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

- **Backend**: `IppBackend` (detected via `os.platform() === 'win32'`)
- **Local printers**: Use `win://` URI scheme → routed through `printViaWindowsSpooler()`
- **Print engine**: `pdf-to-printer` npm package (wraps SumatraPDF portable)
- **SumatraPDF options**: Passed via `win32: ['-print-settings', '...']` array
- **No CUPS/lp commands** are available at runtime

## Implications for Code Changes

- Changes to `cups-backend.ts` have NO effect at runtime (only used on Linux/macOS)
- Print orientation/scaling must be controlled via SumatraPDF `-print-settings` flags
- The Windows printer driver (e.g., Brother TD-4100N) may apply its own transformations
- Testing on Linux validates logic/generation but cannot verify actual print output on Windows
- IPP attributes like `orientation-requested` and `media` are only used for network IPP printers, NOT for `win://` local printers

## Hardware

- **Stamp/label printer**: Brother TD-4100N (thermal label printer, 55×25mm labels)
  - Feeds paper along the 55mm side (long edge)
  - Driver may auto-rotate content
  - Connected as local Windows printer (`win://` URI)
- **Ticket printer**: Thermal receipt printer (78mm wide, variable height)
