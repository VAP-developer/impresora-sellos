# Documento de Requisitos

## Introducción

Esta funcionalidad define la infraestructura de distribución, actualización, licenciamiento y control de acceso de la aplicación de escritorio de venta de sellos (Electron + SQLite), apoyada en servicios de AWS.

Los objetivos son cinco:

1. **Distribuir** los instaladores y las actualizaciones desde AWS, de forma controlada y verificable.
2. **Preservar el funcionamiento offline**: la aplicación debe vender, imprimir y registrar sin red. La red solo se necesita para traer actualizaciones, licencias y contenido.
3. **Licenciar por máquina** para impedir que el instalador se descargue sin autorización y que una instalación se copie a otro equipo.
4. **Diferenciar permisos por usuario**: un rol propietario/administrador que sube sellos y cambia la configuración del ticket, frente a roles operadores con ajustes restringidos.
5. **Personalizar por cliente sin bifurcar el producto**: se compila un instalador único y cada equipo obtiene su logotipo, sus datos fiscales, sus sellos y sus parámetros de ticket a partir de la identidad de cliente que trae su licencia.

### Alcance de esta entrega

Esta especificación es **documental**. La entrega consiste en el Documento_Arquitectura en `docs/` y no modifica el comportamiento actual de la aplicación: no se añaden pantallas de activación, ni comprobaciones de licencia, ni dependencias de red al código existente, que sigue en desarrollo funcional y visual.

Los requisitos describen el sistema objetivo para que la implementación pueda abordarse más adelante por fases, sin rehacer el análisis. Cada requisito indica *qué* debe cumplir el sistema cuando se construya; el plan de tareas de esta especificación se limita a producir la documentación que lo describe.

### Dimensionamiento previsto

- Entre 4 y 50 clientes finales.
- Entre 1 y 3 equipos por cliente, es decir hasta unos 150 Equipo_Autorizado.
- **Una Licencia por equipo**: cada equipo del cliente se factura de forma independiente, por lo que una Clave_Licencia admite una sola Activacion_Licencia simultánea.

### Convención de redacción (patrones EARS en español)

Cada criterio de aceptación sigue exactamente uno de los seis patrones EARS. Se usan las palabras clave en español con esta correspondencia:

| EARS | Español | Uso |
| --- | --- | --- |
| Ubiquitous | `EL <sistema> DEBERÁ <respuesta>` | Siempre aplica |
| Event-driven | `CUANDO <disparador>, EL <sistema> DEBERÁ <respuesta>` | Disparado por un evento |
| State-driven | `MIENTRAS <condición>, EL <sistema> DEBERÁ <respuesta>` | Aplica durante un estado |
| Unwanted event | `SI <condición>, ENTONCES EL <sistema> DEBERÁ <respuesta>` | Errores y casos no deseados |
| Optional feature | `DONDE <opción>, EL <sistema> DEBERÁ <respuesta>` | Funcionalidad opcional o configurable |
| Complex | `DONDE … MIENTRAS … CUANDO/SI … EL <sistema> DEBERÁ …` | Varias condiciones combinadas |

## Glosario

- **Cliente_Escritorio**: La aplicación Electron instalada en el equipo del usuario final, incluyendo su base de datos SQLite local.
- **Equipo_Autorizado**: Un equipo físico concreto sobre el que existe una Activacion_Licencia válida.
- **Huella_Hardware**: Cadena derivada de identificadores estables del equipo (número de serie de la placa o disco del sistema, UUID de máquina del sistema operativo y dirección MAC de la interfaz de red principal) mediante una función hash SHA-256, usada para vincular una licencia a un Equipo_Autorizado.
- **Licencia**: Registro emitido por el Servicio_Licencias que autoriza a un Cliente_Escritorio concreto a ejecutarse, con un estado (`activa`, `suspendida`, `revocada`, `expirada`), una fecha de expiración y un conjunto de derechos.
- **Clave_Licencia**: Cadena alfanumérica de 25 caracteres entregada al cliente final, que identifica una Licencia antes de su activación.
- **Activacion_Licencia**: Vínculo persistido entre una Licencia y una Huella_Hardware concreta.
- **Token_Licencia**: Documento firmado digitalmente (JWT con firma asimétrica) que el Servicio_Licencias emite tras una activación o validación correcta, y que el Cliente_Escritorio almacena localmente para verificar su estado sin red.
- **Analizador_Token**: Componente del Cliente_Escritorio que verifica la firma de un Token_Licencia y lo convierte en un objeto de estado de licencia.
- **Serializador_Token**: Componente que convierte un objeto de estado de licencia en su representación textual de Token_Licencia.
- **Servicio_Licencias**: Servicio alojado en AWS que emite, valida, activa, desactiva y revoca Licencias.
- **Periodo_Gracia_Offline**: Intervalo máximo, expresado en días, durante el cual el Cliente_Escritorio opera con normalidad sin haber podido revalidar su Token_Licencia contra el Servicio_Licencias.
- **Portal_Descargas**: Punto de entrada en AWS desde el que se obtienen los instaladores, protegido mediante enlaces de descarga temporales.
- **Enlace_Temporal**: URL firmada con caducidad que autoriza la descarga de un artefacto concreto durante un tiempo limitado.
- **Artefacto_Instalador**: Fichero ejecutable de instalación generado por electron-builder (por ejemplo `StampSales-Setup-<version>.exe`), junto con su fichero de metadatos de actualización y su suma de verificación.
- **Canal_Liberacion**: Etiqueta que agrupa versiones destinadas a un mismo conjunto de equipos (`estable`, `beta`, `piloto`).
- **Manifiesto_Actualizacion**: Documento consumido por el Actualizador_Cliente que describe la versión disponible en un Canal_Liberacion, su ruta de descarga y su suma de verificación.
- **Actualizador_Cliente**: Componente del Cliente_Escritorio basado en electron-updater que consulta el Manifiesto_Actualizacion, descarga e instala nuevas versiones.
- **Version_Fijada**: Versión máxima que un Equipo_Autorizado concreto tiene permitido instalar, usada para congelar equipos durante campañas de venta.
- **Paquete_Contenido**: Conjunto versionado de imágenes de sellos y fondos, con su índice de metadatos, publicado en AWS para un cliente concreto.
- **Configuracion_Remota**: Conjunto versionado de parámetros de la aplicación por cliente (configuración del ticket, grupos de tarifas, textos e identificación del kiosko) publicado en AWS.
- **Identidad_Cliente**: Identificador único del cliente final, contenido en el Token_Licencia, que determina qué Paquete_Marca, Paquete_Contenido y Configuracion_Remota corresponden a un Equipo_Autorizado.
- **Paquete_Marca**: Conjunto versionado de recursos de identidad visual de un cliente (logotipo del ticket, logotipo de la etiqueta, nombre comercial, datos fiscales y textos de cabecera y pie del ticket) publicado en AWS.
- **Instalador_Neutro**: Artefacto_Instalador único, idéntico para todos los clientes, que no contiene recursos ni parámetros de ningún cliente concreto.
- **Sincronizador_Remoto**: Componente del Cliente_Escritorio que descarga Paquete_Marca, Paquete_Contenido y Configuracion_Remota y los aplica a la base de datos SQLite local.
- **Rol_Propietario**: Rol con permiso para subir sellos, editar la Configuracion_Remota y el Paquete_Marca, gestionar tarifas y administrar activaciones de licencia.
- **Rol_Operador**: Rol limitado a las operaciones de venta, impresión, consulta de pedidos y ajustes de impresora.
- **Perfil_Permisos**: Documento firmado que asocia identidades de usuario locales a un Rol_Propietario o Rol_Operador y a la lista de acciones permitidas.
- **Guardia_Permisos**: Componente del proceso principal de Electron que autoriza o deniega cada operación IPC sensible según el Perfil_Permisos vigente.
- **Registro_Auditoria**: Registro local, y replicado en AWS cuando hay red, de las acciones sensibles ejecutadas en el Cliente_Escritorio.
- **Cadena_Compilacion**: Proceso automatizado que compila, firma y publica los Artefacto_Instalador en AWS.
- **Documento_Arquitectura**: Documento en español, ubicado en `docs/`, que describe para personas la arquitectura de distribución resultante.

