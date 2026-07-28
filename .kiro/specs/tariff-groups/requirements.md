# Documento de Requisitos

## Introducción

Este documento define los requisitos para el sistema de gestión de grupos de tarifas. Actualmente las tarifas (A, A2, B, C, Tira A, Tira 4 Tarifas) están fijadas en la configuración y renderizadas de forma estática en la vista kiosko. El nuevo sistema permite crear grupos de tarifas reutilizables, asociarlos a eventos y que la vista kiosko se adapte dinámicamente mostrando las tarifas del grupo seleccionado.

Cada grupo de tarifas contiene entre 2 y 10 tarifas. Cada tarifa tiene un nombre (máximo 16 caracteres) y un precio. Los grupos se organizan por año y título, siguiendo el mismo patrón organizativo que los eventos. Además, cada grupo tiene un tipo de moneda que aplica a todos los precios del grupo. Los grupos se gestionan dentro de la Vista_Imprimir existente (la vista de configuración de impresión que ya gestiona perfiles y eventos) con operaciones CRUD completas, y se vinculan a los eventos en el momento de su creación o edición.

## Glosario

- **Grupo_Tarifas**: Entidad que agrupa un conjunto de tarifas reutilizable. Se persiste en SQLite con un año, un título, un tipo de moneda y se asocia a eventos.
- **Tarifa**: Elemento individual dentro de un Grupo_Tarifas. Tiene un nombre (máximo 16 caracteres) y un precio numérico positivo.
- **Tipo_Moneda**: Campo de texto en un Grupo_Tarifas que indica la divisa aplicable a todos los precios del grupo (por ejemplo: "EUR", "USD", "GBP").
- **Sistema_Grupos_Tarifas**: Módulo del proceso principal (main process) responsable de la gestión CRUD de grupos de tarifas y sus tarifas individuales, incluyendo persistencia en SQLite y exposición de canales IPC.
- **Vista_Imprimir**: Vista existente del frontend de configuración de impresión donde el usuario gestiona perfiles y eventos. Se amplía con una sección para crear, editar y eliminar grupos de tarifas y las tarifas contenidas en cada grupo.
- **Vista_Kiosko**: Vista principal de venta que muestra las tarifas del grupo asociado al evento activo con campos de cantidad para cada modelo de sello, incluyendo el tipo de moneda del grupo.
- **Vista_Eventos**: Vista del frontend donde el usuario crea y edita eventos, incluyendo la selección del grupo de tarifas asociado.
- **Evento**: Entidad existente que representa una feria o evento filatélico. Se amplía con un campo de referencia al Grupo_Tarifas.
- **Evento_Activo**: El evento actualmente seleccionado por el usuario en la aplicación, cuyo Grupo_Tarifas determina qué tarifas se muestran en la Vista_Kiosko.

## Requisitos

### Requisito 1: Persistencia de grupos de tarifas en SQLite

**Historia de Usuario:** Como operador de la aplicación, quiero que los grupos de tarifas se almacenen de forma persistente en la base de datos, para poder reutilizarlos entre distintos eventos y sesiones.

#### Criterios de Aceptación

1. THE Sistema_Grupos_Tarifas SHALL almacenar cada Grupo_Tarifas en una tabla SQLite con un identificador único, un título descriptivo, un campo de año (entero), un campo de tipo de moneda (texto) y marcas de tiempo de creación y última modificación.
2. THE Sistema_Grupos_Tarifas SHALL almacenar cada Tarifa en una tabla SQLite con un identificador único, una referencia al Grupo_Tarifas al que pertenece, un nombre de máximo 16 caracteres, un precio numérico positivo y un campo de orden para mantener la posición dentro del grupo.
3. WHEN se elimina un Grupo_Tarifas, THE Sistema_Grupos_Tarifas SHALL eliminar en cascada todas las Tarifas asociadas a ese grupo.
4. THE Sistema_Grupos_Tarifas SHALL garantizar que la combinación de año y título de cada Grupo_Tarifas sea única dentro de la base de datos.
5. THE Sistema_Grupos_Tarifas SHALL crear un índice en la columna de año para permitir búsquedas rápidas de grupos por año.

### Requisito 2: Creación de grupos de tarifas

**Historia de Usuario:** Como operador de la aplicación, quiero poder crear nuevos grupos de tarifas con un año, un título, un tipo de moneda y un conjunto inicial de tarifas, para configurar los precios que aplicaré a cada evento.

#### Criterios de Aceptación

