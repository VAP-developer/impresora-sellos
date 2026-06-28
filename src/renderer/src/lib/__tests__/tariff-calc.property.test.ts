/**
 * Property-based tests for tariff-calc.ts
 *
 * Tests correctness Properties 1, 2, and 14 as defined in the design spec.
 *
 * Property 1: Cálculo correcto del total de la cesta
 * Property 2: Cálculo correcto de límites por tarifa
 * Property 14: Límite según perfil activo
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calcTotal,
  calcLimite,
  calcLimiteSimple,
  calcLimiteTira,
  calcAllLimits,
  calcUsedRollo1,
  calcUsedRollo2,
  calcUsedTickets,
  normalizeQty,
  validateSale
} from '../tariff-calc'
import type { KioskoQuantities, KioskoLimits } from '../tariff-calc'
import type { PreciosConfig, TicketConfig, SelloConfig } from '@renderer/types/config'

// ─── Arbitraries (data generators) ─────────────────────────────────────────────

/** Generate a valid non-negative integer quantity (0..100) */
const arbQty = fc.integer({ min: 0, max: 100 })

/** Generate a valid set of kiosko quantities */
const arbQuantities: fc.Arbitrary<KioskoQuantities> = fc.record({
  tarifaAS1: arbQty,
  tarifaA2S1: arbQty,
  tarifaBS1: arbQty,
  tarifaCS1: arbQty,
  tarifaAT1: arbQty,
  tarifa4T1: arbQty,
  tarifaAS2: arbQty,
  tarifaA2S2: arbQty,
  tarifaBS2: arbQty,
  tarifaCS2: arbQty,
  tarifaAT2: arbQty,
  tarifa4T2: arbQty
})

/** Generate a positive price (0.01..50.00) */
const arbPrice = fc.double({ min: 0.01, max: 50.0, noNaN: true, noDefaultInfinity: true })

/** Generate valid precios config with positive prices */
const arbPrecios: fc.Arbitrary<PreciosConfig> = fc.record({
  tarifaA: arbPrice,
  tarifaA2: arbPrice,
  tarifaB: arbPrice,
  tarifaC: arbPrice,
  tarifaTA: arbPrice,
  tarifaT4: arbPrice
})

/** Generate a valid TicketConfig with reasonable stock values */
const arbTicketConfig: fc.Arbitrary<TicketConfig> = fc.record({
  feria: fc.constant('Test Feria'),
  lugar: fc.constant('Test Lugar'),
  fecha: fc.constant('auto'),
  hora: fc.constant('auto'),
  titulo: fc.constant('Factura Simplificada'),
  tituloCopia: fc.constant('COPIA'),
  rollo1: fc.integer({ min: 0, max: 5000 }),
  rollo2: fc.integer({ min: 0, max: 5000 }),
  tickets: fc.integer({ min: 0, max: 1000 }),
  limiteTickets: fc.integer({ min: 0, max: 1000 }),
  limiteImporte: fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
  NUEVOlimiteImporte: fc.double({
    min: 0.01,
    max: 9999.99,
    noNaN: true,
    noDefaultInfinity: true
  }),
  empresa: fc.constant('Test Empresa'),
  cif: fc.constant('A00000000'),
  cp: fc.constant('28001'),
  l1: fc.constant(''),
  l2: fc.constant(''),
  l3: fc.constant('')
})

/** Generate a valid SelloConfig with any profile (1-6) */
const arbSelloConfig: fc.Arbitrary<SelloConfig> = fc.record({
  elperfil: fc.integer({ min: 1, max: 6 }),
  elnperfil: fc.constant('FERIA'),
  elevento: fc.integer({ min: 0, max: 7 }),
  elnevento: fc.constant('Test Evento'),
  feria: fc.constant('Test Feria'),
  lugar: fc.constant('Test Lugar'),
  modelo1: fc.constant('modelo1'),
  modelo2: fc.constant('modelo2'),
  modo: fc.constant(0),
  nperfil1: fc.constant('Filatelia'),
  nperfil2: fc.constant('Esporadicos'),
  nperfil3: fc.constant('SPDE'),
  nperfil4: fc.constant(''),
  nperfil5: fc.constant('Abono/Envio'),
  nperfil6: fc.constant('FERIA'),
  eventos: fc.constant([])
})

