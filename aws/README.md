# AWS - SvvS Kiosko

Guía paso a paso para desplegar la infraestructura de distribución y autenticación del kiosko.

---

## Requisitos previos

1. **Cuenta AWS** creada con un correo dedicado al proyecto.
2. **AWS CLI** instalado y configurado:
   ```powershell
   # Instalar AWS CLI (descarga desde https://aws.amazon.com/cli/)
   # Configurar credenciales:
   aws configure
   # Te pedirá:
   #   AWS Access Key ID: (de tu usuario IAM)
   #   AWS Secret Access Key: (de tu usuario IAM)
   #   Default region: eu-west-1
   #   Output format: json
   ```
3. **Usuario IAM** con los permisos necesarios (ver sección "Permisos IAM" más abajo).
4. Copiar `aws/.env.example` a `aws/.env` y rellenar con tus valores.

---

## Permisos IAM necesarios

### Opción A: Política administrador (rápido para empezar)

```
arn:aws:iam::aws:policy/AdministratorAccess
```

### Opción B: Política personalizada (mínimos privilegios)

Crea una política IAM con permisos para: CloudFormation, S3, CloudFront, ACM, Cognito, DynamoDB, Lambda, API Gateway, IAM (crear roles).

Necesitarás añadir estos permisos adicionales respecto a la versión básica:

```json
{
  "Sid": "CognitoManagement",
  "Effect": "Allow",
  "Action": [
    "cognito-idp:CreateUserPool",
    "cognito-idp:DeleteUserPool",
    "cognito-idp:CreateUserPoolClient",
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminSetUserPassword",
    "cognito-idp:AdminGetUser"
  ],
  "Resource": "*"
},
{
  "Sid": "DynamoDBManagement",
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DeleteTable",
    "dynamodb:DescribeTable",
    "dynamodb:PutItem",
    "dynamodb:GetItem"
  ],
  "Resource": "*"
},
{
  "Sid": "LambdaManagement",
  "Effect": "Allow",
  "Action": [
    "lambda:CreateFunction",
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "lambda:DeleteFunction",
    "lambda:GetFunction",
    "lambda:AddPermission",
    "lambda:RemovePermission"
  ],
  "Resource": "*"
},
{
  "Sid": "APIGatewayManagement",
  "Effect": "Allow",
  "Action": [
    "apigateway:*"
  ],
  "Resource": "*"
},
{
  "Sid": "IAMRoles",
  "Effect": "Allow",
  "Action": [
    "iam:CreateRole",
    "iam:DeleteRole",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:GetRole",
    "iam:PassRole"
  ],
  "Resource": "arn:aws:iam::*:role/svvs-kiosko-*"
}
```

---

## Paso 1: Desplegar la infraestructura

El template de CloudFormation crea:
- 3 Buckets S3 (web + releases + stamps)
- Distribución CloudFront con HTTPS
- Cognito User Pool (autenticación)
- DynamoDB tabla `users` (datos por usuario)
- DynamoDB tabla `stamp-catalog` (catálogo de sellos por usuario)
- API Gateway + 3 Lambdas (login + download + sync-stamps)

```powershell
aws cloudformation deploy `
  --template-file aws/infra/template.yml `
  --stack-name svvs-kiosko-infra `
  --region eu-west-1 `
  --capabilities CAPABILITY_NAMED_IAM
```

Espera 5-10 minutos. Luego obtén los outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name svvs-kiosko-infra `
  --query "Stacks[0].Outputs" `
  --output json
