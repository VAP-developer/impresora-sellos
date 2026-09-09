/**
 * windows-backend.ts
 *
 * Sends PDFs to local Windows printers via SumatraPDF command line.
 * Invokes SumatraPDF directly (bundled with pdf-to-printer package)
 * with minimal settings to avoid any scaling or transformation.
 *
 * Key principle: the PDF is already the correct size (55×25mm for stamps,
 * 78×variable for tickets). We just tell SumatraPDF "print this at original
 * size, no scaling" and let the printer driver handle the rest.
 *
 * The printer driver in Windows MUST be configured with the correct paper size
 * (55mm × 25mm for the Brother TD-4100N label printer).
 */

import type {
  PrinterBackend,
  PrinterStatus,
  PrintOptions,
  PrintResult,
  DiscoveredPrinter
} from './printer-manager'
import { discoverWindowsLocalPrinters, type DiscoveryCommandExecutor } from './printer-discovery'
import { DpiCache, FALLBACK_DPI } from './dpi-detector'
import { ElectronPrintBackend } from './electron-print-backend'

// ─── Command Executor Interface (for testability) ─────────────────────────────

export interface WindowsCommandExecutor {
  exec(command: string, options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }>
  execFile(file: string, args: string[], options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }>
}

export const defaultWindowsExecutor: WindowsCommandExecutor = {
  exec(command: string, options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }> {
    const { exec: nodeExec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(nodeExec)
    return execAsync(command, { timeout: options?.timeout ?? 10000 })
  },
  execFile(file: string, args: string[], options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }> {
    const { execFile: nodeExecFile } = require('child_process')
    const { promisify } = require('util')
    const execFileAsync = promisify(nodeExecFile)
    return execFileAsync(file, args, { timeout: options?.timeout ?? 30000 })
  }
}



// ─── URI Helpers ──────────────────────────────────────────────────────────────

export function getWindowsPrinterName(printerUri: string): string {
  const encoded = printerUri.replace('win://', '')
  return decodeURIComponent(encoded)
}

function escapePsName(name: string): string {
  return name.replace(/'/g, "''")
}

// ─── SumatraPDF Path Resolution ──────────────────────────────────────────────

/**
 * Parses a media string like "Custom.78x177mm" into width and height in tenths of mm.
 * Returns null if the media string doesn't match the expected format.
 */
function parseCustomMedia(media: string): { widthTenths: number; heightTenths: number } | null {
  const match = media.match(/^Custom\.(\d+)x(\d+)mm$/)
  if (!match) return null
  return { widthTenths: parseInt(match[1], 10) * 10, heightTenths: parseInt(match[2], 10) * 10 }
}

/**
 * Configures the Windows printer driver DEVMODE to set a custom paper size.
 * This is required for Brother TD-4100N (and similar thermal printers) where
 * SumatraPDF's paper= parameter doesn't work and the driver must be
 * pre-configured with the correct paper dimensions before printing.
 *
 * Uses the Win32 API (OpenPrinter, DocumentProperties, SetPrinter) via
 * an external PowerShell script (resources/set-paper-size.ps1).
 */
export async function configurePrinterPaperSize(
  printerName: string,
  widthTenths: number,
  heightTenths: number,
  executor: WindowsCommandExecutor
): Promise<void> {
  // Resolve script path — works both in dev and packaged Electron app
  let scriptPath = ''
  const { join } = require('path')
  const { existsSync } = require('fs')

  // Packaged app: extraResources are in process.resourcesPath
  if (process.resourcesPath) {
    const packaged = join(process.resourcesPath, 'set-paper-size.ps1')
    if (existsSync(packaged)) {
      scriptPath = packaged
    }
  }

  // Dev mode: resources folder relative to project root
  if (!scriptPath) {
    const devPath = join(__dirname, '..', '..', 'resources', 'set-paper-size.ps1')
    if (existsSync(devPath)) {
      scriptPath = devPath
    }
  }

  // Fallback: scripts folder (test scripts)
  if (!scriptPath) {
    const testPath = join(__dirname, '..', '..', 'scripts', 'set-paper-size.ps1')
    if (existsSync(testPath)) {
      scriptPath = testPath
    }
  }

  // Another dev fallback (deeper nesting)
  if (!scriptPath) {
    const deepPath = join(__dirname, '..', '..', '..', 'resources', 'set-paper-size.ps1')
    if (existsSync(deepPath)) {
      scriptPath = deepPath
    }
  }

  if (!existsSync(scriptPath)) {
    // Can't find the script — skip silently
    return
  }

  const escapedPrinter = printerName.replace(/"/g, '`"')
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escapedPrinter}" -WidthTenthsMm ${widthTenths} -HeightTenthsMm ${heightTenths}`

  try {
    await executor.exec(command, { timeout: 10000 })
  } catch {
    // Non-fatal: if we can't configure the paper size, we still try to print
  }
}

/**
 * Configures the Brother TD printer driver to cut every N labels.
 * Uses a PowerShell script (resources/set-cut-interval.ps1) that modifies
 * the driver's private DEVMODE section.
 */
export async function configureCutInterval(
  printerName: string,
  cutInterval: number,
  executor: WindowsCommandExecutor
): Promise<void> {
  const { join } = require('path')
  const { existsSync } = require('fs')

  let scriptPath = ''

  // Packaged app: extraResources
  if (process.resourcesPath) {
    const packaged = join(process.resourcesPath, 'set-cut-interval.ps1')
    if (existsSync(packaged)) {
      scriptPath = packaged
    }
  }

  // Dev mode: resources folder
  if (!scriptPath) {
    const devPath = join(__dirname, '..', '..', 'resources', 'set-cut-interval.ps1')
    if (existsSync(devPath)) {
      scriptPath = devPath
    }
  }

  if (!scriptPath) {
    const deepPath = join(__dirname, '..', '..', '..', 'resources', 'set-cut-interval.ps1')
    if (existsSync(deepPath)) {
      scriptPath = deepPath
    }
  }

  if (!scriptPath) {
    // Script not found — skip silently
    return
  }

  const escapedPrinter = printerName.replace(/"/g, '`"')
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escapedPrinter}" -CutInterval ${cutInterval}`

  try {
    await executor.exec(cmd, { timeout: 10000 })
  } catch {
    // Non-fatal: if we can't configure cut interval, print still works
  }
}

/**
 * Resolves the path to SumatraPDF executable bundled with pdf-to-printer.
 * In an Electron packaged app, the path needs to account for asar unpacking.
 */
function getSumatraPdfPath(): string {
  const { join } = require('path')

  // pdf-to-printer bundles SumatraPDF in its dist folder
  let sumatraPath = join(
    require.resolve('pdf-to-printer'),
    '..',
    'SumatraPDF-3.4.6-32.exe'
  )

  // Handle Electron asar packaging
  if (sumatraPath.includes('app.asar')) {
    sumatraPath = sumatraPath.replace('app.asar', 'app.asar.unpacked')
  }

  return sumatraPath
}

// ─── Script Path Resolution ──────────────────────────────────────────────────

/**
 * Finds a PowerShell script by name in the standard locations:
 * - Packaged app: process.resourcesPath
 * - Dev mode: resources/ folder relative to project root
 * - Fallback: scripts/ folder
 *
 * Returns the full path or empty string if not found.
 */
export function findScript(scriptName: string): string {
  const { join } = require('path')
  const { existsSync } = require('fs')

  const candidates: string[] = []

  // Packaged app: extraResources
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, scriptName))
  }

  // Dev mode: resources folder relative to project root
  candidates.push(join(__dirname, '..', '..', 'resources', scriptName))
  candidates.push(join(__dirname, '..', '..', '..', 'resources', scriptName))

  // Fallback: scripts folder
  candidates.push(join(__dirname, '..', '..', 'scripts', scriptName))
  candidates.push(join(__dirname, '..', '..', '..', 'scripts', scriptName))

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return ''
}
// ─── WindowsBackend Implementation ───────────────────────────────────────────

