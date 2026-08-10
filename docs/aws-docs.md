# Sellos
Buena pregunta. Te planteo una arquitectura sencilla y segura para esto:

Arquitectura propuesta

┌─────────────────────┐         HTTPS (pull only)         ┌──────────────────────┐
│   Kiosko (Electron) │  ◄──────────────────────────────  │   AWS (backend)      │
│                     │         GET /sync/ferias           │                      │
│  SQLite local       │                                   │  DynamoDB o RDS      │
│  bbdd-ferias/       │                                   │  S3 (imágenes)       │
│                     │                                   │  API Gateway + Lambda│
└─────────────────────┘                                   └──────────────────────┘
         ▲                                                         ▲
         │ Botón "Actualizar"                                      │
         │ (único punto de entrada)                    Panel admin (web)
                                                       para subir sellos/logos
Componentes AWS
S3 — Almacena las imágenes (fondos y sellos). Bucket privado, acceso solo vía API.
DynamoDB (o RDS/Aurora Serverless) — Tabla con los metadatos de cada feria: nombre, año, rutas de las imágenes en S3, etc.
API Gateway + Lambda — Endpoint REST que expone un GET /ferias que devuelve la lista de ferias con URLs firmadas (presigned URLs) para descargar las imágenes.
Cognito o API Key — Autenticación del kiosko contra el backend.
Flujo de sincronización
El usuario pulsa el botón "Actualizar base de datos" en la app.
La app llama al endpoint GET /ferias?since=<última_sync>.
Lambda consulta DynamoDB, genera presigned URLs de S3 para cada imagen, y devuelve el JSON.
Electron descarga las imágenes y actualiza la SQLite local / carpeta bbdd-ferias.
Se guarda un timestamp de última sincronización en la config local.
Seguridad: que nadie pueda escribir en local salvo el botón
Aquí hay varias capas:

A nivel de app (Electron)
La SQLite se abre en modo read-only para el uso normal de la app. Solo el proceso de sincronización la abre temporalmente en modo escritura.
El IPC del renderer no expone ningún canal de escritura a la base de datos de ferias. Solo un canal sync:start que dispara el flujo completo desde main.
La carpeta bbdd-ferias se marca con permisos de solo lectura a nivel de filesystem (el proceso de sync los desbloquea temporalmente).
A nivel de red
Solo pull, nunca push. El kiosko solo hace GET. No existe endpoint de escritura accesible desde la app.
Las API Keys se rotan periódicamente y se almacenan en safeStorage de Electron (cifrado del sistema operativo).
Se puede añadir un hash/checksum (SHA-256) a cada paquete de datos que devuelve la API, y verificarlo antes de escribir en local.
A nivel de AWS
El bucket S3 es privado; las presigned URLs expiran en minutos.
La Lambda valida que la request venga con la API Key correcta.
Para subir contenido nuevo se usa un panel de administración web separado, protegido con Cognito + MFA, al que solo acceden los administradores.
Pasos para implementarlo
#	Paso	Detalle
1	Crear bucket S3	Privado, versionado, con lifecycle para limpiar versiones antiguas
2	Crear tabla DynamoDB	PK: feriaId, atributos: nombre, año, s3KeyFondo, s3KeySello, checksum
3	Crear Lambda + API Gateway	Endpoint GET con API Key, devuelve metadatos + presigned URLs
4	Panel admin (web)	App simple (React/Vue) con Cognito para subir imágenes y crear registros
5	En Electron: servicio de sync	Módulo en src/main/sync/ que llama a la API, descarga, valida checksums, y escribe
6	Botón en la UI	En la vista de configuración, botón que llama a ipcRenderer.invoke('sync:start')
7	Proteger escritura local	SQLite en read-only por defecto + permisos de filesystem
Costes estimados
Para un volumen bajo (pocos sellos, pocas sincronizaciones):

S3: prácticamente gratis (unos céntimos/mes)
DynamoDB on-demand: gratis dentro del free tier
Lambda + API Gateway: free tier cubre fácilmente este uso
Total: < 1€/mes para un uso típico de kiosko
¿Quieres que profundice en alguna parte? Por ejemplo, puedo:

Diseñar el esquema de DynamoDB
Crear el módulo de sincronización en Electron
Preparar el template de infraestructura (SAM/CloudFormation)
Diseñar el panel de administración
Dime por dónde prefieres empezar.

# Distribución
Perfecto, vamos a plantearlo paso a paso. Te lo estructuro en los 3 pilares que necesitas resolver:

1. Distribución: descarga inicial

┌──────────────┐       HTTPS        ┌─────────────────────────┐
│  Usuario     │  ──────────────►   │  S3 + CloudFront (CDN)  │
│  (navegador) │   descarga .exe    │  kiosko-releases/       │
└──────────────┘                    │    v6.0.0/              │
                                    │      kiosko-setup.exe   │
                                    │    v6.1.0/              │
                                    │      kiosko-setup.exe   │
                                    │    latest.yml           │
                                    └─────────────────────────┘
Cómo funciona:

Subes cada release (el .exe que genera electron-builder) a un bucket S3 detrás de CloudFront.
Tienes una URL pública tipo https://descargas.tukiosko.com/latest/kiosko-setup.exe.
Todos los usuarios descargan el mismo instalador. La app es idéntica para todos.
Los datos propios de cada usuario se obtienen después de activar la licencia (paso 3).
¿Por qué CloudFront?

Caché global → descargas rápidas.
HTTPS gratis con certificado ACM.
Puedes restringir acceso por país si quisieras.
2. Auto-update: actualizaciones automáticas
Electron-builder ya tiene soporte nativo para auto-update con el módulo electron-updater. Solo necesitas apuntarlo a tu S3/CloudFront.