```

Copia los valores a tu `aws/.env`:
```env
S3_BUCKET_WEB=svvs-kiosko-web
S3_BUCKET_RELEASES=svvs-kiosko-releases
CLOUDFRONT_DISTRIBUTION_ID=E2J36X9R6JCRRE
CLOUDFRONT_DOMAIN=d1m7hj56bdybto.cloudfront.net
USER_POOL_ID=eu-west-1_XXXXXXXXX
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
USERS_TABLE=svvs-kiosko-users
API_GATEWAY_URL=https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod
```

---

## Paso 2: Crear usuarios iniciales

Tras desplegar la infraestructura, ejecuta el script para crear los usuarios en Cognito y DynamoDB:

```powershell
.\aws\scripts\setup-users.ps1
```

Esto crea:

| Usuario | Contraseña | Mensaje de bienvenida |
|---------|-----------|----------------------|
| admin.svvs | Sv#vjc!vS.2026 | Bienvenido VJC |
| test | test_123 | Bienvenido Test |

---

## Paso 3: Desplegar las Lambdas

Las Lambdas se crean con placeholder code en el template. Para actualizar con el código real:

```powershell
# Lambda de login
cd aws\lambdas\login
npm install
Compress-Archive -Path * -DestinationPath ..\login.zip -Force
cd ..\..\..
aws lambda update-function-code `
  --function-name svvs-kiosko-login `
  --zip-file fileb://aws/lambdas/login.zip `
  --region eu-west-1

# Lambda de download
cd aws\lambdas\download
npm install
Compress-Archive -Path * -DestinationPath ..\download.zip -Force
cd ..\..\..
aws lambda update-function-code `
  --function-name svvs-kiosko-download `
  --zip-file fileb://aws/lambdas/download.zip `
  --region eu-west-1
```

---

## Paso 4: Subir la web

```powershell
.\aws\scripts\deploy-web.ps1 -Invalidate
```

La web estará en: `https://<CLOUDFRONT_DOMAIN>/`

---

## Paso 5: Subir un release (.exe)

```powershell
npm run build:win
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"
```

---

## Flujo completo del usuario

```
1. Usuario abre https://<CLOUDFRONT_DOMAIN>/
2. Ve formulario de login → introduce usuario/contraseña
3. POST /api/login → Cognito valida → devuelve token + datos
4. Se muestra "Bienvenido VJC" + botón de descarga
5. Pulsa descargar → GET /api/download con token
6. Lambda genera config.json + presigned URL del .exe
7. Se descargan ambos archivos:
   - svvs-app.exe (instalador)
   - config.json (configuración personal)
8. Usuario instala → copia config.json junto al .exe
9. Al abrir la app → lee config.json → muestra "Bienvenido VJC"
```

---

## Estructura de archivos

```
aws/
├── .env                          ← Credenciales y config (NO va a git)
├── .env.example                  ← Plantilla de referencia
├── README.md                     ← Esta guía
├── infra/
│   └── template.yml              ← CloudFormation (toda la infraestructura)
├── lambdas/
│   ├── login/
│   │   ├── index.js              ← Lambda: autenticación con Cognito
│   │   └── package.json
│   ├── download/
│   │   ├── index.js              ← Lambda: genera config + presigned URL
│   │   └── package.json
│   └── sync-stamps/
│       ├── index.js              ← Lambda: sincronización de sellos (scan S3 + DynamoDB)
│       └── package.json
├── scripts/
│   ├── deploy-web.ps1            ← Sube la web a S3
│   ├── upload-release.ps1        ← Sube un .exe nuevo
│   ├── upload-stamps.ps1         ← Sube imágenes de sellos al bucket de un usuario
│   └── setup-users.ps1           ← Crea usuarios en Cognito + DynamoDB
└── web/
    ├── index.html                ← Página con login + descarga
    ├── styles.css                ← Estilos
    └── app.js                    ← Lógica de login y descarga

Electron (cambios en la app):
├── config.json                   ← Config por usuario (NO va a git)
├── src/main/user-config/
│   └── index.ts                  ← Lee config.json al arrancar
├── src/main/ipc/
│   └── user-config.handlers.ts   ← IPC handler para el renderer
└── src/renderer/src/views/
    └── HomeView.tsx              ← Muestra welcomeMessage
```

---

## Costes estimados

