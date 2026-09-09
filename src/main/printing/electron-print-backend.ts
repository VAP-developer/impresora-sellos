/**
 * electron-print-backend.ts
 *
 * Imprime PDFs con la API nativa de Electron `webContents.print()`, en lugar de
 * delegar en SumatraPDF.
 *
 * ¿Por qué? SumatraPDF NO controla el tamaño de papel ni la orientación: sólo
 * dice "imprime sin escalar" y deja todo al DEVMODE que tenga el driver en ese
 * momento. Además auto-rota la página cuando cree que encaja mejor. Medido en
 * papel con etiquetas de calibración: una página de 55x25mm salía girada y
 * recortada a una franja de ~25mm.
 *
 * Con `webContents.print()` el tamaño de papel (`pageSize`, en micras) y la
 * orientación viajan en el DEVMODE de CADA trabajo, vía Chromium → spooler de
 * Windows, sin depender de los valores por defecto del driver. Es el mismo
 * principio por el que Acrobat imprime "bien": control real del DEVMODE.
 *
 * Cómo funciona:
 *   1. Crea un BrowserWindow oculto
 *   2. Carga el PDF (Chromium trae visor de PDF integrado)
 *   3. Llama a webContents.print() con pageSize/landscape/márgenes y deviceName
 *   4. Destruye la ventana al terminar
 *
 * Limitaciones:
 *   - No permite tocar campos privados del DEVMODE de Brother (intervalo de
 *     corte). Para el corte se sigue usando groupLabels() (un PDF por grupo)
 *     junto al ajuste "cortar al final del trabajo" del driver.
 */

import type { PrintOptions, PrintResult } from './printer-manager'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte una cadena de media tipo "Custom.78x177mm" a mm.
 */
function parseMediaToMm(media: string): { widthMm: number; heightMm: number } | null {
  const match = media.match(/^Custom\.(\d+)x(\d+)mm$/)
  if (!match) return null
  return { widthMm: parseInt(match[1], 10), heightMm: parseInt(match[2], 10) }
}

/**
 * Resuelve el tamaño de papel en mm para un trabajo.
 * Prioriza `mediaSizeMm` (explícito) y cae en el parseo de `media`.
 */
export function resolveMediaSizeMm(
  options: PrintOptions
): { widthMm: number; heightMm: number } | null {
  if (options.mediaSizeMm) return options.mediaSizeMm
  return parseMediaToMm(options.media)
}

/** 1 mm = 1000 micras */
const MM_TO_MICRONS = 1000

// ─── ElectronPrintBackend ─────────────────────────────────────────────────────

/**
 * Imprime PDFs mediante `webContents.print()` de Electron.
 * El tamaño de papel se envía por trabajo (Chromium → DEVMODE de Windows),
 * ignorando por completo los valores por defecto del driver.
 */
export class ElectronPrintBackend {
  /**
   * Imprime un PDF ya escrito en disco.
   *
   * @param printerName - Nombre de la impresora en Windows
   * @param pdfPath - Ruta al PDF en disco
   * @param options - Opciones de impresión (tamaño de papel, orientación, ...)
   */
  async print(printerName: string, pdfPath: string, options: PrintOptions): Promise<PrintResult> {
    const jobName = options.jobName ?? `electron_print_${Date.now()}`

    // electron sólo está disponible dentro del proceso principal de Electron.
    let BrowserWindow: typeof import('electron').BrowserWindow
    try {
      ;({ BrowserWindow } = require('electron'))
      if (!BrowserWindow) throw new Error('BrowserWindow no disponible')
    } catch (err) {
      return {
        success: false,
        error: `Electron no disponible para imprimir: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    const size = resolveMediaSizeMm(options)
    if (!size) {
      return { success: false, error: `No se pudo determinar el tamaño de papel de "${options.media}"` }
    }

    // pageSize de Electron va en MICRAS y debe ser entero.
    const pageSize = {
      width: Math.round(size.widthMm * MM_TO_MICRONS),
      height: Math.round(size.heightMm * MM_TO_MICRONS)
    }

    let win: import('electron').BrowserWindow | null = null

    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          // Necesario para que Chromium renderice el PDF con su visor interno
          plugins: true,
          sandbox: false
        }
      })

      const { pathToFileURL } = require('url')
      await win.loadURL(pathToFileURL(pdfPath).toString())

      // El visor de PDF de Chromium necesita un instante para paginar.
      await new Promise((resolve) => setTimeout(resolve, 700))

      console.log(
        `[ElectronPrintBackend] PRINT job="${jobName}" printer="${printerName}" ` +
          `pageSize=${size.widthMm}x${size.heightMm}mm (${pageSize.width}x${pageSize.height} micras) ` +
          `landscape=${options.landscape ?? false} pdf="${pdfPath}"`
      )

      const result = await new Promise<PrintResult>((resolve) => {
        const contents = win!.webContents
        contents.print(
          {
            silent: true,
            deviceName: printerName,
            // Debe ser TRUE: al cargar el PDF en un BrowserWindow, Chromium lo
            // pinta con su visor interno y, si esto es false, no imprime nada
            // (etiqueta en blanco).
            //
            // Contrapartida: el visor tiene fondo gris oscuro y en monocromo
            // saldría un cuadrado negro. Por eso el PDF DEBE pintar su propio
            // fondo blanco (ver drawWhitePageBackground en stamp-renderer).
            printBackground: true,
            color: false,
            // Sin márgenes: el PDF ya tiene el tamaño exacto de la etiqueta.
            margins: { marginType: 'none' },
            landscape: options.landscape ?? false,
            // 100 = tamaño original, sin reescalado.
            scaleFactor: 100,
            copies: options.copies ?? 1,
            pageSize
          },
          (success: boolean, failureReason: string) => {
            if (success) {
              resolve({ success: true, jobId: jobName })
            } else {
              resolve({ success: false, error: `webContents.print falló: ${failureReason}` })
            }
          }
        )
      })

      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[ElectronPrintBackend] ERROR job="${jobName}": ${message}`)
      return { success: false, error: `Electron print falló: ${message}` }
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }
}
