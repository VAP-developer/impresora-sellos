/**
 * test-sello-layout.js
 *
 * Replica EXACTAMENTE el layout de un sello tal como lo dibuja
 * stamp-renderer.ts (renderStampMultiPage, layout 'derecha'), pero con pdfkit
 * directo para poder ejecutarlo fuera de Electron.
 *
 * Objetivo: comprobar que, con la página a 55x25mm y las coordenadas medidas
 * sobre el sistema de 55mm (`bottomToTop`), el sello sale COMPLETO en el papel.
 *
 * Coordenadas copiadas de renderStampMultiPage (layout 'derecha'):
 *   tarifa            12.2pt @ x=2mm  yBottom=50
 *   descripcion        9pt   @ x=2mm  yBottom=47.2
 *   fecha (mes+año)    9pt   @ x=2mm  yBottom=43
 *   localidad          9pt   @ x=2mm  yBottom=39.5
 *   codigo linea 1     5.7pt @ x=2mm  yBottom=35.2
 *   codigo linea 2     5.7pt @ x=2mm  yBottom=33
 *
 * Uso:
 *   node scripts/test-sello-layout.js "Brother TD-4520TN ETI-1"
 */
const PDFDocument = require('pdfkit')
const { execFileSync } = require('child_process')
const { writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const ROOT = 'e:\\_SvvS Kiosko\\v6-imp'
const MM = 72 / 25.4

const PRINTER = process.argv[2] || 'Brother TD-4520TN ETI-1'
const SETTINGS = process.argv[3] ?? 'noscale,300x300dpi'

// Igual que stamp-renderer.ts
const STAMP_WIDTH_MM = 55
const STAMP_HEIGHT_MM = 55        // sistema de coordenadas
const STAMP_PAGE_HEIGHT_MM = 25   // pagina fisica
const STAMP_WIDTH = STAMP_WIDTH_MM * MM
const STAMP_HEIGHT = STAMP_HEIGHT_MM * MM
const STAMP_PAGE_HEIGHT = STAMP_PAGE_HEIGHT_MM * MM

const sumatra = join(ROOT, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe')
const fontsPath = join(ROOT, 'resources', 'fonts')

/** Igual que bottomToTop() del renderer: mide desde abajo sobre 55mm. */
function bottomToTop(bottomYmm, fontSizePt) {
  return STAMP_HEIGHT - bottomYmm * MM - fontSizePt
}

function buildPdf() {
  const doc = new PDFDocument({ size: [STAMP_WIDTH, STAMP_PAGE_HEIGHT], margin: 0 })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => {
    doc.on('end', () => {
      const tmp = join(tmpdir(), 'test-sello-layout.pdf')
      writeFileSync(tmp, Buffer.concat(chunks))
      resolve(tmp)
    })
  })

  const reg = join(fontsPath, 'franklin_gothic.ttf')
  if (existsSync(reg)) doc.registerFont('FG', reg)
  const font = existsSync(reg) ? 'FG' : 'Helvetica'

  const drawLeft = (text, size, xMm, yBottomMm) => {
    doc.font(font).fontSize(size)
    doc.text(text, xMm * MM, bottomToTop(yBottomMm, size), { lineBreak: false })
  }

  // Marco de referencia del borde de la etiqueta (para ver recorte)
  doc.lineWidth(0.4).rect(0.3, 0.3, STAMP_WIDTH - 0.6, STAMP_PAGE_HEIGHT - 0.6).stroke()

  drawLeft('Tarifa A', 12.2, 2, 50)
  drawLeft('Objeto de coleccionismo', 9, 2, 47.2)
  drawLeft('abril 2026', 9, 2, 43)
  drawLeft('Madrid', 9, 2, 39.5)
  drawLeft('J26-8GI', 5.7, 2, 35.2)
  drawLeft('0001-001', 5.7, 2, 33)

  doc.end()
  return done
}

;(async () => {
  console.log(`Impresora: ${PRINTER}`)
  console.log(`Pagina: ${STAMP_WIDTH_MM}x${STAMP_PAGE_HEIGHT_MM}mm | coordenadas sobre ${STAMP_HEIGHT_MM}mm | ${SETTINGS}`)

  // Verificar que el contenido cabe
  const yMin = bottomToTop(50, 12.2)
  const yMax = bottomToTop(33, 5.7) + 5.7
  console.log(`Contenido ocupa y = ${yMin.toFixed(1)}pt .. ${yMax.toFixed(1)}pt  (pagina = ${STAMP_PAGE_HEIGHT.toFixed(1)}pt)`)
  console.log(yMax <= STAMP_PAGE_HEIGHT ? '  -> CABE en la pagina' : '  -> NO CABE (se recortaria)')

  const pdf = await buildPdf()
  try {
    execFileSync(sumatra, ['-print-to', PRINTER, '-print-settings', SETTINGS, '-silent', pdf],
      { timeout: 30000, stdio: 'ignore' })
    console.log('-> enviado')
  } catch (e) {
    console.log('-> ERROR:', e.message)
    process.exit(1)
  }

  console.log('\nDebe salir, de arriba a abajo:')
  console.log('  Tarifa A / Objeto de coleccionismo / abril 2026 / Madrid / J26-8GI / 0001-001')
})()
