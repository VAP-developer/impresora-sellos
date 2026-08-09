# Design Document: stamp-printing-speed

## Architecture Overview

La optimización se aplica en dos puntos del pipeline de generación de PDFs:

1. **pdf-generator.ts** — Elimina la llamada a `groupLabels()` para sellos simples y pasa el array completo de stamps directamente a `renderStampMultiPage()`, produciendo un único PDF multi-página por combinación tarifa/modelo.

2. **stamp-renderer.ts** — Añade un caché de imágenes pre-decodificadas dentro de `renderStampMultiPage()`, de modo que las imágenes base64 compartidas entre páginas se decodifican una sola vez.

Las tiras (strips) y tiras especiales **no se ven afectadas**: siguen generando un PDF separado por unidad vendida.

```
┌──────────────────────────────────────────────────────────┐
│                   pdf-generator.ts                        │
│                                                          │
│  Simple stamps (tarifa/modelo):                          │
│    ANTES:  stamps → groupLabels(cutNumber) → N PDFs     │
│    AHORA:  stamps → renderStampMultiPage(ALL) → 1 PDF   │
│                                                          │
│  Tiras/Strips: sin cambio (1 PDF por unidad vendida)     │
│  Especiales: sin cambio (1 PDF por strip especial)       │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│                  stamp-renderer.ts                        │
│                                                          │
│  renderStampMultiPage(stamps):                           │
│    1. Crear PDFDocument (1 vez)                          │
│    2. registerFonts(doc) (1 vez — ya existente)          │
│    3. Pre-decodificar imágenes únicas → Map<string,Buf>  │
│    4. Para cada stamp:                                   │
│       - addPage()                                        │
│       - drawBackground(doc, cachedBuffer)                │
│       - drawOverlay(doc, cachedBuffer)                   │
│       - drawLogoPng(doc, cachedBuffer, ...)              │
│       - drawText*(...)                                   │
│    5. doc.end() → Buffer                                 │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1. Image Cache (stamp-renderer.ts)

Un `Map<string, Buffer>` local creado antes del bucle de páginas en `renderStampMultiPage()`. La key es el data URI completo (o path) y el value es el Buffer decodificado.

```typescript
/** Pre-decodes all unique base64 images from a stamp batch into reusable Buffers. */
function buildImageCache(stamps: StampRenderParams[]): Map<string, Buffer> {
  const cache = new Map<string, Buffer>()

  for (const stamp of stamps) {
    for (const src of [stamp.backgroundImage, stamp.overlayImage, stamp.logoPngImage]) {
      if (!src || cache.has(src)) continue
      if (src.startsWith('data:')) {
        const base64Data = src.split(',')[1]
        if (base64Data) {
          try {
            cache.set(src, Buffer.from(base64Data, 'base64'))
          } catch {
            // Malformed base64 — skip, drawBackground/drawOverlay will handle gracefully
          }
        }
      }
      // File paths no se cachean como Buffer — PDFKit los lee directamente del FS
    }
  }

  return cache
}
```

### 2. Funciones de dibujo con caché (stamp-renderer.ts)

Las funciones `drawBackground`, `drawOverlay` y `drawLogoPng` se modifican para aceptar un parámetro opcional `imageCache: Map<string, Buffer>`. Cuando el caché contiene la key, usan el Buffer cacheado en lugar de re-decodificar.

```typescript
function drawBackground(
  doc: PDFKit.PDFDocument,
  imageSource: string | null | undefined,
  imageCache?: Map<string, Buffer>
): void {
  if (!imageSource) return

  try {
    if (imageSource.startsWith('data:')) {
      const cached = imageCache?.get(imageSource)
      if (cached) {
        doc.image(cached, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
      } else {
        // Fallback: decode inline (para llamadores sin caché, e.g. renderStamp individual)
        const base64Data = imageSource.split(',')[1]
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64')
          doc.image(buffer, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
        }
      }
    } else if (existsSync(imageSource)) {
      doc.image(imageSource, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
    }
  } catch {
    // Gracefully ignore image errors
  }
}
```

El mismo patrón se aplica a `drawOverlay` y `drawLogoPng`.

### 3. Consolidación en pdf-generator.ts

En ambas rutas (dinámica y legacy), para sellos simples:

**Antes:**
```typescript
const groups = groupLabels(stamps, cutNumber)
for (const group of groups) {
  const pdfBuffer = await renderStampMultiPage(group)
  pdfs.push({ buffer: pdfBuffer, target, pdfType: 'stamp_simple', ... })
}
```

**Después:**
```typescript
const pdfBuffer = await renderStampMultiPage(stamps)
pdfs.push({ buffer: pdfBuffer, target, pdfType: 'stamp_simple', ... })
```

La variable `cutNumber` y la importación de `groupLabels` se mantienen en el archivo porque podrían usarse en el futuro, pero ya no se invocan en la ruta de sellos simples.

## Interfaces

No se añaden nuevas interfaces públicas. Los cambios son internos:

- `drawBackground(doc, imageSource, imageCache?)` — parámetro opcional añadido
- `drawOverlay(doc, imageSource, imageCache?)` — parámetro opcional añadido
- `drawLogoPng(doc, imageSource, fecha, evento, imageCache?)` — parámetro opcional añadido
- `buildImageCache(stamps)` — función interna nueva (no exportada)

La firma pública de `renderStampMultiPage(stamps: StampRenderParams[]): Promise<Buffer>` **no cambia**.

## Data Models

No hay cambios en modelos de datos. El `GeneratedPdf` mantiene su estructura actual. El `StampRenderParams` no se modifica.

## Error Handling

| Escenario | Comportamiento |
|-----------|---------------|
| base64 malformado en `buildImageCache` | `try/catch` silencioso — el entry no se añade al Map |
| base64 malformado en `drawBackground` (sin caché) | `try/catch` silencioso — la imagen se omite |
| imagen no encontrada en el caché | Fallback a decodificación inline |
| `renderStampMultiPage([])` | Sigue lanzando `Error('No stamps to render')` |
| stamps con imágenes diferentes entre sí | Cada imagen única se decodifica una vez; stamps sin imagen se renderizan sin fondo |

## Performance Impact

| Métrica | Antes (100 sellos, cutNumber=4) | Después (100 sellos) |
|---------|-------------------------------|---------------------|
| PDFDocuments creados | 25 | 1 |
| Registros de fuentes | 25 × 3 = 75 | 1 × 3 = 3 |
| Decodificaciones base64 (fondo) | 100 | 1 |
| Decodificaciones base64 (overlay) | 100 | 1 |
| Decodificaciones base64 (logo) | 100 | 1 |
| Jobs en print_queue | 25 | 1 |

## Print Quality — SumatraPDF DPI Configuration (windows-backend.ts)

The fix is minimal — add `"300x300dpi"` to the existing `-print-settings "noscale"` argument in `windows-backend.ts`.

SumatraPDF `print-settings` syntax supports comma-separated sub-parameters:
- `noscale` — print at 100% original size
- `300x300dpi` — rasterize at 300 DPI horizontally and vertically

Current code (line ~172 in windows-backend.ts):
```typescript
const args = [
  '-print-to', printerName,
  '-print-settings', 'noscale',
  '-silent',
  tempFile
]
```

New code:
```typescript
const args = [
  '-print-to', printerName,
  '-print-settings', `noscale,${PRINT_DPI}`,
  '-silent',
  tempFile
]
```

Where `PRINT_DPI` is an exported constant:
```typescript
/** Rasterization DPI for SumatraPDF when printing PDFs. 300x300 provides crisp text and images on thermal printers. */
export const PRINT_DPI = '300x300dpi'
```

### Impact on existing behavior

- The `noscale` setting is preserved — PDFs continue printing at 100% original size.
- The `configurePrinterPaperSize()` call for custom media (tickets) remains independent and unaffected.
- SumatraPDF silently ignores unrecognized sub-parameters, so the DPI addition is non-blocking even on older SumatraPDF versions.
- The constant is exported so tests and future configuration can reference or override it.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: One PDF per tariff/model for simple stamps

*For any* sale with simple stamps, for each distinct tariff/model combination with quantity > 0, the `generateSalePdfs` function SHALL produce exactly one GeneratedPdf with pdfType `stamp_simple` or `SELLO_simple` for that combination, regardless of the quantity.

**Validates: Requirements 1.1, 1.3, 1.4, 7.1, 7.2**

### Property 2: Page count equals stamp quantity

*For any* tariff/model combination with quantity N > 0, the stamps array passed to `renderStampMultiPage` SHALL have exactly N elements, each with sequential label codes (incrementing producto counter).

**Validates: Requirements 1.2**

### Property 3: Image decode count is at most the number of unique images

*For any* batch of N stamps sharing K unique base64 image URIs (across background, overlay, and logo), the `buildImageCache` function SHALL produce a Map with exactly K entries, meaning each unique image is decoded exactly once regardless of N.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Malformed base64 does not abort PDF generation

*For any* stamp batch where one or more image data URIs contain malformed base64 data, `renderStampMultiPage` SHALL still return a valid PDF Buffer (non-empty, no exception thrown) with the correct number of pages.

**Validates: Requirements 2.4**

### Property 5: Strips remain one PDF per unit

*For any* strip tariff with quantity N > 0, the `generateSalePdfs` function SHALL produce exactly N GeneratedPdf entries with pdfType `stamp_tira` for that strip, preserving the existing behavior of one multi-page PDF per physical strip unit sold.

**Validates: Requirements 4.1, 4.2**

### Property 6: stampCount equals number of stamp PDFs

*For any* sale, the `SaleGenerationResult.stampCount` SHALL equal the total number of GeneratedPdf entries whose pdfType starts with `stamp_` (simple + tira + especial), reflecting consolidated PDF count not individual page count.

**Validates: Requirements 6.3**

### Property 7: Print settings include noscale and DPI specification

*For any* print job dispatched by `WindowsBackend`, the `-print-settings` argument passed to SumatraPDF SHALL contain both `"noscale"` and a DPI specification matching the pattern `NNNxNNNdpi`, ensuring crisp rasterization without altering the original PDF scale.

**Validates: Requirements 8.1, 8.2, 8.3, 10.1**
