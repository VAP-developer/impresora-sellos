/**
 * Property-based tests for pdf-generator.ts
 *
 * Tests correctness Property 7 as defined in the design spec:
 *
 * Property 7: Generación correcta de PDFs por venta
 *
 * For any set of valid quantities, the system must generate exactly one stamp PDF
 * per each tariff/model combination with quantity > 0 (simple stamps generate one
 * single-page PDF per unit, tiras generate one 4-page PDF per unit). The total
 * number of print jobs is deterministic given the quantities.
 *
 * Validates: Requirements 6.1, 6.5, 6.6
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as fc from 'fast-check'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

// Mock the ImagesRepository to avoid SQLite dependency
vi.mock('../../database/repositories/images.repository', () => ({
  ImagesRepository: class MockImagesRepository {
    getByName(): { name: string; url: string } | null {
      return null
    }
  }
}))

import { generateSalePdfs } from '../pdf-generator'
import type { SaleQuantities, GeneratedPdf } from '../pdf-generator'
import { setTestFontsPath, setTestImagesPath } from '../stamp-renderer'
import type { AppConfig } from '../../../renderer/src/types/config'

// ─── Test setup ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, '../../../..')
const FONTS_PATH = join(PROJECT_ROOT, 'resources/fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources/images')

beforeAll(() => {
  setTestFontsPath(FONTS_PATH)
  setTestImagesPath(IMAGES_PATH)
})

afterAll(() => {
  setTestFontsPath(null)
  setTestImagesPath(null)
})


// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal valid AppConfig for testing PDF generation */
function createTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    ticket: {
      feria: 'Test Feria',
      lugar: 'Test Lugar',
      fecha: 'auto',
      hora: 'auto',
      titulo: 'Factura Simplificada',
      tituloCopia: 'COPIA Factura Simplificada',
      rollo1: 1500,
      rollo2: 1500,
      tickets: 450,
      limiteTickets: 450,
      limiteImporte: 399.99,
      empresa: 'Test Empresa S.A.',
      cif: 'A12345678',
      cp: '28001 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
      T1especial: 0,
      T2especial: 0,
      T3especial: 0,
      TEmod1: 'N',
      TEmod2: 'N',
      ImprimeCopiaTicket: 'N',
      ImprimeMasterTicket: 'N',
      ...overrides?.ticket
    },
    codigo: {
      modo: 'P',
      mes: 4,
      annio: '25',
      pais: 'ES',
      maquina: 'CH17',
      cliente: 1,
      producto: 1,
      ...overrides?.codigo
    },
    sello: {
      elperfil: 6,
      elnperfil: 'FERIA',
      elevento: 0,
      elnevento: 'Test Evento',
      feria: 'Test Feria',
      lugar: 'Test Lugar',
      modelo1: 'modelo1',
      modelo2: 'modelo2',
      modo: 1,
      nperfil1: 'Filatelia',
      nperfil2: 'Esporadicos',
      nperfil3: 'SPDE',
      nperfil4: '',
      nperfil5: 'Abono/Envio',
      nperfil6: 'FERIA',
      eventos: [
        {
          nevento: 'Test Evento',
          nferia: 'Test Feria',
          nlugar: 'Test Lugar',
          motivoi: 'motivoIzq',
          motivod: 'motivoDer',
          fecha: '21-24 abril 2025',
          localidad: 'Madrid'
        }
      ],
      ...overrides?.sello
    },
    precios: {
      tarifaA: 0.5,
      tarifaA2: 0.6,
      tarifaB: 1.25,
      tarifaC: 1.35,
      tarifaTA: 2.0,
      tarifaT4: 3.7,
      ...overrides?.precios
    }
  }
}

/** Create a zero-quantity SaleQuantities object */
function emptyQuantities(): SaleQuantities {
  return {
    tarifaAS1: 0,
    tarifaA2S1: 0,
    tarifaBS1: 0,
    tarifaCS1: 0,
    tarifaAT1: 0,
    tarifa4T1: 0,
    tarifaAS2: 0,
    tarifaA2S2: 0,
    tarifaBS2: 0,
    tarifaCS2: 0,
    tarifaAT2: 0,
    tarifa4T2: 0
  }
}

