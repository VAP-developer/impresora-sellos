# Documento de Requisitos

## Introducción

Este documento define los requisitos para el nuevo sistema de gestión de imágenes de ferias. El sistema mantiene SQLite como almacén de imágenes (Data URI Base64) pero se alimenta automáticamente de la estructura de carpetas `bbdd-ferias/{año}/{feria}/`.

Al arrancar la aplicación, se ejecuta una sincronización inteligente que importa a SQLite solo las imágenes que hayan cambiado en las carpetas. El usuario selecciona la feria activa en el frontend y las imágenes correspondientes se cargan desde SQLite.

Cada carpeta de feria contiene dos imágenes:
- **imagen-fondo** (sufijo `-fondo`): referencia visual mostrada en la app, NO se imprime por defecto. Se puede imprimir opcionalmente para pruebas.
- **imagen-sello** (sufijo `-sello`): imagen del sello que se imprime en la etiqueta cuando la opción está activada.

## Glosario

- **Sincronizador**: Módulo del proceso principal (main process) responsable de escanear la estructura de carpetas `bbdd-ferias/` y sincronizar las imágenes con la base de datos SQLite.
- **Sistema_Imagenes**: Módulo del proceso principal que gestiona la lectura y escritura de imágenes en SQLite y expone canales IPC al frontend.
- **Vista_Kiosko**: Vista del frontend que muestra la previsualización del sello y las opciones de venta.
- **Vista_Configuracion**: Vista o sección del frontend donde el usuario selecciona la feria activa y configura las opciones de impresión de imágenes.
- **Generador_PDF**: Módulo del proceso principal responsable de generar los PDFs de las etiquetas de sellos.
- **Imagen_Fondo**: Archivo de imagen (JPG/PNG) con sufijo `-fondo` en la carpeta de la feria. Se usa como referencia visual en la aplicación.
- **Imagen_Sello**: Archivo de imagen (JPG/PNG) con sufijo `-sello` en la carpeta de la feria. Se usa como fondo imprimible en las etiquetas.
- **Carpeta_Feria**: Directorio con estructura `bbdd-ferias/{año}/{nombre_feria}/` que contiene las imágenes asociadas a una feria.
- **Registro_Sync**: Registro en SQLite que almacena los metadatos de sincronización (ruta del archivo, fecha de modificación, hash) para detectar cambios.
- **Checkbox_Imprimir_Fondo**: Control tipo checkbox que permite activar la impresión de la imagen de fondo con fines de prueba.
- **Checkbox_Imprimir_Sello**: Control tipo checkbox que permite activar o desactivar la impresión de la imagen del sello en las etiquetas.

## Requisitos

### Requisito 1: Estructura de carpetas de imágenes

**Historia de Usuario:** Como operador de la aplicación, quiero que las imágenes de cada feria estén organizadas en carpetas por año y nombre de feria, para poder gestionar las imágenes de forma sencilla desde el explorador de archivos.

#### Criterios de Aceptación

1. THE Sincronizador SHALL reconocer la estructura de carpetas `bbdd-ferias/{año}/{nombre_feria}/` relativa al directorio de la aplicación.
2. WHEN el Sincronizador escanea una Carpeta_Feria, THE Sincronizador SHALL identificar el archivo con sufijo `-fondo` (extensión `.jpg` o `.png`) como la Imagen_Fondo de esa feria.
3. WHEN el Sincronizador escanea una Carpeta_Feria, THE Sincronizador SHALL identificar el archivo con sufijo `-sello` (extensión `.jpg` o `.png`) como la Imagen_Sello de esa feria.
4. IF una Carpeta_Feria no contiene un archivo con sufijo `-fondo`, THEN THE Sincronizador SHALL registrar que esa feria no tiene Imagen_Fondo sin producir un error fatal.
5. IF una Carpeta_Feria no contiene un archivo con sufijo `-sello`, THEN THE Sincronizador SHALL registrar que esa feria no tiene Imagen_Sello sin producir un error fatal.

### Requisito 2: Sincronización inteligente al arrancar