## Requisitos

### Requisito 1: Publicación de instaladores en AWS

**Historia de usuario:** Como responsable del producto, quiero publicar los instaladores en AWS, para poder entregar la aplicación a cada cliente sin usar memorias USB ni envíos manuales.

#### Criterios de aceptación

1. CUANDO la Cadena_Compilacion finaliza una compilación correcta, ENTONCES LA Cadena_Compilacion DEBERÁ publicar el Artefacto_Instalador, su Manifiesto_Actualizacion y su suma de verificación SHA-256 en el Portal_Descargas.
2. EL Portal_Descargas DEBERÁ almacenar los Artefacto_Instalador cifrados en reposo.
3. EL Portal_Descargas DEBERÁ separar los artefactos por Canal_Liberacion, de forma que una versión publicada en el canal `beta` quede fuera del alcance de los equipos suscritos al canal `estable`.
4. EL Portal_Descargas DEBERÁ conservar como mínimo las tres versiones anteriores de cada Canal_Liberacion disponibles para descarga.
5. CUANDO la Cadena_Compilacion publica una versión, ENTONCES LA Cadena_Compilacion DEBERÁ registrar en el Registro_Auditoria la versión, el Canal_Liberacion, la suma de verificación y la fecha de publicación.
6. SI la suma de verificación calculada de un Artefacto_Instalador publicado difiere de la registrada en su Manifiesto_Actualizacion, ENTONCES LA Cadena_Compilacion DEBERÁ marcar la publicación como fallida y conservar la versión anterior como versión vigente del Canal_Liberacion.

### Requisito 2: Descarga de instaladores restringida a clientes con licencia

**Historia de usuario:** Como responsable del producto, quiero que solo quien tenga una licencia válida pueda descargar el instalador, para evitar que la aplicación se difunda a equipos no autorizados.

#### Criterios de aceptación

1. EL Portal_Descargas DEBERÁ entregar los Artefacto_Instalador exclusivamente a través de un Enlace_Temporal.
2. CUANDO se presenta una Clave_Licencia en estado `activa` al Servicio_Licencias solicitando una descarga, ENTONCES EL Servicio_Licencias DEBERÁ emitir un Enlace_Temporal con una caducidad de 15 minutos.
3. SI se presenta una Clave_Licencia en estado `revocada`, `suspendida` o `expirada`, ENTONCES EL Servicio_Licencias DEBERÁ denegar la emisión del Enlace_Temporal y devolver un código de error que identifique el estado de la Licencia.
4. SI se solicita un Artefacto_Instalador sin un Enlace_Temporal vigente, ENTONCES EL Portal_Descargas DEBERÁ denegar la petición con un código de estado 403.
5. CUANDO el Servicio_Licencias emite un Enlace_Temporal, ENTONCES EL Servicio_Licencias DEBERÁ registrar en el Registro_Auditoria la Clave_Licencia, la versión solicitada y la fecha de emisión.
6. EL Servicio_Licencias DEBERÁ limitar a 5 el número de Enlace_Temporal emitidos por Clave_Licencia y por periodo de 24 horas.
7. SI una Clave_Licencia alcanza el límite de 5 Enlace_Temporal en 24 horas, ENTONCES EL Servicio_Licencias DEBERÁ denegar nuevas emisiones y registrar el intento en el Registro_Auditoria.

