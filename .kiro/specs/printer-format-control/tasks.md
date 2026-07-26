# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - CUPS fit-to-page ausente y overlay/texto mal posicionados
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases:
    - Bug 1: Any call to `CupsBackend.print()` — verify args DO NOT contain `fit-to-page=no` (confirms bug)
    - Bug 2: Any call to `renderStamp()` with overlayImage — verify overlay draws at x=0 full width (confirms bug)
    - Bug 2: Any call to `renderStamp()` with evento text — verify xRight=53mm (confirms bug)
  - **Test file**: `src/main/printing/__tests__/format-control.bug-condition.property.test.ts`
  - Use fast-check to generate arbitrary PrintOptions (media string, orientation 3|6, optional jobName)
  - Mock CommandExecutor to capture `lp` args — assert args array does NOT include `fit-to-page=no`
  - Mock PDFDocument to capture `doc.image()` calls — assert overlayImage is drawn at x=0, width=STAMP_WIDTH
  - Mock `drawTextRight` or capture calls — assert evento/fecha use xRight=53mm
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples: "CupsBackend.print() args missing fit-to-page=no", "overlayImage drawn at x=0 full-width", "evento text at xRight=53mm"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Comportamiento existente sin cambios
  - **IMPORTANT**: Follow observation-first methodology
  - **Test file**: `src/main/printing/__tests__/format-control.preservation.property.test.ts`
  - **Observe on UNFIXED code**:
    - `drawBackground(doc, backgroundImage)` draws at x=0, y=0, width=STAMP_WIDTH, height=STAMP_HEIGHT
    - `drawTextLeft(doc, tarifa, ...)` uses x=2mm
    - `drawTextLeft(doc, codigo, ...)` uses x=2mm
    - `IppBackend.print()` does NOT include `fit-to-page` in IPP attributes
    - `renderStampEspecialStrip()` uses same layout as before (E1-E4 unchanged)
  - **Property tests to write (using fast-check)**:
    - For all arbitrary StampRenderParams with backgroundImage: background draws at (0, 0, 55mm, 25mm)
    - For all arbitrary StampRenderParams: tarifa text at x=2mm, codigo text at x=2mm
    - For all arbitrary PrintOptions via IppBackend: no fit-to-page option added
    - For all tiras especiales: layout unchanged (E1-E4 backgrounds, codigo at 1.5mm, especial at 23.3mm)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

- [x] 3. Fix para control de formato de impresión

  - [x] 3.1 Agregar `fit-to-page=no` al CUPS backend
    - En `src/main/printing/cups-backend.ts`, método `CupsBackend.print()`
    - Después de agregar las opciones de media y orientation al array `args`, agregar: `args.push('-o', 'fit-to-page=no')`
    - Esta opción previene el escalado automático del driver CUPS/Brother
    - _Bug_Condition: isBugCondition(input) where input.backend == "cups" AND NOT args.contains("fit-to-page=no")_
    - _Expected_Behavior: El comando lp siempre incluye `-o fit-to-page=no` para todos los print jobs_
    - _Preservation: IPP backend no se modifica; media size y orientation siguen igual_
    - _Requirements: 2.1, 2.2, 3.1, 3.8_

  - [x] 3.2 Crear función `drawOverlay()` y corregir layout de etiquetas
    - En `src/main/printing/stamp-renderer.ts`:
    - Crear nueva función `drawOverlay(doc, imageSource)` que dibuje la imagen en la mitad derecha: x=27.5mm, y=0, width=27.5mm, height=25mm (usando coordenadas en puntos: x=27.5*MM_TO_PT, width=27.5*MM_TO_PT)
    - En `renderStamp()`: reemplazar `drawBackground(doc, params.overlayImage)` por `drawOverlay(doc, params.overlayImage)`
    - En `renderStamp()`: cambiar textos evento y fecha de `drawTextRight(doc, ..., 53, ...)` a `drawTextRight(doc, ..., 26, ...)`
    - En `renderStampMultiPage()`: aplicar los mismos cambios — usar `drawOverlay()` para overlay y cambiar xRight de 53 a 26 para evento/fecha
    - _Bug_Condition: isBugCondition(input) where overlayImage != null AND overlayPosition.x < 27.5mm_
    - _Expected_Behavior: overlay dibujado en x>=27.5mm; textos evento/fecha con xRight<=27.5mm_
    - _Preservation: backgroundImage sigue en (0,0,55,25); tarifa en x=2mm; codigo en x=2mm; tiras especiales sin cambios_
    - _Requirements: 2.3, 2.4, 2.5, 3.3, 3.4, 3.5, 3.7_

  - [x] 3.3 Verificar que el test de bug condition ahora pasa
    - **Property 1: Expected Behavior** - CUPS fit-to-page presente y overlay/texto correctamente posicionados
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (assertions are inverted for the fix)
    - Run `src/main/printing/__tests__/format-control.bug-condition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Verificar que los tests de preservación siguen pasando
    - **Property 2: Preservation** - Comportamiento existente sin cambios
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run `src/main/printing/__tests__/format-control.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest --run src/main/printing/__tests__/`
  - Verify bug condition exploration test passes (bug is fixed)
  - Verify preservation tests pass (no regressions)
  - Verify existing tests pass (cups-backend.test.ts, stamp-renderer.test.ts, etc.)
  - Ensure all tests pass, ask the user if questions arise.