| Servicio | Uso | Coste/mes (sin free tier) |
|----------|-----|--------------------------|
| S3 | Web + releases + stamps | < 1€ |
| CloudFront | CDN + HTTPS | < 1€ |
| Cognito | Autenticación | < 0.30€ (50 usuarios) |
| DynamoDB | Datos usuarios + stamp-catalog | < 0.02€ |
| Lambda | Login + download + sync-stamps | < 0.01€ |
| API Gateway | 3 endpoints | < 0.01€ |
| **Total** | | **~1-2€/mes** |

---

## Troubleshooting

### "Access Denied" al acceder a la web
- Verifica que el stack se desplegó: `aws cloudformation describe-stacks --stack-name svvs-kiosko-infra`
- Comprueba que subiste los archivos con `deploy-web.ps1`.

### La web no se actualiza tras deploy
- Usa `.\aws\scripts\deploy-web.ps1 -Invalidate` para forzar refresco.

### Login falla con "Usuario o contraseña incorrectos"
- Verifica que ejecutaste `setup-users.ps1` correctamente.
- Comprueba en Cognito que el usuario existe y está confirmado.

### La app no muestra el mensaje de bienvenida
- Verifica que `config.json` está junto al ejecutable (en la carpeta de instalación).
- En modo dev, debe estar en la raíz del proyecto.

### Error al desplegar Lambdas
- Asegúrate de ejecutar `npm install` dentro de cada carpeta de lambda antes de comprimir.
- El zip debe contener los archivos en la raíz (no dentro de una subcarpeta).

---

## Procedimiento: Dar de alta sellos a un usuario

Guía operativa para añadir, verificar y eliminar sellos de un usuario en el bucket S3.

### 1. Preparar las imágenes

Cada sello requiere exactamente dos archivos con el nombre del sello como prefijo:

| Archivo | Formato | Tamaño recomendado | Ejemplo |
|---------|---------|--------------------|---------| 
| `{nombre-sello}-fondo.jpg` | JPG | ~200-500 KB | `Boston 2026-fondo.jpg` |
| `{nombre-sello}-sello.png` | PNG | ~50-200 KB | `Boston 2026-sello.png` |

> **Importante:** El nombre del archivo debe coincidir con el nombre de la carpeta en S3.

### 2. Subir al bucket S3

#### Opción A: Usando el script `upload-stamps.ps1`

```powershell
# Archivos individuales
.\aws\scripts\upload-stamps.ps1 -Username "admin.svvs" -Year "2026" -StampName "Boston 2026" `
  -FondoPath ".\images\Boston 2026-fondo.jpg" `
  -LogoPath ".\images\Boston 2026-sello.png"

# Desde una carpeta (modo bulk)
.\aws\scripts\upload-stamps.ps1 -Username "admin.svvs" -Year "2026" -StampName "Boston 2026" `
  -BulkFolder ".\bbdd-ferias\2026\Boston 2026"
