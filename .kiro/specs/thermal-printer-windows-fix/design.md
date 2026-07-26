# Bugfix Impresora Térmica Windows - Diseño

## Overview

Este diseño aborda tres bugs interrelacionados al imprimir etiquetas de sello en la Brother TD-4100N conectada por USB en Windows (URI `win://`). La estrategia general es:

1. Aplicar una rotación de 180° al contenido del PDF **en la ruta de impresión** (no en el renderer) para corregir la inversión causada por la dirección de alimentación del papel térmico.
2. Investigar y corregir la doble impresión, cuya causa más probable es que `pdf-to-printer` interpreta el campo `copies` como adicional al documento (imprime copies+1) o que el PDF generado tiene dimensiones que causan que SumatraPDF pagine en dos.
3. Crear una interfaz `ThermalPrinterConfig` y lógica dedicada en `printViaWindowsSpooler()` para detectar impresoras térmicas y aplicar parámetros SumatraPDF específicos (tamaño de página, sin escalado, sin márgenes, copia única explícita).

## Glossary

- **Bug_Condition (C)**: Condición que dispara los bugs — impresión de etiquetas stamp via URI `win://` a una impresora térmica de etiquetas (Brother TD-4100N)
- **Property (P)**: Comportamiento deseado — las etiquetas salen con orientación correcta (imagen arriba, texto abajo), una sola etiqueta por sello solicitado, con parámetros de impresión optimizados para impresora térmica
- **Preservation**: Comportamiento existente que NO debe cambiar — impresión IPP de red, tickets vía `win://`, impresoras normales no-térmicas via `win://`, generación de PDFs de sello, flujo CUPS en Linux
- **printViaWindowsSpooler()**: Método privado en `src/main/printing/ipp-backend.ts` que envía PDFs al spooler de Windows usando `pdf-to-printer` (motor SumatraPDF)
- **ThermalPrinterConfig**: Nueva interfaz que define opciones específicas para impresoras térmicas de etiquetas (rotación, tamaño papel, escalado)
- **PrinterAssignments**: Mapeo existente de target (`printer1`/`printer2`/`ticket`) a URI de impresora en `printer-manager.ts`
- **SumatraPDF print-settings**: Parámetros de línea de comandos que controlan el comportamiento de impresión de SumatraPDF (motor usado por `pdf-to-printer`)

## Bug Details

### Bug Condition

Los bugs se manifiestan cuando se envía un PDF de etiqueta de sello (55×25mm) a través del método `printViaWindowsSpooler()` a una impresora térmica Brother TD-4100N conectada por USB con URI `win://Brother%20TD-4100N`. La impresora térmica alimenta papel desde abajo (cada etiqueta avanza 25mm), lo que invierte la orientación del contenido impreso. Además, el sistema produce 2 etiquetas físicas por cada sello solicitado, y no existe control dedicado para parámetros térmicos.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PrintJob { printerUri, pdfBuffer, options }
  OUTPUT: boolean
  
  RETURN input.printerUri STARTS_WITH 'win://'
         AND printerIsThermalLabel(input.printerUri)
         AND input.options.pdfType IN ['stamp_simple', 'stamp_tira', 'stamp_especial']
END FUNCTION
```

### Examples

- **Inversión**: Se imprime 1 sello Tarifa A → la etiqueta sale con la imagen de fondo en la parte inferior y el texto (tarifa, evento, código) en la parte superior. Esperado: imagen arriba, texto abajo.
- **Doble impresión**: Se solicita 1 sello → la Brother imprime 2 etiquetas idénticas. Esperado: exactamente 1 etiqueta.
- **Parámetros genéricos**: Se envía un sello a la Brother TD-4100N con settings `noscale,portrait` sin especificar tamaño de página 55×25mm → el driver de la impresora puede escalar o reposicionar el contenido. Esperado: parámetros `noscale,portrait,paper=55x25` o equivalente.
- **Caso no-bug**: Se imprime un ticket vía `win://` → el ticket se imprime correctamente con los parámetros genéricos actuales (no debe cambiar).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Impresión vía IPP de red (`ipp://`) debe seguir usando el flujo IPP actual sin cambios
- Tickets (`ticket`, `ticket_caja`, `ticket_master`) vía `win://` deben seguir imprimiendo con la configuración genérica `noscale,portrait` actual
- El renderer de sellos (`renderStamp`) debe seguir generando PDFs 55×25mm con el mismo layout interno
- La cola de impresión (`PrintQueueService.enqueue()`) debe seguir encolando exactamente un job por cada PDF generado
- Impresoras normales (no-térmicas) vía `win://` deben seguir usando parámetros genéricos
- El flujo CUPS en Linux debe permanecer intacto
- La generación de PDFs en `pdf-generator.ts` no debe modificarse

