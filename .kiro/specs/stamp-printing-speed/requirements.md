# Requirements Document

## Introduction

Optimización de la velocidad de generación de PDFs de sellos (stamps) en el módulo de impresión. Actualmente, al generar más de 100 sellos simples, el sistema crea múltiples PDFDocuments separados (agrupados por `cutNumber`), cada uno re-registrando fuentes y re-decodificando imágenes base64 idénticas. La optimización consolida todos los sellos simples de una misma tarifa/modelo en un único PDFDocument multi-página, registrando fuentes una sola vez y decodificando imágenes una sola vez como Buffers reutilizables.

## Glossary

- **PDF_Generator**: Módulo `pdf-generator.ts` que orquesta la generación de todos los PDFs para una venta.
- **Stamp_Renderer**: Módulo `stamp-renderer.ts` que genera los PDFs de etiquetas de sellos individuales y multi-página mediante PDFKit.
- **Label_Grouping**: Utilidad `label-grouping.ts` que divide arrays de sellos en grupos según el `cutNumber`.
- **Print_Queue**: Servicio `print-queue.service.ts` que gestiona la cola de impresión persistente con reintentos.
- **Windows_Backend**: Módulo `windows-backend.ts` que envía los PDFs a impresoras locales Windows mediante SumatraPDF.
- **SumatraPDF**: Ejecutable externo usado por Windows_Backend para rasterizar y enviar PDFs al controlador de impresora.
- **Print_Settings**: Cadena de configuración pasada a SumatraPDF mediante el argumento `-print-settings` que controla el escalado y la resolución de rasterización.
- **Rasterization_DPI**: Resolución en puntos por pulgada a la que SumatraPDF convierte las páginas PDF a bitmap antes de enviarlas al controlador de impresora.
- **cutNumber**: Configuración que define cuántos sellos se agrupan antes de ejecutar un corte físico en la impresora Brother TD-4100N.
- **Simple_Stamp**: Sello individual (no tira) generado para una tarifa/modelo específico.
- **Image_Cache**: Buffer pre-decodificado de una imagen base64 que se reutiliza entre páginas de un mismo PDFDocument.
- **Font_Registration**: Proceso de registrar fuentes TrueType (Franklin Gothic) en una instancia de PDFDocument.
- **Multi_Page_PDF**: Documento PDF con múltiples páginas, una por sello, generado por `renderStampMultiPage()`.

## Requirements

### Requirement 1: Consolidación de PDFs de sellos simples

**User Story:** Como operador del kiosco, quiero que la generación de sellos simples produzca un único PDF multi-página por tarifa/modelo en lugar de múltiples PDFs separados, para que la impresión de pedidos grandes sea significativamente más rápida.

#### Acceptance Criteria

1. WHEN the PDF_Generator processes Simple_Stamps for a given tariff and model, THE PDF_Generator SHALL produce exactly one Multi_Page_PDF containing all stamps for that tariff/model combination instead of splitting them into groups of cutNumber.
2. WHEN the PDF_Generator produces a consolidated Multi_Page_PDF for Simple_Stamps, THE Multi_Page_PDF SHALL contain one page per stamp in the same sequential order that the legacy grouping produced.
3. WHEN the PDF_Generator consolidates Simple_Stamps into a single Multi_Page_PDF, THE Print_Queue SHALL receive exactly one job per tariff/model combination instead of `ceil(quantity / cutNumber)` jobs.
4. WHILE the PDF_Generator processes a sale with multiple tariff/model combinations, THE PDF_Generator SHALL produce one Multi_Page_PDF per distinct tariff/model pair (stamps for different tariffs or different models remain in separate PDFs).

### Requirement 2: Caché de imágenes decodificadas

**User Story:** Como operador del kiosco, quiero que las imágenes de fondo y sello se decodifiquen una sola vez durante la generación de un lote de sellos, para que no se repita el costoso proceso de decodificación base64 en cada página.

#### Acceptance Criteria

1. WHEN the Stamp_Renderer renders a Multi_Page_PDF with identical backgroundImage across pages, THE Stamp_Renderer SHALL decode the base64 data URI into a Buffer exactly once and reuse that Buffer for all pages that reference the same image.
2. WHEN the Stamp_Renderer renders a Multi_Page_PDF with identical overlayImage across pages, THE Stamp_Renderer SHALL decode the overlay base64 data URI into a Buffer exactly once and reuse that Buffer for all pages.
3. WHEN the Stamp_Renderer renders a Multi_Page_PDF with identical logoPngImage across pages, THE Stamp_Renderer SHALL decode the logo base64 data URI into a Buffer exactly once and reuse that Buffer for all pages.
4. IF a base64 image data URI is malformed or fails decoding, THEN THE Stamp_Renderer SHALL skip that image gracefully (no background/overlay rendered for that page) without aborting the entire Multi_Page_PDF generation.

### Requirement 3: Registro de fuentes una sola vez

**User Story:** Como operador del kiosco, quiero que las fuentes Franklin Gothic se registren una única vez por PDFDocument generado, para eliminar la sobrecarga de registrar las mismas 3 fuentes en cada PDF individual.

#### Acceptance Criteria

1. WHEN the Stamp_Renderer creates a Multi_Page_PDF, THE Stamp_Renderer SHALL register the Franklin Gothic fonts (regular, bold, condensed) exactly once on the PDFDocument instance, before rendering the first page.
2. THE Stamp_Renderer SHALL NOT register fonts again when adding subsequent pages to the same PDFDocument.

