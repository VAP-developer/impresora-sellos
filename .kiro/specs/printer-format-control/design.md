# Printer Format Control - Diseño del Bugfix

## Overview

Este documento describe el enfoque técnico para corregir dos bugs relacionados con el control de formato de impresión:

1. **Escalado de tickets (CUPS)**: El backend CUPS no envía `fit-to-page=no` al comando `lp`, lo que permite que el driver escale el contenido cuando la altura excede el límite configurado en la impresora (200mm en Brother).

2. **Layout de etiquetas de sellos**: La imagen del sello (overlayImage) ocupa toda la etiqueta 55×25mm y los textos "evento" y "fecha" se posicionan en la mitad derecha (x=53mm), causando solapamiento visual.

La estrategia de corrección es mínima e invasiva: agregar una opción al comando `lp` y ajustar coordenadas en el renderer de stamps.

## Glossary

- **Bug_Condition (C)**: Condición que activa el bug — (1) impresión vía CUPS sin `fit-to-page=no`; (2) posicionamiento incorrecto de overlay/texto en la etiqueta
- **Property (P)**: Comportamiento deseado — (1) el comando `lp` siempre incluye `fit-to-page=no`; (2) el overlay se dibuja solo en la mitad derecha y los textos evento/fecha en la mitad izquierda
- **Preservation**: Comportamiento existente que no debe cambiar — impresión IPP, posición de tarifa/codigo, imagen de fondo a tamaño completo, tiras especiales
- **CupsBackend.print()**: Método en `src/main/printing/cups-backend.ts` que construye y ejecuta el comando `lp`
- **drawBackground()**: Función en `src/main/printing/stamp-renderer.ts` que dibuja una imagen sobre la etiqueta
- **STAMP_WIDTH_MM**: Constante = 55mm (ancho total de la etiqueta)
- **STAMP_HEIGHT_MM**: Constante = 25mm (alto total de la etiqueta)
- **Punto medio**: 27.5mm — divide la etiqueta en mitad izquierda (texto) y mitad derecha (sello/overlay)

## Bug Details

### Bug Condition

El bug se manifiesta en dos escenarios independientes:

**Bug 1**: Cuando se imprime cualquier PDF vía el backend CUPS, el comando `lp` no incluye la opción `fit-to-page=no`. Esto permite que el driver de la impresora escale automáticamente el contenido cuando las dimensiones del PDF exceden los límites configurados.

**Bug 2**: Cuando se renderiza una etiqueta con `overlayImage` (sello PNG), la función `drawBackground()` dibuja la imagen a tamaño completo (0, 0, 55mm, 25mm) en lugar de solo la mitad derecha. Adicionalmente, los textos "evento" y "fecha" se posicionan alineados a la derecha en x=53mm, invadiendo el área de la imagen del sello.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PrintJob | StampRenderCall
  OUTPUT: boolean
  
  IF input.type == "print_job" THEN
    RETURN input.backend == "cups"
           AND NOT commandArgs(input).contains("fit-to-page=no")
  END IF
  
  IF input.type == "stamp_render" THEN
    RETURN (input.overlayImage != null
            AND overlayPosition(input).x < 27.5)
           OR (input.textoEvento != null
               AND textoEventoPosition(input).x >= 27.5)
           OR (input.textoFecha != null
               AND textoFechaPosition(input).x >= 27.5)
  END IF
  
  RETURN false
