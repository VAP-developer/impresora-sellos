# Documento de Requisitos

## Introducción

Aplicación de escritorio offline-first para la venta de sellos (etiquetas postales ATM) en ferias filatélicas. Reemplaza las máquinas ATM actuales por un kit portátil (portátil + impresoras + software). Dirigida a vendedores no técnicos que necesitan una solución plug-and-play. Migración de la arquitectura legacy Meteor + Vue 3 + MongoDB + Python a Electron + React + SQLite + Node.js.

## Glosario

- **Sistema**: La aplicación de escritorio Electron para venta de sellos
- **Vendedor**: Usuario principal de la aplicación, operador no técnico en ferias filatélicas
- **Kiosko**: Vista principal de venta donde se seleccionan cantidades por tarifa
- **Tarifa**: Tipo de precio de etiqueta postal (A, A2, B, C, Tira A, Tira 4 Tarifas)
- **Rollo**: Rollo físico de etiquetas cargado en la impresora (rollo1 para modelo izquierdo, rollo2 para modelo derecho)
- **Modelo**: Imagen/motivo de fondo del sello (modelo1 = impresora izquierda, modelo2 = impresora derecha)
- **Evento**: Configuración de feria/evento activo con sus datos (nombre, lugar, fecha, modelos)
- **Perfil**: Modo de venta activo (Filatelia, Esporádicos, SPDE, Abono/Envío, FERIA)
- **Sesión**: Identificador incremental de cliente (campo `cliente` en configuración)
- **Código_Etiqueta**: Código impreso en cada sello con formato {modo}{mes}{país}{año} {máquina}-{cliente4dígitos}-{producto3dígitos}
- **Tira**: Conjunto de 4 etiquetas impresas en secuencia (consume 4 unidades del rollo + 1 ticket)
- **Ticket**: Factura simplificada impresa en impresora de tickets (78mm ancho x altura variable)
- **Límite_Importe**: Cantidad máxima en euros permitida por transacción
- **Cesta**: Conjunto de cantidades seleccionadas por tarifa antes de confirmar la venta
- **Impresora_IPP**: Impresora conectada vía protocolo IPP (Internet Printing Protocol)
- **PDF_Etiqueta**: Documento PDF de 55x25mm generado para cada etiqueta
- **PDF_Ticket**: Documento PDF de 78mm x altura variable generado como factura simplificada
- **Cola_Impresión**: Sistema de gestión de trabajos de impresión pendientes con persistencia

## Requisitos

### Requisito 1: Gestión de Venta de Sellos

**User Story:** Como vendedor, quiero seleccionar cantidades de sellos por tarifa y modelo para procesarlas como una venta, de modo que pueda atender a los clientes de forma rápida y sencilla.

#### Criterios de Aceptación

1. CUANDO el vendedor introduce una cantidad para una tarifa y modelo, EL Sistema DEBERÁ calcular el subtotal de esa línea multiplicando cantidad por precio de la tarifa
2. CUANDO el vendedor modifica cualquier cantidad en la cesta, EL Sistema DEBERÁ recalcular el total de la cesta sumando todos los subtotales de ambos modelos
3. CUANDO el vendedor pulsa el botón de imprimir, EL Sistema DEBERÁ validar que el total no excede el Límite_Importe configurado
4. CUANDO el total de la cesta excede el Límite_Importe, EL Sistema DEBERÁ rechazar la operación y mostrar un mensaje indicando el límite superado
5. CUANDO la venta se confirma exitosamente, EL Sistema DEBERÁ resetear todas las cantidades de la cesta a cero
6. CUANDO el vendedor introduce un valor negativo o no numérico, EL Sistema DEBERÁ normalizarlo a cero

### Requisito 2: Cálculo de Límites por Tarifa

**User Story:** Como vendedor, quiero ver el límite máximo de sellos que puedo vender de cada tarifa en tiempo real, de modo que no supere las restricciones de stock ni de importe.

#### Criterios de Aceptación

