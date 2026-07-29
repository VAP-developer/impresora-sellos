# Documento de Requisitos: Configuración, Tarifas e Internacionalización

## Introducción

Este documento define los requisitos para la nueva ventana de Configuración (Settings), la evolución del sistema de grupos de tarifas con restricción anual y tipos de tarifa diferenciados (Tiras y Tarifas individuales), un selector de moneda por lista, la configuración de número de corte para agrupamiento de etiquetas, y la internacionalización (i18n) de la aplicación en español e inglés.

El sistema actual de grupos de tarifas (spec `tariff-groups`) almacena grupos con 2-10 tarifas genéricas por grupo sin distinción de tipo. La evolución propuesta introduce:
1. Restricción de un único grupo de tarifas por año.
2. Dos tipos de tarifa dentro de cada grupo: tarifas individuales (2-20) y tiras (agrupaciones de tarifas individuales).
3. Un selector de moneda basado en una lista predefinida de símbolos de divisa por país.
4. Una nueva vista de Configuración centralizada que agrupa la gestión de grupos de tarifas, el número de corte y el selector de idioma.
5. Número de corte configurable (2-16) que determina cómo se agrupan las etiquetas individuales en tiras para impresión.
6. Soporte multiidioma (español/inglés) con selector en la vista de Configuración.

## Glosario

- **Vista_Configuracion**: Nueva vista del frontend que centraliza la configuración de la aplicación: gestión de grupos de tarifas, número de corte y selector de idioma.
- **Grupo_Tarifas**: Entidad que agrupa tarifas individuales y tiras para un año dado. Se persiste en SQLite. Solo puede existir un Grupo_Tarifas por año.
- **Tarifa_Individual**: Elemento dentro de un Grupo_Tarifas que representa un precio unitario para un sello individual. Tiene un nombre (máximo 16 caracteres) y un precio numérico positivo.
- **Tira**: Elemento dentro de un Grupo_Tarifas que agrupa varias tarifas individuales. Define cuántas tarifas individuales abarca y tiene un nombre y un precio propio.
- **Numero_Corte**: Configuración global (2-16) que determina el tamaño de agrupación de etiquetas individuales al imprimir. Las etiquetas se dividen en tiras de ese tamaño.
- **Selector_Moneda**: Componente de interfaz que presenta una lista predefinida de símbolos de divisa por país para elegir la moneda del grupo de tarifas.
- **Sistema_Configuracion**: Módulo del proceso principal responsable de la persistencia y gestión de la configuración global (número de corte, idioma).
- **Sistema_i18n**: Módulo del frontend responsable de cargar y aplicar las traducciones de la interfaz según el idioma seleccionado.
- **Idioma_Activo**: El idioma actualmente seleccionado por el usuario (español o inglés) que determina los textos mostrados en toda la interfaz.
- **Sistema_Grupos_Tarifas**: Módulo del proceso principal responsable de la gestión CRUD de grupos de tarifas, incluyendo la restricción de unicidad por año.
- **Sistema_Impresion**: Módulo existente de impresión que utiliza el Numero_Corte para agrupar etiquetas en tiras.

## Requisitos

### Requisito 1: Vista de Configuración centralizada

**Historia de Usuario:** Como operador de la aplicación, quiero tener una ventana de Configuración centralizada donde pueda gestionar los grupos de tarifas, el número de corte y el idioma, para acceder a toda la configuración desde un único lugar.

#### Criterios de Aceptación

1. THE Vista_Configuracion SHALL ser accesible desde el menú de navegación principal de la aplicación.
2. THE Vista_Configuracion SHALL organizar la configuración en secciones claramente diferenciadas: una sección para grupos de tarifas, una sección para número de corte y una sección para idioma.
3. WHEN el usuario navega a la Vista_Configuracion, THE Vista_Configuracion SHALL cargar y mostrar los valores actuales de todas las configuraciones persistidas.
4. THE Vista_Configuracion SHALL permitir al usuario modificar cada sección de forma independiente sin afectar a las demás.

### Requisito 2: Restricción de un grupo de tarifas por año

**Historia de Usuario:** Como operador de la aplicación, quiero que solo pueda existir un grupo de tarifas por año, para simplificar la organización y evitar confusiones entre grupos del mismo período.

#### Criterios de Aceptación