**Historia de Usuario:** Como operador de la aplicación, quiero que las imágenes se sincronicen automáticamente al iniciar la aplicación sin ralentizarla, para tener siempre las imágenes actualizadas sin intervención manual.

#### Criterios de Aceptación

1. WHEN la aplicación se inicia, THE Sincronizador SHALL escanear todas las carpetas dentro de `bbdd-ferias/` y comparar los archivos con los registros existentes en SQLite.
2. THE Sincronizador SHALL comparar la fecha de modificación del archivo en disco con la fecha almacenada en el Registro_Sync para determinar si una imagen ha cambiado.
3. WHEN un archivo de imagen tiene una fecha de modificación posterior a la registrada en el Registro_Sync, THE Sincronizador SHALL leer el archivo, convertirlo a Data URI Base64 y actualizar el registro en SQLite.
4. WHEN un archivo de imagen es nuevo (no existe en el Registro_Sync), THE Sincronizador SHALL leer el archivo, convertirlo a Data URI Base64 e insertarlo en SQLite con sus metadatos de sincronización.
5. WHEN un registro en SQLite no tiene un archivo correspondiente en disco (la imagen fue eliminada de la carpeta), THE Sincronizador SHALL eliminar ese registro de SQLite.
6. WHEN ningún archivo ha cambiado, THE Sincronizador SHALL completar la sincronización sin realizar escrituras en SQLite.

### Requisito 3: Selección de feria en el frontend

**Historia de Usuario:** Como operador de la aplicación, quiero poder seleccionar la feria activa desde la interfaz, para cargar las imágenes correctas correspondientes a esa feria.

#### Criterios de Aceptación

1. THE Vista_Configuracion SHALL mostrar un listado de las ferias disponibles obtenido de los registros sincronizados en SQLite.
2. WHEN el usuario selecciona una feria del listado, THE Sistema_Imagenes SHALL cargar las imágenes (fondo y sello) correspondientes a esa feria desde SQLite.
3. WHEN el usuario selecciona una feria, THE Vista_Kiosko SHALL actualizar la previsualización mostrando la Imagen_Fondo de la feria seleccionada.
4. THE Vista_Configuracion SHALL mostrar el año y nombre de cada feria disponible para facilitar la identificación.

### Requisito 4: Visualización de la imagen de fondo

**Historia de Usuario:** Como operador de la aplicación, quiero ver la imagen de fondo de la feria activa en la interfaz, para tener una referencia visual de la temática de la feria mientras trabajo.

#### Criterios de Aceptación

1. WHEN la feria activa tiene una Imagen_Fondo disponible en SQLite, THE Vista_Kiosko SHALL mostrar la Imagen_Fondo como referencia visual en la zona de previsualización.
2. WHEN la feria activa no tiene Imagen_Fondo disponible, THE Vista_Kiosko SHALL mostrar un placeholder con el nombre de la feria en lugar de la imagen.
3. THE Vista_Kiosko SHALL mostrar la Imagen_Fondo con dimensiones proporcionales al área de previsualización sin distorsionar la imagen.

### Requisito 5: Control de impresión de la imagen de fondo (pruebas)

**Historia de Usuario:** Como operador de la aplicación, quiero poder activar opcionalmente la impresión de la imagen de fondo cuando estoy haciendo pruebas, para verificar que la configuración visual es correcta antes de un evento.

#### Criterios de Aceptación

1. THE Vista_Configuracion SHALL mostrar un Checkbox_Imprimir_Fondo con la etiqueta "Imprimir imagen de fondo (pruebas)".
2. THE Checkbox_Imprimir_Fondo SHALL estar desactivado por defecto al iniciar la aplicación.
3. WHEN el Checkbox_Imprimir_Fondo está activado, THE Generador_PDF SHALL incluir la Imagen_Fondo como fondo en las etiquetas generadas.
4. WHEN el Checkbox_Imprimir_Fondo está desactivado, THE Generador_PDF SHALL generar las etiquetas sin incluir la Imagen_Fondo.