1. PARA tarifas simples (A, A2, B, C), EL Sistema DEBERÁ calcular el límite como el mínimo entre (presupuesto restante / precio de la tarifa) y el stock disponible del rollo correspondiente
2. PARA tiras (Tira A, Tira 4 Tarifas), EL Sistema DEBERÁ calcular el límite como el mínimo entre (presupuesto restante / precio de la tira), los tickets disponibles, y el stock del rollo dividido entre 4
3. CUANDO el vendedor modifica cualquier cantidad en la cesta, EL Sistema DEBERÁ recalcular todos los límites reflejando el presupuesto restante actualizado y el stock consumido
4. EL Sistema DEBERÁ mostrar los límites como números enteros redondeados hacia abajo (floor)

### Requisito 3: Gestión de Código de Etiqueta

**User Story:** Como vendedor, quiero que cada etiqueta lleve un código único e incremental, de modo que se pueda rastrear cada venta de forma inequívoca.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ formatear el Código_Etiqueta siguiendo el patrón: {modo}{mes}{país}{año} {máquina}-{cliente4dígitos}-{producto3dígitos}
2. CUANDO una venta se completa exitosamente, EL Sistema DEBERÁ incrementar el campo `cliente` exactamente en 1
3. CUANDO se anula una venta por error de impresión, EL Sistema DEBERÁ decrementar el campo `cliente` exactamente en 1
4. CUANDO el mes es octubre, EL Sistema DEBERÁ representarlo como "O"; noviembre como "N"; diciembre como "D"; y los meses 1-9 como su valor numérico
5. CUANDO el campo `mes` de configuración vale 0, EL Sistema DEBERÁ utilizar el mes actual del sistema
6. CUANDO el campo `año` de configuración vale "auto", EL Sistema DEBERÁ utilizar los dos últimos dígitos del año actual
7. EL Sistema DEBERÁ formatear el campo `cliente` con padding de ceros a la izquierda hasta completar 4 dígitos
8. SI el campo `cliente` excede 9999, ENTONCES EL Sistema DEBERÁ bloquear las ventas e indicar que se necesita un reset

### Requisito 4: Gestión de Rollos

**User Story:** Como vendedor, quiero que el sistema controle automáticamente el stock de etiquetas en cada rollo, de modo que no intente imprimir más sellos de los disponibles.

#### Criterios de Aceptación

1. CUANDO una venta se completa, EL Sistema DEBERÁ decrementar rollo1 por la suma de etiquetas individuales del modelo1 más 4 por cada tira del modelo1
2. CUANDO una venta se completa, EL Sistema DEBERÁ decrementar rollo2 por la suma de etiquetas individuales del modelo2 más 4 por cada tira del modelo2
3. CUANDO una venta incluye tiras, EL Sistema DEBERÁ decrementar el contador de tickets según el número de tiras más 2 (ticket principal + copia)
4. CUANDO se anula una venta por error, EL Sistema DEBERÁ restaurar exactamente las cantidades decrementadas en la venta anulada
5. SI el vendedor intenta vender más etiquetas de las disponibles en un rollo, ENTONCES EL Sistema DEBERÁ rechazar la operación con un mensaje indicando el rollo sin stock
6. EL Sistema DEBERÁ permitir el valor -1 en un rollo para indicar que está quitado/no instalado

### Requisito 5: Bloqueo de Evento

**User Story:** Como vendedor, quiero que el sistema impida cambios de evento cuando hay rollos instalados, de modo que no se mezclen configuraciones de diferentes eventos en un mismo rollo.

#### Criterios de Aceptación

1. MIENTRAS ambos rollos estén instalados (rollo1 ≠ -1 Y rollo2 ≠ -1), EL Sistema DEBERÁ impedir el cambio de evento activo
2. CUANDO ambos rollos están quitados (rollo1 = -1 Y rollo2 = -1), EL Sistema DEBERÁ permitir el cambio de evento
3. CUANDO se instala un rollo, EL Sistema DEBERÁ establecer su valor a la cantidad de etiquetas cargadas menos las desechadas

### Requisito 6: Generación de PDF de Etiquetas

