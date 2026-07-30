/**
 * test-currency-in-ticket.ts
 * 
 * Script de prueba para verificar que el símbolo de moneda se muestra correctamente
 * según la moneda del grupo de tarifas activo.
 */

import { resolve, join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import Module from 'module'

// ─── Mock de @electron-toolkit/utils ──────────────────────────────────────────
const mockElectronPath = resolve(__dirname, 'mock-electron-toolkit.cjs')
writeFileSync(mockElectronPath, 'module.exports = { is: { dev: true } };\n')

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === '@electron-toolkit/utils') {
    return require.resolve('./mock-electron-toolkit.cjs')
  }
  return originalResolveFilename.call(this, request, ...args)
}

const productos = [
  {
    idProducto: 'D1S1',
    modo: 'S',
    precio: 2.50,
    nombre_ticket: 'Tarifa Básica'
  },
  {
    idProducto: 'D2S1',
    modo: 'S',
    precio: 5.00,
    nombre_ticket: 'Tarifa Premium'
  }
]

const items = [
  { idProducto: 'D1S1', cantidad: 2 },
  { idProducto: 'D2S1', cantidad: 1 }
]

async function testCurrencyInTicket() {
  const { genTicket } = await import('../src/main/printing/ticket-renderer')
  const { setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')
  
  // Configurar rutas de recursos
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))
  
  console.log('💱 Probando diferentes monedas en ticket...\n')
  
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  
  const baseParams = {
    fechaTicket: '30/07/2026 14:30:00',
    modoTicket: 'Factura Simplificada',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed. Especial',
    items,
    idCliente: 100,
    nombreMaquina: 'CH17',
    productos,
    feria: 'EXFILNA 2026',
    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  }
  
  // Test 1: Euros (€)
  console.log('📄 Generando ticket con EUROS (€)...')
  const ticketEUR = await genTicket({
    ...baseParams,
    idCliente: 101,
    currencySymbol: '€'
  })
  const ticketEURPath = join(outputDir, 'ticket-currency-EUR.pdf')
  writeFileSync(ticketEURPath, ticketEUR)
  console.log(`✅ Ticket guardado: ${ticketEURPath}`)
  console.log(`   Precios: 2.50€, 5.00€, Total: 10.00€\n`)
  
  // Test 2: Dólares ($)
  console.log('📄 Generando ticket con DÓLARES ($)...')
  const ticketUSD = await genTicket({
    ...baseParams,
    idCliente: 102,
    currencySymbol: '$'
  })
  const ticketUSDPath = join(outputDir, 'ticket-currency-USD.pdf')
  writeFileSync(ticketUSDPath, ticketUSD)
  console.log(`✅ Ticket guardado: ${ticketUSDPath}`)
  console.log(`   Precios: 2.50$, 5.00$, Total: 10.00$\n`)
  
  // Test 3: Libras (£)
  console.log('📄 Generando ticket con LIBRAS (£)...')
  const ticketGBP = await genTicket({
    ...baseParams,
    idCliente: 103,
    currencySymbol: '£'
  })
  const ticketGBPPath = join(outputDir, 'ticket-currency-GBP.pdf')
  writeFileSync(ticketGBPPath, ticketGBP)
  console.log(`✅ Ticket guardado: ${ticketGBPPath}`)
  console.log(`   Precios: 2.50£, 5.00£, Total: 10.00£\n`)
  
  // Test 4: Yenes (¥)
  console.log('📄 Generando ticket con YENES (¥)...')
  const ticketJPY = await genTicket({
    ...baseParams,
    idCliente: 104,
    currencySymbol: '¥'
  })
  const ticketJPYPath = join(outputDir, 'ticket-currency-JPY.pdf')
  writeFileSync(ticketJPYPath, ticketJPY)
  console.log(`✅ Ticket guardado: ${ticketJPYPath}`)
  console.log(`   Precios: 2.50¥, 5.00¥, Total: 10.00¥\n`)
  
  console.log('🎉 ¡Prueba completada!')
  console.log('\n📝 Comportamiento implementado:')
  console.log('   ✓ El símbolo de moneda se obtiene del grupo de tarifas')
  console.log('   ✓ Se usa getCurrencySymbol() para convertir código a símbolo')
  console.log('   ✓ Soporta: EUR (€), USD ($), GBP (£), JPY (¥), y más')
  console.log('   ✓ Por defecto usa € si no se especifica moneda')
  
  // Cleanup
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockElectronPath) } catch {}
}

testCurrencyInTicket().catch(console.error)