**Scope:**
Todos los inputs que NO involucren impresión de stamps a una impresora térmica vía `win://` no deben verse afectados. Esto incluye:
- Impresión de tickets por cualquier vía
- Impresión de stamps a impresoras IPP de red
- Impresión vía CUPS en Linux
- Impresión de stamps a impresoras normales (no-térmicas) vía `win://`
- Generación interna de PDFs (el buffer no cambia)

## Hypothesized Root Cause

Based en el análisis del código y el comportamiento reportado:

1. **Inversión 180° (Bug 1)**: La Brother TD-4100N alimenta papel térmico desde abajo. El primer contenido que se imprime aparece en el borde superior de la etiqueta al salir. El PDF de sello dibuja background primero y texto después. El resultado: el background (que debería estar arriba visualmente) queda abajo tras la impresión. La solución es rotar el contenido del PDF 180° antes de enviarlo, para que al ser "invertido" por la mecánica de alimentación, salga correcto.

2. **Doble impresión (Bug 2)**: El campo `copies` se pasa al constructor de opciones de `pdf-to-printer`. Dado que `PrintOptions.copies` no se establece explícitamente en `buildPrintOptions()` del `PrintQueueService` (no incluye `copies` en el objeto retornado), hereda `undefined`, que en `printViaWindowsSpooler` se convierte en `copies = options.copies ?? 1` = 1. Sin embargo, `pdf-to-printer` podría interpretar `copies: 1` como "1 copia adicional" (total 2) en lugar de "1 total". Alternativamente, el PDF de 55×25mm en modo landscape podría causar que SumatraPDF pagine el contenido en 2 páginas al mapear a un papel de 25×55mm configurado en el driver. La causa más probable: **SumatraPDF con `portrait` mode en un PDF landscape 55×25mm mapeado a papel 25mm (ancho) × 55mm (largo) genera dos páginas** porque el contenido landscape no cabe en la orientación portrait del papel configurado en el driver.

3. **Falta de control dedicado (Bug 3)**: `printViaWindowsSpooler()` aplica los mismos settings `noscale,portrait` a TODAS las impresoras `win://`, sin distinción entre impresoras normales e impresoras térmicas de etiquetas. No existe ningún mecanismo para configurar parámetros per-printer.

4. **Relación entre Bug 1 y Bug 2**: Ambos podrían estar causados por un mismatch de orientación/tamaño entre el PDF generado (55×25mm landscape) y el papel configurado en el driver de la Brother (25mm ancho × 55mm largo). Corrigiendo los parámetros de SumatraPDF con el tamaño exacto de papel y la orientación correcta, ambos bugs podrían resolverse.

## Correctness Properties

Property 1: Bug Condition - Orientación correcta en impresora térmica

_For any_ trabajo de impresión donde el URI comienza con `win://`, la impresora está marcada como térmica, y el tipo de PDF es un stamp (`stamp_simple`, `stamp_tira`, `stamp_especial`), el método `printViaWindowsSpooler()` corregido SHALL aplicar una rotación de 180° al contenido del PDF antes de enviarlo a SumatraPDF, de modo que la etiqueta impresa muestre la imagen en la parte superior y el texto en la parte inferior.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Exactamente una etiqueta por sello

_For any_ trabajo de impresión de stamp en una impresora térmica, el sistema corregido SHALL producir exactamente 1 etiqueta física por cada PDF de sello encolado, sin duplicación por parte de SumatraPDF ni del campo `copies`.

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - Impresoras no-térmicas sin cambios