**User Story:** Como vendedor, quiero que el sistema genere etiquetas en formato PDF con las dimensiones exactas de la impresora, de modo que cada sello se imprima correctamente.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ generar cada PDF_Etiqueta con dimensiones exactas de 55mm x 25mm
2. CUANDO se genera una etiqueta, EL Sistema DEBERÁ incluir: imagen de fondo del modelo, texto de tarifa, texto del evento, fecha, localidad y Código_Etiqueta
3. EL Sistema DEBERÁ posicionar el texto de tarifa en fuente Franklin Gothic 12pt en las coordenadas (2mm, 19.5mm)
4. EL Sistema DEBERÁ posicionar el Código_Etiqueta en fuente Franklin Gothic 6pt en las coordenadas (2mm, 15mm)
5. CUANDO la venta incluye tiras, EL Sistema DEBERÁ generar 4 etiquetas consecutivas en un solo trabajo de impresión
6. EL Sistema DEBERÁ generar un PDF independiente por cada tarifa con cantidad mayor a 0

### Requisito 7: Generación de Ticket (Factura Simplificada)

**User Story:** Como vendedor, quiero que el sistema genere un ticket de factura simplificada con todos los datos legales y de la transacción, de modo que el cliente reciba su comprobante de compra.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ generar el PDF_Ticket con ancho fijo de 78mm y altura variable proporcional al número de items vendidos
2. CUANDO se genera un ticket, EL Sistema DEBERÁ incluir: datos de empresa (nombre, CIF, CP), título del documento, fecha/hora, detalle de items, total, y textos legales configurados
3. CUANDO el perfil activo es "Filatelia", EL Sistema DEBERÁ modificar el título del ticket a "Filatelia de: {título_base}"
4. CUANDO el perfil activo es "Protocolo", EL Sistema DEBERÁ modificar el título del ticket a "Protocolo de: {título_base}"
5. CUANDO el perfil activo es "SPDE", EL Sistema DEBERÁ modificar el título del ticket a "SPDE de: {título_base}"
6. CUANDO la configuración `ImprimeCopiaTicket` vale "S", EL Sistema DEBERÁ generar una copia adicional del ticket con el título configurado en `tituloCopia`
7. CUANDO la configuración `ImprimeMasterTicket` vale "S", EL Sistema DEBERÁ generar un ticket master set adicional

### Requisito 8: Gestión de Impresión

**User Story:** Como vendedor, quiero que el sistema envíe automáticamente los PDFs a las impresoras correctas, de modo que no tenga que gestionar manualmente la impresión.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ enrutar las etiquetas del modelo1 exclusivamente a la impresora 1 (PRINTER_1) y las del modelo2 a la impresora 2 (PRINTER_2)
2. EL Sistema DEBERÁ enrutar todos los tickets a la impresora de tickets (PRINTER_TICKET)
3. CUANDO se envía una etiqueta a imprimir, EL Sistema DEBERÁ configurar el medio como DC55x25 y la orientación como landscape (valor 6)
4. CUANDO se envía un ticket a imprimir, EL Sistema DEBERÁ configurar el medio como Custom.78x{altura_variable}mm
5. SI una impresora no responde o devuelve error, ENTONCES EL Sistema DEBERÁ registrar el error en la Cola_Impresión y mantener el trabajo para reintento
6. CUANDO el vendedor pausa una impresora, EL Sistema DEBERÁ detener el envío de trabajos a esa impresora sin perder los trabajos pendientes
7. CUANDO el vendedor reanuda una impresora, EL Sistema DEBERÁ reenviar los trabajos pendientes acumulados

### Requisito 9: Capa de Abstracción de Impresora

**User Story:** Como desarrollador, quiero que la impresión funcione tanto en Linux (desarrollo) como en Windows (producción), de modo que pueda desarrollar y probar sin el hardware de producción.

#### Criterios de Aceptación

