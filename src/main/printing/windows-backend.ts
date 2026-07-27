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

// ─── WindowsBackend Implementation ───────────────────────────────────────────

export class WindowsBackend implements PrinterBackend {
  private cmd: WindowsCommandExecutor

  constructor(executor?: WindowsCommandExecutor) {
    this.cmd = executor ?? defaultWindowsExecutor
  }

  /**
   * Prints a PDF by invoking SumatraPDF directly with:
   *   SumatraPDF.exe -print-to "PrinterName" -print-settings "noscale" -silent file.pdf
   *
   * "noscale" = print at 100% original size, no fitting, no shrinking.
   * The printer driver's paper size configuration determines the output.
   */
  async print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    const { writeFileSync, unlinkSync, mkdirSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')

    const printerName = getWindowsPrinterName(printerUri)
    const jobName = options.jobName ?? `print_${Date.now()}`

    // Write PDF to temp file
    const tempDir = join(tmpdir(), 'stamp-sales-print')
    try { mkdirSync(tempDir, { recursive: true }) } catch { /* exists */ }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.pdf`)

    try {
      writeFileSync(tempFile, pdfBuffer)

      // Invoke SumatraPDF directly
      const sumatraPath = getSumatraPdfPath()
      const args = [
        '-print-to', printerName,
        '-print-settings', 'noscale',
        '-silent',
        tempFile
      ]

      await this.cmd.execFile(sumatraPath, args, { timeout: 30000 })

      // Clean up after delay
      setTimeout(() => {
        try { unlinkSync(tempFile) } catch { /* ignore */ }
      }, 10000)

      return { success: true, jobId: jobName }
    } catch (err: unknown) {
      try { unlinkSync(tempFile) } catch { /* ignore */ }
      const message = err instanceof Error ? err.message : String(err)
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
