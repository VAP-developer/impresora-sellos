/**
 * Script para generar un PDF de prueba con stamp-renderer y guardarlo en disco.
 *
 * Uso:
 *   npx tsx scripts/test-stamp-render.ts
 *
 * Genera: scripts/output/test-stamp.pdf
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

  // Generar un sello con la palabra "TEST" en los campos visibles
  const pdfBuffer = await renderStamp({
    tarifa: 'TEST',
    fecha: 'test fecha',
    evento: 'test evento',
    codigo: 'TEST-0000-000',
    backgroundImage: null
  })

  // Guardar el PDF en disco
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })

  const outputPath = join(outputDir, 'test-stamp.pdf')
  writeFileSync(outputPath, pdfBuffer)

  console.log(`✅ PDF generado: ${outputPath}`)
  console.log(`   Tamaño: ${pdfBuffer.length} bytes`)
  console.log(`   Ábrelo con tu visor de PDF para verificar el resultado.`)

  // Limpiar mock
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockPath) } catch {}
}).catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
