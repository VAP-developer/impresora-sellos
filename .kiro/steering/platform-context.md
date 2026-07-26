---
inclusion: auto
---

# Platform Context

## Development vs Execution Environment

- **Development**: Linux (Ubuntu)
- **Execution/Production**: Windows 10/11
- **Build command**: `npm run build:win` (cross-compiles for Windows)
- **Package manager**: npm

## Printing Stack on Windows

The app runs on Windows and uses the following printing stack:

- **Backend**: `WindowsBackend` (detected via `os.platform() === 'win32'`)
- **Local printers**: Use `win://` URI scheme → all printing goes through Windows spooler
- **Print engine**: `pdf-to-printer` npm package (wraps SumatraPDF portable)
- **SumatraPDF options**: Passed via `win32: ['-print-settings', '...']` array
- **No CUPS/lp commands** are available at runtime

## Implications for Code Changes

- Changes to `cups-backend.ts` have NO effect at runtime (only used on Linux/macOS)
- Print orientation/scaling must be controlled via SumatraPDF `-print-settings` flags
- The Windows printer driver (e.g., Brother TD-4100N) may apply its own transformations
- Testing on Linux validates logic/generation but cannot verify actual print output on Windows
- IPP protocol code has been removed; only local `win://` printers are supported

## Hardware

- **Stamp/label printer**: Brother TD-4100N (thermal label printer)
  - Paper is pre-printed (already has the stamp design/logo)
  - App only needs to place text (tarifa, código, evento, fecha) in correct positions
  - Driver config in Windows:
    - Width: 25mm
    - Length: 55mm
    - Orientation: Horizontal (driver rotates content 90° for landscape output)
  - Paper feed: along the 55mm side (long edge)
  - Connected as local Windows printer (`win://` URI)
  - Print engine: SumatraPDF via pdf-to-printer with `-print-settings "noscale,portrait"`
- **Ticket printer**: Thermal receipt printer (78mm wide, variable height)