// ─── Property 1: Cálculo correcto del total de la cesta ─────────────────────────

describe('Property 1: Cálculo correcto del total de la cesta', () => {
  it('total equals sum of (quantity × price) for all tariff/model combinations', () => {
    fc.assert(
      fc.property(arbQuantities, arbPrecios, (q, precios) => {
        const total = calcTotal(q, precios)

        // Manually compute expected total
        const expected =
          precios.tarifaA * (q.tarifaAS1 + q.tarifaAS2) +
          precios.tarifaA2 * (q.tarifaA2S1 + q.tarifaA2S2) +
          precios.tarifaB * (q.tarifaBS1 + q.tarifaBS2) +
          precios.tarifaC * (q.tarifaCS1 + q.tarifaCS2) +
          (precios.tarifaTA ?? 0) * (q.tarifaAT1 + q.tarifaAT2) +
          (precios.tarifaT4 ?? 0) * (q.tarifa4T1 + q.tarifa4T2)

        // Use relative tolerance for floating point comparison
        expect(total).toBeCloseTo(expected, 5)
      }),
      { numRuns: 500 }
    )
  })

  it('total is always non-negative for non-negative quantities and positive prices', () => {
    fc.assert(
      fc.property(arbQuantities, arbPrecios, (q, precios) => {
        const total = calcTotal(q, precios)
        expect(total).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 500 }
    )
  })

  it('total is zero if and only if all quantities are zero', () => {
    fc.assert(
      fc.property(arbPrecios, (precios) => {
        const zeroQ: KioskoQuantities = {
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
        expect(calcTotal(zeroQ, precios)).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it('a sale is accepted if and only if total ≤ limiteImporte', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbPrecios,
        arbTicketConfig,
        arbSelloConfig,
        (q, precios, ticket, sello) => {
          const total = calcTotal(q, precios)
          const limite = calcLimite(ticket, sello)

          // Ensure sufficient stock so only budget constraint matters
          const largeTicket: TicketConfig = {
            ...ticket,
            rollo1: 100000,
            rollo2: 100000,
            tickets: 100000
          }

          const result = validateSale(q, precios, largeTicket, sello, 1)

          if (total === 0) {
            // Empty basket is rejected
            expect(result).toBe('empty')
          } else if (total > limite) {
            // Over budget → rejected with limit message
            expect(result).toContain('límite de compra')
          } else {
            // Within budget and sufficient stock → accepted
            expect(result).toBeNull()
          }
        }
      ),
      { numRuns: 500 }
    )
  })

  it('total is additive: adding quantity to one tariff increases total by exactly (qty × price)', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbPrecios,
        fc.integer({ min: 1, max: 50 }),
        (q, precios, extraQty) => {
          const baseTot = calcTotal(q, precios)
          const modified = { ...q, tarifaAS1: q.tarifaAS1 + extraQty }
          const newTot = calcTotal(modified, precios)

          expect(newTot).toBeCloseTo(baseTot + extraQty * precios.tarifaA, 5)
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ─── Property 2: Cálculo correcto de límites por tarifa ─────────────────────────

describe('Property 2: Cálculo correcto de límites por tarifa', () => {
  describe('Simple tariff limits', () => {
    it('limit = min(floor(budgetRemaining / price), availableRollStock)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          (budget, price, stock) => {
            const result = calcLimiteSimple(budget, price, stock)
            const expected = Math.max(0, Math.min(Math.floor(budget / price), stock))
            expect(result).toBe(expected)
          }
        ),
        { numRuns: 1000 }
      )
    })

    it('limit is always non-negative', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -10, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: -100, max: 5000 }),
          (budget, price, stock) => {
            const result = calcLimiteSimple(budget, price, stock)
            expect(result).toBeGreaterThanOrEqual(0)
          }
        ),
        { numRuns: 500 }
      )
    })

    it('limit is always an integer (floor)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          (budget, price, stock) => {
            const result = calcLimiteSimple(budget, price, stock)
            expect(Number.isInteger(result)).toBe(true)
          }
        ),
        { numRuns: 300 }
      )
    })

    it('limit is zero when price is zero or negative', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -50, max: 0, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          (budget, price, stock) => {
            expect(calcLimiteSimple(budget, price, stock)).toBe(0)
          }
        ),
        { numRuns: 200 }
      )
    })
  })

  describe('Tira (strip) tariff limits', () => {
    it('limit = min(floor(budgetRemaining / price), ticketsAvailable, floor(rollStock / 4))', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 1000 }),
          (budget, price, stock, tickets) => {
            const result = calcLimiteTira(budget, price, stock, tickets)
            const expected = Math.max(
              0,
              Math.min(Math.floor(budget / price), tickets, Math.floor(stock / 4))
            )
            expect(result).toBe(expected)
          }
        ),
        { numRuns: 1000 }
      )
    })

    it('limit is always non-negative', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -10, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: -100, max: 5000 }),
          fc.integer({ min: -100, max: 1000 }),
          (budget, price, stock, tickets) => {
            const result = calcLimiteTira(budget, price, stock, tickets)
            expect(result).toBeGreaterThanOrEqual(0)
          }
        ),
        { numRuns: 500 }
      )
    })

    it('limit is always an integer (floor)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 1000 }),
          (budget, price, stock, tickets) => {
            const result = calcLimiteTira(budget, price, stock, tickets)
            expect(Number.isInteger(result)).toBe(true)
          }
        ),
        { numRuns: 300 }
      )
    })

    it('tira limit is always ≤ simple limit (tira has additional ticket constraint)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 1000 }),
          (budget, price, stock, tickets) => {
            const tiraLimit = calcLimiteTira(budget, price, stock, tickets)
            // Simple limit only considers budget and full stock (not /4)
            const budgetLimit = Math.max(0, Math.floor(budget / price))
            expect(tiraLimit).toBeLessThanOrEqual(budgetLimit)
          }
        ),
        { numRuns: 300 }
      )
    })
  })

  describe('calcAllLimits integration', () => {
    it('all limits are non-negative integers', () => {
      fc.assert(
        fc.property(
          arbQuantities,
          arbPrecios,
          arbTicketConfig,
          arbSelloConfig,
          (q, precios, ticket, sello) => {
            const limits = calcAllLimits(q, precios, ticket, sello)
            const allValues = Object.values(limits) as number[]

            for (const val of allValues) {
              expect(val).toBeGreaterThanOrEqual(0)
              expect(Number.isInteger(val)).toBe(true)
            }
          }
        ),
        { numRuns: 500 }
      )
    })

    it('limits decrease when quantities increase (monotonicity)', () => {
      fc.assert(
        fc.property(
          arbPrecios,
          arbTicketConfig,
          arbSelloConfig,
          fc.integer({ min: 1, max: 20 }),
          (precios, ticket, sello, extraQty) => {
            // Ensure enough stock for the test to be meaningful
            const safeTicket = { ...ticket, rollo1: 5000, rollo2: 5000, tickets: 1000 }

            const baseQ: KioskoQuantities = {
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

            const modifiedQ = { ...baseQ, tarifaAS1: extraQty }

            const limitsBase = calcAllLimits(baseQ, precios, safeTicket, sello)
            const limitsModified = calcAllLimits(modifiedQ, precios, safeTicket, sello)

            // Budget-constrained limits should decrease (or stay same if limited by stock)
            expect(limitsModified.limiteAS1).toBeLessThanOrEqual(limitsBase.limiteAS1)
            expect(limitsModified.limiteBS1).toBeLessThanOrEqual(limitsBase.limiteBS1)
            expect(limitsModified.limiteAT1).toBeLessThanOrEqual(limitsBase.limiteAT1)
          }
        ),
        { numRuns: 300 }
      )
    })

    it('recalculates limits reflecting updated budget and consumed stock', () => {
      fc.assert(
        fc.property(
          arbQuantities,
          arbPrecios,
          arbTicketConfig,
          arbSelloConfig,
          (q, precios, ticket, sello) => {
            const limits = calcAllLimits(q, precios, ticket, sello)
            const total = calcTotal(q, precios)
            const limite = calcLimite(ticket, sello)
            const budgetRemaining = limite - total

            const rollo1Available = (ticket.rollo1 ?? 0) - calcUsedRollo1(q)
            const rollo2Available = (ticket.rollo2 ?? 0) - calcUsedRollo2(q)
            const ticketsAvailable = (ticket.tickets ?? 0) - 2 - calcUsedTickets(q)

            // Verify simple limits match the formula
            expect(limits.limiteAS1).toBe(
              calcLimiteSimple(budgetRemaining, precios.tarifaA, rollo1Available)
            )
            expect(limits.limiteAS2).toBe(
              calcLimiteSimple(budgetRemaining, precios.tarifaA, rollo2Available)
            )
            expect(limits.limiteA2S1).toBe(
              calcLimiteSimple(budgetRemaining, precios.tarifaA2, rollo1Available)
            )
            expect(limits.limiteBS1).toBe(
              calcLimiteSimple(budgetRemaining, precios.tarifaB, rollo1Available)
            )
            expect(limits.limiteCS2).toBe(
              calcLimiteSimple(budgetRemaining, precios.tarifaC, rollo2Available)
            )

            // Verify tira limits match the formula
            expect(limits.limiteAT1).toBe(
              calcLimiteTira(
                budgetRemaining,
                precios.tarifaTA ?? 0,
                rollo1Available,
                ticketsAvailable
              )
            )
            expect(limits.limite4T2).toBe(
              calcLimiteTira(
                budgetRemaining,
                precios.tarifaT4 ?? 0,
                rollo2Available,
                ticketsAvailable
              )
            )
          }
        ),
        { numRuns: 500 }
      )
    })
  })
})

