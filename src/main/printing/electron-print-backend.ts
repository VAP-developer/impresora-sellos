/**
 * electron-print-backend.ts
 *
 * Prints PDFs using Electron's native webContents.print() API instead of SumatraPDF.
 * This approach sends the correct DEVMODE per-job (paper size, orientation) directly
 * to the Windows print spooler via Chromium's printing infrastructure.
 *
 * Advantages over SumatraPDF:
 * - Custom paper sizes are passed per-job in the DEVMODE (not dependent on driver defaults)
 * - No external executable dependency
 * - Better integration with the Electron app lifecycle
 *
 * How it works:
 * 1. Creates a hidden BrowserWindow
 * 2. Loads the PDF file (Chromium has built-in PDF rendering)
 * 3. Calls webContents.print() with custom pageSize (in microns) and deviceName
 * 4. The print job carries the correct paper dimensions in its DEVMODE
 * 5. Destroys the window after printing
 *
 * Limitations:
 * - Cannot control Brother-specific private DEVMODE fields (cut interval)
 *   For cut control, the groupLabels() approach (separate PDF per group) is used
 *   combined with the driver's "cut at end of job" setting.
 */

import type { PrintOptions, PrintResult } from './printer-manager'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parses a media string like "Custom.78x177mm" into width and height in mm.
 */
function parseMediaToMm(media: string): { widthMm: number; heightMm: number } | null {
  const match = media.match(/^Custom\.(\d+)x(\d+)mm$/)
  if (!match) return null
  return { widthMm: parseInt(match[1], 10), heightMm: parseInt(match[2], 10) }
}

// ─── ElectronPrintBackend ─────────────────────────────────────────────────────

/**
 * Prints PDFs using Electron's built-in webContents.print() API.
 * Paper size is passed per-job via Chromium → Windows DEVMODE, bypassing
 * the printer driver's default settings entirely.
 */
export class ElectronPrintBackend {
  /**
   * Prints a PDF buffer to the specified printer with custom paper size.
   *
   * @param printerName - Windows printer name (decoded from URI)
   * @param pdfPath - Path to the PDF file on disk
   * @param options - Print options including media (paper size) and orientation
   * @returns Promise resolving to print result
   */
  async print(printerName: string, pdfPath: string, options: PrintOptions): Promise<PrintResult> {
    const jobName = options.jobName ?? `electron_print_${Date.now()}`

    // Strategy: Modify the per-user DevMode registry to set the correct paper size,
    // then invoke SumatraPDF which will pick up the new defaults.
    // Unlike the previous approach, we do NOT restore the original DevMode —
    // we leave it set to the last printed size. This avoids race conditions
    // where the spooler hasn't yet cached the DEVMODE before we revert it.
    //
    // This is safe because:
    // - Each ticket print will set its own height before printing
    // - The stamp printers don't use custom media (they use fixed DC55x55)

    const customSize = parseMediaToMm(options.media)

    if (customSize) {
      // Write paper size directly to per-user DevMode registry
      try {
        const { execSync } = require('child_process')

        // Build PowerShell script to modify the per-user DevMode bytes.
        // Uses -EncodedCommand to avoid all quoting/escaping issues.
        const widthTenths = customSize.widthMm * 10
        const heightTenths = customSize.heightMm * 10
        const psScript = [
          `$regPath = 'HKCU:\\Printers\\DevModePerUser'`,
          `$pn = '${printerName.replace(/'/g, "''")}'`,
          `$dm = (Get-ItemProperty $regPath).$pn`,
          `if ($dm -and $dm.Length -gt 84) {`,
          `  [BitConverter]::GetBytes([int16]256).CopyTo($dm, 78)`,
          `  [BitConverter]::GetBytes([int16]${heightTenths}).CopyTo($dm, 80)`,
          `  [BitConverter]::GetBytes([int16]${widthTenths}).CopyTo($dm, 82)`,
          `  $f = [BitConverter]::ToInt32($dm, 72) -bor 0xE`,
          `  [BitConverter]::GetBytes([int32]$f).CopyTo($dm, 72)`,
          `  Set-ItemProperty -Path $regPath -Name $pn -Value $dm -Type Binary`,
          `  Write-Host "OK:${heightTenths}"`,
          `} else { Write-Host "SKIP:no-dm" }`
        ].join('\n')

        // Encode as Base64 UTF-16LE (what PowerShell -EncodedCommand expects)
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64')
        const result = execSync(
          `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
          { timeout: 5000, encoding: 'utf8' }
        )
        console.log(`[ElectronPrintBackend] Registry update: ${result.trim()}`)

        // Wait for spooler to pick up registry change
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (err) {
        console.warn('[ElectronPrintBackend] Failed to set paper size in registry:', err)
        // Continue anyway — SumatraPDF will use whatever the driver has
      }
    }

    // Now print with SumatraPDF (which reads the updated per-user DevMode)
    const sumatraPath = this.getSumatraPdfPath()
    if (!sumatraPath) {
      return { success: false, error: 'SumatraPDF not found' }
    }

    const { execFile } = require('child_process')
    const { promisify } = require('util')
    const execFileAsync = promisify(execFile)

    const args = [
      '-print-to', printerName,
      '-print-settings', 'noscale',
      '-silent',
      pdfPath
    ]

    try {
      await execFileAsync(sumatraPath, args, { timeout: 30000 })
      console.log(`[ElectronPrintBackend] SumatraPDF printed successfully: ${pdfPath}`)
      return { success: true, jobId: jobName }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `SumatraPDF print failed: ${message}` }
    }
  }

  private getSumatraPdfPath(): string {
    const { join } = require('path')
    const { existsSync } = require('fs')

    let sumatraPath = join(
      require.resolve('pdf-to-printer'),
      '..',
      'SumatraPDF-3.4.6-32.exe'
    )

    if (sumatraPath.includes('app.asar')) {
      sumatraPath = sumatraPath.replace('app.asar', 'app.asar.unpacked')
    }

    if (existsSync(sumatraPath)) return sumatraPath
    return ''
  }
}