### Requisito 3: Integridad y autenticidad del instalador

**Historia de usuario:** Como cliente final, quiero comprobar que el instalador que descargo es el original, para no instalar una versión manipulada.

> **Nota de alcance**: la firma de código exige un certificado emitido por una autoridad reconocida, que a fecha de hoy no está contratado. Los criterios 1 y 5 distinguen la verificación por suma de verificación, disponible desde el primer día, de la firma digital, que se incorpora cuando exista certificado.

#### Criterios de aceptación

1. CUANDO el Actualizador_Cliente descarga un Artefacto_Instalador, ENTONCES EL Actualizador_Cliente DEBERÁ comparar la suma de verificación SHA-256 del fichero descargado con la declarada en el Manifiesto_Actualizacion.
2. SI la suma de verificación del fichero descargado difiere de la declarada, ENTONCES EL Actualizador_Cliente DEBERÁ descartar el fichero descargado, conservar la versión instalada y registrar el fallo en el Registro_Auditoria.
3. EL Manifiesto_Actualizacion DEBERÁ estar firmado con la clave privada del Servicio_Licencias, y EL Actualizador_Cliente DEBERÁ verificar esa firma antes de aceptar la versión declarada.
4. SI la firma del Manifiesto_Actualizacion no es válida, ENTONCES EL Actualizador_Cliente DEBERÁ descartar el manifiesto y conservar la versión instalada.
5. DONDE la organización dispone de un certificado de firma de código, LA Cadena_Compilacion DEBERÁ firmar digitalmente cada Artefacto_Instalador para Windows con ese certificado.
6. DONDE los Artefacto_Instalador están firmados digitalmente, EL Actualizador_Cliente DEBERÁ cancelar la instalación y conservar la versión instalada SI la firma digital del artefacto descargado no es válida.
7. MIENTRAS los Artefacto_Instalador se distribuyen sin firma digital, EL Documento_Arquitectura DEBERÁ describir el procedimiento manual de verificación de la suma de verificación y el aviso de SmartScreen que verá la persona que instale.
8. EL Actualizador_Cliente DEBERÁ usar una versión de electron-updater igual o superior a 6.3.0, que corrige la elusión de verificación de firma en Windows registrada como CVE-2024-39698.

### Requisito 4: Operación completa sin conexión

**Historia de usuario:** Como operador de kiosko en una feria sin cobertura, quiero vender e imprimir con normalidad, para no depender de la red durante el evento.

#### Criterios de aceptación

1. MIENTRAS el Cliente_Escritorio no dispone de conexión a la red, EL Cliente_Escritorio DEBERÁ permitir registrar ventas, generar documentos de impresión, imprimir y consultar pedidos usando exclusivamente la base de datos SQLite local.
2. CUANDO el Cliente_Escritorio arranca sin conexión a la red, ENTONCES EL Cliente_Escritorio DEBERÁ mostrar la vista principal operativa en un tiempo máximo de 5 segundos.
3. EL Cliente_Escritorio DEBERÁ ejecutar las comprobaciones de red (validación de licencia, búsqueda de actualizaciones y sincronización de contenido) en segundo plano, sin bloquear la interfaz de venta.
4. SI una comprobación de red supera un tiempo de espera de 10 segundos, ENTONCES EL Cliente_Escritorio DEBERÁ abandonar esa comprobación, continuar en modo offline y programar un nuevo intento.
5. EL Cliente_Escritorio DEBERÁ mostrar de forma permanente un indicador del estado de conectividad y de la fecha de la última sincronización correcta.
6. CUANDO el Cliente_Escritorio recupera la conexión a la red, ENTONCES EL Cliente_Escritorio DEBERÁ reintentar de forma automática la validación de licencia y la sincronización de contenido pendientes.

### Requisito 5: Actualización automática con degradación controlada

**Historia de usuario:** Como responsable del producto, quiero que los equipos se actualicen solos cuando tengan red, para no desplazarme a cada kiosko a instalar versiones nuevas.

#### Criterios de aceptación

1. CUANDO el Cliente_Escritorio arranca con conexión a la red, ENTONCES EL Actualizador_Cliente DEBERÁ consultar el Manifiesto_Actualizacion del Canal_Liberacion asignado al Equipo_Autorizado.
2. MIENTRAS el Cliente_Escritorio dispone de conexión a la red, EL Actualizador_Cliente DEBERÁ consultar el Manifiesto_Actualizacion con una periodicidad de 6 horas.
3. CUANDO el Manifiesto_Actualizacion declara una versión superior a la instalada y no superior a la Version_Fijada del Equipo_Autorizado, ENTONCES EL Actualizador_Cliente DEBERÁ descargar el Artefacto_Instalador correspondiente en segundo plano.
4. CUANDO una descarga de actualización finaliza y se verifica correctamente, ENTONCES EL Actualizador_Cliente DEBERÁ solicitar confirmación a la persona que usa el equipo antes de reiniciar la aplicación para instalarla.
5. MIENTRAS existe una venta en curso sin finalizar, EL Actualizador_Cliente DEBERÁ posponer la instalación de la actualización.
6. SI la consulta del Manifiesto_Actualizacion falla, ENTONCES EL Actualizador_Cliente DEBERÁ mantener la versión instalada operativa y programar un nuevo intento en 6 horas.
7. SI una instalación de actualización termina con error, ENTONCES EL Cliente_Escritorio DEBERÁ arrancar con la versión anterior y registrar el error en el Registro_Auditoria.
8. DONDE un Equipo_Autorizado tiene una Version_Fijada configurada, EL Actualizador_Cliente DEBERÁ omitir las versiones superiores a la Version_Fijada.
9. DONDE la administración publica una orden de retorno a una versión anterior para un Canal_Liberacion, EL Actualizador_Cliente DEBERÁ instalar esa versión anterior en el siguiente ciclo de comprobación.

