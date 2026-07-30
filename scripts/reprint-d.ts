/**
 * Reimprime test D (logo PNG sin fondo) con el nuevo PNG actualizado.
 * npx tsx scripts/reprint-d.ts
 */
import { resolve, join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { extname } from 'path'
import { execSync } from 'child_process'
import Module from 'module'

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

const mockPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockPath, 'module.exports = { is: { dev: true } };\n')

function fileToDataUri(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const buffer = readFileSync(filePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

import('../src/main/printing/stamp-renderer').then(async ({ renderStamp, setTestFontsPath, setTestImagesPath }) => {
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))

  const selloPath = resolve(__dirname, '../bbdd-ferias/2026/serpiente/Año Serpiente-sello.png')
  console.log('Sello:', selloPath)
  console.log('Tamaño:', readFileSync(selloPath).length, 'bytes')

  const selloDataUri = fileToDataUri(selloPath)

  const pdf = await renderStamp({
    tarifa: 'Tarifa A',
    tarifaDescripcion: 'Sello individual',
    fecha: '21-24 abril 2026',
    evento: 'Madrid',
    codigo: 'P4ES26 CH17-0001-001',
    backgroundImage: null,
    overlayImage: null,
    printLogoPng: true,
    logoPngImage: selloDataUri
  })

  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  const outPath = join(outputDir, 'test-D-logo-alpha-sin-fondo.pdf')
  writeFileSync(outPath, pdf)
  console.log(`PDF generado: ${outPath} (${pdf.length} bytes)`)

  // Enviar a impresora
  const sumatraPath = join(require.resolve('pdf-to-printer'), '..', 'SumatraPDF-3.4.6-32.exe')
  if (!existsSync(sumatraPath)) {
    console.error('SumatraPDF no encontrado')
    cleanup()
    return
  }

  console.log('Enviando a Brother TD-4100N ETI-2...')
  try {
    execSync(`"${sumatraPath}" -print-to "Brother TD-4100N ETI-2" -print-settings "noscale" -silent "${outPath}"`, {
      timeout: 30000
    })
    console.log('✅ Enviado OK')
  } catch (err: any) {
    console.error('❌ Error:', err.message)
  }

  cleanup()
}).catch((err) => {
  console.error('Error:', err)
  cleanup()
  process.exit(1)
})

function cleanup() {
  try { require('fs').unlinkSync(mockPath) } catch {}
}
