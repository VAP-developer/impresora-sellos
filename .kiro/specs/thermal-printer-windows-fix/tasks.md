# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Thermal Printer Stamp Bugs (Rotation, Double Print, Missing Config)
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the 3 bugs exist in `printViaWindowsSpooler()`
  - **Scoped PBT Approach**: Scope the property to stamp print jobs sent via `win://` URI to a thermal printer
  - **Test file**: `src/main/printing/__tests__/thermal-printer.bug-condition.property.test.ts`
  - **Setup**: Mock `pdf-to-printer`'s `print` function to capture arguments (file path, options). Mock `fs.writeFileSync` to capture the PDF buffer written to temp file. Configure `PrinterAssignments` with a `win://Brother%20TD-4100N` URI and `thermalConfig` for printer1
  - **Bug Condition** (`isBugCondition`): `printerUri STARTS_WITH 'win://' AND printerIsThermalLabel(printerUri) AND pdfType IN ['stamp_simple', 'stamp_tira', 'stamp_especial']`
  - **Properties to assert (expected behavior after fix)**:
    - P1 (Rotation): The PDF buffer written to disk SHALL have 180° rotation applied to all pages (use `pdf-lib` to load captured buffer and check `page.getRotation().angle === 180`)
    - P2 (Single Copy): `printPdf` SHALL be called exactly once per job, and the `copies` option SHALL be undefined or omitted (not passed to SumatraPDF)
    - P3 (Thermal Settings): The `win32` print-settings string SHALL include paper size matching `thermalConfig.paperWidthMm x paperHeightMm` (e.g., `paper=55x25`)
  - **Generators**: Use `fc.constantFrom('stamp_simple', 'stamp_tira', 'stamp_especial')` for pdfType, generate arbitrary PDF buffers (valid 55×25mm PDFs via `pdf-lib`), generate thermal configs with `rotateDegrees: 180`, `paperWidthMm: 55`, `paperHeightMm: 25`, `forceSingleCopy: true`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (confirms bugs: no rotation applied, copies may be passed, no thermal-specific settings)
  - Document counterexamples found (e.g., "PDF has rotation 0° instead of 180°", "copies=1 passed causing double print", "settings string is 'noscale,portrait' without paper size")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Thermal Print Path Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Test file**: `src/main/printing/__tests__/thermal-printer.preservation.property.test.ts`
  - **Observe behavior on UNFIXED code for non-buggy inputs** (cases where `isBugCondition` returns false):
    - Observe: Tickets via `win://` use settings `noscale,portrait`, no PDF rotation, copies passed as-is
    - Observe: Stamps via `win://` to a non-thermal printer use settings `noscale,portrait`, no PDF rotation
    - Observe: Stamps via `ipp://` go through IPP path with media/orientation/copies attributes unchanged
    - Observe: `PrintQueueService.buildPrintOptions()` returns `{ media: 'DC55x25', orientation: 3, jobName }` for stamps regardless of thermal config
  - **Property-based tests to write**:
    - P2a: For all ticket print jobs via `win://` (any printer), the PDF buffer SHALL NOT be rotated AND settings SHALL remain `noscale,portrait` AND copies SHALL be passed unchanged
    - P2b: For all stamp print jobs via `win://` where `thermalConfig` is undefined/not-enabled, the PDF buffer SHALL NOT be rotated AND settings SHALL remain `noscale,portrait`
    - P2c: For all print jobs via `ipp://` URI (any type), the IPP code path SHALL be taken (not `printViaWindowsSpooler`) regardless of `thermalConfig` presence
  - **Generators**: Use `fc.constantFrom('ticket', 'ticket_caja', 'ticket_master')` for ticket types, `fc.constantFrom('stamp_simple', 'stamp_tira', 'stamp_especial')` for stamp types, generate valid PDF buffers, generate URIs with `ipp://` and `win://` prefixes
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for thermal printer orientation, double printing, and missing config

  - [ ] 3.1 Define `ThermalPrinterConfig` interface and extend `PrinterAssignments`
    - Add `ThermalPrinterConfig` interface to `src/main/printing/printer-manager.ts` with fields: `enabled: boolean`, `rotateDegrees: 0 | 90 | 180 | 270`, `paperWidthMm: number`, `paperHeightMm: number`, `forceSingleCopy: boolean`
    - Extend `PrinterAssignments` interface with optional `thermalConfig?: Partial<Record<PrinterTarget, ThermalPrinterConfig>>`
    - Export the new interface
    - _Bug_Condition: isBugCondition(input) where printerUri starts with 'win://' AND target has thermalConfig enabled_
    - _Expected_Behavior: ThermalPrinterConfig provides mechanism to specify per-target thermal settings_
    - _Preservation: Non-thermal assignments unchanged — thermalConfig is optional_
    - _Requirements: 2.5, 1.4, 1.5_

  - [ ] 3.2 Extend `PrintOptions` with optional `thermalConfig` field
    - Add `thermalConfig?: ThermalPrinterConfig` to `PrintOptions` interface in `src/main/printing/printer-manager.ts`
    - This transports thermal config from `PrinterManager` through to `printViaWindowsSpooler()`
    - _Bug_Condition: Need to transport thermal config through the print pipeline_
    - _Expected_Behavior: PrintOptions carries thermalConfig for thermal-enabled targets_
    - _Preservation: Existing PrintOptions fields unchanged, thermalConfig is optional_
    - _Requirements: 2.4, 2.5_

  - [ ] 3.3 Implement `rotatePdfPages()` utility function
    - Create or add to `src/main/printing/ipp-backend.ts` (or a new utility file) the `rotatePdfPages(pdfBuffer: Buffer, rotation: number): Promise<Buffer>` function
    - Use `pdf-lib` (`PDFDocument.load()`, `page.setRotation(degrees(currentAngle + rotation))`, `pdfDoc.save()`)
    - Ensure it handles multi-page PDFs (rotate ALL pages)
    - Ensure it preserves PDF dimensions (width/height unchanged)
    - Add `pdf-lib` to dependencies if not already present (check `package.json`)
    - _Bug_Condition: Thermal printer inverts content 180° due to paper feed direction_
    - _Expected_Behavior: rotatePdfPages(buffer, 180) produces PDF with all pages rotated 180°_
    - _Preservation: Function is new, does not affect existing code paths_
    - _Requirements: 2.1_

  - [ ] 3.4 Modify `printViaWindowsSpooler()` to apply thermal configuration
    - Accept `thermalConfig` from `options.thermalConfig`
    - If `thermalConfig?.enabled` AND `thermalConfig.rotateDegrees !== 0`: call `rotatePdfPages(pdfBuffer, thermalConfig.rotateDegrees)` before writing to temp file
    - If `thermalConfig?.enabled`: build SumatraPDF settings string as `noscale,portrait,paper=${paperWidthMm}x${paperHeightMm}` (or equivalent format)
    - If `thermalConfig?.forceSingleCopy`: do NOT pass `copies` field to `printPdf()` options (omit it entirely to prevent double-printing)
    - If NOT thermal: keep existing behavior (`noscale,portrait`, pass `copies` as before)
    - _Bug_Condition: isBugCondition(input) where options.thermalConfig.enabled === true_
    - _Expected_Behavior: PDF rotated, paper size set, copies omitted for thermal printers_
    - _Preservation: When thermalConfig is undefined/not-enabled, behavior identical to current code_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.5 Update `PrinterManager.printStamp()` to pass `thermalConfig` from assignments
    - In `printStamp()` method, look up `this.assignments.thermalConfig?.[target]`
    - If found and `enabled`, include it in the `PrintOptions` passed to `this.print()`
    - This connects the stored per-target thermal config to the print execution path
    - _Bug_Condition: thermalConfig not passed through the print chain_
    - _Expected_Behavior: printStamp() passes thermalConfig to PrintOptions for thermal targets_
    - _Preservation: Non-thermal targets get no thermalConfig in PrintOptions (field absent)_
    - _Requirements: 2.4, 2.5_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Thermal Printer Stamp Bugs Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (rotation 180°, single copy, thermal settings)
    - When this test passes, it confirms all 3 bugs are fixed
    - Run: `npx vitest --run src/main/printing/__tests__/thermal-printer.bug-condition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Thermal Print Path Still Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `npx vitest --run src/main/printing/__tests__/thermal-printer.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm tickets, IPP printers, and non-thermal win:// printers all behave identically to before fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest --run`
  - Ensure all existing tests still pass (no regressions in printer-routing, format-control, pdf-generator, etc.)
  - Ensure the 2 new property tests pass
  - If any test fails, investigate and fix before considering the bugfix complete
  - Ask the user if questions arise about hardware-specific behavior that can't be verified in tests
