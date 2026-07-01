/**
 * Property-based tests for roll decrement correctness (Property 5)
 *
 * Property 5: Decremento correcto de rollos
 *
 * For any set of quantities per tariff and model, the roll decrement must be:
 *   rollo_N -= (simples_modelo_N + 4 × tiras_modelo_N)
 *   tickets -= (total_tiras + 2)
 *
 * An attempt to sell more stamps than the available stock must be rejected.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import * as fc from 'fast-check'

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-test'),
    isPackaged: false
  }
}))

import { runMigrations } from '../../database/migrator'
import { ConfigRepository, getDefaultConfig } from '../../database/repositories/config.repository'
import type { AppConfig } from '../../database/repositories/config.repository'
import {
  executeSale,
  calcSellos1,
  calcSellos2,
  calcTicketsUsed
} from '../sale.service'
import type { KioskoQuantities } from '../sale.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupDb(): { db: Database.Database; repo: ConfigRepository } {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migrationsPath = join(__dirname, '..', '..', 'database', 'migrations')
  runMigrations(db, migrationsPath)

  const repo = new ConfigRepository(db)
  repo.initConfig()

  return { db, repo }
}

/** Read config directly from DB */
function readConfig(db: Database.Database): AppConfig {
  const row = db.prepare('SELECT data FROM config WHERE id = 1').get() as { data: string }
  return JSON.parse(row.data) as AppConfig
}

// ─── Arbitraries (data generators) ─────────────────────────────────────────────

/** Generate valid KioskoQuantities with at least one stamp */
const arbQuantities: fc.Arbitrary<KioskoQuantities> = fc
  .record({
    tarifaAS1: fc.integer({ min: 0, max: 30 }),
    tarifaA2S1: fc.integer({ min: 0, max: 30 }),
    tarifaBS1: fc.integer({ min: 0, max: 30 }),
    tarifaCS1: fc.integer({ min: 0, max: 30 }),
    tarifaAT1: fc.integer({ min: 0, max: 10 }),
    tarifa4T1: fc.integer({ min: 0, max: 10 }),
    tarifaAS2: fc.integer({ min: 0, max: 30 }),
    tarifaA2S2: fc.integer({ min: 0, max: 30 }),
    tarifaBS2: fc.integer({ min: 0, max: 30 }),
    tarifaCS2: fc.integer({ min: 0, max: 30 }),
    tarifaAT2: fc.integer({ min: 0, max: 10 }),
    tarifa4T2: fc.integer({ min: 0, max: 10 })
  })
  .filter((q) => calcSellos1(q) + calcSellos2(q) > 0)

/** Generate quantities with only model 1 stamps (model 2 all zero) */
const arbQuantitiesModel1Only: fc.Arbitrary<KioskoQuantities> = fc
  .record({
    tarifaAS1: fc.integer({ min: 0, max: 30 }),
    tarifaA2S1: fc.integer({ min: 0, max: 30 }),
    tarifaBS1: fc.integer({ min: 0, max: 30 }),
    tarifaCS1: fc.integer({ min: 0, max: 30 }),
    tarifaAT1: fc.integer({ min: 0, max: 10 }),
    tarifa4T1: fc.integer({ min: 0, max: 10 }),
    tarifaAS2: fc.constant(0),
    tarifaA2S2: fc.constant(0),
    tarifaBS2: fc.constant(0),
    tarifaCS2: fc.constant(0),
    tarifaAT2: fc.constant(0),
    tarifa4T2: fc.constant(0)
  })
  .filter((q) => calcSellos1(q) > 0)

/** Generate quantities with only model 2 stamps (model 1 all zero) */
const arbQuantitiesModel2Only: fc.Arbitrary<KioskoQuantities> = fc
  .record({
    tarifaAS1: fc.constant(0),
    tarifaA2S1: fc.constant(0),
    tarifaBS1: fc.constant(0),
    tarifaCS1: fc.constant(0),
    tarifaAT1: fc.constant(0),
    tarifa4T1: fc.constant(0),
    tarifaAS2: fc.integer({ min: 0, max: 30 }),
    tarifaA2S2: fc.integer({ min: 0, max: 30 }),
    tarifaBS2: fc.integer({ min: 0, max: 30 }),
    tarifaCS2: fc.integer({ min: 0, max: 30 }),
    tarifaAT2: fc.integer({ min: 0, max: 10 }),
    tarifa4T2: fc.integer({ min: 0, max: 10 })
  })
  .filter((q) => calcSellos2(q) > 0)

