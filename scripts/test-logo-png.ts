/**
 * Script para diagnosticar el problema del logo PNG en el sello.
 *
 * Uso:
 *   npx tsx scripts/test-logo-png.ts
 *
 * Genera: scripts/output/test-logo-png.pdf
 */

import { resolve, join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import Module from 'module'

// Mock @electron-toolkit/utils para poder ejecutar fuera de Electron
const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

// Crear el mock file en runtime
const mockPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockPath, 'module.exports = { is: { dev: true } };\n')

// Helper para convertir archivo a data URI
function fileToDataUri(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const buffer = readFileSync(filePath)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

// Ahora sí importar el renderer
import('../src/main/printing/stamp-renderer').then(async ({ renderStamp, setTestFontsPath, setTestImagesPath }) => {
  const fontsPath = resolve(__dirname, '../resources/fonts')
  const imagesPath = resolve(__dirname, '../resources/images')
  setTestFontsPath(fontsPath)
  setTestImagesPath(imagesPath)

  // Cargar el sello PNG de la feria serpiente
  const selloPath = resolve(__dirname, '../bbdd-ferias/2026/serpiente/Año Serpiente-sello.png')
  
  console.log('--- Diagnóstico Logo PNG ---')
  console.log(`Sello path: ${selloPath}`)
  console.log(`Sello exists: ${existsSync(selloPath)}`)

  if (!existsSync(selloPath)) {
    console.error('❌ El archivo sello no existe!')
    process.exit(1)
  }

  const selloDataUri = fileToDataUri(selloPath)
  console.log(`Sello data URI length: ${selloDataUri.length}`)
  console.log(`Sello data URI prefix: ${selloDataUri.substring(0, 30)}...`)
  console.log(`Is PNG data URI: ${selloDataUri.startsWith('data:image/png')}`)

  // Test 1: Generar sello con printLogoPng=true y logoPngImage
  console.log('\n--- Test 1: Logo PNG con datos ---')
  try {
    const pdfBuffer = await renderStamp({
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
    const outputPath = join(outputDir, 'test-logo-png.pdf')
    writeFileSync(outputPath, pdfBuffer)
    console.log(`✅ PDF generado: ${outputPath} (${pdfBuffer.length} bytes)`)
  } catch (err) {
    console.error(`❌ Error generando PDF con logo: ${err}`)
  }

  // Test 2: Generar sello con printLogoPng=true pero logoPngImage=null (simula el bug)
  console.log('\n--- Test 2: Logo PNG con imagen null (simula bug) ---')
  try {
    const pdfBuffer = await renderStamp({
      tarifa: 'Tarifa A',
      tarifaDescripcion: 'Sello individual',
      fecha: '21-24 abril 2026',
      evento: 'Madrid',
      codigo: 'P4ES26 CH17-0001-001',
      backgroundImage: null,
      overlayImage: null,
      printLogoPng: true,
      logoPngImage: null
    })

    const outputDir = join(__dirname, 'output')
    const outputPath = join(outputDir, 'test-logo-png-null.pdf')
    writeFileSync(outputPath, pdfBuffer)
    console.log(`✅ PDF generado (sin logo, como esperado): ${outputPath} (${pdfBuffer.length} bytes)`)
  } catch (err) {
    console.error(`❌ Error: ${err}`)
  }

  // Test 3: Verificar que drawLogoPng no lanza error silente
  console.log('\n--- Test 3: Logo PNG con fondo de feria ---')
  try {
    const fondoPath = resolve(__dirname, '../bbdd-ferias/2026/serpiente/Año Serpiente-fondo.jpg')
    const fondoDataUri = existsSync(fondoPath) ? fileToDataUri(fondoPath) : null
    
    const pdfBuffer = await renderStamp({
      tarifa: 'Tarifa A',
      tarifaDescripcion: 'Sello individual',
      fecha: '21-24 abril 2026',
      evento: 'Madrid',
      codigo: 'P4ES26 CH17-0001-001',
      backgroundImage: fondoDataUri,
      overlayImage: null,
      printLogoPng: true,
      logoPngImage: selloDataUri
    })

    const outputDir = join(__dirname, 'output')
    const outputPath = join(outputDir, 'test-logo-png-with-bg.pdf')
    writeFileSync(outputPath, pdfBuffer)
    console.log(`✅ PDF generado con fondo + logo: ${outputPath} (${pdfBuffer.length} bytes)`)
  } catch (err) {
    console.error(`❌ Error: ${err}`)
  }

  console.log('\n--- Fin diagnóstico ---')
  console.log('Abre los PDFs generados para verificar si el logo aparece.')

  // Limpiar mock
  try { require('fs').unlinkSync(mockPath) } catch {}
}).catch((err) => {
  console.error('Error importando módulo:', err)
  process.exit(1)
})
