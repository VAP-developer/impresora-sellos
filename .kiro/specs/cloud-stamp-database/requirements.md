# Documento de Requisitos: Base de Datos de Sellos en la Nube

## Introducción

Esta funcionalidad establece un sistema de almacenamiento en la nube para las imágenes de sellos (fondos y logos) de cada usuario, con sincronización bidireccional entre los buckets de S3 y la aplicación de escritorio.

Los objetivos son cuatro:

1. **Centralizar los activos de imagen** en AWS S3 con una estructura por usuario, año y nombre de sello, eliminando la dependencia de la carpeta local `bbdd-ferias` como fuente primaria.
2. **Mantener un registro (base de datos en la nube)** de todos los sellos y sus imágenes disponibles para cada usuario, accesible desde la configuración de la aplicación.
3. **Sincronizar bajo demanda** la base de datos local con la de la nube mediante un botón en la sección de configuración, detectando altas y bajas de carpetas en el bucket.
4. **Proteger la integridad del sistema** verificando la identidad del usuario y la autenticidad del equipo antes de permitir la sincronización; bloqueando la aplicación y borrando la base de datos local si se detecta un acceso no autorizado.

### Alcance

- Un nuevo campo en la pantalla de configuración: "Base de datos sellos" que muestra la lista de sellos e imágenes disponibles.
- Un botón "Sincronizar" que inicia el proceso de verificación + sincronización.
- Infraestructura AWS: bucket S3 por usuario con estructura `{username}/{año}/{nombre-sello}/` conteniendo `fondo.jpg` y `logo.png`.
- Base de datos en la nube (DynamoDB o similar) que se actualiza a partir del contenido del bucket.
- Lambda o proceso que escanea el bucket y actualiza la base de datos en la nube.

### Dimensionamiento previsto

- Entre 4 y 50 usuarios.
- Cada usuario: entre 5 y 30 sellos por año.
- Imágenes: fondo en JPG (~200-500 KB) y logo en PNG (~50-200 KB).
- Sincronizaciones: máximo 2-3 al día por usuario.

### Convención de redacción (patrones EARS en español)

| EARS | Español | Uso |
| --- | --- | --- |
| Ubiquitous | `EL <sistema> DEBERÁ <respuesta>` | Siempre aplica |
| Event-driven | `CUANDO <disparador>, EL <sistema> DEBERÁ <respuesta>` | Disparado por un evento |
| State-driven | `MIENTRAS <condición>, EL <sistema> DEBERÁ <respuesta>` | Aplica durante un estado |
| Unwanted event | `SI <condición>, ENTONCES EL <sistema> DEBERÁ <respuesta>` | Errores y casos no deseados |
| Optional feature | `DONDE <opción>, EL <sistema> DEBERÁ <respuesta>` | Funcionalidad opcional o configurable |
| Complex | `DONDE … MIENTRAS … CUANDO/SI … EL <sistema> DEBERÁ …` | Varias condiciones combinadas |

## Glosario

- **Bucket_Sellos**: Bucket de S3 que almacena las imágenes de sellos de todos los usuarios, organizado por carpetas `{username}/{año}/{nombre-sello}/`.
- **Registro_Sello**: Entrada en la base de datos de la nube que representa un sello disponible, con su nombre, año, rutas a fondo y logo, y metadatos.
- **BBDD_Nube**: Tabla en DynamoDB que almacena el catálogo completo de sellos disponibles por usuario.
- **BBDD_Local**: Tabla o estructura en SQLite local que replica el catálogo de sellos del usuario para uso offline.
- **Sincronizador_Sellos**: Componente del Cliente_Escritorio que coordina la verificación de identidad, la detección de cambios y la actualización de la BBDD_Local.
- **Verificacion_Identidad**: Proceso que comprueba que el usuario autenticado y el equipo (machineId) coinciden con una Activacion_Licencia válida antes de permitir la sincronización.
- **Escaneo_Bucket**: Proceso (Lambda) que recorre el Bucket_Sellos del usuario, detecta altas/bajas de carpetas y actualiza la BBDD_Nube.
- **Fondo_Sello**: Imagen de fondo del sello en formato JPG, almacenada como `{nombre}-fondo.jpg` en el bucket.
- **Logo_Sello**: Imagen del logo/sello en formato PNG, almacenada como `{nombre}-sello.png` en el bucket.

