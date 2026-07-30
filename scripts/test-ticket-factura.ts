/**
 * test-ticket-factura.ts
 *
 * Script de prueba para verificar los cambios en el ticket de factura:
 *   - Título = nombre del evento (no el grupo de tarifa)
 *   - Fecha en una sola línea: "Fecha 30/07/2026 21:10:10"
 *   - Factura Simplificada + Código (CH17 - 0021)
 *   - Productos igual
 *   - Sin línea de sesión (CH17 - Session 0038) en el footer
 *
 * Uso:
 *   npx tsx scripts/test-ticket-factura.ts
 *
 * Genera: scripts/output/test-ticket-factura.pdf
 * Opcionalmente imprime en: Brother-TD-4100N Tickets
 */

import { resolve, join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import Module from 'module'

// ─── Mock de @electron-toolkit/utils ──────────────────────────────────────────
const mockElectronPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockElectronPath, 'module.exports = { is: { dev: true } };\n')

const PRINT_TO_PRINTER = process.argv.includes('--print')

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  // Solo mockear pdf-to-printer si NO vamos a imprimir de verdad
  if (request === 'pdf-to-printer' && !PRINT_TO_PRINTER) {
    return require.resolve('./mock-pdf-to-printer.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

// ─── Mock de pdf-to-printer ───────────────────────────────────────────────────
const mockPrinterPath = resolve(__dirname, 'mock-pdf-to-printer.cjs')
writeFileSync(mockPrinterPath, `
let lastCall = null;
module.exports = {
  print: async (filePath, options) => {
    lastCall = { filePath, options };
    console.log('  [mock pdf-to-printer] Impresora:', options.printer);
    console.log('  [mock pdf-to-printer] Archivo:', filePath);
  },
  getLastCall: () => lastCall
};
`)

// ─── Datos de prueba ──────────────────────────────────────────────────────────

// 20 productos para probar corte de papel con ticket largo
const productos = [
  { idProducto: 'AS1', modo: 'S', precio: 2.50, nombre_ticket: 'Tarifa A' },
  { idProducto: 'A2S1', modo: 'S', precio: 3.00, nombre_ticket: 'Tarifa A2' },
  { idProducto: 'BS1', modo: 'S', precio: 1.75, nombre_ticket: 'Tarifa B' },
  { idProducto: 'CS1', modo: 'S', precio: 1.50, nombre_ticket: 'Tarifa C' },
  { idProducto: 'DS1', modo: 'S', precio: 4.00, nombre_ticket: 'Tarifa D Premium' },
  { idProducto: 'ES1', modo: 'S', precio: 2.00, nombre_ticket: 'Tarifa E' },
  { idProducto: 'FS1', modo: 'S', precio: 5.50, nombre_ticket: 'Tarifa F Especial' },
  { idProducto: 'GS1', modo: 'S', precio: 3.25, nombre_ticket: 'Tarifa G' },
  { idProducto: 'HS1', modo: 'S', precio: 1.00, nombre_ticket: 'Tarifa H Básica' },
  { idProducto: 'IS1', modo: 'S', precio: 6.00, nombre_ticket: 'Tarifa I Coleccionista' },
  { idProducto: 'JS1', modo: 'S', precio: 2.75, nombre_ticket: 'Tarifa J' },
  { idProducto: 'KS1', modo: 'S', precio: 8.00, nombre_ticket: 'Tarifa K Edición Limitada' },
  { idProducto: 'LS1', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa L' },
  { idProducto: 'MS1', modo: 'S', precio: 3.50, nombre_ticket: 'Tarifa M' },
  { idProducto: 'NS1', modo: 'S', precio: 4.50, nombre_ticket: 'Tarifa N Conmemorativa' },
  { idProducto: 'OS1', modo: 'S', precio: 2.00, nombre_ticket: 'Tarifa O' },
  { idProducto: 'PS1', modo: 'S', precio: 7.00, nombre_ticket: 'Tarifa P Oro' },
  { idProducto: 'QS1', modo: 'S', precio: 1.50, nombre_ticket: 'Tarifa Q' },
  { idProducto: 'RS1', modo: 'S', precio: 9.00, nombre_ticket: 'Tarifa R Platino' },
  { idProducto: 'SS1', modo: 'S', precio: 3.00, nombre_ticket: 'Tarifa S Estándar' }
]

// Todos con cantidad > 0 para probar ticket largo
const items = [
  { idProducto: 'AS1', cantidad: 3 },
  { idProducto: 'A2S1', cantidad: 1 },
  { idProducto: 'BS1', cantidad: 2 },
  { idProducto: 'CS1', cantidad: 4 },
  { idProducto: 'DS1', cantidad: 1 },
  { idProducto: 'ES1', cantidad: 2 },
  { idProducto: 'FS1', cantidad: 1 },
  { idProducto: 'GS1', cantidad: 3 },
  { idProducto: 'HS1', cantidad: 5 },
  { idProducto: 'IS1', cantidad: 1 },
  { idProducto: 'JS1', cantidad: 2 },
  { idProducto: 'KS1', cantidad: 1 },
  { idProducto: 'LS1', cantidad: 4 },
  { idProducto: 'MS1', cantidad: 2 },
  { idProducto: 'NS1', cantidad: 1 },
  { idProducto: 'OS1', cantidad: 3 },
  { idProducto: 'PS1', cantidad: 1 },
  { idProducto: 'QS1', cantidad: 6 },
  { idProducto: 'RS1', cantidad: 1 },
  { idProducto: 'SS1', cantidad: 2 }
]

// ─── Ejecutar ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { genTicket } = await import('../src/main/printing/ticket-renderer')
  const { setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')

  // Configurar rutas de recursos
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))

  console.log('🎫 Generando ticket de factura con los cambios...\n')

  const pdfBuffer = await genTicket({
    // ─── CAMBIO 1: Título = nombre del evento (antes era el grupo de tarifa) ───
    feria: 'Feria Internacional del Sello 2026',

    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',

    // ─── CAMBIO 2: Fecha en una sola línea ───
    // El renderer ahora pinta: "Fecha 30/07/2026 21:10:10" en una sola línea
    fechaTicket: '30/07/2026 21:10:10',

    // ─── CAMBIO 3: Factura Simplificada + Código ───
    modoTicket: 'Factura Simplificada CH17 - 0021',

    // Modelos de sello (prefijo en nombre de producto)
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed.',

    items,
    productos,

    // ─── CAMBIO 4: idCliente y nombreMaquina ya no se muestran en el footer ───
    // Se mantienen en params por compatibilidad pero no se renderizan
    idCliente: 21,
    nombreMaquina: 'CH17',

    // Textos legales del footer
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  })

  // Guardar PDF
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'test-ticket-factura.pdf')
  writeFileSync(outputPath, pdfBuffer)

  console.log(`✅ PDF generado: ${outputPath}`)
  console.log(`   Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB`)
  console.log('')
  console.log('📋 Verificar visualmente:')
  console.log('   - Título: "Feria Internacional del Sello 2026" (nombre del evento)')
  console.log('   - Fecha en UNA línea: "Fecha 30/07/2026 21:10:10"')
  console.log('   - Modo: "Factura Simplificada CH17 - 0021"')
  console.log('   - Productos con cantidades y precios')
  console.log('   - SIN línea "CH17 - Sesión 0021" en el footer')
  console.log('   - Solo textos legales (l1, l2, l3) en el footer')

  // ─── Opcionalmente imprimir en la Brother ───────────────────────────────────
  if (PRINT_TO_PRINTER) {
    console.log('\n🖨️  Enviando a impresora Brother-TD-4100N TICKETS...')
    const { WindowsBackend } = await import('../src/main/printing/windows-backend')
    const { calcActualTicketHeight } = await import('../src/main/printing/ticket-renderer')
    const backend = new WindowsBackend()
    
    const activeItems = items.filter(i => i.cantidad > 0).length
    
    // Calcular la altura real del ticket
    const ticketParams = {
      feria: 'Feria Internacional del Sello 2026',
      lugar: 'Madrid - IFEMA',
      empresa: 'CORREOS Y TELÉGRAFOS S.A.',
      cif: 'A-83052407',
      cp: '28020 Madrid',
      fechaTicket: '30/07/2026 21:10:10',
      modoTicket: 'Factura Simplificada CH17 - 0021',
      modelo1Ticket: 'Año Serpiente',
      modelo2Ticket: 'Año Serpiente Ed.',
      items,
      idCliente: 21,
      nombreMaquina: 'CH17',
      productos,
      l1: 'Conserve este ticket como justificante de compra',
      l2: 'No se admiten devoluciones sin este documento',
      l3: 'Gracias por su visita'
    }
    const heightMm = Math.ceil(calcActualTicketHeight(ticketParams))
    
    console.log(`   Productos activos: ${activeItems}`)
    console.log(`   Altura ticket: ${heightMm}mm`)
    console.log(`   Media: Custom.78x${heightMm}mm`)
    
    // WindowsBackend ahora auto-configura el driver via set-paper-size.ps1
    const result = await backend.print(
      'win://Brother%20TD-4100N%20TICKETS',
      pdfBuffer,
      {
        media: `Custom.78x${heightMm}mm`,
        orientation: 0,
        jobName: 'test_ticket_factura'
      }
    )
    console.log(`   Resultado: ${result.success ? '✅ Impreso' : '❌ Error: ' + result.error}`)
  } else {
    console.log('\n💡 Para imprimir en la Brother, ejecuta:')
    console.log('   npx tsx scripts/test-ticket-factura.ts --print')
  }

  // Cleanup
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockElectronPath) } catch {}
  try { unlinkSync(mockPrinterPath) } catch {}
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
