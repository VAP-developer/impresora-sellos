/**
 * @vitest-environment node
 *
 * Tests for ticket-renderer.ts
 *
 * Since pdfkit encodes text as glyph IDs when custom fonts are registered,
 * we can't easily search for plain text in the output. Tests verify:
 * - PDF validity (magic bytes %PDF-)
 * - Reasonable output size
 * - Functions don't throw errors for valid inputs
 * - Height calculations are correct
 * - formatClientId and formatPrice helpers
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))
import {
  genTicket,
  genTicketCaja,
  genTicketMaster,
  formatClientId,
  formatPrice,
  calcTicketHeight,
  calcTicketCajaHeight,
  TICKET_WIDTH_MM,
  TICKET_WIDTH,
  type GenTicketParams,
  type GenTicketCajaParams,
  type GenTicketMasterParams,
  type TicketItem,
  type TicketProduct
} from '../ticket-renderer'
import { setTestFontsPath, setTestImagesPath } from '../stamp-renderer'

// ─────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────

const fontsPath = join(__dirname, '../../../../resources/fonts')
const imagesPath = join(__dirname, '../../../../resources/images')

/** Standard product definitions matching legacy */
const testProductos: TicketProduct[] = [
  { idProducto: 'tarifaAS1', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' },
  { idProducto: 'tarifaA2S1', modo: 'S', precio: 0.6, nombre_ticket: 'Tarifa A2' },
  { idProducto: 'tarifaBS1', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa B' },
  { idProducto: 'tarifaCS1', modo: 'S', precio: 1.35, nombre_ticket: 'Tarifa C' },
  { idProducto: 'tarifaAT1', modo: 'T', precio: 2.0, nombre_ticket: 'Tarifa A Tira 4' },
  { idProducto: 'tarifa4T1', modo: 'T', precio: 3.7, nombre_ticket: 'Tira 4 Tarifas' },
  { idProducto: 'tarifaAS2', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' },
  { idProducto: 'tarifaA2S2', modo: 'S', precio: 0.6, nombre_ticket: 'Tarifa A2' },
  { idProducto: 'tarifaBS2', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa B' },
  { idProducto: 'tarifaCS2', modo: 'S', precio: 1.35, nombre_ticket: 'Tarifa C' },
  { idProducto: 'tarifaAT2', modo: 'T', precio: 2.0, nombre_ticket: 'Tarifa A Tira 4' },
  { idProducto: 'tarifa4T2', modo: 'T', precio: 3.7, nombre_ticket: 'Tira 4 Tarifas' }
]

/** Items with some quantities set */
const testItems: TicketItem[] = [
  { idProducto: 'tarifaAS1', cantidad: 2 },
  { idProducto: 'tarifaA2S1', cantidad: 0 },
  { idProducto: 'tarifaBS1', cantidad: 1 },
  { idProducto: 'tarifaCS1', cantidad: 0 },
  { idProducto: 'tarifaAT1', cantidad: 0 },
  { idProducto: 'tarifa4T1', cantidad: 0 },
  { idProducto: 'tarifaAS2', cantidad: 3 },
  { idProducto: 'tarifaA2S2', cantidad: 0 },
  { idProducto: 'tarifaBS2', cantidad: 0 },
  { idProducto: 'tarifaCS2', cantidad: 1 },
  { idProducto: 'tarifaAT2', cantidad: 0 },
  { idProducto: 'tarifa4T2', cantidad: 0 }
]

/** All items zero */
const emptyItems: TicketItem[] = testProductos.map((p) => ({
  idProducto: p.idProducto,
  cantidad: 0
}))

/** Single item */
const singleItem: TicketItem[] = testProductos.map((p, i) => ({
  idProducto: p.idProducto,
  cantidad: i === 0 ? 1 : 0
}))

function makeTicketParams(items: TicketItem[]): GenTicketParams {
  return {
    fechaTicket: '21/04/2025 10:30',
    modoTicket: 'Factura Simplificada',
    modelo1Ticket: 'Feria Madrid',
    modelo2Ticket: 'Feria Madrid 2',
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos: testProductos,
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor - Madrid',
    empresa: 'S.E. Correos y Telegrafos S.A., S.M.E.',
    cif: 'A83052407',
    cp: '28042 Madrid',
    l1: 'Exento de impuestos',
    l2: 'Objeto de coleccionismo',
    l3: 'No se admiten devoluciones'
  }
}

function makeCajaParams(items: TicketItem[]): GenTicketCajaParams {
  return {
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos: testProductos,
    feria: 'XLIX Feria Nacional Sello',
    modoTicket: 'COPIA Factura Simplificada',
    modelo1Ticket: 'Feria Madrid',
    modelo2Ticket: 'Feria Madrid 2'
  }
}

function makeMasterParams(items: TicketItem[]): GenTicketMasterParams {
  return {
    fechaTicket: '21/04/2025 10:30',
    modoTicket: '',
    modelo1Ticket: 'Feria Madrid',
    modelo2Ticket: 'Feria Madrid 2',
    items,
    idCliente: 42,
    nombreMaquina: 'CH17',
    productos: testProductos,
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor - Madrid',
    empresa: 'S.E. Correos y Telegrafos S.A., S.M.E.',
    cif: 'A83052407',
    cp: '28042 Madrid',
    l1: 'Exento de impuestos',
    l2: 'Objeto de coleccionismo',
    l3: 'No se admiten devoluciones'
  }
}

// ─────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────

beforeAll(() => {
  setTestFontsPath(fontsPath)
  setTestImagesPath(imagesPath)
})

// ─────────────────────────────────────────────
// Helper function tests
// ─────────────────────────────────────────────

describe('formatClientId', () => {
  it('pads single digit to 4 digits', () => {
    expect(formatClientId(1)).toBe('0001')
    expect(formatClientId(9)).toBe('0009')
  })

  it('pads double digit to 4 digits', () => {
    expect(formatClientId(10)).toBe('0010')
    expect(formatClientId(99)).toBe('0099')
  })

  it('pads triple digit to 4 digits', () => {
    expect(formatClientId(100)).toBe('0100')
    expect(formatClientId(999)).toBe('0999')
  })

  it('does not pad 4+ digits', () => {
    expect(formatClientId(1000)).toBe('1000')
    expect(formatClientId(9999)).toBe('9999')
    expect(formatClientId(10000)).toBe('10000')
  })

  it('handles zero', () => {
    expect(formatClientId(0)).toBe('0000')
  })
})

describe('formatPrice', () => {
  it('formats integer as 2 decimals with euro sign', () => {
    expect(formatPrice(5)).toBe('5.00€')
  })

  it('formats decimal prices correctly', () => {
    expect(formatPrice(0.5)).toBe('0.50€')
    expect(formatPrice(1.25)).toBe('1.25€')
    expect(formatPrice(31.05)).toBe('31.05€')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0.00€')
  })

  it('rounds to 2 decimal places', () => {
    // Note: 1.255 in IEEE 754 is actually 1.2549999... so toFixed(2) rounds down
    expect(formatPrice(1.256)).toBe('1.26€')
    expect(formatPrice(3.7)).toBe('3.70€')
  })
})

// ─────────────────────────────────────────────
// Height calculation tests
// ─────────────────────────────────────────────

describe('calcTicketHeight', () => {
  it('returns positive height for any number of items', () => {
    expect(calcTicketHeight(0)).toBeGreaterThan(0)
    expect(calcTicketHeight(1)).toBeGreaterThan(0)
    expect(calcTicketHeight(12)).toBeGreaterThan(0)
  })

  it('increases with more items', () => {
    const h1 = calcTicketHeight(1)
    const h5 = calcTicketHeight(5)
    const h12 = calcTicketHeight(12)
    expect(h5).toBeGreaterThan(h1)
    expect(h12).toBeGreaterThan(h5)
  })

  it('matches expected formula for known values', () => {
    // New formula: page_height = (62 + 3*nitems + 30) * mm
    // For nitems=4: (62 + 12 + 30) = 104mm
    const MM_TO_PT = 72 / 25.4
    const expected = 104 * MM_TO_PT
    expect(calcTicketHeight(4)).toBeCloseTo(expected, 1)
  })
})

describe('calcTicketCajaHeight', () => {
  it('returns positive height for any number of items', () => {
    expect(calcTicketCajaHeight(0)).toBeGreaterThan(0)
    expect(calcTicketCajaHeight(1)).toBeGreaterThan(0)
    expect(calcTicketCajaHeight(12)).toBeGreaterThan(0)
  })

  it('increases with more items', () => {
    const h1 = calcTicketCajaHeight(1)
    const h5 = calcTicketCajaHeight(5)
    expect(h5).toBeGreaterThan(h1)
  })
})

// ─────────────────────────────────────────────
// Constants tests
// ─────────────────────────────────────────────

describe('Constants', () => {
  it('ticket width is 78mm', () => {
    expect(TICKET_WIDTH_MM).toBe(78)
  })

  it('ticket width in points matches conversion', () => {
    const MM_TO_PT = 72 / 25.4
    expect(TICKET_WIDTH).toBeCloseTo(78 * MM_TO_PT, 2)
  })
})

// ─────────────────────────────────────────────
// genTicket tests
// ─────────────────────────────────────────────

describe('genTicket', () => {
  it('generates a valid PDF buffer with multiple items', async () => {
    const buffer = await genTicket(makeTicketParams(testItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with a single item', async () => {
    const buffer = await genTicket(makeTicketParams(singleItem))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with zero items', async () => {
    const buffer = await genTicket(makeTicketParams(emptyItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('produces larger PDF for more items', async () => {
    const bufferSingle = await genTicket(makeTicketParams(singleItem))
    const bufferMulti = await genTicket(makeTicketParams(testItems))
    expect(bufferMulti.length).toBeGreaterThan(bufferSingle.length)
  })

  it('handles special characters in text fields', async () => {
    const params = makeTicketParams(singleItem)
    params.feria = 'XLIX Fería Ñacional — Sello «2025»'
    params.empresa = 'Correos & Telégrafos™'
    const buffer = await genTicket(params)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('handles various profile modes', async () => {
    const params1 = makeTicketParams(testItems)
    params1.modoTicket = 'Filatelia de: Factura Simplificada'
    const buffer1 = await genTicket(params1)
    expect(buffer1.slice(0, 5).toString()).toBe('%PDF-')

    const params2 = makeTicketParams(testItems)
    params2.modoTicket = 'Protocolo de: Factura Simplificada'
    const buffer2 = await genTicket(params2)
    expect(buffer2.slice(0, 5).toString()).toBe('%PDF-')

    const params3 = makeTicketParams(testItems)
    params3.modoTicket = 'SPDE de: Factura Simplificada'
    const buffer3 = await genTicket(params3)
    expect(buffer3.slice(0, 5).toString()).toBe('%PDF-')
  })
})

// ─────────────────────────────────────────────
// genTicketCaja tests
// ─────────────────────────────────────────────

describe('genTicketCaja', () => {
  it('generates a valid PDF buffer with multiple items', async () => {
    const buffer = await genTicketCaja(makeCajaParams(testItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with a single item', async () => {
    const buffer = await genTicketCaja(makeCajaParams(singleItem))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with zero items', async () => {
    const buffer = await genTicketCaja(makeCajaParams(emptyItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('produces different output than genTicket for same items', async () => {
    const ticketBuf = await genTicket(makeTicketParams(testItems))
    const cajaBuf = await genTicketCaja(makeCajaParams(testItems))
    // Different lengths or content (they have different layouts)
    expect(ticketBuf.length).not.toBe(cajaBuf.length)
  })
})

// ─────────────────────────────────────────────
// genTicketMaster tests
// ─────────────────────────────────────────────

describe('genTicketMaster', () => {
  it('generates a valid PDF buffer with multiple items', async () => {
    const buffer = await genTicketMaster(makeMasterParams(testItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with a single item', async () => {
    const buffer = await genTicketMaster(makeMasterParams(singleItem))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF with zero items', async () => {
    const buffer = await genTicketMaster(makeMasterParams(emptyItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('produces different output than genTicket for same items', async () => {
    const ticketBuf = await genTicket(makeTicketParams(testItems))
    const masterBuf = await genTicketMaster(makeMasterParams(testItems))
    expect(ticketBuf.length).not.toBe(masterBuf.length)
  })
})

// ─────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles all items having quantity > 0 (12 items)', async () => {
    const allItems: TicketItem[] = testProductos.map((p) => ({
      idProducto: p.idProducto,
      cantidad: 5
    }))
    const buffer = await genTicket(makeTicketParams(allItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('handles large quantities', async () => {
    const largeItems: TicketItem[] = testProductos.map((p, i) => ({
      idProducto: p.idProducto,
      cantidad: i === 0 ? 9999 : 0
    }))
    const buffer = await genTicket(makeTicketParams(largeItems))
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('handles empty string text fields', async () => {
    const params = makeTicketParams(singleItem)
    params.feria = ''
    params.lugar = ''
    params.empresa = ''
    params.cif = ''
    params.cp = ''
    params.l1 = ''
    params.l2 = ''
    params.l3 = ''
    const buffer = await genTicket(params)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  it('handles client ID edge cases', async () => {
    const params1 = makeTicketParams(singleItem)
    params1.idCliente = 0
    const buffer1 = await genTicket(params1)
    expect(buffer1.slice(0, 5).toString()).toBe('%PDF-')

    const params2 = makeTicketParams(singleItem)
    params2.idCliente = 9999
    const buffer2 = await genTicket(params2)
    expect(buffer2.slice(0, 5).toString()).toBe('%PDF-')
  })
})