### Requirement 4: Preservación del comportamiento de tiras

**User Story:** Como operador del kiosco, quiero que la generación de tiras (strips) no se vea afectada por la optimización, para que las tiras sigan generándose como un PDF separado por unidad vendida.

#### Acceptance Criteria

1. WHILE the PDF_Generator processes strip tariffs (tiras), THE PDF_Generator SHALL continue generating one Multi_Page_PDF per strip unit sold (one PDF with N pages per tira), without consolidation across units.
2. WHILE the PDF_Generator processes special strips (tiras especiales), THE PDF_Generator SHALL continue generating one PDF per special strip without consolidation.

### Requirement 5: Eliminación del groupLabels para sellos simples

**User Story:** Como desarrollador, quiero que el módulo PDF_Generator deje de utilizar `groupLabels()` para dividir sellos simples en sub-grupos, ya que la consolidación en un solo PDF hace innecesaria esa división.

#### Acceptance Criteria

1. WHEN the PDF_Generator generates Simple_Stamps, THE PDF_Generator SHALL pass all stamps of a tariff/model directly to `renderStampMultiPage()` without calling `groupLabels()`.
2. THE Label_Grouping module SHALL remain available in the codebase (no deletion) for potential use by other callers or future features.

### Requirement 6: Compatibilidad de salida

**User Story:** Como operador del kiosco, quiero que el contenido visual de cada sello individual sea idéntico al que produce el sistema actual, para que la optimización no altere la apariencia de las etiquetas impresas.

#### Acceptance Criteria

1. THE Stamp_Renderer SHALL produce pages with identical dimensions (55mm x 55mm in points), text positioning, font sizes, and image placement as the current `renderStampMultiPage()` implementation.
2. WHEN the PDF_Generator produces a consolidated Multi_Page_PDF, THE GeneratedPdf metadata (target, pdfType, description) SHALL remain consistent with the current output format, using pdfType `stamp_simple` or `SELLO_simple` as applicable.
3. WHEN the PDF_Generator counts stamp PDFs in the SaleGenerationResult, THE stampCount SHALL reflect the number of Multi_Page_PDFs produced (one per tariff/model), not the number of individual stamp pages.

### Requirement 7: Aplicación a ambas rutas de generación

**User Story:** Como desarrollador, quiero que la optimización se aplique tanto a la ruta de tarifas dinámicas como a la ruta legacy estática, para que todas las ventas se beneficien de la mejora.

#### Acceptance Criteria

1. WHEN the PDF_Generator uses the dynamic tariff path (dynamicTariffCtx provided), THE PDF_Generator SHALL consolidate Simple_Stamps for each tariff/model into a single Multi_Page_PDF.
2. WHEN the PDF_Generator uses the legacy static tariff path (no dynamicTariffCtx), THE PDF_Generator SHALL consolidate Simple_Stamps for each tariff/model into a single Multi_Page_PDF.

### Requirement 8: Resolución de rasterización de SumatraPDF

**User Story:** Como operador del kiosco, quiero que los sellos impresos tengan texto y logos nítidos en lugar de ligeramente pixelados, para que la calidad visual de las etiquetas sea profesional.

#### Acceptance Criteria

1. WHEN the Windows_Backend invokes SumatraPDF to print a PDF, THE Windows_Backend SHALL include a DPI parameter in the Print_Settings string that forces SumatraPDF to rasterize at 300×300 DPI o superior.
2. WHEN the Windows_Backend builds the `-print-settings` argument, THE Windows_Backend SHALL use the format `"noscale,300x300dpi"` to combine the existing noscale setting with the Rasterization_DPI setting.
3. THE Windows_Backend SHALL apply the Rasterization_DPI setting to all print jobs (stamps, tickets, and any future PDF types) sent through SumatraPDF.

### Requirement 9: Configurabilidad del DPI de rasterización

**User Story:** Como desarrollador, quiero que el valor de DPI de rasterización sea configurable en un único punto del código, para poder ajustarlo fácilmente si se detecta que un valor diferente produce mejores resultados en la impresora Brother TD-4100N.

#### Acceptance Criteria

1. THE Windows_Backend SHALL define the Rasterization_DPI value as una constante exportada o parámetro configurable, permitiendo su modificación sin buscar cadenas literales dispersas en el código.
2. WHEN the Rasterization_DPI value is changed, THE Windows_Backend SHALL apply the new value a todos los jobs de impresión subsiguientes sin requerir cambios en otros módulos.

### Requirement 10: Retrocompatibilidad del backend de impresión

**User Story:** Como operador del kiosco, quiero que el cambio de DPI no altere el comportamiento de escalado ni la configuración de tamaño de papel existente, para que los sellos sigan imprimiéndose al tamaño correcto (55×25mm).

#### Acceptance Criteria

1. WHEN the Windows_Backend applies the Rasterization_DPI setting, THE Windows_Backend SHALL preserve the `noscale` print setting to ensure PDFs are printed at 100% original size without fitting or shrinking.
2. WHEN the Windows_Backend prints PDFs with custom media sizes (tickets), THE Windows_Backend SHALL continue configuring the printer driver paper size via `configurePrinterPaperSize()` independently of the Rasterization_DPI setting.
3. IF SumatraPDF does not recognize the DPI parameter format, THEN THE Windows_Backend SHALL still complete the print job (the DPI parameter is additive and non-blocking — SumatraPDF ignores unrecognized sub-parameters in print-settings).