```

#### Opción B: Manualmente con AWS CLI

```powershell
aws s3 cp ".\Boston 2026-fondo.jpg" "s3://svvs-kiosko-stamps/admin.svvs/2026/Boston 2026/Boston 2026-fondo.jpg" --region eu-west-1
aws s3 cp ".\Boston 2026-sello.png" "s3://svvs-kiosko-stamps/admin.svvs/2026/Boston 2026/Boston 2026-sello.png" --region eu-west-1
```

### 3. Verificar la estructura

Listar el contenido del bucket para confirmar que los archivos están correctos:

```powershell
aws s3 ls "s3://svvs-kiosko-stamps/admin.svvs/" --recursive --region eu-west-1
```

Deberías ver algo como:
```
2026/Boston 2026/Boston 2026-fondo.jpg
2026/Boston 2026/Boston 2026-sello.png
2026/Diwali 2026/Diwali 2026-fondo.jpg
2026/Diwali 2026/Diwali 2026-sello.png
...
```

### 4. Sincronizar desde la app

Una vez subidos los archivos, el usuario debe:

1. Abrir la aplicación en su equipo.
2. Ir a **Configuración** → sección **"Base de datos sellos"**.
3. Pulsar el botón **"Sincronizar con la nube"**.

La app verificará la identidad del usuario, escaneará su carpeta en S3, actualizará el catálogo en DynamoDB y descargará las imágenes nuevas. Al finalizar mostrará un resumen con los sellos añadidos/eliminados.

### 5. Eliminar un sello

Para eliminar un sello, borra la carpeta completa del bucket:

```powershell
aws s3 rm "s3://svvs-kiosko-stamps/admin.svvs/2026/Boston 2026/" --recursive --region eu-west-1
```

Después, el usuario debe sincronizar de nuevo desde la app para que el sello desaparezca de su catálogo local.

### 6. Notas importantes

- **Ambos archivos obligatorios**: El fondo (`.jpg`) y el logo (`.png`) deben estar presentes para que el sello se considere "completo". Si falta alguno, la Lambda lo marcará como `incomplete` y no se descargará.
- **Coincidencia de nombres**: El nombre de la carpeta en S3 debe coincidir con el prefijo del nombre de los archivos. Ejemplo: carpeta `Boston 2026/` contiene `Boston 2026-fondo.jpg` y `Boston 2026-sello.png`.
- **Sincronización manual**: Los cambios en S3 no son instantáneos en la app. El usuario debe pulsar "Sincronizar con la nube" para obtener los cambios.
- **DynamoDB se actualiza automáticamente**: No es necesario tocar la base de datos manualmente. La Lambda de sincronización escanea el bucket y actualiza el catálogo en DynamoDB durante cada sincronización.
- **Estructura por usuario**: Cada usuario tiene su propia carpeta raíz (`{username}/`). Los sellos de un usuario no son visibles para otro.

---

## Fases diferidas

Las siguientes mejoras quedan fuera de la entrega actual:

- **Sincronización automática al arranque**: Actualmente es solo bajo demanda (botón). Se podría añadir una sincronización silenciosa al iniciar la app si hay conexión.
- **S3 Event Notifications**: Para volúmenes grandes, se podría reaccionar a cambios en S3 en tiempo real en lugar de escanear on-demand.
- **Caché de miniaturas**: Generar thumbnails optimizados en lugar de cargar las imágenes completas en la lista.
- **Sincronización selectiva por año**: Permitir al usuario elegir qué años descargar.
- **Versionado de imágenes**: Detectar si una imagen se ha actualizado (no solo alta/baja de carpetas).

---

## Próximos pasos

- [x] **Fase 2:** Sistema de licencias (validar licencia al arrancar, limitar por máquina)
- [x] **Fase 3:** Base de datos por usuario (sync de ferias/sellos desde AWS)
- [ ] **Fase 4:** Panel admin web (gestionar usuarios, licencias, ferias)
- [ ] **Fase 5:** Auto-update con electron-updater apuntando a CloudFront

---

## Dominio personalizado (opcional)

Si quieres usar un dominio como `descargas.tukiosko.com`:

1. Solicita un certificado SSL en ACM (región `us-east-1`):
   ```powershell
   aws acm request-certificate `
     --domain-name descargas.tukiosko.com `
     --validation-method DNS `
     --region us-east-1
   ```
2. Valida el certificado añadiendo el CNAME en tu DNS.
3. Descomenta las líneas de `DomainName` y `AcmCertificateArn` en `template.yml`.
4. Redesplega el stack con los parámetros adicionales.
5. Añade un CNAME: `descargas.tukiosko.com → d1m7hj56bdybto.cloudfront.net`.


# Resumen

## Fase 1: Creación de web
Primero vamos a crear una web para que los usuarios puedan descargar la aplicación.

Para eso vamos a necesitar los servicios:
- Cloudfornt: Para maner un url público
- S3: Para almacenar la web y los release de la app

Primero tenemos que ejecutar este comando para desplegar la infraestructura
``` bash
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1

# Si da error
aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --region eu-west-1 --query "Stacks[0].Outputs" --output json


# Borrar
aws cloudformation delete-stack --stack-name svvs-kiosko-infra --region eu-west-1
```