### Requisito 6: Activación de licencia vinculada al equipo

**Historia de usuario:** Como responsable del producto, quiero vincular cada licencia a un equipo concreto, para que una instalación no funcione en otras máquinas.

#### Criterios de aceptación

1. CUANDO el Cliente_Escritorio arranca por primera vez y no encuentra un Token_Licencia local, ENTONCES EL Cliente_Escritorio DEBERÁ solicitar una Clave_Licencia antes de habilitar las operaciones de venta.
2. CUANDO se introduce una Clave_Licencia, ENTONCES EL Cliente_Escritorio DEBERÁ calcular la Huella_Hardware y enviarla junto con la Clave_Licencia al Servicio_Licencias.
3. CUANDO el Servicio_Licencias recibe una Clave_Licencia en estado `activa` sin Activacion_Licencia vigente, ENTONCES EL Servicio_Licencias DEBERÁ crear una Activacion_Licencia y devolver un Token_Licencia firmado con la Huella_Hardware, la fecha de expiración, el Canal_Liberacion, la Identidad_Cliente y los derechos concedidos.
4. EL Servicio_Licencias DEBERÁ admitir una única Activacion_Licencia vigente por Clave_Licencia, de forma que cada equipo de un cliente consuma su propia Licencia facturable.
5. SI una Clave_Licencia ya tiene una Activacion_Licencia vigente con otra Huella_Hardware, ENTONCES EL Servicio_Licencias DEBERÁ denegar la activación y devolver un código de error que identifique el equipo que ocupa la Licencia.
6. CUANDO el Rol_Propietario da de alta un cliente con varios equipos, ENTONCES EL Servicio_Licencias DEBERÁ emitir una Clave_Licencia distinta por equipo, todas asociadas a la misma Identidad_Cliente.
7. CUANDO el Cliente_Escritorio recibe un Token_Licencia válido, ENTONCES EL Cliente_Escritorio DEBERÁ almacenarlo en el almacén de credenciales del sistema operativo y habilitar las operaciones de venta.
8. MIENTRAS no existe un Token_Licencia válido en el equipo, EL Cliente_Escritorio DEBERÁ limitar la interfaz a la pantalla de activación y a la vista de diagnóstico.
9. DONDE un equipo no tiene acceso a la red, EL Cliente_Escritorio DEBERÁ ofrecer una activación manual en la que la persona introduce un Token_Licencia emitido para la Huella_Hardware mostrada en pantalla.
10. DONDE el equipo se entrega al cliente con la aplicación preinstalada, EL Rol_Propietario DEBERÁ completar la activación antes de la entrega, de forma que la primera puesta en marcha del cliente no requiera conexión a la red.

### Requisito 7: Validación periódica y periodo de gracia offline

**Historia de usuario:** Como responsable del producto, quiero revalidar las licencias cuando haya red y conceder un margen offline, para controlar el parque de equipos sin dejar tirado a un kiosko sin cobertura.

#### Criterios de aceptación

1. MIENTRAS el Cliente_Escritorio dispone de conexión a la red, EL Cliente_Escritorio DEBERÁ revalidar el Token_Licencia contra el Servicio_Licencias con una periodicidad de 24 horas.
2. CUANDO una revalidación devuelve el estado `activa`, ENTONCES EL Servicio_Licencias DEBERÁ emitir un Token_Licencia renovado y EL Cliente_Escritorio DEBERÁ sustituir el almacenado.
3. MIENTRAS el tiempo transcurrido desde la última revalidación correcta es inferior o igual al Periodo_Gracia_Offline, EL Cliente_Escritorio DEBERÁ mantener disponibles todas las operaciones de venta.
4. EL Periodo_Gracia_Offline DEBERÁ tener un valor por defecto de 30 días y ser configurable por Licencia entre 1 y 180 días.
5. CUANDO el tiempo transcurrido desde la última revalidación correcta alcanza el 80 % del Periodo_Gracia_Offline, ENTONCES EL Cliente_Escritorio DEBERÁ mostrar un aviso con los días restantes y las instrucciones de reconexión.
6. SI el tiempo transcurrido desde la última revalidación correcta supera el Periodo_Gracia_Offline, ENTONCES EL Cliente_Escritorio DEBERÁ pasar a modo restringido, permitiendo consultar y exportar los pedidos ya registrados e impidiendo registrar ventas nuevas.
7. CUANDO una revalidación devuelve el estado `revocada` o `expirada`, ENTONCES EL Cliente_Escritorio DEBERÁ pasar a modo restringido en la sesión en curso y registrar el motivo en el Registro_Auditoria.
8. SI la fecha del sistema operativo del equipo es anterior a la fecha de emisión del Token_Licencia almacenado, ENTONCES EL Cliente_Escritorio DEBERÁ tratar el Periodo_Gracia_Offline como agotado y solicitar una revalidación en línea.

### Requisito 8: Prevención de copia entre equipos

**Historia de usuario:** Como responsable del producto, quiero que copiar la carpeta de instalación o los datos a otro equipo no produzca una aplicación funcional, para proteger el producto frente a copias no autorizadas.

#### Criterios de aceptación

