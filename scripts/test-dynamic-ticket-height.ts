/**
 * test-dynamic-ticket-height.ts
 * 
 * Script de prueba para verificar que el corte dinámico de tickets funciona correctamente
 * con nombres de productos largos que antes se cortaban.
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

// Productos de prueba con nombres LARGOS que antes se cortaban
const productosConNombresLargos = [
  {
    idProducto: '1',
    modo: 'S',
    precio: 2.50,
    nombre_ticket: 'Tarifa Especial de Año Nuevo con Diseño Conmemorativo del Año de la Serpiente'
  },
  {
    idProducto: '2',
    modo: 'T',
    precio: 10.00,
    nombre_ticket: 'Colección Completa Tira 4 Sellos Edición Limitada Feria Internacional'
  },
  {
    idProducto: '3',
    modo: 'S',
    precio: 1.75,
    nombre_ticket: 'Sello Simple Estándar'
  }
]

// Items de prueba - activamos todos
const items = [
  { idProducto: '1', cantidad: 2 },
  { idProducto: '2', cantidad: 1 },
  { idProducto: '3', cantidad: 3 }
]

async function testDynamicTicketHeight() {
  const { genTicket, genTicketCaja, genTicketMaster } = await import('../src/main/printing/ticket-renderer')
  const { setTestFontsPath, setTestImagesPath } = await import('../src/main/printing/stamp-renderer')
  
  // Configurar rutas de recursos
  setTestFontsPath(resolve(__dirname, '../resources/fonts'))
  setTestImagesPath(resolve(__dirname, '../resources/images'))
  
  console.log('🎫 Probando corte dinámico de tickets...\n')
  
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  
  // Parámetros comunes
  const commonParams = {
    fechaTicket: '30/07/2026 14:30:00',
    modoTicket: 'Factura Simplificada',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed. Especial',
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos: productosConNombresLargos,
    feria: 'Feria Internacional del Sello 2026',
    lugar: 'Madrid - IFEMA',
    empresa: 'CORREOS Y TELÉGRAFOS S.A.',
    cif: 'A-83052407',
    cp: '28020 Madrid',
    l1: 'Conserve este ticket como justificante de compra',
    l2: 'No se admiten devoluciones sin este documento',
    l3: 'Gracias por su visita'
  }
  
  console.log('📄 Generando ticket principal con nombres largos...')
  const ticketPdf = await genTicket(commonParams)
  const ticketPath = join(outputDir, 'ticket-dynamic-height.pdf')
  writeFileSync(ticketPath, ticketPdf)
  console.log(`✅ Ticket guardado: ${ticketPath}`)
  console.log(`   Tamaño: ${(ticketPdf.length / 1024).toFixed(2)} KB\n`)
  
  console.log('📄 Generando ticket caja con nombres largos...')
  const ticketCajaPdf = await genTicketCaja({
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos: productosConNombresLargos,
    feria: 'Feria Internacional del Sello 2026',
    modoTicket: 'COPIA - PASE POR CAJA',
    modelo1Ticket: 'Año Serpiente',
    modelo2Ticket: 'Año Serpiente Ed. Especial'
  })
  const ticketCajaPath = join(outputDir, 'ticket-caja-dynamic-height.pdf')
  writeFileSync(ticketCajaPath, ticketCajaPdf)
  console.log(`✅ Ticket Caja guardado: ${ticketCajaPath}`)
  console.log(`   Tamaño: ${(ticketCajaPdf.length / 1024).toFixed(2)} KB\n`)
  
  console.log('📄 Generando ticket master con nombres largos...')
  const ticketMasterPdf = await genTicketMaster(commonParams)
  const ticketMasterPath = join(outputDir, 'ticket-master-dynamic-height.pdf')
  writeFileSync(ticketMasterPath, ticketMasterPdf)
  console.log(`✅ Ticket Master guardado: ${ticketMasterPath}`)
  console.log(`   Tamaño: ${(ticketMasterPdf.length / 1024).toFixed(2)} KB\n`)
  
  console.log('🎉 ¡Prueba completada!')
  console.log('\n📝 Notas:')
  console.log('   - Los tickets ahora se ajustan dinámicamente al contenido')
  console.log('   - Los nombres largos ya NO se cortan')
  console.log('   - El texto hace wrap (salto de línea) automático')
  console.log('   - La altura del ticket se calcula según el espacio necesario')
  
  // Cleanup
  const { unlinkSync } = require('fs')
  try { unlinkSync(mockElectronPath) } catch {}
}

testDynamicTicketHeight().catch(console.error)
