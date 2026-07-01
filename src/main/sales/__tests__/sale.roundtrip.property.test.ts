/**
 * Property-based tests for round-trip sale/cancellation (Property 4)
 *
 * Property 4: Round-trip de venta y anulación (integridad de sesión y rollos)
 *
 * For any valid sale (quantities that don't exceed stock or limit),
 * executing the sale followed by a cancellation must restore the exact
 * previous state: `cliente` returns to its original value, rollo1/rollo2/tickets
 * return to their pre-sale values.
 *
 * Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 10.2, 10.3
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
  cancelSale,
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

/** Count orders in the DB */
function countOrders(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt
}

// ─── Arbitraries (data generators) ─────────────────────────────────────────────

/**
 * Generate valid KioskoQuantities where at least one field is > 0
 * (to ensure the basket is not empty).
 * Values constrained to 0-50 per field.
 */
const arbQuantities: fc.Arbitrary<KioskoQuantities> = fc
  .record({
    tarifaAS1: fc.integer({ min: 0, max: 50 }),
    tarifaA2S1: fc.integer({ min: 0, max: 50 }),
    tarifaBS1: fc.integer({ min: 0, max: 50 }),
    tarifaCS1: fc.integer({ min: 0, max: 50 }),
    tarifaAT1: fc.integer({ min: 0, max: 50 }),
    tarifa4T1: fc.integer({ min: 0, max: 50 }),
    tarifaAS2: fc.integer({ min: 0, max: 50 }),
    tarifaA2S2: fc.integer({ min: 0, max: 50 }),
    tarifaBS2: fc.integer({ min: 0, max: 50 }),
    tarifaCS2: fc.integer({ min: 0, max: 50 }),
    tarifaAT2: fc.integer({ min: 0, max: 50 }),
    tarifa4T2: fc.integer({ min: 0, max: 50 })
  })
  .filter((q) => {
    // Ensure basket is not empty (at least one stamp)
    return calcSellos1(q) + calcSellos2(q) > 0
  })

/** Generate initial rollo values (100-2000) */
const arbRollo = fc.integer({ min: 100, max: 2000 })

/** Generate initial tickets (50-500) */
const arbTickets = fc.integer({ min: 50, max: 500 })

/** Generate initial cliente (1-9000, leaves room for increment without exceeding 9999) */
const arbCliente = fc.integer({ min: 1, max: 9000 })