┌──────────────────┐                    ┌──────────────────────┐
│  Kiosko app      │   GET latest.yml   │  S3 + CloudFront     │
│  (en ejecución)  │  ───────────────►  │                      │
│                  │                    │  latest.yml           │
│  electron-updater│  ◄───────────────  │  (versión + checksum) │
│                  │                    │                      │
│  si hay nueva    │   GET .exe         │  kiosko-setup-6.1.exe│
│  versión →       │  ───────────────►  │                      │
│  descarga + pide │                    └──────────────────────┘
│  reiniciar       │
└──────────────────┘
Flujo:

Al abrir la app (o cada X horas), electron-updater consulta latest.yml en tu CDN.
Si la versión remota > local, descarga el nuevo instalador en segundo plano.
Cuando termina, muestra un aviso: "Hay una actualización disponible. ¿Reiniciar ahora?"
El usuario acepta → se instala y reinicia. Datos locales intactos.
Configuración en electron-builder.yml:

yaml

publish:
  provider: s3
  bucket: kiosko-releases
  region: eu-west-1
  acl: private
O si usas CloudFront con URL genérica:

yaml

publish:
  provider: generic
  url: https://descargas.tukiosko.com/releases
Clave: el latest.yml se genera automáticamente con cada build. Solo tienes que subir los artefactos a S3.

3. Licencias: 1 licencia = 1 máquina, datos compartidos
Este es el pilar más complejo. Aquí va el modelo:


┌───────────────┐                         ┌──────────────────────────────┐
│  Kiosko app   │                         │  AWS Backend                 │
│               │   POST /activate        │                              │
│  1er arranque │  ────────────────────►  │  API Gateway + Lambda        │
│  pide clave   │  { licenseKey,          │         │                    │
│  de licencia  │    machineId }          │         ▼                    │
│               │                         │  DynamoDB: licenses          │
│               │  ◄────────────────────  │  ┌─────────────────────┐    │
│  recibe token │   { ok, userData,       │  │ PK: licenseKey       │    │
│  + datos      │     token }             │  │ machines: [id1, id2] │    │
│               │                         │  │ maxMachines: 1       │    │
└───────────────┘                         │  │ userId: "usr_abc"    │    │
                                          │  └─────────────────────┘    │
                                          │                              │
                                          │  DynamoDB: users             │
                                          │  ┌─────────────────────┐    │
                                          │  │ PK: userId           │    │
                                          │  │ ferias: [...]        │    │
                                          │  │ config: {...}        │    │
                                          │  └─────────────────────┘    │
                                          └──────────────────────────────┘
Modelo de datos
Tabla licenses:

Campo	Ejemplo
licenseKey (PK)	KIOSKO-XXXX-YYYY-ZZZZ
userId	usr_abc123
maxMachines	1 (o 2 si pagó extra)
activeMachines	["machine_hash_1"]
createdAt	timestamp
expiresAt	timestamp (si quieres suscripción)
Tabla users:

Campo	Ejemplo
userId (PK)	usr_abc123
name	"Filatelia García"
ferias	lista de ferias asignadas
config	configuración personalizada
¿Qué es el machineId?
Un hash único por ordenador. En Electron puedes generarlo combinando:

ts

import { machineIdSync } from 'node-machine-id'

const id = machineIdSync({ original: true }) // UUID único del SO
Esto asegura que una licencia no se puede usar en más máquinas de las permitidas.

Flujo de activación
Primer arranque → La app muestra pantalla de "Introduce tu clave de licencia".
El usuario pega su clave → La app envía POST /activate con { licenseKey, machineId }.
Lambda valida:
¿Existe la licencia? ¿No ha expirado?
¿activeMachines.length < maxMachines?
Si sí → añade el machineId al array, devuelve token JWT + datos del usuario.
Si no → error "Licencia ya activada en el máximo de equipos".
La app guarda el token en safeStorage (cifrado del SO).
En cada arranque la app valida el token contra el backend (o al menos cada X horas).
Caso: usuario paga segunda licencia
Desde tu panel admin, cambias maxMachines de 1 a 2 en su registro de licencia.
El usuario instala en el 2º PC, introduce la misma clave → activa sin problema.
Ambas máquinas sincronizan los mismos datos porque comparten el mismo userId.
Caso: usuario cambia de ordenador
Necesitas un endpoint POST /deactivate o un mecanismo de "heartbeat".
Si una máquina no se conecta en X días, se desactiva automáticamente y libera el slot.
O el usuario lo hace manualmente desde un portal web.
Resumen de servicios AWS necesarios
Servicio	Uso	Coste estimado
S3	Almacén de releases + imágenes de ferias	< 1€/mes
CloudFront	CDN para descargas rápidas	< 1€/mes (poco tráfico)
API Gateway	Endpoints REST (activate, sync, etc.)	Free tier
Lambda	Lógica de negocio	Free tier
DynamoDB	Licencias, usuarios, ferias	Free tier (on-demand)
Cognito	(Opcional) Auth del panel admin	Free tier
ACM	Certificado SSL para tu dominio	Gratis
Total para empezar: < 5€/mes con un número moderado de usuarios.

Diagrama completo del flujo

DISTRIBUCIÓN          LICENCIA              DATOS/SELLOS         UPDATES
─────────────         ────────              ────────────         ───────

CDN ──► descarga      1er arranque          Botón "Sync"        Auto-check
   .exe               pide clave            ───────────         ──────────
                      ──────────
                           │                GET /ferias          GET latest.yml
                           ▼                     │                    │
                      POST /activate             ▼                    ▼
                           │              Descarga imgs         ¿Nueva versión?
                           ▼              Actualiza SQLite           │
                      Validar licencia                               ▼
                      Devolver datos                            Descarga + instala
                      Guardar token