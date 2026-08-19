# Implementation Plan: Dynamic Printer DPI

## Overview

Replace the hardcoded `PRINT_DPI = '300x300dpi'` constant with runtime DPI detection via WMI. The implementation adds a `DpiDetector` module that queries `Win32_PrinterConfiguration` for each assigned printer's native resolution, caches results in-memory (`DpiCache`), and injects the correct DPI into SumatraPDF's `-print-settings` argument at print time. Detection is triggered on printer assignment (startup + UI changes) and falls back to 203x203 on any failure.

## Tasks

- [x] 1. Create DPI detector module and cache
  - [x] 1.1 Create `src/main/printing/dpi-detector.ts` with DpiResult interface, FALLBACK_DPI, and DpiCache class
    - Define and export `DpiResult` interface with `dpiX: number` and `dpiY: number`
    - Export `FALLBACK_DPI: DpiResult = { dpiX: 203, dpiY: 203 }`
    - Implement `DpiCache` class with `Map<string, DpiResult>` backing store
    - Methods: `get(printerName)`, `set(printerName, dpi)`, `delete(printerName)`, `clear()`, `get size()`
    - Export `DpiDetector` interface with `detect(printerName: string): Promise<DpiResult>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 2.5_

  - [x] 1.2 Implement `WmiDpiDetector` class in `dpi-detector.ts`
    - Accept `WindowsCommandExecutor` in constructor (reuse existing interface from `windows-backend.ts`)
    - Build PowerShell command: `Get-CimInstance -ClassName Win32_PrinterConfiguration -Filter "Name='<printerName>'" | Select-Object XResolution, YResolution | ConvertTo-Json -Compress`
    - Escape single quotes in printer name (same `escapePsName` pattern)
    - Parse JSON stdout, extract `XResolution` and `YResolution`
    - Validate both are positive integers (> 0); return `FALLBACK_DPI` on any parse failure
    - Set timeout to 5000ms
    - Wrap entire detect in try/catch — always return `FALLBACK_DPI` on error, log warning
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.3 Write property test for DPI parsing correctness (Property 1)
    - **Property 1: DPI Parsing Correctness**
    - For any string returned by the command executor: if it's valid JSON with positive integer `XResolution` and `YResolution`, the detector returns those values; otherwise it returns `FALLBACK_DPI {dpiX: 203, dpiY: 203}`
    - Use `fast-check` to generate random JSON strings (valid WMI shapes and garbage)
    - Test file: `src/main/printing/__tests__/dpi-detector.property.test.ts`
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 1.4 Write property test for cache invariant (Property 2)
    - **Property 2: Cache Invariant**
    - For any sequence of `set`/`get`/`delete` operations with arbitrary printer names, the cache contains exactly one entry per unique printer name reflecting its most recently set value
    - Use `fast-check` to generate random operation sequences
    - Test file: `src/main/printing/__tests__/dpi-cache.property.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 2. Modify WindowsBackend to use DpiCache
  - [x] 2.1 Update `WindowsBackend` constructor and `print()` in `windows-backend.ts`
    - Add optional `DpiCache` parameter to `WindowsBackend` constructor, store as private field
    - Remove the exported `PRINT_DPI` constant
    - In `print()` method: look up `dpiCache.get(printerName)` for the target printer
    - If cache hit → use `${dpi.dpiX}x${dpi.dpiY}dpi` in `-print-settings`
    - If cache miss or no cache → use `${FALLBACK_DPI.dpiX}x${FALLBACK_DPI.dpiY}dpi` (import from dpi-detector)
    - Build args as: `-print-settings`, `noscale,${resolvedDpi}` (same format as before)
    - Preserve all other arguments unchanged (printer name, `-silent`, temp file path)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2_

  - [ ]* 2.2 Write property test for SumatraPDF command construction (Property 4)
    - **Property 4: SumatraPDF Command Construction**
    - For any printer name and cached DPI pair `(dpiX, dpiY)`, the args passed to execFile include `-print-settings "noscale,{dpiX}x{dpiY}dpi"` and preserve `-print-to`, `-silent`, and temp file path unchanged
    - Use `fast-check` to generate random printer names + DPI values (1–9999)
    - Test file: `src/main/printing/__tests__/windows-backend-dpi.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 3. Checkpoint - Verify DPI detector and backend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate DPI detection into PrinterManager and services
  - [x] 4.1 Modify `PrinterManager` to accept `DpiDetector` and `DpiCache`, trigger detection in `setAssignments()`
    - Add `DpiDetector` and `DpiCache` as optional constructor parameters
    - In `setAssignments()`: iterate assigned URIs, extract printer name via `getWindowsPrinterName()`, call `dpiDetector.detect(printerName)` for each, store result in `dpiCache`
    - Detection is fire-and-forget (async, non-blocking to the caller) — use `Promise.allSettled`
    - On detection failure, store `FALLBACK_DPI` in cache (Requirement 4.3)
    - Export `getWindowsPrinterName` from `windows-backend.ts` if not already exported (it is already)
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4_

  - [x] 4.2 Update `services.ts` to wire DpiDetector, DpiCache, and pass to PrinterManager and WindowsBackend
    - Create shared `DpiCache` instance in `getPrinterManager()`
    - Create `WmiDpiDetector` instance with `defaultWindowsExecutor`
    - Pass `DpiCache` to `WindowsBackend` constructor
    - Pass both `DpiDetector` and `DpiCache` to `PrinterManager` constructor
    - After creating PrinterManager with initial assignments, call `setAssignments()` to trigger initial DPI detection
    - _Requirements: 4.1, 4.2, 4.3, 2.3_

  - [ ]* 4.3 Write property test for detection triggered on assignment (Property 3)
    - **Property 3: Detection Triggered on Assignment**
    - For any call to `setAssignments` with a set of printer URIs, the DPI detector is invoked exactly once per newly assigned printer name, and the resulting DPI is stored in the cache
    - Use `fast-check` to generate random sets of printer URIs
    - Mock `DpiDetector` to track calls
    - Test file: `src/main/printing/__tests__/printer-manager-dpi.property.test.ts`
    - **Validates: Requirements 2.4, 4.1, 4.2, 4.3**

- [x] 5. Update printer:assign handler to trigger DPI detection on reassignment
  - [x] 5.1 Update `printer:assign` handler in `printer.handlers.ts`
    - After `printerManager.setAssignments({ [typedTarget]: typedUri })`, DPI detection fires automatically via the modified `setAssignments()` — verify no additional wiring needed
    - Ensure cache invalidation for previous assignment happens in `setAssignments()` (delete old entry before detecting new)
    - _Requirements: 2.4, 4.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests and property tests are complementary: properties cover exhaustive generation, unit tests verify specific known scenarios
- The `WindowsCommandExecutor` interface is already exported from `windows-backend.ts` and reused by the DPI detector
- `getWindowsPrinterName()` is already exported and reused for URI → printer name conversion
- Detection is non-blocking: `setAssignments()` triggers detection asynchronously so it doesn't delay startup or UI responses

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3", "5.1"] }
  ]
}
```
