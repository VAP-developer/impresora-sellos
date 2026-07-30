/**
 * Script para probar específicamente que fecha y localidad se imprimen correctamente.
 *
 * Uso:
 *   npx tsx scripts/test-fecha-localidad.ts
 *
 * Genera: scripts/output/test-fecha-localidad.pdf
 */

import { resolve, join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import Module from 'module'

// Mock @electron-toolkit/utils para poder ejecutar fuera de Electron
const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    // Devolver un módulo falso con is.dev = true
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

// Crear el mock file en runtime
const mockPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockPath, 'module.exports = { is: { dev: true } };\n')

// Ahora sí importar el renderer
import('../src/main/printing/stamp-renderer').then(async ({ renderStamp, setTestFontsPath, setTestImagesPath }) => {
  // Apuntar a las fuentes e imágenes del proyecto
  const fontsPath = resolve(__dirname, '../resources/fonts')
  const imagesPath = resolve(__dirname, '../resources/images')
  setTestFontsPath(fontsPath)
  setTestImagesPath(imagesPath)

  // Generar un sello con valores realistas para fecha y localidad
  const pdfBuffer = await renderStamp({
    tarifa: 'Tarifa A',
    tarifaDescripcion: 'Acceso General',
    fecha: '21-24 abril 2025',
    evento: 'Madrid',
    codigo: 'P4ES26 CH17-0001-001',
    backgroundImage: null
  })

  // Guardar el PDF en disco
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })

  const outputPath = join(outputDir, 'test-fecha-localidad.pdf')
  writeFileSync(outputPath, pdfBuffer)

  console.log(`✅ PDF generado: ${outputPath}`)
  console.log(`   Tamaño: ${pdfBuffer.length} bytes`)
  console.log(`\n   Contenido del sello:`)
  console.log(`   - Tarifa: "Tarifa A"`)
  console.log(`   - Descripción: "Acceso General"`)
  console.log(`   - Fecha: "21-24 abril 2025" → debe mostrar "abril 2025"`)
  console.log(`   - Localidad: "Madrid"`)
  console.log(`   - Código L1: "P26-4ES"`)
  console.log(`   - Código L2: "0001-001"`)
  console.log(`\n   Verifica que la fecha y localidad aparezcan correctamente.`)

  // Limpiar mock
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockPath) } catch {}
}).catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
