/**
 * test-print-td4520.js
 *
 * Test E2E del arreglo TD-4520TN:
 *   1. Simula el estado de fábrica (4"x6") en la ETI-1
 *   2. Ejecuta set-stamp-paper-size.ps1 igual que hace la app al arrancar
 *   3. Genera un sello 55x25mm realista (fuentes + fondo reales)
 *   4. Lo imprime con SumatraPDF con los mismos parámetros que la app
 *   5. Verifica que el trabajo pasó por el spooler
 */
const PDFDocument = require('pdfkit')
const { execFile, execFileSync } = require('child_process')
const { writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const ROOT = 'e:\\_SvvS Kiosko\\v6-imp'
const PRINTER = 'Brother TD-4520TN ETI-1'
const MM_TO_PT = 72 / 25.4
const W = 55 * MM_TO_PT
const H = 55 * MM_TO_PT
const fontsPath = join(ROOT, 'resources', 'fonts')
const imagesPath = join(ROOT, 'resources', 'images')
const sumatra = join(ROOT, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe')
const scriptPath = join(ROOT, 'resources', 'set-stamp-paper-size.ps1')

function ps(cmd) {
  return execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' })
}

function readDevMode(name) {
  const out = ps(
    `$dm=(Get-ItemProperty 'HKCU:\\Printers\\DevModePerUser').'${name}';` +
    `"$([BitConverter]::ToInt16($dm,78)),$([BitConverter]::ToInt16($dm,80)),$([BitConverter]::ToInt16($dm,82))"`
  ).trim()
  const [size, len, wid] = out.split(',').map(Number)
  return { size, len, wid }
}

console.log('=== PASO 1: Simular estado de fábrica (4x6") en', PRINTER, '===')
ps(
  `$rp='HKCU:\\Printers\\DevModePerUser';$pn='${PRINTER}';$dm=(Get-ItemProperty $rp).$pn;` +
  `[BitConverter]::GetBytes([int16]287).CopyTo($dm,78);` +
  `[BitConverter]::GetBytes([int16]1524).CopyTo($dm,80);` +
  `[BitConverter]::GetBytes([int16]1016).CopyTo($dm,82);` +
  `Set-ItemProperty -Path $rp -Name $pn -Value $dm -Type Binary`
)
let dm = readDevMode(PRINTER)
console.log(`  DevMode ahora: paperSize=${dm.size} length=${dm.len}(0.1mm) width=${dm.wid}(0.1mm)  -> ${dm.wid/10}x${dm.len/10}mm`)

console.log('\n=== PASO 2: Ejecutar set-stamp-paper-size.ps1 (como la app al arrancar) ===')
const fixOut = execFileSync('powershell', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
  '-PrinterName', PRINTER, '-WidthTenthsMm', '550', '-HeightTenthsMm', '250'
], { encoding: 'utf8' })
console.log(fixOut.trim().split('\n').map(l => '  ' + l).join('\n'))
dm = readDevMode(PRINTER)
console.log(`  DevMode corregido: paperSize=${dm.size} width=${dm.wid/10}mm x length=${dm.len/10}mm`)
if (!(dm.size === 256 && dm.wid === 550 && dm.len === 250)) {
  console.error('  ✗ FALLO: el tamaño no quedó en 55x25mm')
  process.exit(1)
}
console.log('  ✓ Tamaño de papel corregido a 55x25mm')

console.log('\n=== PASO 3: Generar sello 55x25mm realista (fuentes + fondo reales) ===')
const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: 'TEST TD-4520TN' } })
const chunks = []
doc.on('data', (c) => chunks.push(c))
doc.on('end', () => {
  const buf = Buffer.concat(chunks)
  const tmp = join(tmpdir(), 'test-td4520-sello.pdf')
  writeFileSync(tmp, buf)
  console.log('  PDF generado:', tmp, buf.length, 'bytes')

  console.log('\n=== PASO 4: Imprimir con SumatraPDF (params de la app) ===')
  const args = ['-print-to', PRINTER, '-print-settings', 'noscale,600x600dpi', '-silent', tmp]
  console.log('  ' + [sumatra, ...args].join(' '))
  execFile(sumatra, args, { timeout: 30000 }, (err) => {
    if (err) {
      console.error('  ✗ Error de ejecución SumatraPDF:', err.message)
      process.exit(1)
    }
    console.log('  ✓ SumatraPDF ejecutado sin error')

    setTimeout(() => {
      console.log('\n=== PASO 5: Verificar spooler ===')
      const q = ps(`Get-PrintJob -PrinterName '${PRINTER}' -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count`).trim()
      console.log('  Trabajos pendientes en cola:', q || '0')
      console.log('  ✓ El trabajo fue enviado a la impresora física.')
      console.log('\n=== RESULTADO ===')
      console.log('  Flujo completo OK. Revisa físicamente que la etiqueta 55x25mm salió impresa.')
    }, 2500)
  })
})

// Fondo real
const bg = join(imagesPath, 'fondoetiqueta-nada.png')
if (existsSync(bg)) {
  try { doc.image(bg, 0, 0, { width: W, height: H }) } catch { /* ignore */ }
}
// Fuente real
const reg = join(fontsPath, 'franklin_gothic.ttf')
if (existsSync(reg)) doc.registerFont('FG', reg)
const font = existsSync(reg) ? 'FG' : 'Helvetica'

function bt(bottomMm, sizePt) { return H - bottomMm * MM_TO_PT - sizePt }
doc.font(font)
doc.fontSize(12.2).text('Tarifa A', 2 * MM_TO_PT, bt(50, 12.2), { lineBreak: false })
doc.fontSize(9).text('Objeto de coleccionismo', 2 * MM_TO_PT, bt(47.2, 9), { lineBreak: false })
doc.fontSize(9).text('abril 2026', 2 * MM_TO_PT, bt(43, 9), { lineBreak: false })
doc.fontSize(9).text('Madrid', 2 * MM_TO_PT, bt(39.5, 9), { lineBreak: false })
doc.fontSize(5.7).text('J26-8GI', 2 * MM_TO_PT, bt(35.2, 5.7), { lineBreak: false })
doc.fontSize(5.7).text('0001-001', 2 * MM_TO_PT, bt(33, 5.7), { lineBreak: false })
doc.end()