_For any_ trabajo de impresión donde la impresora NO está marcada como térmica (incluyendo impresoras `win://` normales, impresoras `ipp://`, tickets, y flujos CUPS), el sistema corregido SHALL producir exactamente el mismo resultado que el sistema original, preservando parámetros genéricos `noscale,portrait` para `win://` normales y el flujo IPP/CUPS intacto.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/main/printing/printer-manager.ts`

**New Interface**: `ThermalPrinterConfig`

**Specific Changes**:
1. **Definir `ThermalPrinterConfig`**: Nueva interfaz que permite marcar un target como impresora térmica, con opciones de rotación (180°), tamaño de papel (width/height en mm), y flag de copia única.
   ```typescript
   export interface ThermalPrinterConfig {
     enabled: boolean
     rotateDegrees: 0 | 90 | 180 | 270
     paperWidthMm: number
     paperHeightMm: number
     forceSingleCopy: boolean
   }
   ```

2. **Extender `PrinterAssignments`**: Añadir un campo opcional `thermalConfig` por target para almacenar la configuración térmica.
   ```typescript
   export interface PrinterAssignments {
     printer1?: string
     printer2?: string
     ticket?: string
     thermalConfig?: Partial<Record<PrinterTarget, ThermalPrinterConfig>>
   }
   ```

---

**File**: `src/main/printing/ipp-backend.ts`

**Function**: `printViaWindowsSpooler()`

**Specific Changes**:
3. **Aceptar `ThermalPrinterConfig` como parámetro opcional**: Modificar la firma del método para recibir la configuración térmica, o inyectarla vía una referencia al `PrinterManager`.

4. **Aplicar rotación 180° al PDF**: Antes de escribir el PDF a disco, si `thermalConfig.rotateDegrees === 180`, usar `pdf-lib` para rotar todas las páginas del PDF 180°. Esto se hace manipulando el buffer PDF en memoria:
   ```typescript
   import { PDFDocument, degrees } from 'pdf-lib'
   
   async function rotatePdfPages(pdfBuffer: Buffer, rotation: number): Promise<Buffer> {
     const pdfDoc = await PDFDocument.load(pdfBuffer)
     for (const page of pdfDoc.getPages()) {
       page.setRotation(degrees(page.getRotation().angle + rotation))
     }
     return Buffer.from(await pdfDoc.save())
   }
   ```

5. **Configurar SumatraPDF con tamaño de papel explícito**: Cuando hay config térmica, usar settings específicos:
   ```
   noscale,portrait,paper=<width>x<height>
   ```
   O alternativamente, usar el flag `-print-settings "noscale,fit"` con `-paper-size` si SumatraPDF lo soporta.

6. **Forzar `copies` a 1 (no pasarlo a pdf-to-printer)**: Cuando `thermalConfig.forceSingleCopy === true`, no incluir el campo `copies` en las opciones de `pdf-to-printer`, o asegurar que `copies: 1` significa exactamente 1 impresión total (probando el comportamiento real de la librería).

7. **Eliminar el campo `copies` del call a `printPdf()` para térmicas**: Si la doble impresión viene de `copies`, simplemente omitir el parámetro cuando `forceSingleCopy` está activo.

---

**File**: `src/main/printing/printer-manager.ts`

**Function**: `print()`

**Specific Changes**:
8. **Pasar `thermalConfig` al backend**: Cuando `printViaWindowsSpooler` se invoque para un target que tiene `thermalConfig`, pasar la config al método. Esto requiere extender la interfaz `PrinterBackend.print()` con un parámetro opcional, o que `IppBackend` tenga acceso a la configuración de assignments.

---

**File**: `src/main/printing/ipp-backend.ts`

**Function**: `print()` (método público)

**Specific Changes**:
9. **Pasar thermalConfig desde PrintOptions extendido**: Añadir un campo opcional `thermalConfig` a `PrintOptions` para transportar la configuración desde `PrinterManager` hasta `printViaWindowsSpooler()` sin romper la interfaz existente.
   ```typescript
   export interface PrintOptions {
     media: string
     orientation: number
     copies?: number
     jobName?: string
     thermalConfig?: ThermalPrinterConfig
   }
   ```

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, generar counterexamples que demuestren los bugs en código no-corregido, y luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Generar counterexamples que demuestren los bugs ANTES de implementar el fix. Confirmar o refutar el análisis de root cause. Si refutamos, necesitamos re-hypothesize.

**Test Plan**: Escribir tests que simulen la ruta de impresión de stamps vía `win://` hacia una impresora térmica, mockeando `pdf-to-printer` para capturar los argumentos exactos enviados a SumatraPDF. Ejecutar estos tests sobre el código NO-CORREGIDO para observar los fallos.