// ─── Arbitraries (data generators) ─────────────────────────────────────────────

/** Generate a small non-negative quantity (0-3) to keep tests fast */
const arbSmallQty = fc.integer({ min: 0, max: 3 })

/** Generate a single tariff quantity (0-5) */
const arbQty = fc.integer({ min: 0, max: 5 })

/** Generate a full SaleQuantities with small values */
const arbQuantities: fc.Arbitrary<SaleQuantities> = fc.record({
  tarifaAS1: arbSmallQty,
  tarifaA2S1: arbSmallQty,
  tarifaBS1: arbSmallQty,
  tarifaCS1: arbSmallQty,
  tarifaAT1: arbSmallQty,
  tarifa4T1: arbSmallQty,
  tarifaAS2: arbSmallQty,
  tarifaA2S2: arbSmallQty,
  tarifaBS2: arbSmallQty,
  tarifaCS2: arbSmallQty,
  tarifaAT2: arbSmallQty,
  tarifa4T2: arbSmallQty
})

/** Generate quantities where at least one field is > 0 */
const arbNonEmptyQuantities: fc.Arbitrary<SaleQuantities> = arbQuantities.filter((q) => {
  return Object.values(q).some((v) => v > 0)
})

/** Simple stamp keys (non-tira) */
const SIMPLE_KEYS: (keyof SaleQuantities)[] = [
  'tarifaAS1',
  'tarifaA2S1',
  'tarifaBS1',
  'tarifaCS1',
  'tarifaAS2',
  'tarifaA2S2',
  'tarifaBS2',
  'tarifaCS2'
]

/** Tira keys */
const TIRA_KEYS: (keyof SaleQuantities)[] = [
  'tarifaAT1',
  'tarifa4T1',
  'tarifaAT2',
  'tarifa4T2'
]

/** Model 1 keys */
const MODEL1_KEYS: (keyof SaleQuantities)[] = [
  'tarifaAS1',
  'tarifaA2S1',
  'tarifaBS1',
  'tarifaCS1',
  'tarifaAT1',
  'tarifa4T1'
]

/** Model 2 keys */
const MODEL2_KEYS: (keyof SaleQuantities)[] = [
  'tarifaAS2',
  'tarifaA2S2',
  'tarifaBS2',
  'tarifaCS2',
  'tarifaAT2',
  'tarifa4T2'
]


// ─── Property 7: Generación correcta de PDFs por venta ─────────────────────────