### Requisito 6: Control de impresión de la imagen del sello

**Historia de Usuario:** Como operador de la aplicación, quiero poder activar o desactivar la impresión de la imagen del sello en las etiquetas, para poder imprimir solo la información textual del pedido cuando no necesito el sello gráfico.

#### Criterios de Aceptación

1. THE Vista_Configuracion SHALL mostrar un Checkbox_Imprimir_Sello con la etiqueta "Imprimir imagen del sello".
2. WHEN el Checkbox_Imprimir_Sello está activado, THE Generador_PDF SHALL incluir la Imagen_Sello como fondo impreso en las etiquetas generadas.
3. WHEN el Checkbox_Imprimir_Sello está desactivado, THE Generador_PDF SHALL generar las etiquetas incluyendo únicamente la información textual (tarifa, fecha, evento, código) sin imagen de fondo.
4. WHEN el Checkbox_Imprimir_Sello está activado y la Imagen_Sello no está disponible para la feria activa, THE Generador_PDF SHALL generar las etiquetas sin imagen de fondo y THE Sistema_Imagenes SHALL informar al usuario de que la imagen del sello no fue encontrada.

### Requisito 7: Composición de capas de imagen en la etiqueta

**Historia de Usuario:** Como operador de la aplicación, quiero que la lógica de impresión componga las imágenes por capas según mis configuraciones, para obtener el resultado de impresión correcto con fondo, sello e información textual.

#### Criterios de Aceptación

1. WHEN el Checkbox_Imprimir_Sello está activado y el Checkbox_Imprimir_Fondo está desactivado, THE Generador_PDF SHALL renderizar la Imagen_Sello como única capa de imagen, con la información textual (tarifa, fecha, evento, código) superpuesta encima.
2. WHEN el Checkbox_Imprimir_Fondo está activado y el Checkbox_Imprimir_Sello está desactivado, THE Generador_PDF SHALL renderizar la Imagen_Fondo como única capa de imagen, con la información textual superpuesta encima.
3. WHEN ambos checkboxes están activados, THE Generador_PDF SHALL renderizar la Imagen_Fondo como capa inferior, la Imagen_Sello como capa intermedia encima del fondo, y la información textual como capa superior.
4. WHEN ambos checkboxes están desactivados, THE Generador_PDF SHALL generar la etiqueta sin imagen de fondo, incluyendo solo la información textual.

### Requisito 8: Persistencia del estado de los controles de impresión

**Historia de Usuario:** Como operador de la aplicación, quiero que el estado de los checkboxes de impresión se comporte de forma coherente entre sesiones, para tener la configuración adecuada sin sorpresas.

#### Criterios de Aceptación

1. THE Sistema_Imagenes SHALL mantener el estado del Checkbox_Imprimir_Fondo y del Checkbox_Imprimir_Sello durante toda la sesión activa de la aplicación.
2. WHEN la aplicación se reinicia, THE Checkbox_Imprimir_Fondo SHALL volver a su estado desactivado por defecto (es una opción de pruebas, no de producción).
3. WHEN la aplicación se reinicia, THE Checkbox_Imprimir_Sello SHALL mantener su último estado guardado en la configuración persistente de SQLite.

### Requisito 9: Carga de imágenes mediante IPC

**Historia de Usuario:** Como desarrollador, quiero que el sistema de imágenes exponga canales IPC adecuados para el nuevo flujo basado en carpetas, manteniendo la separación entre proceso principal y renderer.

#### Criterios de Aceptación

1. THE Sistema_Imagenes SHALL exponer un canal IPC que devuelva el listado de ferias disponibles (año, nombre) sincronizadas en SQLite.
2. THE Sistema_Imagenes SHALL exponer un canal IPC que reciba el año y nombre de una feria y devuelva las imágenes (fondo y sello) como Data URI desde SQLite.
3. IF ocurre un error al acceder a los datos en SQLite, THEN THE Sistema_Imagenes SHALL devolver un mensaje de error descriptivo al frontend sin provocar un cierre inesperado de la aplicación.