1. CUANDO el Cliente_Escritorio arranca, ENTONCES EL Cliente_Escritorio DEBERÁ calcular la Huella_Hardware y compararla con la contenida en el Token_Licencia almacenado.
2. SI la Huella_Hardware calculada difiere de la contenida en el Token_Licencia, ENTONCES EL Cliente_Escritorio DEBERÁ pasar a modo restringido y solicitar una activación para el equipo actual.
3. CUANDO el Servicio_Licencias recibe una solicitud de activación con una Huella_Hardware distinta de la de una Activacion_Licencia existente para la misma Clave_Licencia, ENTONCES EL Servicio_Licencias DEBERÁ tratarla como una activación nueva sujeta al máximo contratado.
4. EL Cliente_Escritorio DEBERÁ cifrar el Token_Licencia y el Perfil_Permisos almacenados localmente con una clave derivada de la Huella_Hardware.
5. SI el descifrado del Token_Licencia almacenado falla, ENTONCES EL Cliente_Escritorio DEBERÁ descartar el Token_Licencia y solicitar una activación.
6. EL Cliente_Escritorio DEBERÁ tolerar cambios en un solo componente de la Huella_Hardware, considerando válida la huella cuando coinciden al menos dos de sus tres componentes.
7. CUANDO se detecta un cambio parcial de la Huella_Hardware que sigue considerándose válido, ENTONCES EL Cliente_Escritorio DEBERÁ enviar la huella actualizada al Servicio_Licencias en la siguiente revalidación y registrar el cambio en el Registro_Auditoria.
8. LA Huella_Hardware DEBERÁ almacenarse en AWS únicamente como valor hash, sin los identificadores de hardware en claro.

### Requisito 9: Traspaso, suspensión y revocación de licencias

**Historia de usuario:** Como propietario del negocio, quiero mover una licencia de un equipo averiado a uno nuevo y desactivar equipos perdidos, para gestionar el parque sin depender del soporte.

#### Criterios de aceptación

1. CUANDO el Rol_Propietario solicita la desactivación de una Activacion_Licencia, ENTONCES EL Servicio_Licencias DEBERÁ marcar esa Activacion_Licencia como liberada y devolver el cupo de activación a la Licencia.
2. CUANDO una Activacion_Licencia liberada intenta revalidarse, ENTONCES EL Servicio_Licencias DEBERÁ responder con el estado `revocada`.
3. CUANDO el Rol_Propietario marca una Licencia como `suspendida`, ENTONCES EL Servicio_Licencias DEBERÁ denegar las nuevas activaciones y las emisiones de Enlace_Temporal para esa Licencia.
4. EL Servicio_Licencias DEBERÁ exponer la lista de Activacion_Licencia de un cliente con su identificador de equipo, versión instalada, Canal_Liberacion y fecha de última revalidación.
5. CUANDO el Cliente_Escritorio ejecuta una desinstalación, ENTONCES EL Cliente_Escritorio DEBERÁ intentar liberar su Activacion_Licencia contra el Servicio_Licencias.
6. SI la liberación durante la desinstalación falla, ENTONCES EL Cliente_Escritorio DEBERÁ completar la desinstalación y dejar la Activacion_Licencia pendiente de liberación manual.

### Requisito 10: Roles y permisos diferenciados

**Historia de usuario:** Como propietario del negocio, quiero que solo yo pueda subir sellos y cambiar la configuración del ticket, para que los operadores de feria no alteren parámetros sensibles.

> **Nota de alcance**: la aplicación actual no tiene ningún concepto de usuario ni de contraseña. Este requisito describe el modelo objetivo, con un PIN de propietario como credencial de elevación por su encaje en un kiosko con pantalla táctil y sin teclado cómodo. No se implementa en esta entrega.

#### Criterios de aceptación

1. EL Cliente_Escritorio DEBERÁ asignar a cada sesión de uso exactamente un rol, elegido entre Rol_Propietario y Rol_Operador.
2. EL Rol_Propietario DEBERÁ tener permiso para subir imágenes de sellos, editar la configuración del ticket, editar los grupos de tarifas, gestionar activaciones de licencia y consultar el Registro_Auditoria.
3. EL Rol_Operador DEBERÁ tener permiso para registrar ventas, imprimir, cancelar ventas, consultar y exportar pedidos y asignar impresoras.
4. CUANDO una sesión con Rol_Operador solicita una operación reservada al Rol_Propietario, ENTONCES EL Guardia_Permisos DEBERÁ denegar la operación y devolver un error de permiso insuficiente.
5. EL Guardia_Permisos DEBERÁ autorizar cada operación en el proceso principal de Electron, con independencia de los controles de la interfaz.
6. CUANDO una sesión con Rol_Operador está activa, ENTONCES EL Cliente_Escritorio DEBERÁ ocultar los controles de las operaciones reservadas al Rol_Propietario.
7. EL Cliente_Escritorio DEBERÁ arrancar cada sesión con el Rol_Operador.
8. CUANDO una persona solicita elevar la sesión a Rol_Propietario, ENTONCES EL Cliente_Escritorio DEBERÁ requerir un PIN de propietario de 6 dígitos como mínimo y comparar su derivación con la almacenada en el Perfil_Permisos antes de conceder el rol.
9. EL Cliente_Escritorio DEBERÁ almacenar el PIN de propietario únicamente como derivación mediante una función de derivación de claves con sal, sin conservar el valor en claro.
10. SI se introduce un PIN de propietario incorrecto 5 veces consecutivas, ENTONCES EL Cliente_Escritorio DEBERÁ bloquear los intentos de elevación durante 15 minutos y registrar el bloqueo en el Registro_Auditoria.
11. CUANDO una sesión elevada a Rol_Propietario permanece 15 minutos sin actividad, ENTONCES EL Cliente_Escritorio DEBERÁ devolver la sesión al Rol_Operador.
12. CUANDO el Guardia_Permisos deniega una operación, ENTONCES EL Cliente_Escritorio DEBERÁ registrar en el Registro_Auditoria la operación, el rol de la sesión y la fecha.
13. CUANDO el Rol_Propietario cambia el PIN de propietario, ENTONCES EL Cliente_Escritorio DEBERÁ requerir el PIN vigente antes de aceptar el nuevo valor.

### Requisito 11: Aprovisionamiento de permisos desde AWS y aplicación offline

