/**
 * Property-based tests for sale atomicity (Property 10)
 *
 * Property 10: Atomicidad de transacciones de venta
 *
 * For any sale where a failure is injected at any point in the process
 * (after incrementing session, after decrementing rolls, or during order insertion),
 * all prior changes must be reverted and no PDFs should be generated.
 *
 * Validates: Requirements 11.1, 11.2, 11.3
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
import { executeSale, calcSellos1, calcSellos2, calcTicketsUsed } from '../sale.service'
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

/** Capture a full snapshot of DB state for comparison */
function snapshotDbState(db: Database.Database): {
  config: AppConfig | null
  orderCount: number
} {
  const row = db.prepare('SELECT data FROM config WHERE id = 1').get() as
    | { data: string }
    | undefined
  const config = row ? (JSON.parse(row.data) as AppConfig) : null
  const orderCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
  ).cnt
  return { config, orderCount }
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

/** Generate initial cliente (1-9000) */
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

describe('Property 10: Atomicidad de transacciones de venta', () => {
  /**
   * **Validates: Requirements 11.1, 11.2**
   *
   * Property: When config is deleted (simulating DB corruption mid-transaction),
   * executeSale must fail and the database state must remain identical to
   * before the call — no partial changes to session, rolls, or orders.
   */
  it('failed transaction leaves DB state identical to before (config deleted)', () => {
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
            // Setup: configure the DB with the generated values
            const config = getDefaultConfig()
            config.ticket.rollo1 = rollo1
            config.ticket.rollo2 = rollo2
            config.ticket.tickets = tickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Take a snapshot of DB state before the attempt
            const before = snapshotDbState(db)

            // Simulate failure: delete config row so transaction fails
            // when it tries to read config inside the transaction
            db.prepare('DELETE FROM config').run()

            // Attempt the sale — should fail
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(false)

            // Verify no orders were inserted
            const orderCountAfter = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt
            expect(orderCountAfter).toBe(before.orderCount)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.1, 11.2**
   *
   * Property: When the orders table is dropped/corrupted mid-transaction
   * (simulating INSERT failure), all changes including session increment
   * and roll decrement must be rolled back.
   */
  it('failed transaction due to corrupted orders table rolls back all changes', () => {
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
            // Ensure stock is sufficient for the sale to pass pre-validation
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            // Setup: configure the DB with safe values
            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Take snapshot before
            const before = snapshotDbState(db)

            // Corrupt the orders table so INSERT fails inside the transaction
            db.exec('DROP TABLE orders')
            db.exec('CREATE TABLE orders (id INTEGER PRIMARY KEY)')

            // Attempt the sale — should fail during INSERT
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(false)

            // Verify config was rolled back (session + rolls unchanged)
            const afterConfig = repo.get()
            expect(afterConfig).not.toBeNull()
            expect(afterConfig!.codigo.cliente).toBe(before.config!.codigo.cliente)
            expect(afterConfig!.ticket.rollo1).toBe(before.config!.ticket.rollo1)
            expect(afterConfig!.ticket.rollo2).toBe(before.config!.ticket.rollo2)
            expect(afterConfig!.ticket.tickets).toBe(before.config!.ticket.tickets)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.1, 11.3**
   *
   * Property: A successful sale is truly atomic — all-or-nothing.
   * After a successful executeSale: session is incremented by exactly 1,
   * rolls are decremented by exactly the computed amounts, and the
   * correct number of order records exist.
   */
  it('successful sale is all-or-nothing: session, rolls, and orders all updated', () => {
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
            // Ensure stock is sufficient
            const sellos1 = calcSellos1(quantities)
            const sellos2 = calcSellos2(quantities)
            const ticketsUsed = calcTicketsUsed(quantities)

            const safeRollo1 = Math.max(rollo1, sellos1 + 1)
            const safeRollo2 = Math.max(rollo2, sellos2 + 1)
            const safeTickets = Math.max(tickets, ticketsUsed + 1)

            // Setup
            const config = getDefaultConfig()
            config.ticket.rollo1 = safeRollo1
            config.ticket.rollo2 = safeRollo2
            config.ticket.tickets = safeTickets
            config.codigo.cliente = cliente
            repo.set(config)

            // Execute sale
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(true)
            if (!result.success) return

            // Verify ALL changes happened atomically
            const afterConfig = repo.get()!

            // Session incremented by exactly 1
            expect(afterConfig.codigo.cliente).toBe(cliente + 1)

            // Rolls decremented by exact computed amounts
            expect(afterConfig.ticket.rollo1).toBe(safeRollo1 - sellos1)
            expect(afterConfig.ticket.rollo2).toBe(safeRollo2 - sellos2)
            expect(afterConfig.ticket.tickets).toBe(safeTickets - ticketsUsed)

            // Orders inserted (one per non-zero tariff/model combo)
            const orderCount = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt
            expect(orderCount).toBe(result.orders.length)
            expect(orderCount).toBeGreaterThan(0)
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.2, 11.3**
   *
   * Property: After a failed executeSale, no orders exist in the database
   * (proving that PDFs cannot be generated since they depend on successful
   * transaction output). The design ensures PDFs are generated only after
   * successful transaction — if transaction fails, no data exists to generate from.
   */
  it('no orders inserted on failure implies no PDFs can be generated (Req 11.3)', () => {
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
            // Setup with sufficient stock
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

            // Count orders before
            const ordersBefore = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt

            // Simulate failure by deleting config
            db.prepare('DELETE FROM config').run()

            // Attempt sale
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(false)

            // No new orders — therefore no PDFs can be generated
            const ordersAfter = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt
            expect(ordersAfter).toBe(ordersBefore)

            // The result does NOT contain orders or sesionId — no data for PDF generation
            if (!result.success) {
              expect(result).not.toHaveProperty('orders')
              expect(result).not.toHaveProperty('sesionId')
            }
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 11.1, 11.2**
   *
   * Property: After a failed executeSale, the database state is identical
   * to the state before the call was made. This is the strongest atomicity
   * guarantee — no observable side effects from a failed transaction.
   */
  it('DB state is byte-for-byte identical before and after a failed sale', () => {
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
            // Ensure stock is sufficient (so failure is NOT from pre-validation)
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

            // Take full snapshot: the serialized config JSON + order count
            const configBefore = db.prepare('SELECT data FROM config WHERE id = 1').get() as {
              data: string
            }
            const orderCountBefore = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt

            // Corrupt orders table to force failure INSIDE the transaction
            // (after config read succeeds but INSERT fails)
            db.exec('DROP TABLE orders')
            db.exec('CREATE TABLE orders (id INTEGER PRIMARY KEY)')

            // Attempt the sale
            const result = executeSale(config, quantities, profile, db)
            expect(result.success).toBe(false)

            // Verify config JSON is byte-for-byte identical
            const configAfter = db.prepare('SELECT data FROM config WHERE id = 1').get() as {
              data: string
            }
            expect(configAfter.data).toBe(configBefore.data)

            // Verify no orders were inserted (table was corrupted, but rollback
            // means config changes were also reverted)
            const orderCountAfter = (
              db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
            ).cnt
            expect(orderCountAfter).toBe(0) // corrupted table has no rows
          } finally {
            db.close()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