Cuando todo este bien subimos la web
``` bash
.\aws\scripts\deploy-web.ps1
```
### WEB
La url de la web es: https://d1m7hj56bdybto.cloudfront.net/

## Fase 2: Autenticación
Para la autenticación vamos a convertir la web pública a que tenga un login. Y según el usuario que se autentique personalizar la descarga.

Para ello vamos a utilizar los servicios:
- Cognito User Pool: Autenticar usuarios
- DynamoDB: Configuración por usuarios
- Lambda: Generar el zip personalizado
- API Gateway: Generar los endpoints

Ahora los pasos para desplegarlos son:

``` bash
# Validate
aws cloudformation validate-template --template-body file://aws/infra/template.yml --region eu-west-1

# 1. Redesplegar infraestructura (añade Cognito, DynamoDB, API, Lambdas)
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1 --capabilities CAPABILITY_NAMED_IAM

# 2. Obtener outputs y actualizar .env
aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --query "Stacks[0].Outputs" --output json --no-cli-pager

# 3. Crear usuarios
.\aws\scripts\setup-users.ps1

# 4. Desplegar código de Lambdas (npm install + zip + update)
cd aws\lambdas\activate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\login\*" -DestinationPath "aws\lambdas\login.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-login --zip-file fileb://aws/lambdas/login.zip --region eu-west-1 --no-cli-pager

cd aws\lambdas\activate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\download\*" -DestinationPath "aws\lambdas\download.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-download --zip-file fileb://aws/lambdas/download.zip --region eu-west-1 --no-cli-pager

cd aws\lambdas\activate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\activate\*" -DestinationPath "aws\lambdas\activate.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-activate --zip-file fileb://aws/lambdas/activate.zip --region eu-west-1 --no-cli-pager

cd aws\lambdas\deactivate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\deactivate\*" -DestinationPath "aws\lambdas\deactivate.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-deactivate --zip-file fileb://aws/lambdas/deactivate.zip --region eu-west-1 --no-cli-pager

Compress-Archive -Path "aws\lambdas\download\*" -DestinationPath "aws\lambdas\download.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-download --zip-file fileb://aws/lambdas/download.zip --region eu-west-1 --no-cli-pager

# 5. Subir la web actualizada
.\aws\scripts\deploy-web.ps1 -Invalidate

# 6. Subir el .exe
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"
```

## Fase 3: Licencias
Para esta fase definimos las licencias:
- Generalmente 1 ordenadro por usuario
- Si el usuario compra otra licencia se le amplia a un ordenador más
- Admin puede instalarse en cualquier equipo

Esta información se guarda en la tabla DynamoDB a traves de maxMachines donde se registra el machineID que es un hash único del hardware del PC ligado a la placa base.

Este sistema funciona:
1. Primer arranque: Con internet, lee config,json, generar el machineID del PC y llama al POST para activar la licencia y lo guarda en %APPDATA%\stamp-sales-app\.license-ticket
2. Arranques siguientes: Lo valida con internet o sino localiza el fichero guardado en %APPDATA% y comprueba el ticket existente y la machineID
3. Para cambiar de PC en el settings podemos desactivar equipo

Por útlimo para que el usuario no edite el archivo .license-ticket vamos a implementar un enfoque HMAC.

En este caso cuando el usuario edite cualqueir byte del ticket la firma deja de coincidir y el ticket se invalida automaticamente

Para implementar esta parte necesitamos ejecutar:

