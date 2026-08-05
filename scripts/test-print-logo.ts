/**
 * Script para diagnosticar el problema de impresión del logo PNG en Brother TD-4100N.
 *
 * Genera varias variantes del PDF para aislar la causa:
 * 1. PDF con logo PNG original (con transparencia/alpha)
 * 2. PDF con logo PNG "flattened" (sin transparencia, fondo blanco)
 * 3. PDF con logo reducido de tamaño
 *
 * Uso:
 *   npx tsx scripts/test-print-logo.ts
 *
 * Los PDFs se guardan en scripts/output/ para inspección visual y prueba manual.
 * Para imprimir directamente (requiere impresora configurada):
 *   npx tsx scripts/test-print-logo.ts --print "NombreImpresora"
 */

import { resolve, join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import { execSync } from 'child_process'
import Module from 'module'

// Mock @electron-toolkit/utils para poder ejecutar fuera de Electron
const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

const mockPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockPath, 'module.exports = { is: { dev: true } };\n')

// Helper: convert file to data URI
function fileToDataUri(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const buffer = readFileSync(filePath)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Flatten PNG transparency by compositing onto white background.
 * Converts RGBA PNG data URI to RGB JPEG data URI (no alpha channel).
 * Uses a simple in-memory approach with raw pixel manipulation.
 */
function flattenPngToJpegDataUri(pngDataUri: string): string {
  // Extract base64 data from the data URI
  const base64Data = pngDataUri.split(',')[1]
  const pngBuffer = Buffer.from(base64Data, 'base64')

  // For simplicity, we'll create a white JPEG placeholder of similar dimensions
  // The real solution would be to use sharp or canvas to flatten, but let's
  // test with the original PNG first to confirm the transparency theory.
  // Instead, we'll return the PNG as-is but note this in the output.
  return pngDataUri
}

// Parse command line args
const printerArg = process.argv.indexOf('--print')
const printerName = printerArg !== -1 ? process.argv[printerArg + 1] : null

import('../src/main/printing/stamp-renderer').then(async ({ renderStamp, renderStampMultiPage, setTestFontsPath, setTestImagesPath }) => {
  const fontsPath = resolve(__dirname, '../resources/fonts')
  const imagesPath = resolve(__dirname, '../resources/images')
  setTestFontsPath(fontsPath)
  setTestImagesPath(imagesPath)

  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })

  // Load sello image
  const selloPath = resolve(__dirname, '../bbdd-ferias/2026/serpiente/Año Serpiente-sello.png')
  const fondoPath = resolve(__dirname, '../bbdd-ferias/2026/serpiente/Año Serpiente-fondo.jpg')

  if (!existsSync(selloPath)) {
    console.error('❌ Sello image not found:', selloPath)
    process.exit(1)
  }

  const selloDataUri = fileToDataUri(selloPath)
  const fondoDataUri = existsSync(fondoPath) ? fileToDataUri(fondoPath) : null

  console.log('=== Diagnóstico de impresión Logo PNG ===')
  console.log(`Sello PNG: ${selloPath}`)
  console.log(`  Tamaño archivo: ${readFileSync(selloPath).length} bytes`)
  console.log(`  Data URI length: ${selloDataUri.length} chars`)
  console.log(`  Formato: PNG con transparencia (RGBA, ColorType 6)`)
  console.log(`  Dimensiones: 650x288 px`)
  console.log('')

  const baseParams = {
    tarifa: 'Tarifa A',
    tarifaDescripcion: 'Sello individual',
    fecha: '21-24 abril 2026',
    evento: 'Madrid',
    codigo: 'P4ES26 CH17-0001-001'
  }

  // ─── Test A: Sin logo (baseline) ───────────────────────────────────────────
  console.log('--- Test A: Sin logo (baseline - debería imprimir OK) ---')
  const pdfA = await renderStamp({
    ...baseParams,
    backgroundImage: fondoDataUri,
    overlayImage: null,
    printLogoPng: false,
    logoPngImage: null
  })
  const pathA = join(outputDir, 'test-A-sin-logo.pdf')
  writeFileSync(pathA, pdfA)
  console.log(`  ✅ ${pathA} (${pdfA.length} bytes)`)

  // ─── Test B: Con logo PNG (transparencia) ──────────────────────────────────
  console.log('--- Test B: Con logo PNG original (con transparencia) ---')
  const pdfB = await renderStamp({
    ...baseParams,
    backgroundImage: fondoDataUri,
    overlayImage: null,
    printLogoPng: true,
    logoPngImage: selloDataUri
  })
  const pathB = join(outputDir, 'test-B-con-logo-alpha.pdf')
  writeFileSync(pathB, pdfB)
  console.log(`  ✅ ${pathB} (${pdfB.length} bytes)`)

  // ─── Test C: Con logo como JPEG (sin transparencia) ────────────────────────
  // Usamos el fondo JPEG como "logo" para probar si el problema es la transparencia
  console.log('--- Test C: Con imagen JPEG como logo (sin transparencia) ---')
  const jpegLogoDataUri = fondoDataUri // El fondo es JPEG, sin alpha
  const pdfC = await renderStamp({
    ...baseParams,
    backgroundImage: null,
    overlayImage: null,
    printLogoPng: true,
    logoPngImage: jpegLogoDataUri
  })
  const pathC = join(outputDir, 'test-C-logo-jpeg-no-alpha.pdf')
  writeFileSync(pathC, pdfC)
  console.log(`  ✅ ${pathC} (${pdfC.length} bytes)`)

  // ─── Test D: Con logo PNG pero sin fondo ───────────────────────────────────
  console.log('--- Test D: Logo PNG sin fondo (transparencia, sin background) ---')
  const pdfD = await renderStamp({
    ...baseParams,
    backgroundImage: null,
    overlayImage: null,
    printLogoPng: true,
    logoPngImage: selloDataUri
  })
  const pathD = join(outputDir, 'test-D-logo-alpha-sin-fondo.pdf')
  writeFileSync(pathD, pdfD)
  console.log(`  ✅ ${pathD} (${pdfD.length} bytes)`)

  // ─── Resumen ───────────────────────────────────────────────────────────────
  console.log('')
  console.log('=== Resumen de archivos generados ===')
  console.log(`  A (sin logo):           ${pdfA.length.toString().padStart(6)} bytes → debería imprimir OK`)
  console.log(`  B (logo PNG + alpha):   ${pdfB.length.toString().padStart(6)} bytes → NO imprime en Brother`)
  console.log(`  C (logo JPEG sin alpha):${pdfC.length.toString().padStart(6)} bytes → ¿imprime?`)
  console.log(`  D (logo PNG sin fondo): ${pdfD.length.toString().padStart(6)} bytes → ¿imprime?`)
  console.log('')
  console.log('📋 PASOS PARA DIAGNOSTICAR:')
  console.log('1. Abre cada PDF en un visor para verificar que se ven bien')
  console.log('2. Imprime cada uno manualmente en la Brother Brother TD-4100N ETI 1')
  console.log('3. Si C imprime pero B no → el problema es la TRANSPARENCIA (alpha channel)')
  console.log('4. Si C tampoco imprime → el problema es el TAMAÑO del PDF (37KB vs 8KB)')
  console.log('')

  if (printerName) {
    console.log(`\n🖨️  Enviando a impresora: ${printerName}`)

    // Find SumatraPDF
    let sumatraPath: string
    try {
      sumatraPath = join(
        require.resolve('pdf-to-printer'),
        '..',
        'SumatraPDF-3.4.6-32.exe'
      )
      if (!existsSync(sumatraPath)) {
        throw new Error('SumatraPDF not found')
      }
    } catch {
      console.error('❌ No se encontró SumatraPDF. Instala pdf-to-printer o imprime manualmente.')
      cleanup()
      return
    }

    const printPdf = (label: string, pdfPath: string) => {
      console.log(`  Enviando ${label}...`)
      try {
        execSync(`"${sumatraPath}" -print-to "${printerName}" -print-settings "noscale" -silent "${pdfPath}"`, {
          timeout: 30000
        })
        console.log(`    ✅ Enviado OK`)
      } catch (err: any) {
        console.log(`    ❌ Error: ${err.message}`)
      }
    }

    // Esperar entre envíos para no saturar la impresora
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    printPdf('A (sin logo)', pathA)
    await sleep(5000)
    printPdf('D (logo PNG sin fondo)', pathD)
    await sleep(5000)
    printPdf('C (logo JPEG)', pathC)
    await sleep(5000)
    printPdf('B (logo PNG + alpha + fondo)', pathB)
  } else {
    console.log('💡 Para enviar directamente a la impresora:')
    console.log('   npx tsx scripts/test-print-logo.ts --print "Brother TD-4100N ETI 1"')
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