describe('Property 7: Generación correcta de PDFs por venta', () => {
  const config = createTestConfig()

  describe('Stamp PDF count is deterministic and correct', () => {
    it('generates zero stamp PDFs when all quantities are zero', async () => {
      const quantities = emptyQuantities()
      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const stampPdfs = result.pdfs.filter(
        (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira'
      )
      expect(stampPdfs).toHaveLength(0)
      expect(result.stampCount).toBe(0)
    })

    it('for simple tariffs: generates exactly qty PDFs per tariff/model with qty > 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tarifaAS1: arbQty,
            tarifaA2S1: arbQty,
            tarifaBS1: arbQty,
            tarifaCS1: arbQty,
            tarifaAT1: fc.constant(0),
            tarifa4T1: fc.constant(0),
            tarifaAS2: arbQty,
            tarifaA2S2: arbQty,
            tarifaBS2: arbQty,
            tarifaCS2: arbQty,
            tarifaAT2: fc.constant(0),
            tarifa4T2: fc.constant(0)
          }),
          async (quantities: SaleQuantities) => {
            const result = await generateSalePdfs(config, quantities, 'FERIA')

            const simplePdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_simple')

            // Total simple PDFs = sum of all simple quantities
            const expectedSimpleCount = SIMPLE_KEYS.reduce(
              (sum, key) => sum + quantities[key],
              0
            )
            expect(simplePdfs).toHaveLength(expectedSimpleCount)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('for tiras: generates exactly qty PDFs per tira tariff with qty > 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tarifaAS1: fc.constant(0),
            tarifaA2S1: fc.constant(0),
            tarifaBS1: fc.constant(0),
            tarifaCS1: fc.constant(0),
            tarifaAT1: arbSmallQty,
            tarifa4T1: arbSmallQty,
            tarifaAS2: fc.constant(0),
            tarifaA2S2: fc.constant(0),
            tarifaBS2: fc.constant(0),
            tarifaCS2: fc.constant(0),
            tarifaAT2: arbSmallQty,
            tarifa4T2: arbSmallQty
          }),
          async (quantities: SaleQuantities) => {
            const result = await generateSalePdfs(config, quantities, 'FERIA')

            const tiraPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_tira')

            // Total tira PDFs = sum of all tira quantities
            const expectedTiraCount = TIRA_KEYS.reduce(
              (sum, key) => sum + quantities[key],
              0
            )
            expect(tiraPdfs).toHaveLength(expectedTiraCount)
          }
        ),
        { numRuns: 20 }
      )
    }, 30000)

    it('total stamp PDFs = sum of simple quantities + sum of tira quantities (no especiales)', async () => {
      await fc.assert(
        fc.asyncProperty(arbQuantities, async (quantities: SaleQuantities) => {
          const result = await generateSalePdfs(config, quantities, 'FERIA')

          const stampPdfs = result.pdfs.filter(
            (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira'
          )

          const expectedTotal = Object.values(quantities).reduce((sum, v) => sum + v, 0)
          expect(stampPdfs).toHaveLength(expectedTotal)
          expect(result.stampCount).toBe(expectedTotal)
        }),
        { numRuns: 20 }
      )
    }, 30000)
  })

  describe('Each generated PDF is a valid PDF buffer', () => {
    it('all stamp PDFs start with %PDF- header', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const result = await generateSalePdfs(config, quantities, 'FERIA')

          const stampPdfs = result.pdfs.filter(
            (p) =>
              p.pdfType === 'stamp_simple' ||
              p.pdfType === 'stamp_tira' ||
              p.pdfType === 'stamp_especial'
          )

          for (const pdf of stampPdfs) {
            expect(pdf.buffer).toBeInstanceOf(Buffer)
            expect(pdf.buffer.length).toBeGreaterThan(0)
            expect(pdf.buffer.slice(0, 5).toString()).toBe('%PDF-')
          }
        }),
        { numRuns: 10 }
      )
    })

    it('all ticket PDFs start with %PDF- header', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const result = await generateSalePdfs(config, quantities, 'FERIA')

          const ticketPdfs = result.pdfs.filter(
            (p) =>
              p.pdfType === 'ticket' ||
              p.pdfType === 'ticket_caja' ||
              p.pdfType === 'ticket_master'
          )

          for (const pdf of ticketPdfs) {
            expect(pdf.buffer).toBeInstanceOf(Buffer)
            expect(pdf.buffer.length).toBeGreaterThan(0)
            expect(pdf.buffer.slice(0, 5).toString()).toBe('%PDF-')
          }
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Tiras generate exactly 4 pages per unit', () => {
    it('each tira PDF contains 4 page objects (4 stamps in one job)', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifaAT1: 1 // One tira
      }

      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const tiraPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_tira')
      expect(tiraPdfs).toHaveLength(1)

      // Count /Type /Page entries (excluding /Pages) in the PDF
      const pdfContent = tiraPdfs[0].buffer.toString('latin1')
      const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
      expect(pageMatches).not.toBeNull()
      expect(pageMatches!.length).toBe(4)
    })

    it('Tira 4 Tarifas also generates exactly 4 pages per unit', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifa4T2: 1 // One "tira 4 tarifas" on model 2
      }

      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const tiraPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_tira')
      expect(tiraPdfs).toHaveLength(1)

      const pdfContent = tiraPdfs[0].buffer.toString('latin1')
      const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
      expect(pageMatches).not.toBeNull()
      expect(pageMatches!.length).toBe(4)
    })

    it('multiple tiras generate multiple 4-page PDFs (one per unit)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (tiraCnt: number) => {
            const quantities: SaleQuantities = {
              ...emptyQuantities(),
              tarifaAT1: tiraCnt
            }

            const result = await generateSalePdfs(config, quantities, 'FERIA')

            const tiraPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_tira')
            expect(tiraPdfs).toHaveLength(tiraCnt)

            // Each PDF should have exactly 4 pages
            for (const pdf of tiraPdfs) {
              const pdfContent = pdf.buffer.toString('latin1')
              const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
              expect(pageMatches).not.toBeNull()
              expect(pageMatches!.length).toBe(4)
            }
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('Simple stamps generate exactly 1 page per PDF', () => {
    it('each simple stamp PDF contains exactly 1 page', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifaAS1: 1,
        tarifaBS2: 1
      }

      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const simplePdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_simple')
      expect(simplePdfs).toHaveLength(2)

      for (const pdf of simplePdfs) {
        const pdfContent = pdf.buffer.toString('latin1')
        const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
        expect(pageMatches).not.toBeNull()
        expect(pageMatches!.length).toBe(1)
      }
    })
  })

  describe('Printer routing is correct per model', () => {
    it('model 1 stamp PDFs target printer1', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tarifaAS1: arbQty,
            tarifaA2S1: arbQty,
            tarifaBS1: arbQty,
            tarifaCS1: arbQty,
            tarifaAT1: arbSmallQty,
            tarifa4T1: arbSmallQty,
            tarifaAS2: fc.constant(0),
            tarifaA2S2: fc.constant(0),
            tarifaBS2: fc.constant(0),
            tarifaCS2: fc.constant(0),
            tarifaAT2: fc.constant(0),
            tarifa4T2: fc.constant(0)
          }),
          async (quantities: SaleQuantities) => {
            const result = await generateSalePdfs(config, quantities, 'FERIA')

            const stampPdfs = result.pdfs.filter(
              (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira'
            )

            // All stamp PDFs for model 1 should go to printer1
            for (const pdf of stampPdfs) {
              expect(pdf.target).toBe('printer1')
            }
          }
        ),
        { numRuns: 15 }
      )
    })

    it('model 2 stamp PDFs target printer2', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tarifaAS1: fc.constant(0),
            tarifaA2S1: fc.constant(0),
            tarifaBS1: fc.constant(0),
            tarifaCS1: fc.constant(0),
            tarifaAT1: fc.constant(0),
            tarifa4T1: fc.constant(0),
            tarifaAS2: arbQty,
            tarifaA2S2: arbQty,
            tarifaBS2: arbQty,
            tarifaCS2: arbQty,
            tarifaAT2: arbSmallQty,
            tarifa4T2: arbSmallQty
          }),
          async (quantities: SaleQuantities) => {
            const result = await generateSalePdfs(config, quantities, 'FERIA')

            const stampPdfs = result.pdfs.filter(
              (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira'
            )

            // All stamp PDFs for model 2 should go to printer2
            for (const pdf of stampPdfs) {
              expect(pdf.target).toBe('printer2')
            }
          }
        ),
        { numRuns: 15 }
      )
    })

    it('ticket PDFs always target ticket printer', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const result = await generateSalePdfs(config, quantities, 'FERIA')

          const ticketPdfs = result.pdfs.filter(
            (p) =>
              p.pdfType === 'ticket' ||
              p.pdfType === 'ticket_caja' ||
              p.pdfType === 'ticket_master' ||
              p.pdfType === 'ticket_tira'
          )

          for (const pdf of ticketPdfs) {
            expect(pdf.target).toBe('ticket')
          }
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('Ticket generation per configuration', () => {
    it('generates exactly 1 main ticket when items exist and no copia/master configured', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const noExtrasConfig = createTestConfig({
            ticket: {
              ...createTestConfig().ticket,
              ImprimeCopiaTicket: 'N',
              ImprimeMasterTicket: 'N'
            }
          })

          const result = await generateSalePdfs(noExtrasConfig, quantities, 'FERIA')

          const ticketPdfs = result.pdfs.filter((p) => p.pdfType === 'ticket')
          expect(ticketPdfs).toHaveLength(1)

          // Per-tira tickets: one per tira unit
          const tiraTickets = result.pdfs.filter((p) => p.pdfType === 'ticket_tira')
          const totalTiras = quantities.tarifaAT1 + quantities.tarifaAT2 + quantities.tarifa4T1 + quantities.tarifa4T2
          expect(tiraTickets).toHaveLength(totalTiras)

          expect(result.ticketCount).toBe(1 + totalTiras)
        }),
        { numRuns: 10 }
      )
    }, 30000)

    it('generates main + copia tickets when ImprimeCopiaTicket = "S"', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const copiaConfig = createTestConfig({
            ticket: {
              ...createTestConfig().ticket,
              ImprimeCopiaTicket: 'S',
              ImprimeMasterTicket: 'N'
            }
          })

          const result = await generateSalePdfs(copiaConfig, quantities, 'FERIA')

          const mainTickets = result.pdfs.filter((p) => p.pdfType === 'ticket')
          const copiaTickets = result.pdfs.filter((p) => p.pdfType === 'ticket_caja')
          expect(mainTickets).toHaveLength(1)
          expect(copiaTickets).toHaveLength(1)

          const totalTiras = quantities.tarifaAT1 + quantities.tarifaAT2 + quantities.tarifa4T1 + quantities.tarifa4T2
          expect(result.ticketCount).toBe(2 + totalTiras)
        }),
        { numRuns: 10 }
      )
    }, 30000)

    it('generates main + master tickets when ImprimeMasterTicket = "S"', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const masterConfig = createTestConfig({
            ticket: {
              ...createTestConfig().ticket,
              ImprimeCopiaTicket: 'N',
              ImprimeMasterTicket: 'S'
            }
          })

          const result = await generateSalePdfs(masterConfig, quantities, 'FERIA')

          const mainTickets = result.pdfs.filter((p) => p.pdfType === 'ticket')
          const masterTickets = result.pdfs.filter((p) => p.pdfType === 'ticket_master')
          expect(mainTickets).toHaveLength(1)
          expect(masterTickets).toHaveLength(1)

          const totalTiras = quantities.tarifaAT1 + quantities.tarifaAT2 + quantities.tarifa4T1 + quantities.tarifa4T2
          expect(result.ticketCount).toBe(2 + totalTiras)
        }),
        { numRuns: 10 }
      )
    }, 30000)

    it('generates main + copia + master tickets when both are "S"', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const allConfig = createTestConfig({
            ticket: {
              ...createTestConfig().ticket,
              ImprimeCopiaTicket: 'S',
              ImprimeMasterTicket: 'S'
            }
          })

          const result = await generateSalePdfs(allConfig, quantities, 'FERIA')

          const mainTickets = result.pdfs.filter((p) => p.pdfType === 'ticket')
          const copiaTickets = result.pdfs.filter((p) => p.pdfType === 'ticket_caja')
          const masterTickets = result.pdfs.filter((p) => p.pdfType === 'ticket_master')
          expect(mainTickets).toHaveLength(1)
          expect(copiaTickets).toHaveLength(1)
          expect(masterTickets).toHaveLength(1)

          const totalTiras = quantities.tarifaAT1 + quantities.tarifaAT2 + quantities.tarifa4T1 + quantities.tarifa4T2
          expect(result.ticketCount).toBe(3 + totalTiras)
        }),
        { numRuns: 10 }
      )
    }, 30000)

    it('generates 0 tickets when all quantities are zero', async () => {
      const quantities = emptyQuantities()
      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const ticketPdfs = result.pdfs.filter(
        (p) =>
          p.pdfType === 'ticket' ||
          p.pdfType === 'ticket_caja' ||
          p.pdfType === 'ticket_master'
      )
      expect(ticketPdfs).toHaveLength(0)
      expect(result.ticketCount).toBe(0)
    })
  })

  describe('Determinism: same input always produces same output structure', () => {
    it('calling generateSalePdfs twice with same input produces same counts and types', async () => {
      await fc.assert(
        fc.asyncProperty(arbNonEmptyQuantities, async (quantities: SaleQuantities) => {
          const result1 = await generateSalePdfs(config, quantities, 'FERIA')
          const result2 = await generateSalePdfs(config, quantities, 'FERIA')

          expect(result1.stampCount).toBe(result2.stampCount)
          expect(result1.ticketCount).toBe(result2.ticketCount)
          expect(result1.pdfs.length).toBe(result2.pdfs.length)

          // Same structure (type and target) for each PDF in order
          for (let i = 0; i < result1.pdfs.length; i++) {
            expect(result1.pdfs[i].pdfType).toBe(result2.pdfs[i].pdfType)
            expect(result1.pdfs[i].target).toBe(result2.pdfs[i].target)
          }
        }),
        { numRuns: 10 }
      )
    }, 30000)
  })

  describe('Especial strips generation', () => {
    it('no especial strips when TEmod1="N" and TEmod2="N"', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifaAT1: 2,
        tarifaAT2: 2
      }

      const noEspecialConfig = createTestConfig({
        ticket: {
          ...createTestConfig().ticket,
          TEmod1: 'N',
          TEmod2: 'N',
          T1especial: 100,
          T2especial: 200,
          T3especial: 300
        }
      })

      const result = await generateSalePdfs(noEspecialConfig, quantities, 'FERIA')
      const especialPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_especial')
      expect(especialPdfs).toHaveLength(0)
    })

    it('generates especial strips for model 1 when TEmod1="S" and tiras present with non-zero prices', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifaAT1: 1 // has tiras on model 1
      }

      const especialConfig = createTestConfig({
        ticket: {
          ...createTestConfig().ticket,
          TEmod1: 'S',
          TEmod2: 'N',
          T1especial: 100,
          T2especial: 200,
          T3especial: 300
        }
      })

      const result = await generateSalePdfs(especialConfig, quantities, 'FERIA')
      const especialPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_especial')

      // 3 special prices configured, all > 0, so 3 especial strips for model 1
      expect(especialPdfs).toHaveLength(3)
      for (const pdf of especialPdfs) {
        expect(pdf.target).toBe('printer1')
      }
    })

    it('generates especial strips for model 2 when TEmod2="S" and tiras present with non-zero prices', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifa4T2: 1 // has tiras on model 2
      }

      const especialConfig = createTestConfig({
        ticket: {
          ...createTestConfig().ticket,
          TEmod1: 'N',
          TEmod2: 'S',
          T1especial: 50,
          T2especial: 0, // zero price → no strip for this one
          T3especial: 150
        }
      })

      const result = await generateSalePdfs(especialConfig, quantities, 'FERIA')
      const especialPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_especial')

      // Only T1 and T3 have non-zero prices → 2 especial strips for model 2
      expect(especialPdfs).toHaveLength(2)
      for (const pdf of especialPdfs) {
        expect(pdf.target).toBe('printer2')
      }
    })

    it('no especial strips when tiras are absent (even if TEmod="S")', async () => {
      const quantities: SaleQuantities = {
        ...emptyQuantities(),
        tarifaAS1: 3 // Only simple stamps, no tiras
      }

      const especialConfig = createTestConfig({
        ticket: {
          ...createTestConfig().ticket,
          TEmod1: 'S',
          TEmod2: 'S',
          T1especial: 100,
          T2especial: 200,
          T3especial: 300
        }
      })

      const result = await generateSalePdfs(especialConfig, quantities, 'FERIA')
      const especialPdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_especial')
      expect(especialPdfs).toHaveLength(0)
    })
  })

  describe('One PDF per tariff/model combination with qty > 0 (Req 6.6)', () => {
    it('generates independent PDFs for each tariff even at qty=1', async () => {
      const quantities: SaleQuantities = {
        tarifaAS1: 1,
        tarifaA2S1: 1,
        tarifaBS1: 1,
        tarifaCS1: 1,
        tarifaAT1: 0,
        tarifa4T1: 0,
        tarifaAS2: 1,
        tarifaA2S2: 1,
        tarifaBS2: 1,
        tarifaCS2: 1,
        tarifaAT2: 0,
        tarifa4T2: 0
      }

      const result = await generateSalePdfs(config, quantities, 'FERIA')

      const simplePdfs = result.pdfs.filter((p) => p.pdfType === 'stamp_simple')
      // 4 tariffs × 2 models = 8 PDFs
      expect(simplePdfs).toHaveLength(8)

      // 4 for printer1, 4 for printer2
      const printer1Pdfs = simplePdfs.filter((p) => p.target === 'printer1')
      const printer2Pdfs = simplePdfs.filter((p) => p.target === 'printer2')
      expect(printer1Pdfs).toHaveLength(4)
      expect(printer2Pdfs).toHaveLength(4)
    })
  })
})