1. THE Sistema_Grupos_Tarifas SHALL garantizar que solo exista un Grupo_Tarifas por cada valor de año en la base de datos.
2. IF el usuario intenta crear un Grupo_Tarifas para un año que ya tiene un grupo asignado, THEN THE Sistema_Grupos_Tarifas SHALL rechazar la creación y devolver un mensaje de error indicando que ya existe un grupo para ese año.
3. IF el usuario intenta modificar el año de un Grupo_Tarifas existente a un año que ya tiene otro grupo asignado, THEN THE Sistema_Grupos_Tarifas SHALL rechazar la actualización y devolver un mensaje de error indicando que ya existe un grupo para ese año.
4. THE Vista_Configuracion SHALL mostrar el listado de grupos de tarifas organizados por año, indicando qué años ya tienen grupo asignado.

### Requisito 3: Tipos de tarifa diferenciados (Individuales y Tiras)

**Historia de Usuario:** Como operador de la aplicación, quiero que cada grupo de tarifas contenga dos tipos de tarifas (individuales y tiras), para poder configurar tanto precios unitarios como agrupaciones de sellos con sus propios precios.

#### Criterios de Aceptación

1. THE Sistema_Grupos_Tarifas SHALL almacenar cada Grupo_Tarifas con dos colecciones diferenciadas: una colección de Tarifas_Individuales y una colección de Tiras.
2. WHEN el usuario crea un Grupo_Tarifas, THE Vista_Configuracion SHALL solicitar primero la definición de las tarifas individuales y posteriormente la configuración de las tiras.
3. THE Sistema_Grupos_Tarifas SHALL permitir entre 2 y 20 tarifas individuales dentro de un Grupo_Tarifas.
4. IF el formulario de creación contiene menos de 2 tarifas individuales, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que se requieren al menos 2 tarifas individuales.
5. IF el formulario de creación contiene más de 20 tarifas individuales, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el máximo permitido es 20 tarifas individuales.
6. WHEN el usuario configura una Tira, THE Vista_Configuracion SHALL mostrar un selector para que el usuario indique cuántas tarifas individuales abarca esa tira.
7. THE Sistema_Grupos_Tarifas SHALL almacenar cada Tira con un nombre, un precio, una posición y el número de tarifas individuales que abarca.

### Requisito 4: Validación de tarifas individuales y tiras

**Historia de Usuario:** Como operador de la aplicación, quiero que el sistema valide los datos de cada tarifa individual y tira al crearlas o editarlas, para evitar datos incorrectos que afecten la impresión o el cálculo de precios.

#### Criterios de Aceptación

1. IF el nombre de una Tarifa_Individual supera los 16 caracteres, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el nombre no puede exceder 16 caracteres.
2. IF el nombre de una Tarifa_Individual está vacío, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el nombre es obligatorio.
3. IF el precio de una Tarifa_Individual es menor o igual a cero, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el precio debe ser un número positivo.
4. IF el precio de una Tarifa_Individual no es un valor numérico válido, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el precio debe ser un número válido.
5. IF el nombre de una Tira supera los 16 caracteres, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el nombre de la tira no puede exceder 16 caracteres.
6. IF el nombre de una Tira está vacío, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el nombre de la tira es obligatorio.
7. IF el precio de una Tira es menor o igual a cero, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que el precio de la tira debe ser un número positivo.
8. IF el número de tarifas individuales que abarca una Tira es menor que 2, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que una tira debe abarcar al menos 2 tarifas individuales.
9. IF el número de tarifas individuales que abarca una Tira supera el total de tarifas individuales definidas en el grupo, THEN THE Vista_Configuracion SHALL impedir el envío y mostrar un mensaje indicando que la tira no puede abarcar más tarifas de las existentes.
10. THE Sistema_Grupos_Tarifas SHALL validar las mismas reglas en el backend antes de persistir los datos, rechazando la operación con un mensaje descriptivo si alguna regla se incumple.

### Requisito 5: Selector de moneda por lista

**Historia de Usuario:** Como operador de la aplicación, quiero elegir la moneda del grupo de tarifas desde una lista de símbolos de divisa por país, para evitar errores de escritura y asegurar consistencia en los datos de moneda.

#### Criterios de Aceptación

1. WHEN el usuario crea o edita un Grupo_Tarifas, THE Vista_Configuracion SHALL mostrar un Selector_Moneda con una lista desplegable de monedas disponibles.
2. THE Selector_Moneda SHALL mostrar para cada opción el código ISO de la moneda y el símbolo correspondiente (por ejemplo: "EUR €", "USD $", "GBP £").
3. THE Selector_Moneda SHALL incluir al menos las siguientes monedas: EUR, USD, GBP, CHF, JPY, CNY, MXN, ARS, COP, BRL.
4. THE Vista_Configuracion SHALL impedir que el usuario introduzca un valor de moneda libre de texto; solo se aceptan valores seleccionados de la lista.
5. THE Sistema_Grupos_Tarifas SHALL almacenar el código ISO seleccionado como valor de la moneda del Grupo_Tarifas.
6. WHEN el Selector_Moneda se muestra con un Grupo_Tarifas existente, THE Selector_Moneda SHALL preseleccionar la moneda actualmente asignada al grupo.

