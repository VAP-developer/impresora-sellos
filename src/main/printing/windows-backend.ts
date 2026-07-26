/**
 * windows-backend.ts
 *
 * Implementation of PrinterBackend for Windows using local printers (USB/spooler).
 * Uses pdf-to-printer (SumatraPDF) to send PDFs silently to the Windows spooler.
 * Uses PowerShell cmdlets for status, pause, resume, cancel, and discovery.
 *
 * Simplified version: no thermal printer distinction, no rotation logic.
 * Just connects PDFs to printers.
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
}

export const defaultWindowsExecutor: WindowsCommandExecutor = {
  exec(command: string, options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }> {
    const { exec: nodeExec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(nodeExec)
    return execAsync(command, { timeout: options?.timeout ?? 10000 })
  }
}

// ─── URI Helpers ──────────────────────────────────────────────────────────────

/**
 * Extracts the printer name from a win:// URI.
 * win://Canon%20PIXMA%20MG3600 → "Canon PIXMA MG3600"
 */
export function getWindowsPrinterName(printerUri: string): string {
  const encoded = printerUri.replace('win://', '')
  return decodeURIComponent(encoded)
}

function escapePsName(name: string): string {
  return name.replace(/'/g, "''")
}

// ─── WindowsBackend Implementation ───────────────────────────────────────────

/**
 * WindowsBackend sends PDFs to local Windows printers via pdf-to-printer (SumatraPDF).
 * Management (status, pause, resume, cancel, discovery) via PowerShell cmdlets.
 */
export class WindowsBackend implements PrinterBackend {
  private cmd: WindowsCommandExecutor

  constructor(executor?: WindowsCommandExecutor) {
    this.cmd = executor ?? defaultWindowsExecutor
  }

  /**
   * Sends a PDF to the specified printer.
   * Writes the buffer to a temp file and prints it via SumatraPDF.
   */
  async print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    const { writeFileSync, unlinkSync, mkdirSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')
    const { print: printPdf } = require('pdf-to-printer')

    const printerName = getWindowsPrinterName(printerUri)
    const jobName = options.jobName ?? `print_${Date.now()}`

    const tempDir = join(tmpdir(), 'stamp-sales-print')
    try { mkdirSync(tempDir, { recursive: true }) } catch { /* exists */ }

    const tempFile = join(tempDir, `${jobName}_${Date.now()}.pdf`)

    try {
      writeFileSync(tempFile, pdfBuffer)

      await printPdf(tempFile, {
        printer: printerName,
        copies: options.copies ?? 1,
        silent: true,
        win32: ['-print-settings', 'noscale,landscape,paper=55x25']
      })

      // Clean up after delay to let spooler finish reading
      setTimeout(() => {
        try { unlinkSync(tempFile) } catch { /* ignore */ }
      }, 10000)

      return { success: true, jobId: jobName }
    } catch (err: unknown) {
      try { unlinkSync(tempFile) } catch { /* ignore */ }
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Windows print failed: ${message}` }
    }
  }

  /**
   * Queries printer status via PowerShell Get-Printer.
   */
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