1. MIENTRAS el sistema operativo sea Linux, EL Sistema DEBERÁ utilizar CUPS como backend de impresión (comandos `lp`, `cupsdisable`, `cupsenable`)
2. MIENTRAS el sistema operativo sea Windows, EL Sistema DEBERÁ utilizar IPP directo como backend de impresión
3. EL Sistema DEBERÁ detectar automáticamente el sistema operativo y seleccionar el backend de impresión correspondiente
4. CUANDO se consulta el estado de las impresoras, EL Sistema DEBERÁ devolver la misma estructura de datos independientemente del backend utilizado

### Requisito 10: Anulación de Venta por Error de Impresión

**User Story:** Como vendedor, quiero poder anular la última venta si hubo un error de impresión, de modo que pueda corregir el problema sin perder la integridad del stock.

#### Criterios de Aceptación

1. CUANDO el vendedor solicita anular la última venta, EL Sistema DEBERÁ pedir confirmación antes de proceder
2. CUANDO se confirma la anulación, EL Sistema DEBERÁ revertir el incremento de sesión (decrementar `cliente` en 1)
3. CUANDO se confirma la anulación, EL Sistema DEBERÁ restaurar las cantidades exactas de rollos y tickets decrementadas en la última venta
4. CUANDO se confirma la anulación, EL Sistema DEBERÁ insertar un registro de orden con event="ELIMINAR ANTERIOR" para auditoría
5. SI no existe una venta anterior registrada para anular, ENTONCES EL Sistema DEBERÁ rechazar la operación e informar que no hay venta para anular

### Requisito 11: Atomicidad de Transacciones de Venta

**User Story:** Como vendedor, quiero que cada venta se procese de forma atómica, de modo que no queden inconsistencias si algo falla durante el proceso.

#### Criterios de Aceptación

1. CUANDO se procesa una venta, EL Sistema DEBERÁ ejecutar como transacción atómica: incremento de sesión, decremento de rollos, e inserción de registros de orden
2. SI alguno de los pasos de la transacción falla, ENTONCES EL Sistema DEBERÁ revertir todos los cambios realizados en esa transacción
3. EL Sistema DEBERÁ garantizar que no se generan PDFs ni se envían a impresora si la transacción de datos no se completó exitosamente

### Requisito 12: Configuración de Máquina

**User Story:** Como vendedor, quiero configurar los parámetros de la máquina (código de etiqueta, datos de ticket, rollos), de modo que pueda adaptar el sistema a cada feria.

#### Criterios de Aceptación

1. CUANDO el vendedor modifica la configuración de código (modo, mes, año, país, máquina), EL Sistema DEBERÁ persistir los cambios inmediatamente en la base de datos
2. CUANDO el vendedor modifica la configuración de ticket (feria, lugar, empresa, textos legales, límites), EL Sistema DEBERÁ persistir los cambios inmediatamente
3. CUANDO el vendedor modifica los contadores de rollos, EL Sistema DEBERÁ actualizar el stock disponible reflejado en la vista de Kiosko
4. EL Sistema DEBERÁ validar que los precios de tarifas son valores numéricos positivos mayores que cero

### Requisito 13: Configuración de Impresión (Perfiles y Eventos)

**User Story:** Como vendedor, quiero gestionar perfiles de venta y eventos, de modo que pueda alternar entre diferentes configuraciones según la feria.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ soportar hasta 6 perfiles de venta con nombres editables (Filatelia, Esporádicos, SPDE, editable, Abono/Envío, FERIA)
2. EL Sistema DEBERÁ soportar hasta 8 eventos (índices 0-7) con datos: nombre, feria, lugar, modelo izquierdo, modelo derecho, fecha, localidad
3. CUANDO el vendedor cambia el evento activo, EL Sistema DEBERÁ actualizar los modelos mostrados en Kiosko con los motivos del nuevo evento
4. CUANDO el vendedor cambia el perfil activo, EL Sistema DEBERÁ ajustar el Límite_Importe según corresponda (perfil 6/FERIA usa `limiteImporte`, otros usan `NUEVOlimiteImporte`)

### Requisito 14: Gestión de Imágenes