## Requisitos

### Requisito 1: Estructura del bucket S3 por usuario

**Historia de usuario:** Como administrador, quiero que cada usuario tenga su propia carpeta en S3 con una estructura organizada por año y nombre de sello, para poder gestionar las imágenes de forma independiente por cliente.

#### Criterios de aceptación

1. EL Bucket_Sellos DEBERÁ organizar las imágenes con la estructura de carpetas: `{username}/{año}/{nombre-sello}/`.
2. CADA carpeta de sello DEBERÁ contener exactamente dos archivos: un archivo `{nombre}-fondo.jpg` (fondo del sello) y un archivo `{nombre}-sello.png` (logo del sello).
3. EL sistema DEBERÁ soportar múltiples años por usuario, cada año como subcarpeta directa del usuario.
4. EL nombre de la carpeta del sello DEBERÁ coincidir con el prefijo del nombre de los archivos que contiene.
5. SI se sube una carpeta sin los dos archivos requeridos (fondo.jpg y sello.png), ENTONCES EL Escaneo_Bucket DEBERÁ marcar el Registro_Sello como incompleto y no incluirlo en la sincronización.

### Requisito 2: Base de datos de sellos en la nube (BBDD_Nube)

**Historia de usuario:** Como sistema, quiero mantener un catálogo actualizado de todos los sellos disponibles para cada usuario en una base de datos en la nube, para poder servir esa información a la aplicación de escritorio de forma eficiente.

#### Criterios de aceptación

1. LA BBDD_Nube DEBERÁ almacenar por cada Registro_Sello: username, año, nombre del sello, ruta al fondo, ruta al logo, fecha de alta y estado (completo/incompleto).
2. LA BBDD_Nube DEBERÁ actualizarse exclusivamente mediante el Escaneo_Bucket, nunca directamente desde la aplicación de escritorio.
3. CUANDO se añade una nueva carpeta al Bucket_Sellos, ENTONCES EL Escaneo_Bucket DEBERÁ crear un nuevo Registro_Sello en la BBDD_Nube.
4. CUANDO se elimina una carpeta del Bucket_Sellos, ENTONCES EL Escaneo_Bucket DEBERÁ eliminar el Registro_Sello correspondiente de la BBDD_Nube.
5. EL Escaneo_Bucket DEBERÁ ejecutarse como parte del proceso de sincronización iniciado por la aplicación, garantizando que la BBDD_Nube refleje el estado actual del bucket antes de enviar datos al cliente.

### Requisito 3: Verificación de identidad y autenticidad del equipo

**Historia de usuario:** Como responsable del producto, quiero que antes de cualquier sincronización se verifique que el usuario y el equipo son legítimos, para impedir que instalaciones no autorizadas accedan al catálogo de sellos.

#### Criterios de aceptación

1. CUANDO el usuario pulsa "Sincronizar", EL Sincronizador_Sellos DEBERÁ enviar al backend el apiKey del usuario y el machineId del equipo.
2. EL backend DEBERÁ verificar que el apiKey corresponde a un usuario existente en la tabla de usuarios de DynamoDB.
3. EL backend DEBERÁ verificar que el machineId está registrado como máquina activa del usuario (presente en activeMachines).
4. SI el apiKey no existe o el machineId no está registrado para ese usuario, ENTONCES EL backend DEBERÁ devolver un código de error de autenticación.
5. SI la verificación falla, ENTONCES EL Cliente_Escritorio DEBERÁ borrar la BBDD_Local de sellos y bloquear la aplicación mostrando un mensaje de error indicando que se requiere contactar con soporte.
6. SI la verificación falla, ENTONCES EL Cliente_Escritorio DEBERÁ eliminar el ticket de activación local (.license-ticket) para impedir el uso offline posterior.

### Requisito 4: Sincronización de la base de datos local

**Historia de usuario:** Como usuario, quiero pulsar un botón en configuración para actualizar mi catálogo local de sellos con los cambios realizados en la nube, para tener siempre disponibles las imágenes más recientes.