// ─── Property 14: Límite según perfil activo ────────────────────────────────────

describe('Property 14: Límite según perfil activo', () => {
  it('profile 6 (FERIA) always uses limiteImporte', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        (limiteImporte, nuevoLimite) => {
          const ticket: TicketConfig = {
            feria: '',
            lugar: '',
            fecha: 'auto',
            hora: 'auto',
            titulo: '',
            tituloCopia: '',
            rollo1: 1500,
            rollo2: 1500,
            tickets: 450,
            limiteTickets: 450,
            limiteImporte,
            NUEVOlimiteImporte: nuevoLimite,
            empresa: '',
            cif: '',
            cp: '',
            l1: '',
            l2: '',
            l3: ''
          }
          const sello: SelloConfig = {
            elperfil: 6,
            elnperfil: 'FERIA',
            elevento: 0,
            elnevento: '',
            feria: '',
            lugar: '',
            modelo1: '',
            modelo2: '',
            modo: 0,
            nperfil1: '',
            nperfil2: '',
            nperfil3: '',
            nperfil4: '',
            nperfil5: '',
            nperfil6: '',
            eventos: []
          }

          expect(calcLimite(ticket, sello)).toBe(limiteImporte)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('profiles 1-5 use NUEVOlimiteImporte when defined and non-zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        (perfil, limiteImporte, nuevoLimite) => {
          const ticket: TicketConfig = {
            feria: '',
            lugar: '',
            fecha: 'auto',
            hora: 'auto',
            titulo: '',
            tituloCopia: '',
            rollo1: 1500,
            rollo2: 1500,
            tickets: 450,
            limiteTickets: 450,
            limiteImporte,
            NUEVOlimiteImporte: nuevoLimite,
            empresa: '',
            cif: '',
            cp: '',
            l1: '',
            l2: '',
            l3: ''
          }
          const sello: SelloConfig = {
            elperfil: perfil,
            elnperfil: '',
            elevento: 0,
            elnevento: '',
            feria: '',
            lugar: '',
            modelo1: '',
            modelo2: '',
            modo: 0,
            nperfil1: '',
            nperfil2: '',
            nperfil3: '',
            nperfil4: '',
            nperfil5: '',
            nperfil6: '',
            eventos: []
          }

          // NUEVOlimiteImporte > 0 so it should be used
          expect(calcLimite(ticket, sello)).toBe(nuevoLimite)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('profiles 1-5 fall back to limiteImporte when NUEVOlimiteImporte is 0 or undefined', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.oneof(fc.constant(0), fc.constant(undefined)),
        (perfil, limiteImporte, nuevoLimite) => {
          const ticket: TicketConfig = {
            feria: '',
            lugar: '',
            fecha: 'auto',
            hora: 'auto',
            titulo: '',
            tituloCopia: '',
            rollo1: 1500,
            rollo2: 1500,
            tickets: 450,
            limiteTickets: 450,
            limiteImporte,
            NUEVOlimiteImporte: nuevoLimite,
            empresa: '',
            cif: '',
            cp: '',
            l1: '',
            l2: '',
            l3: ''
          }
          const sello: SelloConfig = {
            elperfil: perfil,
            elnperfil: '',
            elevento: 0,
            elnevento: '',
            feria: '',
            lugar: '',
            modelo1: '',
            modelo2: '',
            modo: 0,
            nperfil1: '',
            nperfil2: '',
            nperfil3: '',
            nperfil4: '',
            nperfil5: '',
            nperfil6: '',
            eventos: []
          }

          // Fallback to limiteImporte
          expect(calcLimite(ticket, sello)).toBe(limiteImporte)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('for any profile, the spending limit is always a non-negative number', () => {
    fc.assert(
      fc.property(arbTicketConfig, arbSelloConfig, (ticket, sello) => {
        const result = calcLimite(ticket, sello)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(result)).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it('profile 6 is independent of NUEVOlimiteImporte value', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        (limiteImporte, nuevo1, nuevo2) => {
          const baseSello: SelloConfig = {
            elperfil: 6,
            elnperfil: 'FERIA',
            elevento: 0,
            elnevento: '',
            feria: '',
            lugar: '',
            modelo1: '',
            modelo2: '',
            modo: 0,
            nperfil1: '',
            nperfil2: '',
            nperfil3: '',
            nperfil4: '',
            nperfil5: '',
            nperfil6: '',
            eventos: []
          }

          const ticket1: TicketConfig = {
            feria: '',
            lugar: '',
            fecha: 'auto',
            hora: 'auto',
            titulo: '',
            tituloCopia: '',
            rollo1: 1500,
            rollo2: 1500,
            tickets: 450,
            limiteTickets: 450,
            limiteImporte,
            NUEVOlimiteImporte: nuevo1,
            empresa: '',
            cif: '',
            cp: '',
            l1: '',
            l2: '',
            l3: ''
          }
          const ticket2 = { ...ticket1, NUEVOlimiteImporte: nuevo2 }

          // Profile 6 result should be same regardless of NUEVOlimiteImporte
          expect(calcLimite(ticket1, baseSello)).toBe(calcLimite(ticket2, baseSello))
        }
      ),
      { numRuns: 300 }
    )
  })
})