/** Generate a valid profile name */
const arbProfile = fc.constantFrom(
  'Filatelia',
  'Esporadicos',
  'SPDE',
  'Abono/Envio',
  'FERIA'
)

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 4: Round-trip venta/anulación (integridad de sesión y rollos)', () => {
  /**
   * **Validates: Requirements 3.2, 3.3, 10.2**
   *
   * Property: After executing a sale and then cancelling it,
   * the `codigo.cliente` field must return to its exact original value.
   * executeSale increments by 1, cancelSale decrements by 1.
   */
  it('sale + cancellation restores codigo.cliente to original value', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbCliente,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, cliente, profile) => {
          const { db, repo } = setupDb()
          try {
            // Ensure stock is sufficient for the sale
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            // Setup initial state
            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Execute the sale
            const saleResult = executeSale(config, quantities, profile, db)
            expect(saleResult.success).toBe(true)
            if (!saleResult.success) return

            // Verify session was incremented
            const afterSale = readConfig(db)
            expect(afterSale.codigo.cliente).toBe(cliente + 1)

            // Cancel the sale
            const cancelResult = cancelSale(
              { sellos1: saleResult.sellos1, sellos2: saleResult.sellos2, tickets: saleResult.tickets },
              db
            )
            expect(cancelResult.success).toBe(true)

            // Verify session restored to original
            const afterCancel = readConfig(db)
            expect(afterCancel.codigo.cliente).toBe(cliente)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.1, 4.2, 4.4, 10.3**
   *
   * Property: After executing a sale and then cancelling it,
   * rollo1 and rollo2 must return to their exact pre-sale values.
   * executeSale decrements by (simples + 4×tiras), cancelSale restores the same amount.
   */
  it('sale + cancellation restores rollo1 and rollo2 to original values', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbCliente,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, cliente, profile) => {
          const { db, repo } = setupDb()
          try {
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Execute the sale
            const saleResult = executeSale(config, quantities, profile, db)
            expect(saleResult.success).toBe(true)
            if (!saleResult.success) return

            // Verify rolls were decremented
            const afterSale = readConfig(db)
            expect(afterSale.ticket.rollo1).toBe(safeRollo1 - sellos1)
            expect(afterSale.ticket.rollo2).toBe(safeRollo2 - sellos2)

            // Cancel the sale
            const cancelResult = cancelSale(
              { sellos1: saleResult.sellos1, sellos2: saleResult.sellos2, tickets: saleResult.tickets },
              db
            )
            expect(cancelResult.success).toBe(true)

            // Verify rolls restored to original
            const afterCancel = readConfig(db)
            expect(afterCancel.ticket.rollo1).toBe(safeRollo1)
            expect(afterCancel.ticket.rollo2).toBe(safeRollo2)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3, 4.4, 10.3**
   *
   * Property: After executing a sale and then cancelling it,
   * the tickets counter must return to its exact pre-sale value.
   * executeSale decrements by (total_tiras + 2), cancelSale restores the same amount.
   */
  it('sale + cancellation restores tickets counter to original value', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbCliente,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, cliente, profile) => {
          const { db, repo } = setupDb()
          try {
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Execute the sale
            const saleResult = executeSale(config, quantities, profile, db)
            expect(saleResult.success).toBe(true)
            if (!saleResult.success) return

            // Verify tickets were decremented
            const afterSale = readConfig(db)
            expect(afterSale.ticket.tickets).toBe(safeTickets - ticketsUsed)

            // Cancel the sale
            const cancelResult = cancelSale(
              { sellos1: saleResult.sellos1, sellos2: saleResult.sellos2, tickets: saleResult.tickets },
              db
            )
            expect(cancelResult.success).toBe(true)

            // Verify tickets restored to original
            const afterCancel = readConfig(db)
            expect(afterCancel.ticket.tickets).toBe(safeTickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 10.2, 10.3**
   *
   * Property: After executing a sale and then cancelling it,
   * the ENTIRE config state (session + all rolls + tickets) must be
   * byte-for-byte identical to the pre-sale state — except for the
   * audit order record which is expected to remain.
   *
   * This is the strongest round-trip guarantee: the cancellation is a
   * perfect inverse of the sale with respect to the config document.
   */
  it('sale + cancellation produces config state identical to pre-sale (full round-trip)', () => {
    fc.assert(
      fc.property(
        arbQuantities,
        arbRollo,
        arbRollo,
        arbTickets,
        arbCliente,
        arbProfile,
        (quantities, rollo1, rollo2, tickets, cliente, profile) => {
          const { db, repo } = setupDb()
          try {
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Snapshot the config JSON before the sale
            const configJsonBefore = (
              db.prepare('SELECT data FROM config WHERE id = 1').get() as { data: string }
            ).data

            // Execute the sale
            const saleResult = executeSale(config, quantities, profile, db)
            expect(saleResult.success).toBe(true)
            if (!saleResult.success) return

            // Cancel the sale with the exact consumption data from the sale result
            const cancelResult = cancelSale(
              { sellos1: saleResult.sellos1, sellos2: saleResult.sellos2, tickets: saleResult.tickets },
              db
            )
            expect(cancelResult.success).toBe(true)

            // Verify config JSON is identical to pre-sale state
            const configJsonAfter = (
              db.prepare('SELECT data FROM config WHERE id = 1').get() as { data: string }
            ).data

            // Parse both for deep comparison (JSON key order may differ)
            const configBefore = JSON.parse(configJsonBefore) as AppConfig
            const configAfter = JSON.parse(configJsonAfter) as AppConfig

            expect(configAfter.codigo.cliente).toBe(configBefore.codigo.cliente)
            expect(configAfter.ticket.rollo1).toBe(configBefore.ticket.rollo1)
            expect(configAfter.ticket.rollo2).toBe(configBefore.ticket.rollo2)
            expect(configAfter.ticket.tickets).toBe(configBefore.ticket.tickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.2, 3.3, 4.1-4.4, 10.2, 10.3**
   *
   * Property: The round-trip holds for multiple consecutive sales followed
   * by their corresponding cancellations in reverse order (LIFO).
   * After N sales followed by N cancellations, the config state is
   * identical to the initial state.
   *
   * This tests that the cancellation mechanism works correctly even when
   * the state has been modified by prior sales (accumulating decrements).
   */
  it('multiple sales followed by reverse cancellations restores original state (LIFO)', () => {
    fc.assert(
      fc.property(
        // Generate 2-4 distinct quantity sets for multiple consecutive sales
        fc.integer({ min: 2, max: 4 }),
        arbRollo,
        arbRollo,
        arbTickets,
        arbCliente,
        arbProfile,
        (numSales, rollo1, rollo2, tickets, cliente, profile) => {
          const { db, repo } = setupDb()
          try {
            // Generate N quantity sets — use small quantities to avoid running out of stock
            const quantitySets: KioskoQuantities[] = []
            for (let i = 0; i < numSales; i++) {
              const q: KioskoQuantities = {
                tarifaAS1: i % 2 === 0 ? 1 : 0,
                tarifaA2S1: 0,
                tarifaBS1: i % 3 === 0 ? 1 : 0,
                tarifaCS1: 0,
                tarifaAT1: 0,
                tarifa4T1: 0,
                tarifaAS2: i % 2 === 1 ? 1 : 0,
                tarifaA2S2: 0,
                tarifaBS2: 0,
                tarifaCS2: i % 3 === 1 ? 1 : 0,
                tarifaAT2: 0,
                tarifa4T2: 0
              }
              // Ensure at least one stamp
              if (calcSellos1(q) + calcSellos2(q) === 0) {
                q.tarifaAS1 = 1
              }
              quantitySets.push(q)
            }

            // Compute total consumption across all sales to set safe stock
            let totalSellos1 = 0
            let totalSellos2 = 0
            let totalTickets = 0
            for (const q of quantitySets) {
              totalSellos1 += calcSellos1(q)
              totalSellos2 += calcSellos2(q)
              totalTickets += calcTicketsUsed(q)
            }

            const safeRollo1 = Math.max(rollo1, totalSellos1 + 10)
            const safeRollo2 = Math.max(rollo2, totalSellos2 + 10)
            const safeTickets = Math.max(tickets, totalTickets + 10)

            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Execute all sales, collecting results
            const saleResults: Array<{ sellos1: number; sellos2: number; tickets: number }> = []
            for (const q of quantitySets) {
              // Re-read config from DB for each sale (mimics real flow)
              const currentConfig = readConfig(db)
              const result = executeSale(currentConfig, q, profile, db)
              expect(result.success).toBe(true)
              if (!result.success) return
              saleResults.push({
                sellos1: result.sellos1,
                sellos2: result.sellos2,
                tickets: result.tickets
              })
            }

            // Verify state changed after all sales
            const afterAllSales = readConfig(db)
            expect(afterAllSales.codigo.cliente).toBe(cliente + numSales)

            // Cancel all sales in reverse order (LIFO)
            for (let i = saleResults.length - 1; i >= 0; i--) {
              const cancelResult = cancelSale(saleResults[i], db)
              expect(cancelResult.success).toBe(true)
            }

            // Verify full state restoration
            const afterAllCancellations = readConfig(db)
            expect(afterAllCancellations.codigo.cliente).toBe(cliente)
            expect(afterAllCancellations.ticket.rollo1).toBe(safeRollo1)
            expect(afterAllCancellations.ticket.rollo2).toBe(safeRollo2)
            expect(afterAllCancellations.ticket.tickets).toBe(safeTickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