#### Criterios de aceptación

1. CUANDO la verificación de identidad es exitosa, EL Sincronizador_Sellos DEBERÁ solicitar al backend la lista completa de Registro_Sello del usuario.
2. EL Sincronizador_Sellos DEBERÁ comparar la lista recibida con la BBDD_Local y detectar: sellos nuevos (presentes en nube, ausentes en local), sellos eliminados (ausentes en nube, presentes en local) y sellos modificados (diferentes metadatos).
3. PARA cada sello nuevo, EL Sincronizador_Sellos DEBERÁ descargar las imágenes (fondo y logo) desde S3 mediante URLs prefirmadas y almacenarlas en la carpeta local de imágenes.
4. PARA cada sello eliminado, EL Sincronizador_Sellos DEBERÁ eliminar las imágenes locales y el registro de la BBDD_Local.
5. CUANDO la sincronización finaliza con éxito, EL Sincronizador_Sellos DEBERÁ actualizar la BBDD_Local con la lista completa de la nube y mostrar un resumen de cambios (añadidos, eliminados).
6. SI ocurre un error durante la descarga de imágenes, ENTONCES EL Sincronizador_Sellos DEBERÁ revertir los cambios parciales y mostrar un mensaje de error específico.
7. MIENTRAS la sincronización está en curso, EL Cliente_Escritorio DEBERÁ mostrar un indicador de progreso y desactivar el botón de sincronización.

### Requisito 5: Interfaz de configuración — Sección "Base de datos sellos"

**Historia de usuario:** Como usuario, quiero ver en la configuración una lista de todos los sellos e imágenes disponibles en mi cuenta, con un botón para sincronizar.

#### Criterios de aceptación

1. LA sección "Base de datos sellos" DEBERÁ aparecer dentro de la pantalla de configuración de la aplicación.
2. LA sección DEBERÁ mostrar una lista con todos los sellos disponibles localmente, agrupados por año.
3. CADA entrada de la lista DEBERÁ mostrar: nombre del sello, año, y una miniatura del fondo y del logo.
4. LA sección DEBERÁ incluir un botón "Sincronizar con la nube" claramente visible.
5. CUANDO no hay conexión a internet, EL botón de sincronización DEBERÁ estar deshabilitado con un tooltip indicando que se requiere conexión.
6. DESPUÉS de una sincronización exitosa, LA lista DEBERÁ actualizarse automáticamente para reflejar los cambios.
7. SI la BBDD_Local está vacía, LA sección DEBERÁ mostrar un mensaje indicando que se debe sincronizar por primera vez.

### Requisito 6: Seguridad y bloqueo ante acceso no autorizado

**Historia de usuario:** Como responsable del producto, quiero que si se detecta un intento de sincronización desde un equipo o usuario no autorizado, la aplicación se bloquee y se borren los datos locales, para impedir el uso de copias ilegítimas.

#### Criterios de aceptación

1. SI la Verificacion_Identidad devuelve un error de autenticación, ENTONCES EL Cliente_Escritorio DEBERÁ borrar todos los registros de la BBDD_Local de sellos.
2. SI la Verificacion_Identidad devuelve un error de autenticación, ENTONCES EL Cliente_Escritorio DEBERÁ borrar las imágenes descargadas de la carpeta local de sellos.
3. SI la Verificacion_Identidad devuelve un error de autenticación, ENTONCES EL Cliente_Escritorio DEBERÁ entrar en estado bloqueado, impidiendo el acceso a cualquier funcionalidad de la aplicación.
4. EL estado bloqueado DEBERÁ persistir tras reinicios de la aplicación hasta que se resuelva con soporte técnico.
5. CUANDO la aplicación está bloqueada, EL Cliente_Escritorio DEBERÁ mostrar únicamente una pantalla con el mensaje: "Aplicación bloqueada. Contacte con soporte." y un identificador del equipo para diagnóstico.
6. EL Cliente_Escritorio DEBERÁ registrar el intento fallido de sincronización con fecha, machineId y apiKey usado para análisis posterior.
