/**
 * test-etiqueta.js
 *
 * Imprime una etiqueta de prueba con DOS rectángulos (mitad superior y mitad
 * inferior de la página), cada uno con una X dentro y su nombre.
 *
 * Sirve para dos cosas a la vez:
 *   1. Saber QUÉ FRANJA de la página llega al papel: si sólo se ve "ARRIBA",
 *      la impresora imprime la mitad superior; si sólo "ABAJO", la inferior.
 *   2. Detectar distorsión: cada X debe cruzarse en el centro de su rectángulo
 *      y los rectángulos deben verse completos (los 4 lados).
 *
 * Uso:
 *   node scripts/test-etiqueta.js "Brother TD-4520TN ETI-1"
 *   node scripts/test-etiqueta.js "Brother TD-4520TN ETI-1" 55 25 "noscale"
 *   node scripts/test-etiqueta.js "Brother TD-4520TN ETI-1" 55 55 "noscale,300x300dpi"
 *                                  impresora                 W  H  print-settings
 */
const PDFDocument = require('pdfkit')
const { execFileSync } = require('child_process')
const { writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const ROOT = 'e:\\_SvvS Kiosko\\v6-imp'
const MM = 72 / 25.4

const PRINTER = process.argv[2] || 'Brother TD-4520TN ETI-1'
const PAGE_W_MM = Number(process.argv[3] ?? 55)
const PAGE_H_MM = Number(process.argv[4] ?? 25)
const SETTINGS = process.argv[5] ?? 'noscale'

const sumatra = join(ROOT, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe')
const fontsPath = join(ROOT, 'resources', 'fonts')

/** Muestra el tamaño de papel EFECTIVO del driver (el del PrintTicket). */
function showDriverMediaSize(printer) {
  try {
    const ps = `$pt=(Get-PrintConfiguration -PrinterName '${printer.replace(/'/g, "''")}').PrintTicketXML;` +
      `[regex]::Matches($pt,'MediaSize(Width|Height)"><psf:Value[^>]*>(\\d+)') | ForEach-Object { "$($_.Groups[1].Value)=$([math]::Round([int]$_.Groups[2].Value/1000,1))mm" }`
    const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim()
    console.log('  Driver MediaSize efectivo:', out.replace(/\s+/g, ' ') || '(no detectado)')
  } catch {
    console.log('  Driver MediaSize efectivo: (no se pudo leer)')
  }
}

function buildPdf() {
  const W = PAGE_W_MM * MM
  const H = PAGE_H_MM * MM

  const doc = new PDFDocument({ size: [W, H], margin: 0 })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => {
    doc.on('end', () => {
      const tmp = join(tmpdir(), `test-etiqueta-${PAGE_W_MM}x${PAGE_H_MM}.pdf`)
      writeFileSync(tmp, Buffer.concat(chunks))
      resolve(tmp)
    })
  })

  const reg = join(fontsPath, 'franklin_gothic.ttf')
  if (existsSync(reg)) doc.registerFont('FG', reg)
  const font = existsSync(reg) ? 'FG' : 'Helvetica'
  doc.font(font)

  const mx = 1.5 * MM      // margen horizontal
  const gap = 1.5 * MM     // separación entre los dos bloques
  const half = (H - gap) / 2

  /** Dibuja un rectángulo con una X dentro y su nombre. */
  const drawBlock = (yTop, height, name) => {
    const x = mx
    const w = W - 2 * mx

    // Rectángulo
    doc.lineWidth(0.7).rect(x, yTop, w, height).stroke()

    // X de esquina a esquina del rectángulo
    doc.lineWidth(0.5)
    doc.moveTo(x, yTop).lineTo(x + w, yTop + height).stroke()
    doc.moveTo(x + w, yTop).lineTo(x, yTop + height).stroke()

    // Nombre del bloque, en el centro sobre fondo blanco para que se lea
    const fs = Math.min(7, height / MM * 0.9)
    doc.fontSize(fs)
    const tw = doc.widthOfString(name)
    const tx = x + w / 2 - tw / 2
    const ty = yTop + height / 2 - fs / 2
    doc.save().rect(tx - 1, ty - 1, tw + 2, fs + 2).fill('white').restore()
    doc.fillColor('black').text(name, tx, ty, { lineBreak: false })
  }

  drawBlock(0, half, 'ARRIBA')
  drawBlock(half + gap, half, 'ABAJO')

  // Tamaño de página en la esquina, muy pequeño
  doc.fontSize(3.5).fillColor('black')
  doc.text(`${PAGE_W_MM}x${PAGE_H_MM} ${SETTINGS}`, mx + 0.5, 0.5, { lineBreak: false })

  doc.end()
  return done
}

;(async () => {
  console.log(`Impresora: ${PRINTER}`)
  console.log(`Pagina PDF: ${PAGE_W_MM}x${PAGE_H_MM}mm | print-settings: ${SETTINGS}`)
  showDriverMediaSize(PRINTER)

  const pdf = await buildPdf()
  console.log(`  PDF: ${pdf}`)

  try {
    execFileSync(sumatra, ['-print-to', PRINTER, '-print-settings', SETTINGS, '-silent', pdf],
      { timeout: 30000, stdio: 'ignore' })
    console.log('  -> enviado')
  } catch (e) {
    console.log('  -> ERROR:', e.message)
    process.exit(1)
  }

  console.log('\nDIME:')
  console.log('  1) Que bloques se ven: ARRIBA / ABAJO / los dos / ninguno')
  console.log('  2) Se ven los rectangulos completos (4 lados) y las X enteras?')
  console.log('  3) Hay distorsion (las X no se cruzan en el centro)?')
})()