**Historia de usuario:** Como responsable del producto, quiero definir en AWS qué puede hacer cada cliente y que esa definición se aplique aunque el equipo esté sin red, para no reconfigurar equipos a mano.

#### Criterios de aceptación

1. EL Servicio_Licencias DEBERÁ incluir en el Token_Licencia el Perfil_Permisos vigente del cliente.
2. CUANDO el Cliente_Escritorio recibe un Token_Licencia, ENTONCES EL Cliente_Escritorio DEBERÁ almacenar el Perfil_Permisos incluido y aplicarlo como configuración de permisos vigente.
3. MIENTRAS el Cliente_Escritorio opera sin conexión a la red, EL Guardia_Permisos DEBERÁ aplicar el último Perfil_Permisos almacenado.
4. SI la firma del Perfil_Permisos almacenado no es válida, ENTONCES EL Guardia_Permisos DEBERÁ aplicar los permisos del Rol_Operador hasta obtener un Perfil_Permisos válido.
5. CUANDO el Rol_Propietario modifica el Perfil_Permisos de un cliente en AWS, ENTONCES EL Cliente_Escritorio DEBERÁ aplicar la nueva versión en la siguiente revalidación correcta del Token_Licencia.
6. EL Perfil_Permisos DEBERÁ incluir un número de versión creciente, y EL Cliente_Escritorio DEBERÁ conservar el de versión más alta entre el almacenado y el recibido.

### Requisito 12: Distribución de sellos y configuración por cliente

**Historia de usuario:** Como propietario del negocio, quiero subir los sellos y la configuración una vez en AWS y que los kioskos los reciban, para no copiar carpetas de imágenes en cada equipo.

> **Nota sobre el funcionamiento offline**: AWS actúa como **origen de publicación**, nunca como base de datos de consulta en tiempo de venta. Toda imagen y todo parámetro se copian a la base de datos SQLite local antes de usarse; la venta y la impresión leen exclusivamente de SQLite. Un kiosko sin red trabaja con el último contenido descargado y no pierde funcionalidad. Los criterios 1, 12 y 13 fijan esta separación.

#### Criterios de aceptación

1. EL Cliente_Escritorio DEBERÁ leer las imágenes y los parámetros de venta exclusivamente desde la base de datos SQLite local, con independencia del estado de la conexión a la red.
2. CUANDO el Rol_Propietario publica un Paquete_Contenido, ENTONCES EL Sincronizador_Remoto DEBERÁ descargarlo en la siguiente comprobación de los equipos de esa Identidad_Cliente y escribir su contenido en la base de datos SQLite local.
3. EL Paquete_Contenido DEBERÁ incluir un índice con el nombre, el año, la feria, el tipo (`fondo` o `sello`), el tamaño y la suma de verificación SHA-256 de cada imagen.
4. CUANDO el Sincronizador_Remoto descarga un Paquete_Contenido, ENTONCES EL Sincronizador_Remoto DEBERÁ verificar la suma de verificación de cada imagen antes de escribirla en la base de datos SQLite local.
5. SI la suma de verificación de una imagen descargada no coincide con la declarada en el índice, ENTONCES EL Sincronizador_Remoto DEBERÁ descartar esa imagen, conservar la versión local previa y registrar el fallo en el Registro_Auditoria.
6. EL Sincronizador_Remoto DEBERÁ descargar únicamente las imágenes cuya suma de verificación difiere de la almacenada localmente.
7. CUANDO una descarga de Paquete_Contenido se interrumpe, ENTONCES EL Sincronizador_Remoto DEBERÁ reanudarla desde las imágenes pendientes en el siguiente intento, dejando la base de datos local en un estado consistente.
8. CUANDO el Rol_Propietario publica una Configuracion_Remota, ENTONCES EL Sincronizador_Remoto DEBERÁ aplicarla a la configuración local de los equipos de esa Identidad_Cliente en la siguiente comprobación.
9. LA Configuracion_Remota DEBERÁ incluir un número de versión creciente, y EL Sincronizador_Remoto DEBERÁ aplicar únicamente las versiones superiores a la almacenada localmente.
10. EL Cliente_Escritorio DEBERÁ mantener operativa la carga local de imágenes desde la carpeta `bbdd-ferias`, como alternativa a la sincronización remota.
11. DONDE un parámetro está marcado como local en la Configuracion_Remota, EL Sincronizador_Remoto DEBERÁ conservar el valor definido en el equipo.
12. MIENTRAS el Cliente_Escritorio no dispone de conexión a la red, EL Cliente_Escritorio DEBERÁ operar con el último Paquete_Contenido y la última Configuracion_Remota aplicados en la base de datos SQLite local.
13. SI una sincronización de contenido falla, ENTONCES EL Cliente_Escritorio DEBERÁ conservar el contenido local vigente y mantener disponibles todas las operaciones de venta.
14. CUANDO una sincronización de contenido escribe en la base de datos SQLite local, ENTONCES EL Sincronizador_Remoto DEBERÁ ejecutar la escritura dentro de una transacción, de forma que una interrupción deje la base de datos en el estado anterior a la sincronización.

### Requisito 13: Instalador único y personalización por cliente

**Historia de usuario:** Como responsable del producto, quiero compilar un solo instalador y que cada equipo tome el logotipo y los parámetros de su cliente al activarse, para no mantener una compilación distinta por cliente.

#### Criterios de aceptación