/** Generate quantities with at least one tira */
const arbQuantitiesWithTiras: fc.Arbitrary<KioskoQuantities> = fc
  .record({
    tarifaAS1: fc.integer({ min: 0, max: 10 }),
    tarifaA2S1: fc.integer({ min: 0, max: 10 }),
    tarifaBS1: fc.integer({ min: 0, max: 10 }),
    tarifaCS1: fc.integer({ min: 0, max: 10 }),
    tarifaAT1: fc.integer({ min: 0, max: 5 }),
    tarifa4T1: fc.integer({ min: 0, max: 5 }),
    tarifaAS2: fc.integer({ min: 0, max: 10 }),
    tarifaA2S2: fc.integer({ min: 0, max: 10 }),
    tarifaBS2: fc.integer({ min: 0, max: 10 }),
    tarifaCS2: fc.integer({ min: 0, max: 10 }),
    tarifaAT2: fc.integer({ min: 0, max: 5 }),
    tarifa4T2: fc.integer({ min: 0, max: 5 })
  })
  .filter((q) => q.tarifaAT1 + q.tarifa4T1 + q.tarifaAT2 + q.tarifa4T2 > 0)

/** Generate initial rollo value (sufficient stock) */
const arbRollo = fc.integer({ min: 200, max: 2000 })

/** Generate initial tickets (sufficient stock) */
const arbTickets = fc.integer({ min: 50, max: 500 })

