# Requirements Document

## Introduction

The stamp-printing application currently uses a hardcoded DPI constant (`PRINT_DPI = '300x300dpi'`) when invoking SumatraPDF. This causes quality degradation on printers with a different native resolution (e.g. the Brother TD-4100N at 203 DPI), because SumatraPDF rasterizes at 300 DPI and the driver must downscale the oversized bitmap — resulting in fuzzy text and pixelated thin lines.

This feature introduces automatic DPI detection per assigned printer so that SumatraPDF rasterizes at the printer's native resolution, eliminating unnecessary scaling and improving output quality without any user intervention.

## Glossary

- **DPI_Detector**: The module responsible for querying Windows for a printer's native horizontal and vertical resolution (DPI).
- **DPI_Cache**: An in-memory store that holds detected DPI values per printer name, avoiding repeated system queries on every print job.
- **Windows_Backend**: The existing `WindowsBackend` class (`windows-backend.ts`) that invokes SumatraPDF to print PDFs.
- **Printer_Manager**: The existing `PrinterManager` class that routes print jobs to the correct target printer.
- **SumatraPDF**: The bundled PDF viewer/printer used by the app to send PDFs to physical printers via command line.
- **Printer_URI**: A string in the format `win://<encoded-printer-name>` that identifies a Windows printer in the app.
- **Native_DPI**: The physical resolution (dots per inch) that a printer can produce, as reported by its Windows driver.
- **Fallback_DPI**: The default DPI value (203x203) used when detection fails, chosen because 203 DPI is the most common resolution for thermal label printers.

## Requirements

### Requirement 1: Detect Printer Native DPI

**User Story:** As a system operator, I want the app to automatically detect each printer's native DPI, so that print jobs are rasterized at the correct resolution without manual configuration.

#### Acceptance Criteria

1. WHEN a printer name is provided, THE DPI_Detector SHALL query Windows for the printer's horizontal and vertical resolution in dots per inch.
2. WHEN the Windows query returns valid DPI values, THE DPI_Detector SHALL return the detected horizontal and vertical DPI as a pair of positive integers.
3. IF the Windows query fails or returns invalid data, THEN THE DPI_Detector SHALL return the Fallback_DPI value of 203x203.
4. IF the printer name does not correspond to an installed printer, THEN THE DPI_Detector SHALL return the Fallback_DPI value of 203x203.
5. THE DPI_Detector SHALL complete the detection query within 5 seconds.

### Requirement 2: Cache Detected DPI Values

**User Story:** As a system operator, I want detected DPI values to be cached, so that the app does not query Windows on every single print job.

#### Acceptance Criteria

1. WHEN the DPI_Detector successfully detects a DPI value for a printer, THE DPI_Cache SHALL store the result keyed by the printer name.
2. WHEN a DPI value is requested for a printer that already exists in the DPI_Cache, THE DPI_Cache SHALL return the cached value without querying Windows.
3. WHEN the application starts, THE DPI_Cache SHALL be empty (no stale values from previous sessions).
4. WHEN a printer assignment changes for any target, THE DPI_Cache SHALL invalidate the entry for the previously assigned printer and detect the DPI for the newly assigned printer.
5. THE DPI_Cache SHALL store at most one entry per unique printer name.

### Requirement 3: Use Detected DPI in SumatraPDF Invocation

**User Story:** As a system operator, I want the detected DPI to be used dynamically in each print job, so that SumatraPDF rasterizes at the printer's native resolution instead of a hardcoded value.

#### Acceptance Criteria

1. WHEN the Windows_Backend builds the SumatraPDF `-print-settings` argument, THE Windows_Backend SHALL use the format `noscale,{dpiX}x{dpiY}dpi` where dpiX and dpiY are the cached DPI values for the target printer.
2. WHEN no DPI value is cached for the target printer, THE Windows_Backend SHALL use the Fallback_DPI value of `203x203dpi` in the `-print-settings` argument.
3. THE Windows_Backend SHALL remove the hardcoded `PRINT_DPI` constant and replace its usage with the dynamically resolved DPI value.
4. THE Windows_Backend SHALL not modify any other part of the SumatraPDF command line arguments (printer name, `-silent` flag, temp file path).

### Requirement 4: Trigger DPI Detection on Printer Assignment

**User Story:** As a system operator, I want the DPI to be re-detected whenever I assign a different printer, so that the correct DPI is always used even after changing printer hardware.

#### Acceptance Criteria

1. WHEN a printer assignment is set or changed via the Printer_Manager, THE DPI_Detector SHALL detect the native DPI for the newly assigned printer.
2. WHEN the application starts and printer assignments are loaded from configuration, THE DPI_Detector SHALL detect the native DPI for each assigned printer.
3. IF DPI detection fails during assignment, THEN THE DPI_Cache SHALL store the Fallback_DPI value for that printer, and the application SHALL continue operating normally.

### Requirement 5: Preserve Existing Print Pipeline

**User Story:** As a system operator, I want the DPI detection feature to operate transparently without affecting other parts of the printing workflow, so that PDF generation, queue management, and label grouping continue to work as before.

#### Acceptance Criteria

1. THE Windows_Backend SHALL continue to accept the same `PrintOptions` interface without additional required parameters.
2. THE Windows_Backend SHALL continue to write temporary PDF files, invoke SumatraPDF, and clean up temp files using the same process as before.
3. THE Printer_Manager SHALL continue to route print jobs based on target assignment without any API changes.
4. THE DPI detection logic SHALL not block or delay print jobs beyond the initial detection performed at assignment time.
