/**
 * Script que simula el flujo completo: stamp-renderer → windows-backend
 * pero mockeando pdf-to-printer para capturar el PDF que se enviaría a la impresora.
 *
 * Uso:
 *   npx tsx scripts/test-print-flow.ts
 *
 * Genera: scripts/output/test-print-flow.pdf (el PDF exacto que recibiría la impresora)
 */

import { resolve, join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import Module from 'module'

// ─── Mock de @electron-toolkit/utils ──────────────────────────────────────────
const mockElectronPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockElectronPath, 'module.exports = { is: { dev: true } };\n')

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  // Mock pdf-to-printer: en vez de imprimir, capturamos el archivo
  if (request === 'pdf-to-printer') {
    return require.resolve('./mock-pdf-to-printer.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

// ─── Mock de pdf-to-printer ───────────────────────────────────────────────────
// Captura los argumentos que recibiría SumatraPDF
const mockPrinterPath = resolve(__dirname, 'mock-pdf-to-printer.cjs')
writeFileSync(mockPrinterPath, `
let lastCall = null;
module.exports = {
  print: async (filePath, options) => {
    lastCall = { filePath, options };
    console.log('  [mock pdf-to-printer] Impresora:', options.printer);
    console.log('  [mock pdf-to-printer] Opciones win32:', options.win32);
    console.log('  [mock pdf-to-printer] Copies:', options.copies);
    console.log('  [mock pdf-to-printer] Archivo:', filePath);
  },
  getLastCall: () => lastCall
};
`)

// ─── Ejecutar el flujo ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const { renderStamp, setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')
  const { WindowsBackend } = await import('../src/main/printing/windows-backend')

  // Configurar rutas de recursos
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))

  // 1. Generar el PDF del sello (como lo haría pdf-generator)
  console.log('─── Paso 1: Generando PDF con stamp-renderer ───')
  const pdfBuffer = await renderStamp({
    tarifa: 'Tarifa A',
    fecha: '21-24 julio 2026',
    evento: 'Madrid',
    codigo: 'P4ES26 CH17-0001-001',
    backgroundImage: null
  })
  console.log(`  PDF generado: ${pdfBuffer.length} bytes (55mm × 25mm landscape)`)

  // 2. Enviar a la "impresora" via windows-backend (mockeado)
  console.log('\n─── Paso 2: Enviando a windows-backend ───')
  const backend = new WindowsBackend()
  const result = await backend.print('win://Brother%20TD-4100N', pdfBuffer, {
    media: 'DC55x25',
    orientation: 3,
    jobName: 'stamp_test_001'
  })
  console.log(`  Resultado: ${result.success ? '✅ OK' : '❌ ERROR: ' + result.error}`)
  console.log(`  Job ID: ${result.jobId}`)

  // 3. Guardar el PDF para inspección visual
  console.log('\n─── Paso 3: Guardando PDF para inspección ───')
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'test-print-flow.pdf')
  writeFileSync(outputPath, pdfBuffer)
  console.log(`  PDF guardado: ${outputPath}`)
  console.log(`  Ábrelo con un visor de PDF para verificar que se ve correcto.`)
  console.log(`  Dimensiones esperadas: 55mm × 25mm (landscape)`)

  // Cleanup
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockElectronPath) } catch {}
  try { unlinkSync(mockPrinterPath) } catch {}
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