/** Generate a valid profile name */
const arbProfile = fc.constantFrom(
  'Filatelia',
  'Esporadicos',
  'SPDE',
  'Abono/Envio',
  'FERIA'
)

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 5: Decremento correcto de rollos', () => {

  /**
   * **Validates: Requirement 4.1**
   *
   * Property: After a successful sale, rollo1 must be decremented by exactly
   * (simples_modelo1 + 4 × tiras_modelo1), where:
   *   simples_modelo1 = tarifaAS1 + tarifaA2S1 + tarifaBS1 + tarifaCS1
   *   tiras_modelo1 = tarifaAT1 + tarifa4T1
   *
   * This verifies that each simple stamp consumes 1 from roll 1, and each
   * tira consumes 4 from roll 1.
   */
  it('rollo1 decrements by (simples_model1 + 4 × tiras_model1) after sale', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            // Ensure stock is sufficient
            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999 // No price limit for this test
            config.codigo.cliente = 1
            repo.set(config)

            // Execute the sale
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Verify rollo1 decrement formula: simples + 4 × tiras
            const afterSale = readConfig(db)
            const actualDecrement1 = safeRollo1 - afterSale.ticket.rollo1

            // Verify the formula holds
            const simples1 = quantities.tarifaAS1 + quantities.tarifaA2S1 +
              quantities.tarifaBS1 + quantities.tarifaCS1
            const tiras1 = quantities.tarifaAT1 + quantities.tarifa4T1
            const expectedDecrement1 = simples1 + 4 * tiras1

            expect(actualDecrement1).toBe(expectedDecrement1)
            expect(actualDecrement1).toBe(expectedSellos1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirement 4.2**
   *
   * Property: After a successful sale, rollo2 must be decremented by exactly
   * (simples_modelo2 + 4 × tiras_modelo2), where:
   *   simples_modelo2 = tarifaAS2 + tarifaA2S2 + tarifaBS2 + tarifaCS2
   *   tiras_modelo2 = tarifaAT2 + tarifa4T2
   *
   * This verifies that each simple stamp consumes 1 from roll 2, and each
   * tira consumes 4 from roll 2.
   */
  it('rollo2 decrements by (simples_model2 + 4 × tiras_model2) after sale', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Verify rollo2 decrement formula
            const afterSale = readConfig(db)
            const actualDecrement2 = safeRollo2 - afterSale.ticket.rollo2

            const simples2 = quantities.tarifaAS2 + quantities.tarifaA2S2 +
              quantities.tarifaBS2 + quantities.tarifaCS2
            const tiras2 = quantities.tarifaAT2 + quantities.tarifa4T2
            const expectedDecrement2 = simples2 + 4 * tiras2

            expect(actualDecrement2).toBe(expectedDecrement2)
            expect(actualDecrement2).toBe(expectedSellos2)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirement 4.3**
   *
   * Property: After a successful sale, tickets must be decremented by exactly
   * (total_tiras + 2), where total_tiras = tarifaAT1 + tarifa4T1 + tarifaAT2 + tarifa4T2.
   * The +2 accounts for the ticket principal and copy.
   */
  it('tickets decrement by (total_tiras + 2) after sale', () => {
    fc.assert(
      fc.property(
        arbQuantitiesWithTiras,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Verify tickets decrement formula
            const afterSale = readConfig(db)
            const actualTicketDecrement = safeTickets - afterSale.ticket.tickets

            const totalTiras = quantities.tarifaAT1 + quantities.tarifa4T1 +
              quantities.tarifaAT2 + quantities.tarifa4T2
            const expectedTicketDecrement = totalTiras + 2

            expect(actualTicketDecrement).toBe(expectedTicketDecrement)
            expect(actualTicketDecrement).toBe(expectedTickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirement 4.1**
   *
   * Property: When a sale only affects model 1 (model 2 quantities all zero),
   * rollo2 must NOT be decremented at all. This verifies isolation between models.
   */
  it('model 1 only sale does not decrement rollo2', () => {
    fc.assert(
      fc.property(
        arbQuantitiesModel1Only,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = rollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Rollo2 must be unchanged
            const afterSale = readConfig(db)
            expect(afterSale.ticket.rollo2).toBe(rollo2)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 4.2**
   *
   * Property: When a sale only affects model 2 (model 1 quantities all zero),
   * rollo1 must NOT be decremented at all. This verifies isolation between models.
   */
  it('model 2 only sale does not decrement rollo1', () => {
    fc.assert(
      fc.property(
        arbQuantitiesModel2Only,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = rollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Rollo1 must be unchanged
            const afterSale = readConfig(db)
            expect(afterSale.ticket.rollo1).toBe(rollo1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 4.5**
   *
   * Property: If the quantities would consume more stamps than available in rollo1,
   * the sale MUST be rejected (returns success: false). This prevents negative stock.
   */
  it('rejects sale when quantities exceed rollo1 stock', () => {
    fc.assert(
      fc.property(
        arbQuantitiesModel1Only,
        arbProfile,
        (quantities, profile) => {
          const { db, repo } = setupDb()
          try {
            const requiredSellos1 = calcSellos1(quantities)

            // Set rollo1 to less than required (but >= 0)
            const insufficientRollo1 = Math.max(0, requiredSellos1 - 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = insufficientRollo1
            config.ticket.rollo2 = 2000
            config.ticket.tickets = 500
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)

            // Must be rejected
            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toContain('rollo 1')
            }

            // Verify state was NOT modified (no partial decrement)
            const afterAttempt = readConfig(db)
            expect(afterAttempt.ticket.rollo1).toBe(insufficientRollo1)
            expect(afterAttempt.codigo.cliente).toBe(1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 4.5**
   *
   * Property: If the quantities would consume more stamps than available in rollo2,
   * the sale MUST be rejected (returns success: false). This prevents negative stock.
   */
  it('rejects sale when quantities exceed rollo2 stock', () => {
    fc.assert(
      fc.property(
        arbQuantitiesModel2Only,
        arbProfile,
        (quantities, profile) => {
          const { db, repo } = setupDb()
          try {
            const requiredSellos2 = calcSellos2(quantities)

            // Set rollo2 to less than required (but >= 0)
            const insufficientRollo2 = Math.max(0, requiredSellos2 - 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = 2000
            config.ticket.rollo2 = insufficientRollo2
            config.ticket.tickets = 500
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)

            // Must be rejected
            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toContain('rollo 2')
            }

            // Verify state was NOT modified
            const afterAttempt = readConfig(db)
            expect(afterAttempt.ticket.rollo2).toBe(insufficientRollo2)
            expect(afterAttempt.codigo.cliente).toBe(1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 4.3**
   *
   * Property: If the sale requires more tickets than available,
   * the sale MUST be rejected.
   */
  it('rejects sale when tiras exceed available tickets', () => {
    fc.assert(
      fc.property(
        arbQuantitiesWithTiras,
        arbProfile,
        (quantities, profile) => {
          const { db, repo } = setupDb()
          try {
            const requiredTickets = calcTicketsUsed(quantities)

            // Set tickets to less than required (but >= 0)
            const insufficientTickets = Math.max(0, requiredTickets - 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = 2000
            config.ticket.rollo2 = 2000
            config.ticket.tickets = insufficientTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)

            // Must be rejected
            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toContain('tickets')
            }

            // Verify state was NOT modified
            const afterAttempt = readConfig(db)
            expect(afterAttempt.ticket.tickets).toBe(insufficientTickets)
            expect(afterAttempt.ticket.rollo1).toBe(2000)
            expect(afterAttempt.ticket.rollo2).toBe(2000)
            expect(afterAttempt.codigo.cliente).toBe(1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * Property: The decrement amounts returned in the SaleResult (sellos1, sellos2, tickets)
   * must match the actual decrements observed in the database. This ensures the
   * returned metadata is consistent with the persisted state change.
   */
  it('SaleResult consumption values match actual DB decrements', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // The returned values must match the formulas
            expect(result.sellos1).toBe(expectedSellos1)
            expect(result.sellos2).toBe(expectedSellos2)
            expect(result.tickets).toBe(expectedTickets)

            // And they must also match the actual DB change
            const afterSale = readConfig(db)
            expect(safeRollo1 - afterSale.ticket.rollo1).toBe(result.sellos1)
            expect(safeRollo2 - afterSale.ticket.rollo2).toBe(result.sellos2)
            expect(safeTickets - afterSale.ticket.tickets).toBe(result.tickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * Property: After a successful sale, the resulting roll values must be non-negative.
   * This ensures the validation logic prevents underflow in all cases.
   */
  it('roll values remain non-negative after successful sale', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, profile) => {
          const { db, repo } = setupDb()
          try {
            const expectedSellos1 = calcSellos1(quantities)
            const expectedSellos2 = calcSellos2(quantities)
            const expectedTickets = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, expectedSellos1 + 1)
            const safeRollo2 = Math.max(rollo2, expectedSellos2 + 1)
            const safeTickets = Math.max(tickets, expectedTickets + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            const afterSale = readConfig(db)
            expect(afterSale.ticket.rollo1).toBeGreaterThanOrEqual(0)
            expect(afterSale.ticket.rollo2).toBeGreaterThanOrEqual(0)
            expect(afterSale.ticket.tickets).toBeGreaterThanOrEqual(0)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirement 4.5**
   *
   * Property: When both rollos have insufficient stock simultaneously,
   * the sale must still be rejected and no state should change.
   * Tests that validation checks both rollos before proceeding.
   */
  it('rejects sale when both rollos have insufficient stock (no partial modification)', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbProfile,
        (quantities, profile) => {
          const { db, repo } = setupDb()
          try {
            const requiredSellos1 = calcSellos1(quantities)
            const requiredSellos2 = calcSellos2(quantities)

            // Only reject if both models have stamps
            fc.pre(requiredSellos1 > 0 && requiredSellos2 > 0)

            const insufficientRollo1 = Math.max(0, requiredSellos1 - 1)
            const insufficientRollo2 = Math.max(0, requiredSellos2 - 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = insufficientRollo1
            config.ticket.rollo2 = insufficientRollo2
            config.ticket.tickets = 500
            config.ticket.limiteImporte = 999999
            config.codigo.cliente = 1
            repo.set(config)

            const result = executeSale(config, quantities, profile, db)

            // Must be rejected
            expect(result.success).toBe(false)

            // Verify NO state was modified
            const afterAttempt = readConfig(db)
            expect(afterAttempt.ticket.rollo1).toBe(insufficientRollo1)
            expect(afterAttempt.ticket.rollo2).toBe(insufficientRollo2)
            expect(afterAttempt.ticket.tickets).toBe(500)
            expect(afterAttempt.codigo.cliente).toBe(1)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