``` bash
# Infra
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1 --capabilities CAPABILITY_NAMED_IAM

# Actualizar DynamoDB
aws dynamodb put-item --table-name svvs-kiosko-users --item file://aws/scripts/admin-item.json --region eu-west-1
aws dynamodb put-item --table-name svvs-kiosko-users --item file://aws/scripts/test-item.json --region eu-west-1
aws dynamodb put-item --table-name svvs-kiosko-users --item file://aws/scripts/vjchome-item.json --region eu-west-1

# Creamos vjc.home en Cognito
aws cognito-idp admin-create-user --user-pool-id eu-west-1_CKDDDarFe --username "vjc.home" --temporary-password "TempPass1!" --message-action SUPPRESS --region eu-west-1 --no-cli-pager
aws cognito-idp admin-set-user-password --user-pool-id eu-west-1_CKDDDarFe --username "vjc.home" --password "vjc_home_123" --permanent --region eu-west-1

# Instalar y subir lambdas
cd aws\lambdas\activate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\activate\*" -DestinationPath "aws\lambdas\activate.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-activate --zip-file fileb://aws/lambdas/activate.zip --region eu-west-1 --no-cli-pager

cd aws\lambdas\deactivate; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\deactivate\*" -DestinationPath "aws\lambdas\deactivate.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-deactivate --zip-file fileb://aws/lambdas/deactivate.zip --region eu-west-1 --no-cli-pager

Compress-Archive -Path "aws\lambdas\download\*" -DestinationPath "aws\lambdas\download.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-download --zip-file fileb://aws/lambdas/download.zip --region eu-west-1 --no-cli-pager

# Build y subir app
npm run build:win
.\aws\scripts\upload-release.ps1 -Version "1.1.0" -ExePath ".\dist\svvs-app.exe"
```

## Fase 4: Base de datos de sellos
La app sincroniza los sellos/fondos/logos desde un bucket S3 en AWS. Cada usuario tiene sus propios sellos organizados por año.

### Bucket S3: `svvs-kiosko-stamps`

Almacena las imágenes de sellos de todos los usuarios. Es un bucket privado con cifrado SSE-S3.

**Estructura de carpetas:**
```
svvs-kiosko-stamps/
├── {username}/
│   ├── {año}/
│   │   ├── {nombre-sello}/
│   │   │   ├── {nombre}-fondo.jpg
│   │   │   └── {nombre}-sello.png
│   │   └── ...
│   └── ...
└── {otro-usuario}/
    └── ...
```

Ejemplo real:
```
svvs-kiosko-stamps/
├── admin.svvs/
│   ├── 2026/
│   │   ├── Boston 2026/
│   │   │   ├── Boston 2026-fondo.jpg
│   │   │   └── Boston 2026-sello.png
│   │   ├── Diwali 2026/
│   │   │   ├── Diwali 2026-fondo.jpg
│   │   │   └── Diwali 2026-sello.png
│   │   └── ...
│   └── ...
```

### DynamoDB: tabla `svvs-kiosko-stamp-catalog`

Catálogo de sellos disponibles por usuario. Se actualiza automáticamente durante la sincronización al escanear el bucket.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `username` (PK) | String | Nombre de usuario |
| `stampId` (SK) | String | `{año}#{nombre-sello}` (ej: `2026#Boston 2026`) |
| `year` | String | Año del sello |
| `stampName` | String | Nombre del sello |
| `fondoKey` | String | Ruta S3 al archivo de fondo |
| `logoKey` | String | Ruta S3 al archivo de logo |
| `status` | String | `complete` / `incomplete` |
| `createdAt` | String | ISO 8601 fecha de alta |
| `updatedAt` | String | ISO 8601 última actualización |

Modo de facturación: **PAY_PER_REQUEST** (bajo demanda).

### Lambda: `svvs-kiosko-sync-stamps`

Endpoint: **POST /api/stamps/sync**

Verifica la identidad del usuario, escanea su carpeta en S3, actualiza el catálogo en DynamoDB y devuelve el catálogo completo con URLs prefirmadas para descargar las imágenes.

**Request body:**
```json
{
  "apiKey": "ak_xxxxxxxxxxxxxxxx",
  "machineId": "abc123def456..."
}
```

**Respuesta exitosa (200):**
```json
{
  "ok": true,
  "catalog": [
    {
      "stampId": "2026#Boston 2026",
      "year": "2026",
      "stampName": "Boston 2026",
      "fondoUrl": "https://svvs-kiosko-stamps.s3.eu-west-1.amazonaws.com/...?X-Amz-...",
      "logoUrl": "https://svvs-kiosko-stamps.s3.eu-west-1.amazonaws.com/...?X-Amz-...",
      "status": "complete"
    }
  ],
  "summary": {
    "total": 15,
    "added": 2,
    "removed": 1
  }
}
```

