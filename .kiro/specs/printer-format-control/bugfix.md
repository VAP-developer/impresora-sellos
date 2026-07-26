# Documento de Requisitos del Bugfix

## Introducción

Este documento cubre dos bugs relacionados con el control de formato de impresión en la aplicación de venta de sellos:

1. **Escalado no deseado del ticket**: Cuando la altura del ticket supera los 200mm (límite configurado en la impresora Brother), el contenido se escala/reduce para ajustarse al papel, en lugar de imprimir a tamaño real con la altura correcta.

2. **Solapamiento de texto e imagen en etiquetas de sellos**: En las etiquetas de 55×25mm, el texto (evento, fecha) y la imagen del sello (PNG decorativo) se superponen porque la imagen ocupa toda la etiqueta y el texto se posiciona sobre el área de la imagen.

Ambos bugs impiden que el programa tenga control absoluto sobre el formato de impresión.

## Análisis del Bug

### Comportamiento Actual (Defecto)

1.1 CUANDO la altura calculada del ticket (vía `calcTicketHeightMm()`) supera los 200mm ENTONCES el sistema envía el media size `Custom.78x{height}mm` pero el driver de la impresora Brother/CUPS escala el contenido del PDF para ajustarse al máximo de 200mm configurado, reduciendo el tamaño del texto y los elementos del ticket

1.2 CUANDO se imprime un ticket vía CUPS backend ENTONCES el sistema no envía la opción `fit-to-page=no` ni ninguna directiva que prevenga el escalado automático por parte del driver

1.3 CUANDO se renderiza una etiqueta de sello con imagen de sello (overlayImage/sello PNG) ENTONCES el sistema dibuja la imagen del sello a tamaño completo 55×25mm cubriendo toda la superficie de la etiqueta (posición x=0, y=0, width=STAMP_WIDTH, height=STAMP_HEIGHT)

1.4 CUANDO se renderiza el texto "evento" en una etiqueta de sello ENTONCES el sistema posiciona el texto alineado a la derecha en x=53mm, lo cual cae sobre el área derecha donde debería estar exclusivamente la imagen del sello

1.5 CUANDO se renderiza el texto "fecha" en una etiqueta de sello ENTONCES el sistema posiciona el texto alineado a la derecha en x=53mm, lo cual cae sobre el área derecha donde debería estar exclusivamente la imagen del sello

### Comportamiento Esperado (Correcto)

2.1 CUANDO la altura calculada del ticket supera los 200mm ENTONCES el sistema SHALL enviar opciones de impresión que impidan el escalado automático (por ejemplo `fit-to-page=no`) para que el ticket se imprima a tamaño real sin reducción de texto, incluso si excede el límite configurado estándar de la impresora

2.2 CUANDO se imprime un ticket vía CUPS backend ENTONCES el sistema SHALL incluir la opción `-o fit-to-page=no` en el comando `lp` para garantizar que el PDF se envía sin transformación de escalado

2.3 CUANDO se renderiza una etiqueta de sello con imagen de sello (overlayImage/sello PNG) ENTONCES el sistema SHALL posicionar la imagen del sello únicamente en la mitad derecha de la etiqueta (aproximadamente x=27.5mm hasta x=55mm, altura completa 25mm)

2.4 CUANDO se renderiza el texto "evento" en una etiqueta de sello ENTONCES el sistema SHALL posicionar el texto exclusivamente en la mitad izquierda de la etiqueta (x entre 0mm y aproximadamente 27.5mm), sin invadir el área de la imagen del sello

2.5 CUANDO se renderiza el texto "fecha" en una etiqueta de sello ENTONCES el sistema SHALL posicionar el texto exclusivamente en la mitad izquierda de la etiqueta (x entre 0mm y aproximadamente 27.5mm), sin invadir el área de la imagen del sello

### Comportamiento Sin Cambios (Prevención de Regresión)

3.1 CUANDO la altura calculada del ticket es menor o igual a 200mm ENTONCES el sistema SHALL CONTINUAR generando el media size `Custom.78x{height}mm` y el ticket se imprime correctamente sin necesidad de opciones adicionales

3.2 CUANDO se imprimen etiquetas de sellos a la impresora de etiquetas ENTONCES el sistema SHALL CONTINUAR usando el media `DC55x25` con orientación landscape (6)

3.3 CUANDO se renderiza el texto "tarifa" en una etiqueta de sello ENTONCES el sistema SHALL CONTINUAR posicionando el texto en x=2mm (mitad izquierda), manteniendo su posición actual correcta

3.4 CUANDO se renderiza el texto "codigo" en una etiqueta de sello ENTONCES el sistema SHALL CONTINUAR posicionando el texto en x=2mm (mitad izquierda), manteniendo su posición actual correcta

3.5 CUANDO se renderiza una etiqueta con imagen de fondo (backgroundImage/fondo) ENTONCES el sistema SHALL CONTINUAR dibujando la imagen de fondo a tamaño completo 55×25mm como capa base

3.6 CUANDO se genera un ticket con pocos items (altura ≤ 200mm) ENTONCES el sistema SHALL CONTINUAR calculando la altura dinámicamente y generando el PDF con las mismas dimensiones y layout que antes

3.7 CUANDO se imprimen tiras especiales (E1, E2, E3, E4) ENTONCES el sistema SHALL CONTINUAR usando el layout existente sin modificaciones, ya que estas no usan overlayImage ni los textos evento/fecha posicionados a la derecha

3.8 CUANDO se imprime vía IPP backend (Windows) ENTONCES el sistema SHALL CONTINUAR enviando los trabajos con las mismas opciones IPP actuales sin cambios, ya que el bug de escalado es específico de CUPS/Brother