export class WindowsBackend implements PrinterBackend {
  private cmd: WindowsCommandExecutor
  private dpiCache?: DpiCache

  constructor(executor?: WindowsCommandExecutor, dpiCache?: DpiCache) {
    this.cmd = executor ?? defaultWindowsExecutor
    this.dpiCache = dpiCache
  }

  /**
   * Prints a PDF using the best available method:
   *
   * - For TICKETS (custom paper size): Uses Electron's webContents.print() API
   *   which passes the page size per-job in the DEVMODE. This ensures the
   *   correct paper height regardless of the Windows driver defaults.
   *
   * - For STAMPS (fixed 55x25mm): Uses SumatraPDF with the driver's configured
   *   paper size. The cut interval is controlled by grouping stamps into
   *   separate PDFs (one per cut group) — the driver just needs "cut at end".
   *
   * Fallback: if Electron print fails, falls back to SumatraPDF.
   */
  async print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    const { writeFileSync, unlinkSync, mkdirSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')

    const printerName = getWindowsPrinterName(printerUri)
    const jobName = options.jobName ?? `print_${Date.now()}`

    // El contenido puede ser HTML (método fiable por Electron) o PDF (fallback).
    const isHtml = options.contentType === 'html'
    const ext = isHtml ? 'html' : 'pdf'

    // Escribir el contenido a un temporal con la extensión correcta: Chromium
    // decide cómo renderizar por la extensión del fichero (HTML nativo vs visor
    // de PDF).
    const tempDir = join(tmpdir(), 'stamp-sales-print')
    try { mkdirSync(tempDir, { recursive: true }) } catch { /* exists */ }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.${ext}`)

    try {
      writeFileSync(tempFile, pdfBuffer)

      // Parse custom media (tickets have variable height)
      const customMedia = parseCustomMedia(options.media)

      // ─── Método principal: Electron webContents.print() ─────────────────
      // Se usa cuando el contenido es HTML, o cuando conocemos el tamaño de
      // papel (tickets "Custom.NxMmm" / etiquetas con mediaSizeMm).
      //
      // Chromium manda el pageSize en el DEVMODE de cada trabajo, así que no
      // depende de lo que tenga configurado el driver. SumatraPDF, en cambio,
      // no controla ni tamaño ni orientación y auto-rota la página: medido en
      // papel, una etiqueta de 55x25 salía girada y recortada a ~25mm.
      const canUseElectron = isHtml || Boolean(customMedia) || Boolean(options.mediaSizeMm)

      if (canUseElectron) {
        try {
          const electronBackend = new ElectronPrintBackend()
          const result = await electronBackend.print(printerName, tempFile, options)

          if (result.success) {
            // Clean up after delay
            setTimeout(() => {
              try { unlinkSync(tempFile) } catch { /* ignore */ }
            }, 10000)
            return result
          }
          console.warn('[WindowsBackend] Electron print failed:', result.error)
        } catch (err) {
          console.warn('[WindowsBackend] Electron print error:', err)
        }

        // El contenido HTML NO puede imprimirse con SumatraPDF (sólo entiende
        // PDF). Si Electron falla con HTML, no hay fallback posible: devolvemos
        // el error de forma explícita en lugar de intentar Sumatra en vano.
        if (isHtml) {
          try { unlinkSync(tempFile) } catch { /* ignore */ }
          console.error(
            `[WindowsBackend] PRINT FAILED (html) printer="${printerName}" job="${jobName}": ` +
            `Electron no pudo imprimir y SumatraPDF no soporta HTML`
          )
          return { success: false, error: 'Electron print failed for HTML content (no SumatraPDF fallback)' }
        }
        // Para PDF sí cae a SumatraPDF a continuación.
        console.warn('[WindowsBackend] Falling back to SumatraPDF (pdf content)')
      }

      // ─── SumatraPDF method (stamps + fallback for tickets) ──────────────
      // For stamps: paper size is fixed (configured in driver), SumatraPDF works fine.
      // The "cut every N" is handled by generating separate PDFs per group.

      const sumatraPath = getSumatraPdfPath()

      // Resolve DPI for rendering.
      //
      // Use the printer's NATIVE resolution — do NOT multiply it. Rasterising
      // above the native DPI forces the driver to downscale an oversized bitmap,
      // which on the Brother TD-4520TN (300 dpi) produced jobs the printer
      // silently discarded: the spooler reported "printed successfully" but no
      // label came out. It also contradicts the dynamic-printer-dpi spec, which
      // requires `noscale,{dpiX}x{dpiY}dpi` with the detected native values.
      const dpi = this.dpiCache?.get(printerName) ?? FALLBACK_DPI
      const dpiSetting = `${dpi.dpiX}x${dpi.dpiY}dpi`
      const printSettings = `noscale,${dpiSetting}`

      const args = [
        '-print-to', printerName,
        '-print-settings', printSettings,
        '-silent',
        tempFile
      ]

      console.log(
        `[WindowsBackend] PRINT job="${jobName}" printer="${printerName}" ` +
        `media="${options.media}" dpi=${dpi.dpiX}x${dpi.dpiY} render=${dpiSetting} ` +
        `pdfBytes=${pdfBuffer.length} sumatra="${sumatraPath}" tmp="${tempFile}"`
      )

      const startedAt = Date.now()
      await this.cmd.execFile(sumatraPath, args, { timeout: 30000 })
      console.log(
        `[WindowsBackend] SumatraPDF returned for job="${jobName}" printer="${printerName}" in ${Date.now() - startedAt}ms`
      )

      // Wait for the spooler to pick up the job with the correct paper size
      // before allowing the next job to reconfigure the driver
      if (customMedia) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Clean up after delay
      setTimeout(() => {
        try { unlinkSync(tempFile) } catch { /* ignore */ }
      }, 10000)

      return { success: true, jobId: jobName }
    } catch (err: unknown) {
      try { unlinkSync(tempFile) } catch { /* ignore */ }
      const message = err instanceof Error ? err.message : String(err)
      // Surface the details Node attaches to failed child processes (exit code,
      // signal, stderr) — without these the log only shows "Command failed".
      const e = err as { code?: unknown; signal?: unknown; stderr?: unknown; stdout?: unknown }
      console.error(
        `[WindowsBackend] PRINT FAILED printer="${printerName}" job="${jobName}" ` +
        `code=${String(e?.code)} signal=${String(e?.signal)} msg=${message} ` +
        `stderr=${String(e?.stderr ?? '').trim()} stdout=${String(e?.stdout ?? '').trim()}`
      )
      return { success: false, error: `Print failed: ${message}` }
    }
  }

  async getStatus(printerUri: string): Promise<PrinterStatus> {
    const printerName = getWindowsPrinterName(printerUri)
    try {
      const escaped = escapePsName(printerName)
      const { stdout } = await this.cmd.exec(
        `powershell -NoProfile -Command "Get-Printer -Name '${escaped}' | Select-Object PrinterStatus | ConvertTo-Json -Compress"`,
        { timeout: 5000 }
      )
      if (!stdout || stdout.trim().length === 0) return 'disconnected'

      const result = JSON.parse(stdout.trim())
      switch (result.PrinterStatus) {
        case 0: return 'ready'
        case 1: return 'paused'
        case 2: return 'error'
        default: return 'disconnected'
      }
    } catch {
      return 'disconnected'
    }
  }

  async pause(printerUri: string): Promise<boolean> {
    const escaped = escapePsName(getWindowsPrinterName(printerUri))
    try {
      await this.cmd.exec(`powershell -NoProfile -Command "Stop-Printer -Name '${escaped}'"`, { timeout: 5000 })
      return true
    } catch { return false }
  }

  async resume(printerUri: string): Promise<boolean> {
    const escaped = escapePsName(getWindowsPrinterName(printerUri))
    try {
      await this.cmd.exec(`powershell -NoProfile -Command "Restart-Printer -Name '${escaped}'"`, { timeout: 5000 })
      return true
    } catch { return false }
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    const executor: DiscoveryCommandExecutor = {
      exec: (command: string) => this.cmd.exec(command, { timeout: 15000 })
    }
    return discoverWindowsLocalPrinters(executor)
  }

  async cancelJob(printerUri: string, jobId: string): Promise<boolean> {
    const escaped = escapePsName(getWindowsPrinterName(printerUri))
    const numericJobId = parseInt(jobId, 10)
    if (isNaN(numericJobId)) return false

    try {
      await this.cmd.exec(
        `powershell -NoProfile -Command "Remove-PrintJob -PrinterName '${escaped}' -ID ${numericJobId}"`,
        { timeout: 5000 }
      )
      return true
    } catch { return false }
  }
}
