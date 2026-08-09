# Implementation Plan: stamp-printing-speed

## Overview

Optimización de la velocidad de generación de PDFs de sellos simples mediante dos cambios principales:
1. Añadir caché de imágenes en `stamp-renderer.ts` para decodificar base64 una sola vez por PDF multi-página.
2. Eliminar las llamadas a `groupLabels()` para sellos simples en `pdf-generator.ts`, pasando el array completo a `renderStampMultiPage()` y produciendo un único PDF por combinación tarifa/modelo.

## Tasks

- [ ] 1. Implement image cache in stamp-renderer.ts
  - [ ] 1.1 Add `buildImageCache()` function
    - Create function `buildImageCache(stamps: StampRenderParams[]): Map<string, Buffer>` that iterates all stamps and pre-decodes unique base64 data URIs into Buffers
    - Handle malformed base64 gracefully with try/catch (skip entry, don't abort)
    - Skip file paths (PDFKit reads them directly from FS)
    - Cache key is the full data URI string; value is the decoded Buffer
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 1.2 Modify `drawBackground()` to accept optional `imageCache` parameter
    - Add optional parameter `imageCache?: Map<string, Buffer>` to `drawBackground`
    - When cache contains the imageSource key, use cached Buffer instead of re-decoding
    - Fallback to inline decode when cache miss (preserves backward compatibility for callers without cache)
    - _Requirements: 2.1, 2.4_

  - [ ] 1.3 Modify `drawOverlay()` to accept optional `imageCache` parameter
    - Same pattern as drawBackground: add `imageCache?: Map<string, Buffer>` parameter
    - Use cached Buffer when available, fallback to inline decode on miss
    - _Requirements: 2.2, 2.4_

  - [ ] 1.4 Modify `drawLogoPng()` to accept optional `imageCache` parameter
    - Add `imageCache?: Map<string, Buffer>` as last parameter (after `evento`)
    - Use cached Buffer when available, fallback to inline decode on miss
    - _Requirements: 2.3, 2.4_

  - [ ] 1.5 Update `renderStampMultiPage()` to build and use image cache
    - Call `buildImageCache(stamps)` before the page loop
    - Pass the cache to `drawBackground`, `drawOverlay`, and `drawLogoPng` within the loop
    - Font registration remains once before the loop (already correct, Requirement 3.1, 3.2)
    - Public signature `renderStampMultiPage(stamps: StampRenderParams[]): Promise<Buffer>` does NOT change
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ]* 1.6 Write property test for `buildImageCache` (Property 3)
    - **Property 3: Image decode count is at most the number of unique images**
    - For any batch of N stamps with K unique base64 URIs, `buildImageCache` returns a Map with exactly K entries
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 1.7 Write property test for malformed base64 handling (Property 4)
    - **Property 4: Malformed base64 does not abort PDF generation**
    - For any stamp batch with malformed base64 data URIs, `renderStampMultiPage` still returns a valid non-empty Buffer without throwing
    - **Validates: Requirements 2.4**

- [ ] 2. Checkpoint - Verify stamp-renderer changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Remove `groupLabels()` calls for simple stamps in pdf-generator.ts
  - [ ] 3.1 Remove `groupLabels()` in the dynamic tariff path (model 1 and model 2)
    - Replace the `groupLabels(stamps, cutNumber)` + loop pattern with a direct call: `const pdfBuffer = await renderStampMultiPage(stamps)`
    - Push a single GeneratedPdf entry per tariff/model with pdfType `stamp_simple`
    - Update description to reflect total count: `${tariff.name} modelo${model} x${stamps.length}`
    - Do NOT remove the `groupLabels` import or `cutNumber` variable (Requirement 5.2)
    - _Requirements: 1.1, 1.3, 5.1, 7.1_

  - [ ] 3.2 Remove `groupLabels()` in the legacy static tariff path
    - Replace the `groupLabels(stamps, cutNumber)` + loop pattern with a direct call: `const pdfBuffer = await renderStampMultiPage(stamps)`
    - Push a single GeneratedPdf entry with pdfType `SELLO_simple` per tariff/model
    - Update description to reflect total count
    - Tiras (strips) remain unchanged — they already generate one PDF per unit (Requirement 4.1)
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 7.2_

  - [ ]* 3.3 Write property test for one-PDF-per-tariff/model (Property 1)
    - **Property 1: One PDF per tariff/model for simple stamps**
    - For any sale with simple stamps, each distinct tariff/model produces exactly one GeneratedPdf with pdfType `stamp_simple` or `SELLO_simple`
    - **Validates: Requirements 1.1, 1.3, 1.4, 7.1, 7.2**

  - [ ]* 3.4 Write property test for page count equals quantity (Property 2)
    - **Property 2: Page count equals stamp quantity**
    - For any tariff/model with quantity N, the stamps array passed to `renderStampMultiPage` has exactly N elements
    - **Validates: Requirements 1.2**

  - [ ]* 3.5 Write property test for strip behavior preservation (Property 5)
    - **Property 5: Strips remain one PDF per unit**
    - For any strip tariff with quantity N, `generateSalePdfs` produces exactly N GeneratedPdf entries with pdfType `stamp_tira`
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.6 Write property test for stampCount (Property 6)
    - **Property 6: stampCount equals number of stamp PDFs**
    - For any sale, `SaleGenerationResult.stampCount` equals the total count of GeneratedPdf entries whose pdfType starts with `stamp_`
    - **Validates: Requirements 6.3**

- [ ] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add DPI configuration to windows-backend.ts for crisp print quality
  - [ ] 5.1 Add exported PRINT_DPI constant
    - Add `export const PRINT_DPI = '300x300dpi'` to windows-backend.ts near the top constants section
    - Add JSDoc comment explaining this controls SumatraPDF's rasterization resolution
    - _Requirements: 9.1, 9.2_

  - [ ] 5.2 Update SumatraPDF print-settings to include DPI
    - In the `print()` method, change `-print-settings` from `'noscale'` to `` `noscale,${PRINT_DPI}` ``
    - This applies to ALL print jobs (stamps and tickets alike)
    - The `noscale` parameter is preserved — only DPI is added
    - _Requirements: 8.1, 8.2, 8.3, 10.1_

  - [ ]* 5.3 Write test for print-settings format (Property 7)
    - **Property 7: Print settings include noscale and DPI specification**
    - Verify that for any print job, the args passed to SumatraPDF include `-print-settings` with both "noscale" and a DPI pattern matching `\d+x\d+dpi`
    - **Validates: Requirements 8.1, 8.2, 10.1**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `groupLabels` import and `cutNumber` variable remain in `pdf-generator.ts` for future use (Requirement 5.2)
- The public signature of `renderStampMultiPage` does not change — backward compatibility preserved
- `renderStamp()` (single stamp) is NOT modified — it continues decoding inline (no cache needed for single page)
- Strip/tira generation (both dynamic and legacy) is untouched
- Property tests validate correctness properties defined in the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["1.6", "1.7", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3"] }
  ]
}
```