### Requisito 6: Número de corte

**Historia de Usuario:** Como operador de la aplicación, quiero configurar un número de corte (entre 2 y 16) que determine cómo se agrupan las etiquetas individuales al imprimir, para controlar el tamaño de las tiras impresas según las necesidades del punto de venta.

#### Criterios de Aceptación

1. THE Vista_Configuracion SHALL mostrar un campo numérico para establecer el Numero_Corte con un valor entre 2 y 16.
2. IF el usuario introduce un Numero_Corte menor que 2, THEN THE Vista_Configuracion SHALL impedir el guardado y mostrar un mensaje indicando que el valor mínimo es 2.
3. IF el usuario introduce un Numero_Corte mayor que 16, THEN THE Vista_Configuracion SHALL impedir el guardado y mostrar un mensaje indicando que el valor máximo es 16.
4. WHEN el usuario guarda un Numero_Corte válido, THE Sistema_Configuracion SHALL persistir el valor en la base de datos.
5. WHEN el Sistema_Impresion recibe una solicitud de impresión de N etiquetas individuales, THE Sistema_Impresion SHALL dividir las N etiquetas en tiras de tamaño igual al Numero_Corte, generando una última tira con las etiquetas restantes si N no es divisible por el Numero_Corte.
6. WHEN el Numero_Corte es 4 y se solicitan 15 etiquetas, THE Sistema_Impresion SHALL generar 3 tiras de 4 etiquetas y 1 tira de 3 etiquetas.
7. THE Sistema_Configuracion SHALL proporcionar un valor por defecto para el Numero_Corte al inicializar la aplicación por primera vez.

### Requisito 7: Internacionalización (i18n)

**Historia de Usuario:** Como operador de la aplicación, quiero poder cambiar el idioma de la interfaz entre español e inglés, para adaptar la aplicación a operadores que hablen cualquiera de los dos idiomas.

#### Criterios de Aceptación

1. THE Sistema_i18n SHALL soportar dos idiomas: español (es) e inglés (en).
2. THE Vista_Configuracion SHALL mostrar un selector de idioma con las opciones "Español" e "Inglés".
3. WHEN el usuario selecciona un idioma diferente al actual, THE Sistema_i18n SHALL aplicar las traducciones del nuevo idioma a todos los textos de la interfaz sin necesidad de reiniciar la aplicación.
4. THE Sistema_i18n SHALL persistir el Idioma_Activo en la base de datos para que se mantenga entre sesiones.
5. WHEN la aplicación se inicia, THE Sistema_i18n SHALL cargar el Idioma_Activo almacenado y aplicar las traducciones correspondientes.
6. IF no existe un Idioma_Activo almacenado, THEN THE Sistema_i18n SHALL utilizar español (es) como idioma por defecto.
7. THE Sistema_i18n SHALL traducir todos los textos estáticos de la interfaz: etiquetas de navegación, títulos de vistas, textos de botones, mensajes de validación y mensajes de error.
8. THE Sistema_i18n SHALL mantener sin traducir los datos dinámicos introducidos por el usuario (nombres de eventos, nombres de tarifas, títulos de grupos).

### Requisito 8: Persistencia de configuración global (número de corte e idioma)

**Historia de Usuario:** Como desarrollador, quiero que la configuración global (número de corte e idioma) se persista de forma estructurada en la base de datos, para mantener la coherencia con el sistema de configuración existente.

#### Criterios de Aceptación

1. THE Sistema_Configuracion SHALL almacenar el Numero_Corte como un campo numérico en la configuración persistida en SQLite.
2. THE Sistema_Configuracion SHALL almacenar el Idioma_Activo como un campo de texto (código ISO 639-1: "es" o "en") en la configuración persistida en SQLite.
3. WHEN se solicita la configuración, THE Sistema_Configuracion SHALL devolver los valores actuales de Numero_Corte e Idioma_Activo junto con el resto de la configuración de la aplicación.
4. THE Sistema_Configuracion SHALL exponer canales IPC para leer y actualizar el Numero_Corte y el Idioma_Activo de forma independiente.
5. IF el valor de Numero_Corte no ha sido configurado previamente, THEN THE Sistema_Configuracion SHALL devolver el valor por defecto de 4.
6. IF el valor de Idioma_Activo no ha sido configurado previamente, THEN THE Sistema_Configuracion SHALL devolver el valor por defecto "es".

### Requisito 9: Agrupamiento de etiquetas según número de corte