END FUNCTION
```

### Examples

- **Bug 1**: Se imprime un ticket de 250mm de alto → el comando ejecutado es `lp -d Brother -o media=Custom.78x250mm -o orientation-requested=3 /tmp/file.pdf` — falta `-o fit-to-page=no` → el driver escala el contenido a 200mm
- **Bug 1**: Se imprime una etiqueta de 55×25mm → mismo problema, pero al ser más pequeña no se nota el escalado. La corrección aplica igual para consistencia.
- **Bug 2**: Se renderiza una etiqueta con sello → la imagen PNG se dibuja desde x=0mm cubriendo 55mm de ancho → el texto "evento" en x=53mm queda debajo de la imagen
- **Bug 2**: Se renderiza "evento" = "Madrid" alineado derecha en x=53mm → el texto aparece entre ~45mm y 53mm → se solapa con la imagen del sello que debería estar en la mitad derecha (27.5-55mm)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- La impresión vía IPP backend (Windows) no se modifica — no necesita `fit-to-page=no`
- El media size `Custom.78x{height}mm` se sigue calculando igual para tickets
- El media `DC55x25` con orientación landscape (6) se sigue usando para etiquetas
- La imagen de fondo (`backgroundImage`) se sigue dibujando a tamaño completo 55×25mm
- Los textos "tarifa" (x=2mm) y "codigo" (x=2mm) mantienen su posición actual
- Las tiras especiales (E1-E4) no se modifican — no usan overlayImage ni textos evento/fecha posicionados a la derecha
- `renderStampBlank()` y las funciones `renderStampE1-E4` no se ven afectadas
- El `CupsBackend.getStatus()`, `pause()`, `resume()`, `discover()` y `cancelJob()` no se modifican

**Scope:**
Todas las entradas que NO involucren: (1) impresión CUPS, o (2) renderizado de etiquetas con overlayImage/textos evento/fecha, deben permanecer completamente sin cambios.

## Hypothesized Root Cause

### Bug 1: Escalado de tickets en CUPS

El método `CupsBackend.print()` construye los argumentos del comando `lp` agregando opciones para `media` y `orientation-requested`, pero **omite completamente** la opción `fit-to-page=no`. El driver CUPS/Brother tiene un comportamiento por defecto de escalar el contenido para ajustarse al papel disponible, lo que reduce el contenido cuando la altura del PDF excede los 200mm configurados como máximo en el driver.

**Ubicación**: `src/main/printing/cups-backend.ts`, método `print()`, líneas donde se construye el array `args`.

### Bug 2: Layout de etiquetas con overlay

1. **Posición del overlay**: La función `drawBackground()` siempre usa `(0, 0, STAMP_WIDTH, STAMP_HEIGHT)` como coordenadas — no distingue entre la imagen de fondo (que sí debe cubrir toda la etiqueta) y la imagen de overlay/sello (que solo debe ocupar la mitad derecha).

2. **Posición de textos**: Los textos "evento" y "fecha" usan `drawTextRight(doc, text, font, size, 53, y)` donde `53` es el borde derecho en mm. Esto posiciona el texto en la zona 43-53mm, que es la mitad derecha donde debería estar exclusivamente la imagen del sello.

**Ubicación**: `src/main/printing/stamp-renderer.ts`, funciones `renderStamp()` y `renderStampMultiPage()`.

## Correctness Properties

Property 1: Bug Condition - Comando CUPS incluye fit-to-page=no

_For any_ llamada a `CupsBackend.print()` con cualquier combinación de printerUri, pdfBuffer y PrintOptions, el comando `lp` ejecutado SHALL incluir el argumento `-o fit-to-page=no` en la lista de argumentos.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Overlay posicionado en mitad derecha

_For any_ llamada a `renderStamp()` o `renderStampMultiPage()` con un `overlayImage` no nulo, la imagen del overlay SHALL dibujarse con una coordenada x >= 27.5mm (la mitad derecha de la etiqueta de 55mm).

**Validates: Requirements 2.3**

Property 3: Bug Condition - Textos evento/fecha en mitad izquierda

_For any_ llamada a `renderStamp()` o `renderStampMultiPage()` con textos "evento" y "fecha", el borde derecho del texto (parámetro xRight de `drawTextRight`) SHALL ser <= 27.5mm (contenido en la mitad izquierda de la etiqueta).

**Validates: Requirements 2.4, 2.5**

Property 4: Preservation - Imagen de fondo a tamaño completo

_For any_ llamada a `renderStamp()` o `renderStampMultiPage()` con un `backgroundImage` no nulo, la imagen de fondo SHALL seguir dibujándose a tamaño completo (x=0, y=0, width=55mm, height=25mm), preservando el comportamiento actual.

**Validates: Requirements 3.5**

Property 5: Preservation - Textos tarifa/codigo sin cambios

_For any_ llamada a `renderStamp()` o `renderStampMultiPage()`, los textos "tarifa" y "codigo" SHALL mantener su posición actual (tarifa en x=2mm, codigo en x=2mm), sin ser afectados por el fix.

**Validates: Requirements 3.3, 3.4**

Property 6: Preservation - Backend IPP sin cambios

_For any_ impresión vía `IppBackend`, el comportamiento SHALL ser idéntico al actual sin agregar opciones adicionales como `fit-to-page=no`.

**Validates: Requirements 3.8**

## Bug 3: Rotación no deseada de etiquetas

### Root Cause

El `STAMP_ORIENTATION` está configurado como `6` (landscape) en `printer-manager.ts`. La función `printStamp()` envía este valor al comando `lp` como `-o orientation-requested=6`.

El problema es que el PDF ya se genera en formato landscape (55mm × 25mm). Cuando el driver Brother TD-4100N recibe `orientation-requested=6`, interpreta que debe rotar el contenido 90° adicionales, porque el papel se alimenta por el lado largo (55mm). El resultado es que el contenido impreso aparece rotado verticalmente en el lateral de la etiqueta.

La solución es cambiar `STAMP_ORIENTATION` de `6` a `3` (portrait). Con orientación portrait, el driver no rota el contenido y el PDF se imprime tal como fue generado — horizontalmente, con el layout correcto.

**Ubicación**: `src/main/printing/printer-manager.ts`, constante `STAMP_ORIENTATION`.

## Fix Implementation

### Changes Required

Asumiendo que el análisis de root cause es correcto:

**File**: `src/main/printing/printer-manager.ts`

**Constant**: `STAMP_ORIENTATION`

**Specific Changes**:
0. **Cambiar STAMP_ORIENTATION de 6 a 3**: En `printer-manager.ts`, cambiar `export const STAMP_ORIENTATION = 6` a `export const STAMP_ORIENTATION = 3`. Esto envía la orientación portrait al driver, evitando la rotación del contenido que ya está en landscape en el PDF.

---

**File**: `src/main/printing/cups-backend.ts`

**Function**: `CupsBackend.print()`

**Specific Changes**:
1. **Agregar fit-to-page=no**: Después de construir las opciones de media y orientation, agregar `args.push('-o', 'fit-to-page=no')` para prevenir el escalado automático por parte del driver CUPS.

---

**File**: `src/main/printing/stamp-renderer.ts`

**Function**: `drawBackground()` → crear nueva función `drawOverlay()`

**Specific Changes**:
2. **Nueva función drawOverlay()**: Crear una función `drawOverlay()` que dibuje la imagen solo en la mitad derecha de la etiqueta (x=27.5mm, y=0, width=27.5mm, height=25mm). Esta función se usará para el `overlayImage` en lugar de `drawBackground()`.

3. **Actualizar renderStamp()**: Reemplazar `drawBackground(doc, params.overlayImage)` por `drawOverlay(doc, params.overlayImage)`.

4. **Actualizar renderStampMultiPage()**: Mismo cambio que en `renderStamp()` — usar `drawOverlay()` para el overlay.

5. **Mover textos evento/fecha a la mitad izquierda**: Cambiar `drawTextRight(doc, params.evento, FONTS.regular, 9, 53, 19)` a `drawTextRight(doc, params.evento, FONTS.regular, 9, 26, 19)` (borde derecho en ~26mm, dentro de la mitad izquierda). Mismo cambio para "fecha": de `53` a `26`.

## Testing Strategy

### Validation Approach

La estrategia de testing sigue dos fases: primero, surfear contraejemplos que demuestren el bug en el código sin corregir, y luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Surfear contraejemplos que demuestren el bug ANTES de implementar el fix. Confirmar o refutar el análisis de root cause.

**Test Plan**: Escribir tests que capturen los argumentos del comando `lp` y las coordenadas de dibujo del stamp renderer. Ejecutar sobre el código SIN corregir para observar los fallos.

**Test Cases**:
1. **CUPS fit-to-page test**: Capturar args de `lp` al imprimir un PDF — verificar que NO contiene `fit-to-page=no` (fallará en código sin fix — confirma el bug)
2. **Overlay position test**: Renderizar etiqueta con overlayImage y capturar las coordenadas de `doc.image()` — verificar que x=0 (confirma el bug en código sin fix)
3. **Texto evento position test**: Renderizar etiqueta y capturar la posición del texto "evento" — verificar que xRight=53mm (confirma el bug en código sin fix)
4. **Texto fecha position test**: Similar al anterior para "fecha"

**Expected Counterexamples**:
- Los args de `lp` no contienen `fit-to-page=no`
- El overlay se dibuja en x=0 (tamaño completo)
- Los textos evento/fecha tienen xRight=53mm (mitad derecha)

### Fix Checking

**Goal**: Verificar que para todas las entradas donde la condición de bug aplica, la función corregida produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.type == "cups_print" THEN
    result := CupsBackend_fixed.print(input)
    ASSERT "fit-to-page=no" IN executedCommandArgs(result)
  END IF
  
  IF input.type == "stamp_with_overlay" THEN
    result := renderStamp_fixed(input)
    ASSERT overlayX(result) >= 27.5mm
    ASSERT textoEventoXRight(result) <= 27.5mm
    ASSERT textoFechaXRight(result) <= 27.5mm
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas las entradas donde la condición de bug NO aplica, la función corregida produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderStamp_original(input).backgroundPosition == renderStamp_fixed(input).backgroundPosition
  ASSERT renderStamp_original(input).tarifaPosition == renderStamp_fixed(input).tarifaPosition
  ASSERT renderStamp_original(input).codigoPosition == renderStamp_fixed(input).codigoPosition
  ASSERT IppBackend_original.print(input) == IppBackend_fixed.print(input)
END FOR
```