**Respuesta error autenticación (401):**
```json
{
  "ok": false,
  "error": "AUTH_FAILED",
  "reason": "machineId no registrado para este usuario"
}
```

> Las presigned URLs expiran en **5 minutos**.

### Despliegue de la Lambda sync-stamps

```powershell
# Instalar dependencias
cd aws\lambdas\sync-stamps; npm install; cd ..\..\..

# Empaquetar
Compress-Archive -Path "aws\lambdas\sync-stamps\*" -DestinationPath "aws\lambdas\sync-stamps.zip" -Force

# Subir a AWS
aws lambda update-function-code --function-name svvs-kiosko-sync-stamps --zip-file fileb://aws/lambdas/sync-stamps.zip --region eu-west-1 --no-cli-pager
```

### Flujo de sincronización

```
1. Usuario pulsa "Sincronizar con la nube" en Configuración
2. App envía POST /api/stamps/sync con apiKey + machineId
3. Lambda verifica identidad contra tabla svvs-kiosko-users
4. Si falla → devuelve 401 → app se bloquea y borra datos locales
5. Si OK → Lambda escanea S3 prefix {username}/
6. Lambda compara con DynamoDB: detecta altas y bajas
7. Lambda actualiza DynamoDB y genera presigned URLs
8. Lambda devuelve catálogo completo + resumen de cambios
9. App descarga imágenes nuevas vía presigned URLs
10. App elimina imágenes de sellos borrados
11. App actualiza SQLite local con el catálogo
12. Se muestra resumen al usuario (añadidos/eliminados)
```

### Subir sellos al bucket de un usuario

```powershell
.\aws\scripts\upload-stamps.ps1 -Username "admin.svvs" -SourceFolder ".\bbdd-ferias\2026"

# Ejemplo serpiente
.\aws\scripts\upload-stamps.ps1 -Username "vjc.home" -Year "2026" -StampName "Diwali 2026" `
  -BulkFolder ".\bbdd-ferias\2026\Diwali 2026"

.\aws\scripts\upload-stamps.ps1 -Username "vjc.home" -Year "2026" -StampName "Gibraltar" `
  -BulkFolder ".\bbdd-ferias\2026\Gibraltar"

# Borrar
aws s3 rm "s3://svvs-kiosko-stamps/vjc.home/2026/Boston 2026/" --recursive --region eu-west-1

```

Para subirlo manualmente:

``` bash
s3://svvs-kiosko-stamps/{username}/{año}/{nombre-sello}/{nombre-sello}-fondo.jpg
s3://svvs-kiosko-stamps/{username}/{año}/{nombre-sello}/{nombre-sello}-sello.png

aws s3 cp ".\bbdd-ferias\2026\Boston 2026\Boston 2026-fondo.jpg" "s3://svvs-kiosko-stamps/admin.svvs/2026/Boston 2026/Boston 2026-fondo.jpg" --region eu-west-1
aws s3 cp ".\bbdd-ferias\2026\Boston 2026\Boston 2026-sello.png" "s3://svvs-kiosko-stamps/admin.svvs/2026/Boston 2026/Boston 2026-sello.png" --region eu-west-1

```

## Fase 5: Panel admin web
Una web separada (protegida con Cognito + MFA) para que tú puedas:

Ver usuarios y sus licencias/máquinas activas
Bloquear/desbloquear usuarios
Liberar slots de máquinas
Subir ferias/sellos/logos
Asignar ferias a usuarios
Ver audit log (quién hizo qué, cuándo, desde dónde)

## Fase 6: Auto-update
La app comprueba si hay nueva versión al arrancar y se actualiza automáticamente.

electron-updater apuntando a CloudFront
latest.yml se genera con cada build
El usuario recibe un aviso "Hay actualización disponible" → acepta → se instala
No necesita volver a la web ni descargar manualmente