1. WHEN el usuario solicita crear un Grupo_Tarifas, THE Vista_Imprimir SHALL mostrar un formulario con campos para el año, el título del grupo, el tipo de moneda y una lista editable de tarifas.
2. WHEN el usuario envía el formulario de creación con datos válidos, THE Sistema_Grupos_Tarifas SHALL crear el Grupo_Tarifas y todas sus Tarifas asociadas en SQLite de forma atómica.
3. IF la combinación de año y título del Grupo_Tarifas ya existe en la base de datos, THEN THE Sistema_Grupos_Tarifas SHALL rechazar la creación y devolver un mensaje de error indicando que ya existe un grupo con ese año y título.
4. IF el formulario de creación contiene menos de 2 tarifas, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que se requieren al menos 2 tarifas.
5. IF el formulario de creación contiene más de 10 tarifas, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el máximo permitido es 10 tarifas.
6. IF el campo de tipo de moneda está vacío, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el tipo de moneda es obligatorio.

### Requisito 3: Edición de grupos de tarifas

**Historia de Usuario:** Como operador de la aplicación, quiero poder modificar los grupos de tarifas existentes (cambiar título, año, tipo de moneda, añadir, eliminar o modificar tarifas), para ajustar los precios según las necesidades de cada temporada.

#### Criterios de Aceptación

1. WHEN el usuario selecciona un Grupo_Tarifas para editar, THE Vista_Imprimir SHALL mostrar el formulario precargado con el año, el título del grupo, el tipo de moneda y todas sus Tarifas actuales.
2. WHEN el usuario envía el formulario de edición con datos válidos, THE Sistema_Grupos_Tarifas SHALL actualizar el Grupo_Tarifas y sincronizar las Tarifas (crear nuevas, actualizar existentes, eliminar las removidas) de forma atómica.
3. IF la edición resulta en menos de 2 tarifas en el grupo, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que se requieren al menos 2 tarifas.
4. IF la edición resulta en más de 10 tarifas en el grupo, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el máximo permitido es 10 tarifas.
5. IF la nueva combinación de año y título del Grupo_Tarifas ya existe en otro grupo, THEN THE Sistema_Grupos_Tarifas SHALL rechazar la actualización y devolver un mensaje de error indicando que ya existe un grupo con ese año y título.
6. IF el campo de tipo de moneda queda vacío tras la edición, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el tipo de moneda es obligatorio.

### Requisito 4: Eliminación de grupos de tarifas

**Historia de Usuario:** Como operador de la aplicación, quiero poder eliminar grupos de tarifas que ya no necesito, para mantener la lista de grupos organizada y sin entradas obsoletas.

#### Criterios de Aceptación

1. WHEN el usuario solicita eliminar un Grupo_Tarifas, THE Vista_Imprimir SHALL mostrar una confirmación antes de proceder.
2. WHEN el usuario confirma la eliminación, THE Sistema_Grupos_Tarifas SHALL eliminar el Grupo_Tarifas y todas sus Tarifas asociadas de SQLite.
3. IF el Grupo_Tarifas está asociado a uno o más Eventos, THEN THE Sistema_Grupos_Tarifas SHALL impedir la eliminación y devolver un mensaje de error indicando qué eventos utilizan ese grupo.

### Requisito 5: Validación de tarifas individuales

**Historia de Usuario:** Como operador de la aplicación, quiero que el sistema valide el nombre y precio de cada tarifa al crearla o editarla, para evitar datos incorrectos que generen problemas en la impresión o el cálculo de precios.

#### Criterios de Aceptación

1. IF el nombre de una Tarifa supera los 16 caracteres, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el nombre no puede exceder 16 caracteres.
2. IF el nombre de una Tarifa está vacío, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el nombre es obligatorio.
3. IF el precio de una Tarifa es menor o igual a cero, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el precio debe ser un número positivo.
4. IF el precio de una Tarifa no es un valor numérico válido, THEN THE Vista_Imprimir SHALL impedir el envío y mostrar un mensaje indicando que el precio debe ser un número válido.
5. THE Sistema_Grupos_Tarifas SHALL validar las mismas reglas en el backend antes de persistir los datos, rechazando la operación con un mensaje descriptivo si alguna regla se incumple.

### Requisito 6: Asociación de grupo de tarifas a eventos

**Historia de Usuario:** Como operador de la aplicación, quiero seleccionar un grupo de tarifas al crear o editar un evento, para que ese evento tenga los precios y nombres de tarifa correctos durante la venta.

#### Criterios de Aceptación

