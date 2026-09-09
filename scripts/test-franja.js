/**
 * test-franja.js
 *
 * GEOMETRÍA CONFIRMADA en la Brother TD-4520TN (medida en papel):
 *   - Con página 55x25mm la impresora gira el contenido 90° ANTIHORARIO (CCW).
 *     Comprobado: una flecha vertical hacia arriba dibujada a la derecha del
 *     lienzo sale horizontal apuntando a la izquierda, arriba.
 *   - Por eso el contenido se dibuja PRE-GIRADO 90° HORARIO: los dos giros se
 *     cancelan y el texto queda horizontal y legible.
 *
 * Sistema de coordenadas local (tras translate(PW,0) + rotate(90)):
 *     lx  -> avanza hacia abajo en el papel   (limitado por el alto de pagina, 25mm)
 *     ly  -> avanza hacia la izquierda        (limitado por el ancho de pagina, 55mm)
 *   es decir: ancho local = 25mm, alto local = hasta 55mm.
 *
 * Uso:
 *   node scripts/test-franja.js "Brother TD-4520TN ETI-1"            (area 25x25)
 *   node scripts/test-franja.js "Brother TD-4520TN ETI-1" 50         (area 25x50)
 *   node scripts/test-franja.js "Brother TD-4520TN ETI-1" 25 1.0     (area y escala)
 */
const PDFDocument = require('pdfkit')
const { execFileSync } = require('child_process')
const { writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const ROOT = 'e:\\_SvvS Kiosko\\v6-imp'
const MM = 72 / 25.4

const PRINTER = process.argv[2] || 'Brother TD-4520TN ETI-1'
/** Alto del área local a usar, en mm (ly). Hasta 55. */
const AREA_H_MM = Number(process.argv[3] ?? 25)
/** Multiplicador de tamaño de letra. */
const SCALE = Number(process.argv[4] ?? 1)
const SETTINGS = 'noscale,300x300dpi'

const sumatra = join(ROOT, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe')
const fontsPath = join(ROOT, 'resources', 'fonts')
const setDriver = join(ROOT, 'scripts', 'set-driver-mediasize.ps1')

const PAGE_W_MM = 55
const PAGE_H_MM = 25

function buildPdf() {
  const PW = PAGE_W_MM * MM
  const PH = PAGE_H_MM * MM
  const doc = new PDFDocument({ size: [PW, PH], margin: 0 })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => {
    doc.on('end', () => {
      const tmp = join(tmpdir(), `test-franja-${AREA_H_MM}-${SCALE}.pdf`)
      writeFileSync(tmp, Buffer.concat(chunks))
      resolve(tmp)
    })
  })

  const reg = join(fontsPath, 'franklin_gothic.ttf')
  if (existsSync(reg)) doc.registerFont('FG', reg)
  const font = existsSync(reg) ? 'FG' : 'Helvetica'

  // Pre-giro 90° horario para cancelar el giro de la impresora
  doc.save()
  doc.translate(PW, 0).rotate(90)

  //const AW = PAGE_H_MM * MM   // ancho local: 25mm ---<<<<<<<<<<<<<<  DEBERÍA SER 55 >>>>>>>>>>>>>>>>----- W
  const AW = PAGE_W_MM * MM   // ancho local: 25mm ---<<<<<<<<<<<<<<  DEBERÍA SER 55 >>>>>>>>>>>>>>>>----- W
  const AH = AREA_H_MM * MM   // alto local

  doc.font(font)
  // Marco del área usada, para ver hasta dónde llega la impresión
  doc.lineWidth(0.6).rect(0.5, 0.5, AW - 1, AH - 1).stroke()

  // Texto proporcional al área, escalado
  const s = SCALE
  doc.fontSize(11 * s).text('Tarifa A', 1.5 * MM, 1.2 * MM, { lineBreak: false })
  doc.fontSize(7 * s).text('Coleccionismo', 1.5 * MM, 6.2 * MM, { lineBreak: false })
  doc.fontSize(7 * s).text('abril 2026', 1.5 * MM, 10.2 * MM, { lineBreak: false })
  doc.fontSize(7 * s).text('Madrid', 1.5 * MM, 14.2 * MM, { lineBreak: false })
  doc.fontSize(5.5 * s).text('J26-8GI', 1.5 * MM, 18.2 * MM, { lineBreak: false })
  doc.fontSize(5.5 * s).text('0001-001', 1.5 * MM, 21.4 * MM, { lineBreak: false })

  // Marcas cada 5mm en el eje ly (alto local) para ver hasta dónde imprime
  doc.lineWidth(0.3).fontSize(3.5)
  for (let mm = 5; mm < AREA_H_MM; mm += 5) {
    const y = mm * MM
    doc.moveTo(AW - 3 * MM, y).lineTo(AW - 0.5 * MM, y).stroke()
    doc.text(String(mm), AW - 6.5 * MM, y - 2, { lineBreak: false })
  }

  doc.restore()
  doc.end()
  return done
}

;(async () => {
  console.log(`Impresora: ${PRINTER}`)
  console.log(`Pagina ${PAGE_W_MM}x${PAGE_H_MM}mm | area local 25x${AREA_H_MM}mm | escala texto x${SCALE}`)

  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setDriver,
      '-PrinterName', PRINTER, '-WidthMm', String(PAGE_W_MM), '-HeightMm', String(PAGE_H_MM)
    ], { encoding: 'utf8', timeout: 20000 })
  } catch { /* el driver probablemente ya estaba bien */ }

  const pdf = await buildPdf()
  try {
    execFileSync(sumatra, ['-print-to', PRINTER, '-print-settings', SETTINGS, '-silent', pdf],
      { timeout: 30000, stdio: 'ignore' })
    console.log('-> enviado')
  } catch (e) {
    console.log('-> ERROR:', e.message.split('\n')[0])
    process.exit(1)
  }
})()
