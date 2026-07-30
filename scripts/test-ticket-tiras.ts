/**
 * test-ticket-tiras.ts
 *
 * Script de prueba para verificar que al imprimir tiras se generan:
 *   - 1 ticket global con TODOS los productos
 *   - N tickets individuales: 1 por cada unidad de tira
 *
 * Ejemplo: 3 tiras "Tarifa A Tira 4" + 2 tiras "Tira A-B-C" = 5 tickets individuales + 1 global = 6 tickets
 *
 * Uso:
 *   npx tsx scripts/test-ticket-tiras.ts
 *   npx tsx scripts/test-ticket-tiras.ts --print
 */

import { resolve, join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import Module from 'module'

// ─── Mock de @electron-toolkit/utils ──────────────────────────────────────────
const PRINT_TO_PRINTER = process.argv.includes('--print')

const mockElectronPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockElectronPath, 'module.exports = { is: { dev: true } };\n')

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  if (request === 'pdf-to-printer' && !PRINT_TO_PRINTER) {
    return require.resolve('./mock-pdf-to-printer.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

const mockPrinterPath = resolve(__dirname, 'mock-pdf-to-printer.cjs')
writeFileSync(mockPrinterPath, `
let lastCall = null;
module.exports = {
  print: async (filePath, options) => {
    lastCall = { filePath, options };
  },
  getLastCall: () => lastCall
};
`)

// ─── Datos de prueba ──────────────────────────────────────────────────────────

// Simulamos: 3 tiras "Tarifa A Tira 4" + 2 tiras "Tira A-B-C" + 1 sello simple
const productos = [
  { idProducto: 'AT1', modo: 'T', precio: 10.00, nombre_ticket: 'Tarifa A Tira 4' },
  { idProducto: '4T1', modo: 'T', precio: 12.00, nombre_ticket: 'Tira de 4 Tarifas' },
  { idProducto: 'AS1', modo: 'S', precio: 2.50, nombre_ticket: 'Tarifa A' },
  { idProducto: 'BS1', modo: 'S', precio: 1.75, nombre_ticket: 'Tarifa B' }
]

const items = [
  { idProducto: 'AT1', cantidad: 3 },  // 3 tiras A → 3 tickets individuales
  { idProducto: '4T1', cantidad: 2 },  // 2 tiras 4 Tarifas → 2 tickets individuales
  { idProducto: 'AS1', cantidad: 2 },  // sellos simples → NO generan ticket individual
  { idProducto: 'BS1', cantidad: 1 }   // sello simple → NO genera ticket individual
]

// ─── Ejecutar ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { genTicket, calcActualTicketHeight } = await import('../src/main/printing/ticket-renderer')
  const { setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')

  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))

  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })

  // Parámetros comunes
  const commonParams = {
    feria: 'Feria Internacional del Sello 2026',
    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',
    fechaTicket: '30/07/2026 21:10:10',
    modoTicket: 'Factura Simplificada CH17 - 0021',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed.',
    idCliente: 21,
    nombreMaquina: 'CH17',
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  }

  console.log('🎫 Simulando lógica de tickets con tiras...\n')
  console.log('📦 Pedido:')
  console.log('   - 3x Tarifa A Tira 4 (modo T)')
  console.log('   - 2x Tira de 4 Tarifas (modo T)')
  console.log('   - 2x Tarifa A sello simple (modo S)')
  console.log('   - 1x Tarifa B sello simple (modo S)')
  console.log('')

  // ─── 1. Ticket global (todos los productos) ────────────────────────────────
  console.log('📄 1. Generando TICKET GLOBAL (todos los productos)...')
  const globalBuffer = await genTicket({ ...commonParams, items, productos })
  const globalPath = join(outputDir, 'ticket-tiras-global.pdf')
  writeFileSync(globalPath, globalBuffer)
  console.log(`   ✅ ${globalPath} (${(globalBuffer.length / 1024).toFixed(1)} KB)`)

  // ─── 2. Tickets individuales por tira ──────────────────────────────────────
  const individualTickets: { buffer: Buffer; name: string }[] = []
  let ticketNum = 0

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const producto = productos[idx]

    // Solo generar tickets individuales para tiras (modo 'T')
    if (item.cantidad > 0 && producto.modo === 'T') {
      for (let t = 0; t < item.cantidad; t++) {
        ticketNum++
        // Items con solo esta tira, cantidad = 1
        const singleTiraItems = items.map((it, i) => ({
          idProducto: it.idProducto,
          cantidad: i === idx ? 1 : 0
        }))

        const buffer = await genTicket({ ...commonParams, items: singleTiraItems, productos })
        const name = `ticket-tiras-individual-${ticketNum}.pdf`
        individualTickets.push({ buffer, name })
      }
    }
  }

  console.log(`\n📄 2. Generando ${individualTickets.length} TICKETS INDIVIDUALES (1 por tira)...`)
  for (const ticket of individualTickets) {
    const ticketPath = join(outputDir, ticket.name)
    writeFileSync(ticketPath, ticket.buffer)
    console.log(`   ✅ ${ticket.name} (${(ticket.buffer.length / 1024).toFixed(1)} KB)`)
  }

  // ─── Resumen ───────────────────────────────────────────────────────────────
  const totalTickets = 1 + individualTickets.length
  console.log(`\n📊 Resumen:`)
  console.log(`   Total tickets generados: ${totalTickets}`)
  console.log(`   - 1 ticket global (todos los productos)`)
  console.log(`   - ${individualTickets.length} tickets individuales (1 por cada tira)`)
  console.log(`     → 3 de "Tarifa A Tira 4"`)
  console.log(`     → 2 de "Tira de 4 Tarifas"`)

  // ─── Imprimir si --print ───────────────────────────────────────────────────
  if (PRINT_TO_PRINTER) {
    console.log('\n🖨️  Imprimiendo en Brother-TD-4100N TICKETS...')
    const { WindowsBackend } = await import('../src/main/printing/windows-backend')
    const backend = new WindowsBackend()

    const allTickets = [
      { buffer: globalBuffer, desc: 'Ticket global', params: { ...commonParams, items, productos } },
      ...individualTickets.map((t, i) => {
        const idx = i < 3 ? 0 : 1
        const singleItems = items.map((it, j) => ({ idProducto: it.idProducto, cantidad: j === idx ? 1 : 0 }))
        return { buffer: t.buffer, desc: `Ticket individual #${i + 1}`, params: { ...commonParams, items: singleItems, productos } }
      })
    ]

    for (const ticket of allTickets) {
      const heightMm = Math.ceil(calcActualTicketHeight(ticket.params))

      // WindowsBackend now auto-configures the driver paper size via DEVMODE
      const result = await backend.print(
        'win://Brother%20TD-4100N%20TICKETS',
        ticket.buffer,
        { media: `Custom.78x${heightMm}mm`, orientation: 0, jobName: `ticket_tira_${Date.now()}` }
      )
      console.log(`   ${ticket.desc} (${heightMm}mm): ${result.success ? '✅' : '❌ ' + result.error}`)
    }
  } else {
    console.log('\n💡 Para imprimir todos los tickets:')
    console.log('   npx tsx scripts/test-ticket-tiras.ts --print')
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