**User Story:** Como vendedor, quiero subir y gestionar las imágenes de fondo de los sellos, de modo que pueda personalizar los motivos según el evento.

#### Criterios de Aceptación

1. CUANDO el vendedor sube una imagen, EL Sistema DEBERÁ almacenarla como data URI (Base64) en la base de datos con nombre único
2. CUANDO el vendedor elimina una imagen, EL Sistema DEBERÁ removerla de la base de datos
3. CUANDO se genera un PDF de etiqueta, EL Sistema DEBERÁ utilizar la imagen correspondiente al motivo configurado para el modelo activo
4. SI la imagen del motivo no existe en la base de datos, ENTONCES EL Sistema DEBERÁ utilizar la imagen de fondo por defecto (fondoetiqueta-nada.png)

### Requisito 15: Exportación de Datos

**User Story:** Como vendedor, quiero exportar las ventas realizadas en formato CSV, de modo que pueda llevar un registro contable de las transacciones.

#### Criterios de Aceptación

1. CUANDO el vendedor solicita la exportación, EL Sistema DEBERÁ generar un archivo CSV con separador punto y coma conteniendo todos los registros de órdenes
2. EL Sistema DEBERÁ incluir en la exportación todos los campos del registro de orden sin excepción
3. EL Sistema DEBERÁ generar la exportación completamente offline sin requerir conexión a internet

### Requisito 16: Funcionamiento Offline-First

**User Story:** Como vendedor, quiero que la aplicación funcione al 100% sin conexión a internet, de modo que pueda operar en ferias sin depender de infraestructura de red.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ ser 100% funcional (ventas, impresión, configuración, exportación) sin conexión a internet
2. EL Sistema DEBERÁ almacenar todos los datos en una base de datos SQLite local
3. CUANDO hay conexión a internet disponible, EL Sistema DEBERÁ ofrecer sincronización opcional con la nube
4. CUANDO la sincronización se ejecuta, EL Sistema DEBERÁ ser idempotente y no duplicar registros

### Requisito 17: Instalación y Arranque

**User Story:** Como vendedor, quiero instalar la aplicación con un solo ejecutable y que arranque rápidamente, de modo que no necesite conocimientos técnicos para ponerla en marcha.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ empaquetarse como un único instalador .exe para Windows sin dependencias externas (sin Java, Python ni servidores)
2. EL Sistema DEBERÁ arrancar y mostrar la vista de Kiosko operativa en menos de 3 segundos
3. DONDE se configure el auto-arranque, EL Sistema DEBERÁ iniciarse automáticamente con el sistema operativo Windows
4. EL Sistema DEBERÁ incluir las fuentes Franklin Gothic (3 variantes) embebidas sin requerir instalación aparte

### Requisito 18: Rendimiento de Impresión

**User Story:** Como vendedor, quiero que la impresión sea rápida para no hacer esperar al cliente, de modo que la experiencia de venta sea fluida.

#### Criterios de Aceptación

1. CUANDO el vendedor confirma una venta, EL Sistema DEBERÁ enviar los trabajos de impresión a las impresoras en menos de 2 segundos (excluyendo la generación de PDFs complejos)
2. EL Sistema DEBERÁ persistir los trabajos de impresión en la Cola_Impresión antes de enviarlos, garantizando que no se pierdan ante un fallo

### Requisito 19: Navegación y Estructura de Vistas

**User Story:** Como vendedor, quiero navegar fácilmente entre las diferentes secciones de la aplicación, de modo que pueda acceder rápidamente a configuración y venta.

#### Criterios de Aceptación

1. EL Sistema DEBERÁ ofrecer 5 vistas accesibles: Home (menú), Kiosko (venta), Máquina (configuración de código y ticket), Imprimir (perfiles y eventos), SubirImagen (gestión de imágenes)
2. CUANDO el vendedor navega entre vistas, EL Sistema DEBERÁ preservar el estado de la configuración y la cesta sin pérdida de datos
3. EL Sistema DEBERÁ mostrar la vista de Kiosko como pantalla principal de trabajo con acceso directo desde Home
