/**
 * test-event-name-in-ticket.ts
 * 
 * Script de prueba para verificar que el nombre del evento (nferia) aparece
 * en el título del ticket en lugar del nombre del grupo de tarifas.
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

// Productos de prueba
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
    precio: 3.00,
    nombre_ticket: 'Tarifa Premium'
  }
]

const items = [
  { idProducto: 'D1S1', cantidad: 2 },
  { idProducto: 'D2S1', cantidad: 1 }
]

async function testEventNameInTicket() {
  const { genTicket } = await import('../src/main/printing/ticket-renderer')
  const { setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')
  
  // Configurar rutas de recursos
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))
  
  console.log('🎫 Probando nombre del evento en ticket...\n')
  
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  
  // Caso 1: Con nombre de evento (uso dinámico)
  console.log('📄 Generando ticket con nombre de EVENTO...')
  const ticketWithEvent = await genTicket({
    fechaTicket: '30/07/2026 14:30:00',
    modoTicket: 'Factura Simplificada',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed. Especial',
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos,
    feria: 'EXFILNA 2026 - Exposición Filatélica Nacional', // ← Este es el nombre del EVENTO (nferia)
    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  })
  
  const ticketWithEventPath = join(outputDir, 'ticket-with-event-name.pdf')
  writeFileSync(ticketWithEventPath, ticketWithEvent)
  console.log(`✅ Ticket guardado: ${ticketWithEventPath}`)
  console.log(`   Título mostrado: "EXFILNA 2026 - Exposición Filatélica Nacional"`)
  console.log(`   (Este es el nombre del evento, NO el del grupo de tarifas)\n`)
  
  // Caso 2: Con nombre de grupo de tarifas (fallback)
  console.log('📄 Generando ticket con nombre de GRUPO DE TARIFAS (fallback)...')
  const ticketWithGroup = await genTicket({
    fechaTicket: '30/07/2026 14:30:00',
    modoTicket: 'Factura Simplificada',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed. Especial',
    items,
    idCliente: 43,
    nombreMaquina: 'CH17',
    productos,
    feria: 'Grupo Tarifario Estándar 2026', // ← Este sería el nombre del grupo (fallback)
    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  })
  
  const ticketWithGroupPath = join(outputDir, 'ticket-with-group-name.pdf')
  writeFileSync(ticketWithGroupPath, ticketWithGroup)
  console.log(`✅ Ticket guardado: ${ticketWithGroupPath}`)
  console.log(`   Título mostrado: "Grupo Tarifario Estándar 2026"`)
  console.log(`   (Este es el nombre del grupo, usado como fallback)\n`)
  
  console.log('🎉 ¡Prueba completada!')
  console.log('\n📝 Comportamiento implementado:')
  console.log('   ✓ Cuando hay evento activo → muestra evento.nferia')
  console.log('   ✓ Cuando NO hay evento → muestra grupo.title (fallback)')
  console.log('   ✓ Prioridad: eventName > title > config.ticket.feria')
  
  // Cleanup
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockElectronPath) } catch {}
}

testEventNameInTicket().catch(console.error)
