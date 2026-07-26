# Documento de Requisitos del Bugfix

## Introducción

Este documento cubre tres bugs críticos al imprimir etiquetas de sellos en Windows con una impresora térmica Brother TD-4100N conectada por USB (esquema URI `win://`). La ruta de impresión usa `pdf-to-printer` (motor SumatraPDF) para enviar PDFs al spooler de Windows.

Bugs identificados:

1. **Contenido invertido 180°**: Las etiquetas salen con la imagen abajo y el texto arriba, cuando debería ser al revés (imagen arriba, texto abajo). El contenido del PDF no coincide con la dirección de alimentación del papel térmico.

2. **Doble impresión**: Por cada sello solicitado se imprimen 2 etiquetas físicas en vez de 1.

3. **Falta de control dedicado para impresora térmica**: El método `printViaWindowsSpooler()` usa configuración genérica (`noscale,portrait`) para todas las impresoras `win://`, sin parámetros específicos para impresoras térmicas de etiquetas (tamaño de página, alimentación, orientación exacta).

Hardware: Brother TD-4100N, rollo de 55mm de ancho con etiquetas pre-cortadas de 25mm de largo. El papel se alimenta por la dirección de 25mm (cada etiqueta avanza 25mm al salir).

## Análisis del Bug

### Comportamiento Actual (Defecto)

1.1 CUANDO se imprime una etiqueta de sello vía `win://` en la Brother TD-4100N ENTONCES el contenido sale invertido 180°: la imagen aparece en la parte inferior de la etiqueta y el texto en la parte superior, en lugar del orden correcto (imagen arriba, texto abajo)

1.2 CUANDO `printViaWindowsSpooler()` envía el PDF a SumatraPDF ENTONCES usa los parámetros genéricos `noscale,portrait` que no controlan la rotación del contenido respecto a la dirección de alimentación del papel térmico, causando que el driver de la Brother interprete la orientación incorrectamente

1.3 CUANDO se solicita imprimir 1 sello desde la venta ENTONCES la impresora Brother TD-4100N produce 2 etiquetas físicas, duplicando el trabajo de impresión

1.4 CUANDO `printViaWindowsSpooler()` recibe un trabajo de impresión para un sello ENTONCES el sistema no distingue entre impresoras térmicas de etiquetas e impresoras normales — aplica los mismos parámetros genéricos a todas

1.5 CUANDO se necesita configurar parámetros específicos de la impresora térmica (tamaño exacto de página 55×25mm, sin escalado, sin rotación, una sola copia) ENTONCES no existe ningún mecanismo para especificar estas opciones en la ruta `win://`

### Comportamiento Esperado (Correcto)

2.1 CUANDO se imprime una etiqueta de sello vía `win://` en la Brother TD-4100N ENTONCES el sistema SHALL rotar el contenido del PDF 180° (o aplicar la transformación equivalente) para que la etiqueta salga con la imagen en la parte superior y el texto en la parte inferior, coincidiendo con la dirección de alimentación del papel

2.2 CUANDO `printViaWindowsSpooler()` envía el PDF a SumatraPDF para una impresora térmica ENTONCES el sistema SHALL incluir parámetros de impresión que garanticen la orientación correcta del contenido respecto a la dirección de alimentación del papel térmico

2.3 CUANDO se solicita imprimir 1 sello ENTONCES el sistema SHALL producir exactamente 1 etiqueta física — no más, no menos

2.4 CUANDO `printViaWindowsSpooler()` recibe un trabajo para una impresora térmica de etiquetas ENTONCES el sistema SHALL utilizar una configuración dedicada que incluya: tamaño de página exacto (55×25mm o 25×55mm según orientación del PDF), sin escalado, y control explícito del número de copias

2.5 CUANDO se imprime en la Brother TD-4100N vía `win://` ENTONCES el sistema SHALL tener un mecanismo (función dedicada, opciones configurables, o detección de tipo de impresora) para aplicar parámetros específicos de impresoras térmicas, separados de la lógica genérica de impresoras normales

### Comportamiento Sin Cambios (Prevención de Regresión)

3.1 CUANDO se imprime vía impresoras IPP de red (esquema `ipp://`) ENTONCES el sistema SHALL CONTINUAR usando el flujo IPP actual sin cambios

3.2 CUANDO se imprimen tickets (pdfType `ticket`, `ticket_caja`, `ticket_master`) vía `win://` ENTONCES el sistema SHALL CONTINUAR imprimiendo con la configuración actual genérica sin aplicar la transformación de impresora térmica

3.3 CUANDO se genera el PDF de una etiqueta de sello ENTONCES el sistema SHALL CONTINUAR generando el contenido con el mismo layout interno (imagen, overlay, tarifa, evento, fecha, código en sus posiciones actuales)

3.4 CUANDO se encola un trabajo de impresión vía `PrintQueueService.enqueue()` ENTONCES el sistema SHALL CONTINUAR encolando exactamente un job por cada PDF generado, sin duplicación a nivel de cola

3.5 CUANDO se usa `pdf-to-printer` para impresoras normales (no térmicas de etiquetas) vía `win://` ENTONCES el sistema SHALL CONTINUAR usando los parámetros genéricos `noscale,portrait` actuales

3.6 CUANDO se imprime vía CUPS backend en Linux ENTONCES el sistema SHALL CONTINUAR usando el flujo CUPS actual con `fit-to-page=no` y `orientation-requested=3` sin cambios
