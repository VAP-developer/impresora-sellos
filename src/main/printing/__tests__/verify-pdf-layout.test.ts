/**
 * verify-pdf-layout.test.ts
 *
 * Task 11.10: Visual PDF Layout Verification
 *
 * This test generates sample PDFs and writes them to `out/pdf-samples/`
 * for manual visual inspection. Each test verifies basic validity of the
 * generated PDF and saves it to disk.
 *
 * Run with:
 *   npx vitest run src/main/printing/__tests__/verify-pdf-layout.test.ts
 *
 * Then open the generated PDFs in a PDF viewer to verify:
 *   - Stamp dimensions: 55mm × 25mm
 *   - Ticket width: 78mm, variable height
 *   - Font placement matches legacy layout
 *   - Text positioning is correct
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { vi } from 'vitest'

// Mock @electron-toolkit/utils to avoid Electron dependency
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  setTestFontsPath,
  setTestImagesPath,
  renderStamp,
  renderStampBlank,
  renderStampE1,
  renderStampE2,
  renderStampE3,
  renderStampE4,
  renderStampMultiPage,
  renderStampEspecialStrip,
  STAMP_WIDTH_MM,
  STAMP_HEIGHT_MM
} from '../stamp-renderer'

import { genTicket, genTicketCaja, genTicketMaster, TICKET_WIDTH_MM } from '../ticket-renderer'

// ─────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..')
const OUTPUT_DIR = join(PROJECT_ROOT, 'out', 'pdf-samples')
const FONTS_PATH = join(PROJECT_ROOT, 'resources', 'fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources', 'images')

function savePdf(filename: string, buffer: Buffer): string {
  const filepath = join(OUTPUT_DIR, filename)
  writeFileSync(filepath, buffer)
  return filepath
}

// ─────────────────────────────────────────────
// Sample Data
// ─────────────────────────────────────────────

const SAMPLE_CODE = 'P4ES25 CH17-0042-001'
const SAMPLE_TARIFA = 'Tarifa A  0,50'
const SAMPLE_FECHA = '21-24 abril 2025'
const SAMPLE_EVENTO = 'Madrid'

const SAMPLE_TICKET_ITEMS = [
  { idProducto: 'AS1', cantidad: 3 },
  { idProducto: 'A2S1', cantidad: 1 },
  { idProducto: 'BS1', cantidad: 2 },
  { idProducto: 'CS1', cantidad: 0 },
  { idProducto: 'AT1', cantidad: 1 },
  { idProducto: '4T1', cantidad: 0 },
  { idProducto: 'AS2', cantidad: 2 },
  { idProducto: 'A2S2', cantidad: 0 },
  { idProducto: 'BS2', cantidad: 1 },
  { idProducto: 'CS2', cantidad: 1 },
  { idProducto: 'AT2', cantidad: 0 },
  { idProducto: '4T2', cantidad: 0 }
]

const SAMPLE_PRODUCTS = [
  { idProducto: 'AS1', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' },
  { idProducto: 'A2S1', modo: 'S', precio: 0.6, nombre_ticket: 'Tarifa A2' },
  { idProducto: 'BS1', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa B' },
  { idProducto: 'CS1', modo: 'S', precio: 1.35, nombre_ticket: 'Tarifa C' },
  { idProducto: 'AT1', modo: 'T', precio: 2.0, nombre_ticket: 'Tarifa A Tira 4' },
  { idProducto: '4T1', modo: 'T', precio: 3.7, nombre_ticket: 'Tira de 4 Tarifas' },
  { idProducto: 'AS2', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' },
  { idProducto: 'A2S2', modo: 'S', precio: 0.6, nombre_ticket: 'Tarifa A2' },
  { idProducto: 'BS2', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa B' },
  { idProducto: 'CS2', modo: 'S', precio: 1.35, nombre_ticket: 'Tarifa C' },
  { idProducto: 'AT2', modo: 'T', precio: 2.0, nombre_ticket: 'Tarifa A Tira 4' },
  { idProducto: '4T2', modo: 'T', precio: 3.7, nombre_ticket: 'Tira de 4 Tarifas' }
]

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Visual PDF Layout Verification (Task 11.10)', () => {
  beforeAll(() => {
    // Configure resource paths
    setTestFontsPath(FONTS_PATH)
    setTestImagesPath(IMAGES_PATH)

    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  })

  describe('Stamp Labels (55×25mm)', () => {
    it('generates stamp without background image', async () => {
      const buffer = await renderStamp({
        tarifa: SAMPLE_TARIFA,
        fecha: SAMPLE_FECHA,
        evento: SAMPLE_EVENTO,
        codigo: SAMPLE_CODE,
        backgroundImage: null
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(500)

      const path = savePdf('01-stamp-no-background.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — ${STAMP_WIDTH_MM}×${STAMP_HEIGHT_MM}mm`)
    })

    it('generates stamp with Tarifa B text', async () => {
      const buffer = await renderStamp({
        tarifa: 'Tarifa B  1,25',
        fecha: '14-17 mayo 2025',
        evento: 'Barcelona',
        codigo: 'P5ES25 VA01-0123-002',
        backgroundImage: null
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('02-stamp-tarifa-b.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes)`)
    })

    it('generates stamp with Tarifa C (longer texts)', async () => {
      const buffer = await renderStamp({
        tarifa: 'Tarifa C  1,35',
        fecha: '5-8 junio 2025',
        evento: 'Sevilla',
        codigo: 'P6ES25 PM01-0999-003',
        backgroundImage: null
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('03-stamp-tarifa-c.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes)`)
    })

    it('generates blank/mdcc mode stamp', async () => {
      const buffer = await renderStampBlank({
        tarifa: 'Tarifa A2  0,60',
        fecha: '1-3 julio 2025',
        evento: 'Zaragoza',
        codigo: 'F7ES25 MD25-0001-001',
        backgroundImage: null
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('04-stamp-blank-mdcc.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — modo MDCC (sin fondo motivo)`)
    })

    it('generates multi-page tira de 4 tarifas', async () => {
      const stamps = [
        { tarifa: 'Tarifa A  0,50', fecha: SAMPLE_FECHA, evento: SAMPLE_EVENTO, codigo: 'P4ES25 CH17-0042-001', backgroundImage: null },
        { tarifa: 'Tarifa A2  0,60', fecha: SAMPLE_FECHA, evento: SAMPLE_EVENTO, codigo: 'P4ES25 CH17-0042-002', backgroundImage: null },
        { tarifa: 'Tarifa B  1,25', fecha: SAMPLE_FECHA, evento: SAMPLE_EVENTO, codigo: 'P4ES25 CH17-0042-003', backgroundImage: null },
        { tarifa: 'Tarifa C  1,35', fecha: SAMPLE_FECHA, evento: SAMPLE_EVENTO, codigo: 'P4ES25 CH17-0042-004', backgroundImage: null }
      ]

      const buffer = await renderStampMultiPage(stamps)

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(2000) // Multi-page should be larger
      const path = savePdf('05-stamp-tira-4-tarifas.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — 4 páginas`)
    })

    it('generates tira de 4 (Tarifa A same tariff)', async () => {
      const stamps = Array.from({ length: 4 }, (_, i) => ({
        tarifa: 'Tarifa A  0,50',
        fecha: SAMPLE_FECHA,
        evento: SAMPLE_EVENTO,
        codigo: `P4ES25 CH17-0042-${String(i + 1).padStart(3, '0')}`,
        backgroundImage: null
      }))

      const buffer = await renderStampMultiPage(stamps)

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('06-stamp-tira-a-4-iguales.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — 4 páginas Tarifa A`)
    })

    it('generates special strip E1', async () => {
      const buffer = await renderStampE1({ codigo: SAMPLE_CODE, especial: '  -E' })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('07-stamp-especial-e1.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — solo código + sufijo`)
    })

    it('generates special strip E2 (with tarifa)', async () => {
      const buffer = await renderStampE2({ codigo: SAMPLE_CODE, especial: '  -E', tarifa: 'Tarifa A3' })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('08-stamp-especial-e2.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — tarifa + código + sufijo`)
    })

    it('generates special strip E3 (with tarifa)', async () => {
      const buffer = await renderStampE3({ codigo: SAMPLE_CODE, especial: '  -E', tarifa: 'Tarifa A3' })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('09-stamp-especial-e3.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — tarifa + código + sufijo`)
    })

    it('generates special strip E4', async () => {
      const buffer = await renderStampE4({ codigo: SAMPLE_CODE, especial: '  -E' })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('10-stamp-especial-e4.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — solo código + sufijo`)
    })

    it('generates full special strip (E1+E2+E3+E4 combined)', async () => {
      const codigos: [string, string, string, string] = [
        'P4ES25 CH17-0042-001',
        'P4ES25 CH17-0042-002',
        'P4ES25 CH17-0042-003',
        'P4ES25 CH17-0042-004'
      ]

      const buffer = await renderStampEspecialStrip(codigos, '  -E', 'Tarifa A3')

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(2000)
      const path = savePdf('11-stamp-tira-especial-completa.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — 4 páginas especial`)
    })
  })

  describe('Tickets (78mm × variable height)', () => {
    it('generates main ticket (Factura Simplificada)', async () => {
      const buffer = await genTicket({
        fechaTicket: '21/04/2025 10:30',
        modoTicket: 'Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: SAMPLE_TICKET_ITEMS,
        idCliente: 42,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(1000)
      const path = savePdf('12-ticket-principal.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — ${TICKET_WIDTH_MM}mm ancho`)
    })

    it('generates ticket with Filatelia profile title', async () => {
      const buffer = await genTicket({
        fechaTicket: '21/04/2025 11:15',
        modoTicket: 'Filatelia de: Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: SAMPLE_TICKET_ITEMS,
        idCliente: 43,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('13-ticket-filatelia.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — perfil Filatelia`)
    })

    it('generates ticket with Protocolo profile title', async () => {
      const buffer = await genTicket({
        fechaTicket: '21/04/2025 12:00',
        modoTicket: 'Protocolo de: Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: [
          { idProducto: 'AS1', cantidad: 5 },
          { idProducto: 'BS1', cantidad: 3 },
          ...SAMPLE_TICKET_ITEMS.slice(2).map((i) => ({ ...i, cantidad: 0 }))
        ],
        idCliente: 44,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('14-ticket-protocolo.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — perfil Protocolo`)
    })

    it('generates ticket caja (copy for cash register)', async () => {
      const buffer = await genTicketCaja({
        items: SAMPLE_TICKET_ITEMS,
        idCliente: 42,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        modoTicket: 'COPIA Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(1000)
      const path = savePdf('15-ticket-caja-copia.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — copia para caja`)
    })

    it('generates ticket master set', async () => {
      const buffer = await genTicketMaster({
        fechaTicket: '21/04/2025 10:30',
        modoTicket: 'Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: SAMPLE_TICKET_ITEMS,
        idCliente: 42,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(1000)
      const path = savePdf('16-ticket-master-set.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — master set con precio fijo 31.05€`)
    })

    it('generates minimal ticket (only 2 items)', async () => {
      const buffer = await genTicket({
        fechaTicket: '22/04/2025 09:00',
        modoTicket: 'Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: [
          { idProducto: 'AS1', cantidad: 1 },
          { idProducto: 'A2S1', cantidad: 0 },
          { idProducto: 'BS1', cantidad: 0 },
          { idProducto: 'CS1', cantidad: 0 },
          { idProducto: 'AT1', cantidad: 0 },
          { idProducto: '4T1', cantidad: 0 },
          { idProducto: 'AS2', cantidad: 1 },
          { idProducto: 'A2S2', cantidad: 0 },
          { idProducto: 'BS2', cantidad: 0 },
          { idProducto: 'CS2', cantidad: 0 },
          { idProducto: 'AT2', cantidad: 0 },
          { idProducto: '4T2', cantidad: 0 }
        ],
        idCliente: 1,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('17-ticket-minimal-2-items.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — altura mínima`)
    })

    it('generates large ticket (all items with quantity)', async () => {
      const buffer = await genTicket({
        fechaTicket: '22/04/2025 15:45',
        modoTicket: 'SPDE de: Factura Simplificada',
        modelo1Ticket: 'Feria Madrid',
        modelo2Ticket: 'Feria Madrid 2',
        items: [
          { idProducto: 'AS1', cantidad: 5 },
          { idProducto: 'A2S1', cantidad: 3 },
          { idProducto: 'BS1', cantidad: 2 },
          { idProducto: 'CS1', cantidad: 1 },
          { idProducto: 'AT1', cantidad: 2 },
          { idProducto: '4T1', cantidad: 1 },
          { idProducto: 'AS2', cantidad: 4 },
          { idProducto: 'A2S2', cantidad: 2 },
          { idProducto: 'BS2', cantidad: 3 },
          { idProducto: 'CS2', cantidad: 1 },
          { idProducto: 'AT2', cantidad: 1 },
          { idProducto: '4T2', cantidad: 1 }
        ],
        idCliente: 9999,
        nombreMaquina: 'CH17',
        productos: SAMPLE_PRODUCTS,
        feria: 'XLIX Feria Nacional del Sello',
        lugar: 'Plaza Mayor - Madrid',
        empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
        cif: 'A83052407',
        cp: '28042 Madrid',
        l1: 'Exento de impuestos',
        l2: 'Objeto de coleccionismo',
        l3: 'No se admiten devoluciones'
      })

      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      const path = savePdf('18-ticket-maximo-12-items.pdf', buffer)
      console.log(`    📄 ${path} (${buffer.length} bytes) — todos los items, sesión 9999`)
    })
  })

  describe('Summary', () => {
    it('prints verification checklist', () => {
      console.log('\n  ═══════════════════════════════════════════════════')
      console.log('  📋 CHECKLIST DE VERIFICACIÓN VISUAL')
      console.log('  ═══════════════════════════════════════════════════')
      console.log('')
      console.log(`  📂 Abrir PDFs en: ${OUTPUT_DIR}`)
      console.log('')
      console.log('  ETIQUETAS (01-11):')
      console.log('    ☐ Dimensiones de página: 55mm × 25mm')
      console.log('    ☐ Texto "Tarifa" en esquina inferior-izquierda, tamaño ~12pt')
      console.log('    ☐ Texto "Evento/Localidad" alineado a la derecha, tamaño ~9pt')
      console.log('    ☐ Texto "Fecha" debajo del evento, alineado derecha, ~9pt')
      console.log('    ☐ Texto "Código" en la parte inferior izquierda, tamaño ~6pt')
      console.log('    ☐ Los textos no se solapan entre sí')
      console.log('    ☐ Tiras multi-página: cada página es una etiqueta independiente')
      console.log('    ☐ Tiras especiales: código + sufijo "-E" visibles')
      console.log('')
      console.log('  TICKETS (12-18):')
      console.log('    ☐ Ancho fijo: 78mm')
      console.log('    ☐ Encabezado: feria + lugar + empresa + CIF + CP centrados')
      console.log('    ☐ Fecha formateada correctamente')
      console.log('    ☐ Título ("Factura Simplificada" / perfil) visible')
      console.log('    ☐ Items: nombre + cantidad + precio + importe')
      console.log('    ☐ Total correcto al pie (suma de importes)')
      console.log('    ☐ Sesión: "CH17 - Sesión: XXXX" con zero-padding')
      console.log('    ☐ Textos legales centrados al final')
      console.log('    ☐ Ticket caja: campos de pago manual + "PASE POR CAJA"')
      console.log('    ☐ Ticket master: "MASTER SET" + precio fijo 31.05€')
      console.log('    ☐ Altura variable según nº de items')
      console.log('')
      console.log('  ═══════════════════════════════════════════════════')

      // Always passes — this test just prints the checklist
      expect(true).toBe(true)
    })
  })
})
