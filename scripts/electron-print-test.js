/**
 * Arnés de prueba: imprime un PDF usando la MISMA técnica que
 * ElectronPrintBackend (webContents.print con pageSize por trabajo).
 *
 * Sirve para validar en hardware real que la impresión por Electron respeta el
 * tamaño de papel, sin depender del DEVMODE por defecto del driver ni de la
 * auto-rotación de SumatraPDF.
 *
 * Uso:
 *   npx electron scripts/electron-print-test.js <pdf> "<Impresora>" [anchoMm] [altoMm] [landscape]
 *
 * Ejemplo:
 *   npx electron scripts/electron-print-test.js out/pdf-samples/calib-V1.pdf "Brother TD-4520TN ETI-1" 55 25 false
 */
const { app, BrowserWindow } = require('electron')
const { pathToFileURL } = require('url')
const { resolve } = require('path')
const { existsSync } = require('fs')

const pdfArg = process.argv[2]
const printerArg = process.argv[3]
const widthMm = Number(process.argv[4] ?? 55)
const heightMm = Number(process.argv[5] ?? 25)
const landscape = String(process.argv[6] ?? 'false') === 'true'

if (!pdfArg || !printerArg) {
  console.error('Uso: electron scripts/electron-print-test.js <pdf> "<Impresora>" [anchoMm] [altoMm] [landscape]')
  process.exit(1)
}

const pdfPath = resolve(process.cwd(), pdfArg)
if (!existsSync(pdfPath)) {
  console.error('No existe el PDF:', pdfPath)
  process.exit(1)
}

// Micras: 1mm = 1000 micras
const pageSize = {
  width: Math.round(widthMm * 1000),
  height: Math.round(heightMm * 1000)
}

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  let win
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { plugins: true, sandbox: false }
    })

    console.log(`[test] Cargando PDF: ${pdfPath}`)
    await win.loadURL(pathToFileURL(pdfPath).toString())
    await new Promise((r) => setTimeout(r, 900))

    // Listado de impresoras para confirmar el nombre exacto
    try {
      const printers = await win.webContents.getPrintersAsync()
      const found = printers.find((p) => p.name === printerArg)
      console.log(`[test] Impresoras detectadas: ${printers.length}`)
      console.log(`[test] "${printerArg}" ${found ? 'ENCONTRADA' : 'NO ENCONTRADA'}`)
      if (!found) {
        console.log('[test] Nombres disponibles:')
        printers.forEach((p) => console.log(`         - ${p.name}`))
      }
    } catch (e) {
      console.log('[test] No se pudo listar impresoras:', e.message)
    }

    console.log(
      `[test] Imprimiendo en "${printerArg}" pageSize=${widthMm}x${heightMm}mm ` +
        `(${pageSize.width}x${pageSize.height} micras) landscape=${landscape}`
    )

    const result = await new Promise((res) => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerArg,
          // TRUE: con false Chromium no imprime el PDF (etiqueta en blanco).
          // El PDF debe traer su propio fondo blanco para no heredar el gris
          // del visor (que en monocromo sale negro).
          printBackground: true,
          color: false,
          margins: { marginType: 'none' },
          landscape,
          scaleFactor: 100,
          copies: 1,
          pageSize
        },
        (success, failureReason) => res({ success, failureReason })
      )
    })

    if (result.success) {
      console.log('[test] RESULTADO: enviado correctamente')
    } else {
      console.log(`[test] RESULTADO: FALLO -> ${result.failureReason}`)
    }

    // Dar tiempo al spooler antes de cerrar
    await new Promise((r) => setTimeout(r, 2500))
  } catch (err) {
    console.error('[test] ERROR:', err)
  } finally {
    if (win && !win.isDestroyed()) win.destroy()
    app.quit()
  }
})