1. LA Cadena_Compilacion DEBERÁ producir un Instalador_Neutro por versión y plataforma, común a todos los clientes.
2. EL Instalador_Neutro DEBERÁ excluir el Paquete_Marca, el Paquete_Contenido y la Configuracion_Remota de todos los clientes.
3. CUANDO una activación de licencia se completa correctamente, ENTONCES EL Cliente_Escritorio DEBERÁ obtener la Identidad_Cliente del Token_Licencia y descargar el Paquete_Marca, el Paquete_Contenido y la Configuracion_Remota correspondientes a esa Identidad_Cliente.
4. EL Paquete_Marca DEBERÁ contener el logotipo del ticket, el logotipo de la etiqueta, el nombre comercial, los datos fiscales y los textos de cabecera y pie del ticket del cliente.
5. MIENTRAS el Cliente_Escritorio no dispone de un Paquete_Marca descargado, EL Cliente_Escritorio DEBERÁ aplicar los recursos de identidad visual por defecto incluidos en el Instalador_Neutro.
6. CUANDO el Rol_Propietario publica una versión nueva del Paquete_Marca, ENTONCES EL Sincronizador_Remoto DEBERÁ aplicarla en los equipos de esa Identidad_Cliente en la siguiente comprobación.
7. EL Paquete_Marca DEBERÁ incluir un número de versión creciente, y EL Sincronizador_Remoto DEBERÁ aplicar únicamente las versiones superiores a la almacenada localmente.
8. EL Cliente_Escritorio DEBERÁ restringir la descarga de Paquete_Marca, Paquete_Contenido y Configuracion_Remota a los recursos de la Identidad_Cliente contenida en su Token_Licencia.
9. SI el Cliente_Escritorio solicita recursos de una Identidad_Cliente distinta de la contenida en su Token_Licencia, ENTONCES EL Portal_Descargas DEBERÁ denegar la petición con un código de estado 403 y registrar el intento en el Registro_Auditoria.
10. EL Cliente_Escritorio DEBERÁ aplicar los parámetros de la Configuracion_Remota y el Paquete_Marca a los documentos de impresión de ticket y de etiqueta sin requerir una versión nueva de la aplicación.
11. DONDE un cliente necesita un parámetro exclusivo de su instalación, LA Configuracion_Remota DEBERÁ admitir ese parámetro como entrada adicional del documento sin alterar el esquema común.
12. CUANDO el Rol_Propietario da de alta un cliente nuevo, ENTONCES EL Servicio_Licencias DEBERÁ crear su Identidad_Cliente con un Paquete_Marca, un Paquete_Contenido y una Configuracion_Remota iniciales derivados de una plantilla por defecto.

### Requisito 14: Serialización y análisis de documentos firmados

**Historia de usuario:** Como desarrollador, quiero que los documentos que intercambian cliente y AWS se analicen y generen sin pérdida de información, para que un fallo de formato no bloquee un kiosko en feria.

#### Criterios de aceptación

1. CUANDO el Analizador_Token recibe un Token_Licencia con firma válida, ENTONCES EL Analizador_Token DEBERÁ devolver un objeto de estado de licencia con la Huella_Hardware, el estado, la fecha de expiración, el Canal_Liberacion, la Identidad_Cliente y el Perfil_Permisos.
2. SI el Analizador_Token recibe un Token_Licencia con firma inválida, con formato incorrecto o con campos obligatorios ausentes, ENTONCES EL Analizador_Token DEBERÁ devolver un error descriptivo que identifique el campo o la comprobación que ha fallado.
3. EL Serializador_Token DEBERÁ convertir un objeto de estado de licencia en un Token_Licencia con el conjunto completo de campos obligatorios.
4. PARA TODO objeto de estado de licencia válido, analizar el resultado de serializarlo DEBERÁ producir un objeto equivalente al de partida (propiedad de ida y vuelta).
5. PARA TODO Manifiesto_Actualizacion válido, analizarlo y volver a serializarlo DEBERÁ producir un documento equivalente al de partida (propiedad de ida y vuelta).
6. PARA TODO índice de Paquete_Contenido válido, analizarlo y volver a serializarlo DEBERÁ producir un documento equivalente al de partida (propiedad de ida y vuelta).
7. SI un índice de Paquete_Contenido o una Configuracion_Remota contiene campos desconocidos, ENTONCES EL Sincronizador_Remoto DEBERÁ conservar esos campos sin alterarlos al reserializar el documento.

### Requisito 15: Seguridad de credenciales en el cliente

**Historia de usuario:** Como responsable de seguridad, quiero que el equipo del cliente no contenga credenciales reutilizables de AWS, para que el robo de un kiosko no comprometa la infraestructura.

#### Criterios de aceptación

1. EL Cliente_Escritorio DEBERÁ acceder a los recursos de AWS mediante credenciales temporales con una validez máxima de 1 hora.
2. EL Artefacto_Instalador DEBERÁ excluir las claves de acceso de larga duración de AWS.
3. EL Cliente_Escritorio DEBERÁ almacenar el Token_Licencia y las credenciales temporales en el almacén de credenciales del sistema operativo.
4. EL Cliente_Escritorio DEBERÁ comunicarse con el Servicio_Licencias, el Portal_Descargas y los recursos de contenido exclusivamente sobre TLS 1.2 o superior.
5. EL Cliente_Escritorio DEBERÁ conceder a sus credenciales temporales acceso de lectura únicamente a los recursos del cliente al que pertenece el Equipo_Autorizado.
6. SI una credencial temporal caduca durante una operación de red, ENTONCES EL Cliente_Escritorio DEBERÁ renovarla y reintentar la operación una vez.
7. EL Cliente_Escritorio DEBERÁ excluir de sus registros los valores de los tokens y de las credenciales, y referirse a ellos por su identificador.

### Requisito 16: Auditoría y observabilidad

**Historia de usuario:** Como propietario del negocio, quiero saber qué versión tiene cada equipo, cuándo se validó y qué acciones sensibles se han ejecutado, para diagnosticar incidencias a distancia.

#### Criterios de aceptación