**Test Cases**:
1. **Rotación test**: Verificar que el PDF enviado a `pdf-to-printer` NO tiene rotación 180° aplicada (fallará en código no-corregido — confirma que falta la rotación)
2. **Copies test**: Verificar qué valor de `copies` se pasa a `pdf-to-printer` y si el mock reporta invocaciones duplicadas (fallará si copies causa doble impresión)
3. **Paper size test**: Verificar que no se incluye especificación de tamaño de papel en los settings de SumatraPDF (fallará — confirma que faltan parámetros térmicos)
4. **Single invocation test**: Verificar que `printPdf` se llama exactamente 1 vez por cada job procesado por `PrintQueueService.processQueue()` (puede fallar si hay doble-enqueue)

**Expected Counterexamples**:
- El PDF enviado a SumatraPDF no tiene rotación 180° aplicada
- Los settings de SumatraPDF no incluyen tamaño de papel específico para térmica
- Posibles causes de doble impresión: `copies` field behavior, PDF landscape en papel portrait causando 2 páginas

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la bug condition se cumple, la función corregida produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := printViaWindowsSpooler_fixed(input)
  ASSERT pdfHasRotation180(result.sentPdfBuffer)
  ASSERT sumatraPdfSettings CONTAINS thermalPaperSize
  ASSERT printPdf.callCount == 1
  ASSERT sentCopies == UNDEFINED OR sentCopies == 1
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la bug condition NO se cumple, la función corregida produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT printViaWindowsSpooler_original(input).settings == printViaWindowsSpooler_fixed(input).settings
  ASSERT printViaWindowsSpooler_original(input).pdfBuffer == printViaWindowsSpooler_fixed(input).pdfBuffer
  ASSERT printViaWindowsSpooler_original(input).copies == printViaWindowsSpooler_fixed(input).copies
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos test cases automáticamente across el dominio de inputs
- Detecta edge cases que tests unitarios manuales podrían perder
- Proporciona garantías fuertes de que el comportamiento no cambia para inputs no-buggy

**Test Plan**: Observar el comportamiento en código NO-CORREGIDO para impresión de tickets, impresoras IPP, y stamps a impresoras no-térmicas; luego escribir property-based tests capturando ese comportamiento.

**Test Cases**:
1. **Ticket preservation**: Verificar que tickets vía `win://` siguen usando `noscale,portrait` sin rotación después del fix
2. **IPP preservation**: Verificar que impresoras `ipp://` no son afectadas por la nueva lógica térmica
3. **Non-thermal win:// preservation**: Verificar que impresoras `win://` sin `thermalConfig` siguen usando parámetros genéricos idénticos
4. **Queue single-enqueue preservation**: Verificar que `PrintQueueService.enqueue()` sigue creando exactamente N jobs para N PDFs generados

### Unit Tests

- Test rotación 180° de PDF: verificar que `rotatePdfPages()` produce un PDF con las páginas rotadas correctamente
- Test `printViaWindowsSpooler` con thermalConfig: verificar que los settings de SumatraPDF incluyen parámetros térmicos
- Test `printViaWindowsSpooler` sin thermalConfig: verificar que usa los settings genéricos actuales
- Test que `copies` no se pasa (o se pasa como undefined) para impresoras térmicas
- Test `ThermalPrinterConfig` serialization/deserialization en PrinterAssignments

### Property-Based Tests

- Generar PrintOptions aleatorios con y sin thermalConfig: verificar que la decisión de rotar/no-rotar es determinista basada en thermalConfig.enabled
- Generar PDFs de stamps aleatorios (simple, tira, especial): verificar que la rotación 180° preserva las dimensiones del PDF (width/height no cambian)
- Generar configuraciones aleatorias de PrinterAssignments: verificar que solo los targets con thermalConfig reciben tratamiento térmico

### Integration Tests

- Test full sale → print flow con printer1 configurado como térmica: verificar que el PDF llega a `pdf-to-printer` con rotación y settings correctos
- Test full sale flow con printer2 configurado como NO-térmica: verificar que el PDF llega sin modificaciones
- Test que una venta de 1 sello simple produce exactamente 1 invocación a `printPdf` en la Brother térmica
- Test que la cola de impresión procesa stamps térmicos y tickets normales en la misma sale sin interferencia