**Historia de Usuario:** Como operador de la aplicación, quiero que al imprimir etiquetas individuales, estas se agrupen automáticamente en tiras del tamaño definido por el número de corte, para facilitar el corte físico de las etiquetas.

#### Criterios de Aceptación

1. WHEN el Sistema_Impresion genera etiquetas individuales para una venta, THE Sistema_Impresion SHALL agrupar las etiquetas en tiras de longitud igual al Numero_Corte configurado.
2. IF el número total de etiquetas no es divisible por el Numero_Corte, THEN THE Sistema_Impresion SHALL generar la última tira con las etiquetas restantes (longitud menor al Numero_Corte).
3. THE Sistema_Impresion SHALL insertar una marca de corte o separación entre cada tira generada en el PDF de impresión.
4. THE Sistema_Impresion SHALL obtener el Numero_Corte desde la configuración persistida al momento de generar cada trabajo de impresión.
5. WHEN el Numero_Corte cambia en la Vista_Configuracion, THE Sistema_Impresion SHALL utilizar el nuevo valor en los siguientes trabajos de impresión sin necesidad de reiniciar la aplicación.

### Requisito 10: Migración del esquema de datos para tipos de tarifa

**Historia de Usuario:** Como desarrollador, quiero que la base de datos se actualice para soportar los nuevos tipos de tarifa (individuales y tiras) y la restricción de un grupo por año, manteniendo compatibilidad con los datos existentes.

#### Criterios de Aceptación

1. THE Sistema_Grupos_Tarifas SHALL ejecutar una migración SQL que añada un campo de tipo (individual o tira) a la tabla de tarifas existente.
2. THE Sistema_Grupos_Tarifas SHALL ejecutar una migración SQL que añada un campo de cantidad de tarifas individuales que abarca (aplicable solo a tiras) a la tabla de tarifas existente.
3. THE Sistema_Grupos_Tarifas SHALL ejecutar una migración que modifique la restricción de unicidad para garantizar un solo grupo por año (reemplazando la restricción actual de año + título).
4. THE Sistema_Grupos_Tarifas SHALL migrar los datos existentes asignando el tipo "individual" a todas las tarifas creadas antes de esta migración.
5. IF la migración falla por datos inconsistentes, THEN THE Sistema_Grupos_Tarifas SHALL registrar un log de error detallado y revertir la transacción sin perder datos existentes.

### Requisito 11: Capa IPC para configuración global

**Historia de Usuario:** Como desarrollador, quiero que la configuración global (número de corte e idioma) exponga canales IPC adecuados, para permitir la comunicación entre el proceso principal y el renderer siguiendo los patrones establecidos.

#### Criterios de Aceptación

1. THE Sistema_Configuracion SHALL exponer un canal IPC `config:getCutNumber` que devuelva el Numero_Corte actual.
2. THE Sistema_Configuracion SHALL exponer un canal IPC `config:setCutNumber` que reciba un valor numérico y actualice el Numero_Corte en la base de datos.
3. THE Sistema_Configuracion SHALL exponer un canal IPC `config:getLanguage` que devuelva el Idioma_Activo actual.
4. THE Sistema_Configuracion SHALL exponer un canal IPC `config:setLanguage` que reciba un código de idioma y actualice el Idioma_Activo en la base de datos.
5. IF el valor recibido en `config:setCutNumber` está fuera del rango 2-16, THEN THE Sistema_Configuracion SHALL rechazar la operación y devolver un mensaje de error descriptivo.
6. IF el valor recibido en `config:setLanguage` no es "es" ni "en", THEN THE Sistema_Configuracion SHALL rechazar la operación y devolver un mensaje de error descriptivo.

### Requisito 12: Archivos de traducción

**Historia de Usuario:** Como desarrollador, quiero que las traducciones se organicen en archivos JSON separados por idioma, para facilitar el mantenimiento y la adición futura de nuevos idiomas.

#### Criterios de Aceptación

1. THE Sistema_i18n SHALL cargar las traducciones desde archivos JSON independientes, uno por idioma (es.json y en.json).
2. THE Sistema_i18n SHALL organizar las claves de traducción en una estructura jerárquica por secciones de la interfaz (navegación, vistas, validaciones, errores).
3. IF una clave de traducción no existe en el idioma activo, THEN THE Sistema_i18n SHALL mostrar la clave como texto de respaldo para facilitar la identificación de traducciones faltantes.
4. THE Sistema_i18n SHALL exponer una función de traducción (t) accesible desde cualquier componente React del renderer.
5. WHEN se añade un nuevo texto a la interfaz, THE Sistema_i18n SHALL requerir que se defina la traducción en ambos archivos de idioma (es.json y en.json).