1. EL Cliente_Escritorio DEBERÁ registrar en el Registro_Auditoria local las activaciones de licencia, los cambios de estado de licencia, las elevaciones a Rol_Propietario, las operaciones denegadas, las instalaciones de actualización y las sincronizaciones de contenido, con fecha, versión de la aplicación e identificador de equipo.
2. CUANDO el Cliente_Escritorio dispone de conexión a la red, ENTONCES EL Cliente_Escritorio DEBERÁ enviar las entradas pendientes del Registro_Auditoria local a AWS.
3. SI el envío de entradas del Registro_Auditoria falla, ENTONCES EL Cliente_Escritorio DEBERÁ conservarlas localmente y reintentar el envío en la siguiente ventana de conectividad.
4. EL Registro_Auditoria local DEBERÁ conservar las entradas de los últimos 90 días.
5. CUANDO una revalidación de licencia se completa, ENTONCES EL Cliente_Escritorio DEBERÁ comunicar al Servicio_Licencias la versión instalada, el Canal_Liberacion y el estado de sincronización de contenido.
6. EL Servicio_Licencias DEBERÁ exponer para cada Equipo_Autorizado su versión instalada, la fecha de última revalidación y el estado de su Licencia.
7. EL Registro_Auditoria DEBERÁ excluir los datos personales de los compradores.
8. CUANDO un Equipo_Autorizado supera 45 días sin revalidación correcta, ENTONCES EL Servicio_Licencias DEBERÁ generar una alerta operativa.

### Requisito 17: Coste y dimensionamiento

**Historia de usuario:** Como propietario del negocio, quiero que la infraestructura cueste poco para un parque pequeño de kioskos, para que la distribución no se coma el margen.

#### Criterios de aceptación

1. LA arquitectura de distribución DEBERÁ operar con servicios de pago por uso, sin recursos de cómputo con facturación continua.
2. LA arquitectura de distribución DEBERÁ soportar hasta 150 Equipo_Autorizado y 12 publicaciones de versión al año dentro de un coste mensual objetivo de 15 EUR.
3. EL Portal_Descargas DEBERÁ aplicar reglas de ciclo de vida que trasladen los artefactos con más de 180 días a una clase de almacenamiento de menor coste.
4. LA arquitectura de distribución DEBERÁ exponer el coste mensual agregado desglosado por servicio.
5. CUANDO el coste mensual acumulado supera el 80 % del presupuesto configurado, ENTONCES LA arquitectura de distribución DEBERÁ emitir una alerta de presupuesto.

### Requisito 18: Cuenta de AWS y aislamiento del entorno

**Historia de usuario:** Como propietario del negocio, quiero que la infraestructura de distribución viva en una cuenta separada de mis recursos personales, para poder llevar la contabilidad del negocio y limitar el alcance de un incidente.

> **Recomendación**: usar una cuenta de AWS nueva, dedicada al negocio, en lugar de la personal. Separa la facturación, permite cerrar o traspasar el negocio sin tocar recursos personales y acota el daño si una credencial se ve comprometida.

#### Criterios de aceptación

1. LA arquitectura de distribución DEBERÁ residir en una cuenta de AWS dedicada al negocio, distinta de cualquier cuenta de uso personal.
2. LA cuenta de AWS DEBERÁ tener la autenticación multifactor activada en su usuario raíz.
3. LA arquitectura de distribución DEBERÁ operar mediante identidades con permisos limitados a los recursos de distribución, sin usar el usuario raíz para operaciones cotidianas.
4. LA arquitectura de distribución DEBERÁ tener configurado un presupuesto mensual con alerta por correo electrónico.
5. LA arquitectura de distribución DEBERÁ desplegarse en una única región de AWS, elegida por proximidad a los clientes finales.
6. LA arquitectura de distribución DEBERÁ definirse como infraestructura declarada en código, versionada en el repositorio.
7. LA arquitectura de distribución DEBERÁ separar los recursos de un entorno de pruebas de los de producción mediante prefijos o cuentas distintas.
8. EL Documento_Arquitectura DEBERÁ incluir el procedimiento de alta de la cuenta de AWS y de configuración inicial de identidades, presupuesto y región.

### Requisito 19: Documentación y operativa

**Historia de usuario:** Como propietario del negocio, quiero un documento en español que explique la distribución y los procedimientos, para poder operar y explicar el sistema sin leer código.

#### Criterios de aceptación

1. EL Documento_Arquitectura DEBERÁ residir en la carpeta `docs/` y estar redactado en español.
2. EL Documento_Arquitectura DEBERÁ describir los componentes de AWS empleados, el flujo de publicación de versiones, el flujo de activación de licencia, el flujo de actualización, el flujo de sincronización de contenido y el flujo de personalización por Identidad_Cliente.
3. EL Documento_Arquitectura DEBERÁ incluir los procedimientos operativos de publicación de una versión, retorno a una versión anterior, alta de un cliente con su Paquete_Marca, traspaso de licencia entre equipos y revocación de una licencia.
4. EL Documento_Arquitectura DEBERÁ incluir una tabla de diagnóstico que asocie cada estado de licencia y cada error de sincronización con su acción correctiva.
5. EL Documento_Arquitectura DEBERÁ incluir una estimación de costes mensuales por servicio de AWS para el dimensionamiento previsto.
6. EL Documento_Arquitectura DEBERÁ comparar las dos modalidades de entrega al cliente, la entrega del instalador y la entrega del equipo con la aplicación preinstalada, indicando el impacto de cada una en la firma de código, la activación de licencia y el soporte.
7. EL Documento_Arquitectura DEBERÁ indicar, para cada requisito de esta especificación, la fase de implementación en la que se aborda.
8. EL Documento_Arquitectura DEBERÁ señalar los puntos del código actual que se verán afectados cuando la implementación comience, sin exigir cambios en ese código para la entrega del documento.
9. CUANDO la arquitectura de distribución cambia, ENTONCES EL Documento_Arquitectura DEBERÁ reflejar el cambio en la misma entrega.
