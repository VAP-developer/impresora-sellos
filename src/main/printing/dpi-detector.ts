/**
 * dpi-detector.ts
 *
 * Runtime DPI detection for Windows printers via WMI.
 * Replaces the hardcoded PRINT_DPI constant with a mechanism that queries
 * each printer's native resolution at assignment time and caches the result.
 *
 * Fallback: 203x203 DPI (Brother TD-4100N native resolution).
 */

import type { WindowsCommandExecutor } from './windows-backend'

// ─── DPI Result Interface ─────────────────────────────────────────────────────

/**
 * Holds horizontal and vertical DPI as positive integers.
 * Used throughout the printing pipeline to configure rasterization resolution.
 */
export interface DpiResult {
  dpiX: number
  dpiY: number
}

// ─── Fallback DPI ─────────────────────────────────────────────────────────────

/**
 * Default DPI used when detection fails or no cache entry exists.
 * 203x203 matches the Brother TD-4100N (most common thermal label printer).
 * Using 203 as fallback avoids upscaling artifacts on the primary hardware.
 */
export const FALLBACK_DPI: DpiResult = { dpiX: 203, dpiY: 203 }

// ─── DPI Cache ────────────────────────────────────────────────────────────────

/**
 * In-memory cache for detected printer DPI values.
 * Simple Map wrapper for testability and encapsulation.
 * No persistence — DPI is re-detected on each app startup.
 */
export class DpiCache {
  private cache: Map<string, DpiResult> = new Map()

  get(printerName: string): DpiResult | undefined {
    return this.cache.get(printerName)
  }

  set(printerName: string, dpi: DpiResult): void {
    this.cache.set(printerName, dpi)
  }

  delete(printerName: string): void {
    this.cache.delete(printerName)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// ─── DPI Detector Interface ───────────────────────────────────────────────────

/**
 * Abstraction for DPI detection, enabling testability via mock implementations.
 * The single `detect` method queries the system for a printer's native resolution.
 * Returns FALLBACK_DPI on any failure (timeout, bad data, missing printer).
 */
export interface DpiDetector {
  detect(printerName: string): Promise<DpiResult>
}

// ─── WMI DPI Detector Implementation ─────────────────────────────────────────

/**
 * Detects printer DPI by querying Windows WMI (Win32_PrinterConfiguration).
 * Executes a PowerShell one-liner via the injected command executor and parses
 * XResolution / YResolution from the JSON output.
 *
 * Always returns a valid DpiResult — falls back to 203x203 on any error.
 */
export class WmiDpiDetector implements DpiDetector {
  private readonly executor: WindowsCommandExecutor

  constructor(executor: WindowsCommandExecutor) {
    this.executor = executor
  }

  async detect(printerName: string): Promise<DpiResult> {
    try {
      const escapedName = printerName.replace(/'/g, "''")
      const command = `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_PrinterConfiguration -Filter \\"Name='${escapedName}'\\" | Select-Object XResolution, YResolution | ConvertTo-Json -Compress"`

      const { stdout } = await this.executor.exec(command, { timeout: 5000 })

      const parsed = JSON.parse(stdout.trim())
      const dpiX = parsed.XResolution
      const dpiY = parsed.YResolution

      if (
        typeof dpiX === 'number' &&
        typeof dpiY === 'number' &&
        Number.isInteger(dpiX) &&
        Number.isInteger(dpiY) &&
        dpiX > 0 &&
        dpiY > 0
      ) {
        return { dpiX, dpiY }
      }

      console.warn(`[DpiDetector] Invalid DPI values for "${printerName}": X=${dpiX}, Y=${dpiY}. Using fallback.`)
      return FALLBACK_DPI
    } catch (error) {
      console.warn(`[DpiDetector] Failed to detect DPI for "${printerName}". Using fallback.`, error)
      return FALLBACK_DPI
    }
  }
}