**Testing Approach**: Se recomienda property-based testing para la preservación porque:
- Genera muchos casos de test automáticamente sobre el dominio de entrada
- Detecta edge cases que los tests manuales podrían ignorar
- Proporciona garantías fuertes de que el comportamiento no cambia para entradas no afectadas

**Test Plan**: Observar el comportamiento del código SIN corregir para clicks de ratón, otras interacciones, y posiciones de texto tarifa/codigo. Luego escribir tests property-based que capturen ese comportamiento.

**Test Cases**:
1. **Background preservation**: Verificar que `backgroundImage` sigue dibujándose a tamaño completo (0, 0, 55mm, 25mm) después del fix
2. **Tarifa/codigo position preservation**: Verificar que tarifa (x=2mm) y codigo (x=2mm) no cambian de posición
3. **IPP backend preservation**: Verificar que el IPP backend no se modifica (no agrega fit-to-page)
4. **Tiras especiales preservation**: Verificar que E1-E4 no se ven afectadas por el fix

### Unit Tests

- Test que `CupsBackend.print()` incluye `-o fit-to-page=no` en los args para cualquier PrintOptions
- Test que `drawOverlay()` posiciona la imagen en x=27.5mm, width=27.5mm
- Test que los textos evento/fecha usan xRight=26mm en `renderStamp()`
- Test que `drawBackground()` sigue usando x=0, width=55mm para backgroundImage
- Test de edge case: overlayImage=null no intenta dibujar nada
- Test de edge case: evento/fecha con texto vacío

### Property-Based Tests

- Generar PrintOptions aleatorias y verificar que el comando `lp` siempre incluye `fit-to-page=no`
- Generar StampRenderParams aleatorios con overlayImage y verificar que overlay.x >= 27.5mm
- Generar StampRenderParams aleatorios y verificar que tarifa.x == 2mm y codigo.x == 2mm (preservación)
- Generar StampRenderParams aleatorios sin overlayImage y verificar que el render es idéntico al original

### Integration Tests

- Test end-to-end: generar un PDF de ticket con altura > 200mm, enviarlo vía CUPS mock, verificar que el comando incluye `fit-to-page=no`
- Test end-to-end: generar etiqueta con fondo + overlay via `pdf-generator.ts` → verificar layout visual (overlay en derecha, texto en izquierda)
- Test end-to-end: generar una venta completa y verificar que todos los PDFs se envían con las opciones correctas