1. WHEN el usuario crea un Evento, THE Vista_Eventos SHALL mostrar un selector desplegable con todos los Grupos_Tarifas disponibles.
2. WHEN el usuario edita un Evento existente, THE Vista_Eventos SHALL mostrar el selector desplegable con el Grupo_Tarifas actualmente asociado preseleccionado.
3. IF el usuario intenta guardar un Evento sin seleccionar un Grupo_Tarifas, THEN THE Vista_Eventos SHALL impedir el guardado y mostrar un mensaje indicando que la selección de un grupo de tarifas es obligatoria.
4. WHEN el usuario guarda el Evento con un Grupo_Tarifas seleccionado, THE Sistema_Grupos_Tarifas SHALL persistir la referencia al Grupo_Tarifas en el registro del Evento en SQLite.
5. THE Sistema_Grupos_Tarifas SHALL almacenar la referencia al Grupo_Tarifas como un campo `tariff_group_id` en la tabla de eventos.

### Requisito 7: Adaptación dinámica de la vista kiosko

**Historia de Usuario:** Como operador de la aplicación, quiero que la vista de venta (kiosko) muestre dinámicamente las tarifas del grupo asociado al evento activo, para poder vender con los precios correctos sin configuración manual.

#### Criterios de Aceptación

1. WHEN el usuario activa un Evento que tiene un Grupo_Tarifas asociado, THE Vista_Kiosko SHALL renderizar una fila por cada Tarifa del grupo, mostrando el nombre, precio y tipo de moneda del Grupo_Tarifas.
2. WHEN el Grupo_Tarifas del Evento_Activo contiene N tarifas, THE Vista_Kiosko SHALL mostrar exactamente N filas de tarifa en cada columna de modelo de sello (Sello A y Sello B).
3. THE Vista_Kiosko SHALL mostrar las tarifas en el orden definido por el campo de orden de cada Tarifa dentro del Grupo_Tarifas.
4. WHEN el Evento_Activo cambia a otro evento con un Grupo_Tarifas diferente, THE Vista_Kiosko SHALL actualizar las filas de tarifa para reflejar el nuevo grupo sin necesidad de recargar la aplicación.
5. IF el Evento_Activo no tiene un Grupo_Tarifas asociado, THEN THE Vista_Kiosko SHALL mostrar un mensaje indicando que el evento no tiene tarifas configuradas y no renderizar filas de tarifa.
6. THE Vista_Kiosko SHALL mostrar el Tipo_Moneda del Grupo_Tarifas junto a los precios de cada Tarifa.

### Requisito 8: Capa IPC para grupos de tarifas

**Historia de Usuario:** Como desarrollador, quiero que el sistema de grupos de tarifas exponga canales IPC adecuados, para mantener la separación entre el proceso principal y el renderer siguiendo el mismo patrón que los eventos.

#### Criterios de Aceptación

1. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:getAll` que devuelva todos los Grupos_Tarifas con sus Tarifas incluidas.
2. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:getByYear` que reciba un año y devuelva todos los Grupos_Tarifas de ese año con sus Tarifas incluidas.
3. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:getById` que reciba un identificador y devuelva el Grupo_Tarifas correspondiente con todas sus Tarifas.
4. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:create` que reciba los datos de un nuevo Grupo_Tarifas con sus Tarifas y devuelva el grupo creado.
5. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:update` que reciba el identificador y los datos actualizados del Grupo_Tarifas con sus Tarifas y devuelva el grupo actualizado.
6. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:delete` que reciba un identificador y devuelva el resultado de la operación de eliminación.
7. THE Sistema_Grupos_Tarifas SHALL exponer un canal IPC `tariff-groups:getYears` que devuelva todos los años distintos que tienen grupos de tarifas, ordenados de forma descendente.
8. IF ocurre un error en cualquier operación IPC del Sistema_Grupos_Tarifas, THEN THE Sistema_Grupos_Tarifas SHALL devolver un mensaje de error descriptivo al frontend sin provocar un cierre inesperado de la aplicación.

### Requisito 9: Listado y organización de grupos de tarifas por año

**Historia de Usuario:** Como operador de la aplicación, quiero ver los grupos de tarifas organizados por año y título, para poder identificar y seleccionar el grupo adecuado siguiendo el mismo patrón que los eventos.

#### Criterios de Aceptación

1. THE Vista_Imprimir SHALL mostrar un listado de los años disponibles que contienen grupos de tarifas, ordenados de forma descendente.
2. WHEN el usuario selecciona un año, THE Vista_Imprimir SHALL mostrar todos los Grupos_Tarifas de ese año con su título, tipo de moneda y el número de tarifas que contiene cada grupo.
3. WHEN el usuario selecciona un Grupo_Tarifas del listado, THE Vista_Imprimir SHALL mostrar el detalle de todas las Tarifas del grupo (nombre y precio de cada una) en el orden definido.
4. THE Vista_Imprimir SHALL permitir acceder a las acciones de crear, editar y eliminar grupos desde la misma sección dentro de la vista de configuración de impresión.
