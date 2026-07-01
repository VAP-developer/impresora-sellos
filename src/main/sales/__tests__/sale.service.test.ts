import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'

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
  calcTicketsUsed,
  generateOrderLines
} from '../sale.service'
import type { KioskoQuantities, CancelSaleInput } from '../sale.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyQuantities(): KioskoQuantities {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sales/sale.service', () => {
  let db: Database.Database
  let repo: ConfigRepository

  beforeEach(() => {
    const setup = setupDb()
    db = setup.db
    repo = setup.repo
  })

  afterEach(() => {
    db.close()
  })

  // ─── Roll consumption calculation tests ───────────────────────────────────

  describe('calcSellos1()', () => {
    it('should return 0 for empty quantities', () => {
      expect(calcSellos1(emptyQuantities())).toBe(0)
    })

    it('should count simple stamps as 1 each', () => {
      const q = emptyQuantities()
      q.tarifaAS1 = 3
      q.tarifaBS1 = 2
      expect(calcSellos1(q)).toBe(5)
    })

    it('should count tiras as 4 each', () => {
      const q = emptyQuantities()
      q.tarifaAT1 = 2
      q.tarifa4T1 = 1
      expect(calcSellos1(q)).toBe(12) // 2*4 + 1*4
    })

    it('should combine simple and tira stamps', () => {
      const q = emptyQuantities()
      q.tarifaAS1 = 1
      q.tarifaA2S1 = 2
      q.tarifaAT1 = 1
      expect(calcSellos1(q)).toBe(7) // 1 + 2 + 4
    })

    it('should not count modelo2 quantities', () => {
      const q = emptyQuantities()
      q.tarifaAS2 = 10
      q.tarifaAT2 = 5
      expect(calcSellos1(q)).toBe(0)
    })
  })

  describe('calcSellos2()', () => {
    it('should return 0 for empty quantities', () => {
      expect(calcSellos2(emptyQuantities())).toBe(0)
    })

    it('should count modelo2 simple stamps as 1 each', () => {
      const q = emptyQuantities()
      q.tarifaAS2 = 4
      q.tarifaCS2 = 1
      expect(calcSellos2(q)).toBe(5)
    })

    it('should count modelo2 tiras as 4 each', () => {
      const q = emptyQuantities()
      q.tarifaAT2 = 3
      expect(calcSellos2(q)).toBe(12)
    })

    it('should not count modelo1 quantities', () => {
      const q = emptyQuantities()
      q.tarifaAS1 = 10
      q.tarifaAT1 = 5
      expect(calcSellos2(q)).toBe(0)
    })
  })

  describe('calcTicketsUsed()', () => {
    it('should return 2 for no tiras (ticket principal + copy)', () => {
      const q = emptyQuantities()
      q.tarifaAS1 = 5 // not a tira
      expect(calcTicketsUsed(q)).toBe(2) // 0 tiras + 2
    })

    it('should count tiras from both models plus 2', () => {
      const q = emptyQuantities()
      q.tarifaAT1 = 2
      q.tarifa4T1 = 1
      q.tarifaAT2 = 3
      q.tarifa4T2 = 1
      expect(calcTicketsUsed(q)).toBe(9) // 2+1+3+1 + 2 = 9
    })
  })

  // ─── Order generation tests ───────────────────────────────────────────────

  describe('generateOrderLines()', () => {
    it('should generate one line per tariff/model with quantity > 0', () => {
      const config = getDefaultConfig()
      const q = emptyQuantities()
      q.tarifaAS1 = 2
      q.tarifaBS2 = 1

      const orders = generateOrderLines(config, q, 'FERIA', 5)
      expect(orders).toHaveLength(2)
    })

    it('should skip tariff/model combinations with quantity 0', () => {
      const config = getDefaultConfig()
      const q = emptyQuantities()
      q.tarifaAS1 = 1

      const orders = generateOrderLines(config, q, 'FERIA', 1)
      expect(orders).toHaveLength(1)
      expect(orders[0].vendType).toBe('Tarifa A')
      expect(orders[0].productName).toBe('Sello Modelo 1')
    })

    it('should set quantitySet=4 for tiras', () => {
      const config = getDefaultConfig()
      const q = emptyQuantities()
      q.tarifaAT1 = 3

      const orders = generateOrderLines(config, q, 'FERIA', 10)
      expect(orders).toHaveLength(1)
      expect(orders[0].vendType).toBe('Tarifa A Tira 4')
      expect(orders[0].quantity).toBe(3)
      expect(orders[0].quantitySet).toBe(4)
      expect(orders[0].totalStamps).toBe(12)
    })

    it('should set correct value based on price * quantity', () => {
      const config = getDefaultConfig()
      config.precios.tarifaA = 0.5
      const q = emptyQuantities()
      q.tarifaAS1 = 4

      const orders = generateOrderLines(config, q, 'FERIA', 1)
      expect(orders[0].value).toBeCloseTo(2.0)
    })

    it('should use the active event data', () => {
      const config = getDefaultConfig()
      config.sello.elevento = 0
      config.sello.eventos[0] = {
        nevento: 'Test Event',
        nferia: 'Test Feria',
        nlugar: 'Test Lugar',
        motivoi: 'img1',
        motivod: 'img2',
        fecha: '1-5 mayo 2025',
        localidad: 'Barcelona'
      }
      const q = emptyQuantities()
      q.tarifaAS1 = 1

      const orders = generateOrderLines(config, q, 'Filatelia', 42)
      expect(orders[0].event).toBe('Test Event')
      expect(orders[0].feria).toBe('Test Feria')
      expect(orders[0].lugar).toBe('Test Lugar')
      expect(orders[0].sesionId).toBe(42)
      expect(orders[0].paymentStatus).toBe('Filatelia')
    })
  })

  // ─── Atomic sale execution tests ──────────────────────────────────────────

  describe('executeSale()', () => {
    it('should return error for empty basket', () => {
      const config = repo.get()!
      const q = emptyQuantities()

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('vacía')
      }
    })

    it('should increment session ID on successful sale', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 1

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sesionId).toBe(2) // started at 1, incremented to 2
      }

      const updatedConfig = repo.get()!
      expect(updatedConfig.codigo.cliente).toBe(2)
    })

    it('should decrement rollos correctly for simple stamps', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 5
      q.tarifaBS2 = 3

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)

      const updatedConfig = repo.get()!
      expect(updatedConfig.ticket.rollo1).toBe(1495) // 1500 - 5
      expect(updatedConfig.ticket.rollo2).toBe(1497) // 1500 - 3
    })

    it('should decrement rollos correctly for tiras (4 per tira)', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAT1 = 2 // 2 tiras = 8 stamps from rollo1
      q.tarifa4T2 = 1 // 1 tira = 4 stamps from rollo2

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)

      const updatedConfig = repo.get()!
      expect(updatedConfig.ticket.rollo1).toBe(1492) // 1500 - 8
      expect(updatedConfig.ticket.rollo2).toBe(1496) // 1500 - 4
    })

    it('should decrement tickets correctly (tiras + 2)', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAT1 = 2
      q.tarifaAT2 = 1
      // Total tiras = 3, tickets = 3 + 2 = 5

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)

      const updatedConfig = repo.get()!
      expect(updatedConfig.ticket.tickets).toBe(445) // 450 - 5
    })

    it('should insert order lines into the database', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 2
      q.tarifaBS2 = 1

      executeSale(config, q, 'FERIA', db)

      const orders = db.prepare('SELECT * FROM orders').all()
      expect(orders).toHaveLength(2)
    })

    it('should return error when rollo1 stock is insufficient', () => {
      // Set rollo1 to low stock
      const config = repo.get()!
      config.ticket.rollo1 = 3
      repo.set(config)

      const freshConfig = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 5 // needs 5, only 3 available

      const result = executeSale(freshConfig, q, 'FERIA', db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('rollo 1')
      }

      // Verify nothing changed
      const afterConfig = repo.get()!
      expect(afterConfig.ticket.rollo1).toBe(3)
      expect(afterConfig.codigo.cliente).toBe(1)
    })

    it('should return error when rollo2 stock is insufficient', () => {
      const config = repo.get()!
      config.ticket.rollo2 = 2
      repo.set(config)

      const freshConfig = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS2 = 3 // needs 3, only 2 available

      const result = executeSale(freshConfig, q, 'FERIA', db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('rollo 2')
      }
    })

    it('should return error when tickets are insufficient', () => {
      const config = repo.get()!
      config.ticket.tickets = 3
      repo.set(config)

      const freshConfig = repo.get()!
      const q = emptyQuantities()
      q.tarifaAT1 = 2 // needs 2 + 2 = 4 tickets, only 3 available

      const result = executeSale(freshConfig, q, 'FERIA', db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('tickets')
      }
    })

    it('should return error when cliente exceeds 9999', () => {
      const config = repo.get()!
      config.codigo.cliente = 10000
      repo.set(config)

      const freshConfig = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 1

      const result = executeSale(freshConfig, q, 'FERIA', db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('9999')
      }
    })

    it('should be fully atomic: no partial changes on failure', () => {
      const config = repo.get()!
      const initialCliente = config.codigo.cliente
      const initialRollo1 = config.ticket.rollo1
      const initialRollo2 = config.ticket.rollo2
      const initialTickets = config.ticket.tickets

      // Force a failure by corrupting the config table mid-transaction
      // We'll simulate this by deleting config before executeSale reads it inside the transaction
      db.prepare('DELETE FROM config').run()

      const q = emptyQuantities()
      q.tarifaAS1 = 1

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(false)

      // Verify no orders were inserted
      const orders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
      expect(orders.cnt).toBe(0)
    })

    it('should handle mixed simple + tira quantities in a single sale', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 3  // 3 simple stamps from rollo1
      q.tarifaAT1 = 2  // 2 tiras = 8 stamps from rollo1
      q.tarifaBS2 = 1  // 1 simple stamp from rollo2
      q.tarifa4T2 = 1  // 1 tira = 4 stamps from rollo2

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sellos1).toBe(11)  // 3 + 8
        expect(result.sellos2).toBe(5)   // 1 + 4
        expect(result.tickets).toBe(5)   // 3 tiras + 2
      }

      const updatedConfig = repo.get()!
      expect(updatedConfig.ticket.rollo1).toBe(1489) // 1500 - 11
      expect(updatedConfig.ticket.rollo2).toBe(1495) // 1500 - 5
      expect(updatedConfig.ticket.tickets).toBe(445) // 450 - 5
    })

    it('should support multiple consecutive sales', () => {
      const config = repo.get()!
      const q1 = emptyQuantities()
      q1.tarifaAS1 = 1

      const result1 = executeSale(config, q1, 'FERIA', db)
      expect(result1.success).toBe(true)

      // Second sale with updated config
      const config2 = repo.get()!
      const q2 = emptyQuantities()
      q2.tarifaAS2 = 2

      const result2 = executeSale(config2, q2, 'FERIA', db)
      expect(result2.success).toBe(true)
      if (result2.success) {
        expect(result2.sesionId).toBe(3) // 1 -> 2 -> 3
      }

      const finalConfig = repo.get()!
      expect(finalConfig.codigo.cliente).toBe(3)
      expect(finalConfig.ticket.rollo1).toBe(1499) // 1500 - 1
      expect(finalConfig.ticket.rollo2).toBe(1498) // 1500 - 2
    })

    it('should return SaleResult with correct consumption data', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 2
      q.tarifaAT2 = 1

      const result = executeSale(config, q, 'FERIA', db)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sellos1).toBe(2)
        expect(result.sellos2).toBe(4)
        expect(result.tickets).toBe(3) // 1 tira + 2
        expect(result.orders.length).toBe(2)
      }
    })

    it('should not decrement rollo if it is -1 (not installed)', () => {
      const config = repo.get()!
      config.ticket.rollo1 = -1
      repo.set(config)

      const freshConfig = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS2 = 2 // only model 2, rollo1 is not installed

      // sellos1=0 so the rollo1 check is skipped (0 > -1 is true but we check >= 0 first)
      const result = executeSale(freshConfig, q, 'FERIA', db)
      expect(result.success).toBe(true)

      const updatedConfig = repo.get()!
      // rollo1 stays at -1 since no stamps taken from it... but actually the transaction
      // still subtracts 0 from -1 = -1. That's fine.
      expect(updatedConfig.ticket.rollo1).toBe(-1)
      expect(updatedConfig.ticket.rollo2).toBe(1498) // 1500 - 2
    })
  })

  // ─── Atomic sale cancellation tests ─────────────────────────────────────────

  describe('cancelSale()', () => {
    it('should return error when no previous sale exists (sellos1=0, sellos2=0)', () => {
      const input: CancelSaleInput = { sellos1: 0, sellos2: 0, tickets: 0 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('No hay venta anterior')
      }
    })

    it('should decrement session ID (codigo.cliente) by 1', () => {
      // First do a sale to increment from 1 to 2
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 1
      executeSale(config, q, 'FERIA', db)

      const afterSale = repo.get()!
      expect(afterSale.codigo.cliente).toBe(2)

      // Now cancel the sale
      const input: CancelSaleInput = { sellos1: 1, sellos2: 0, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sesionId).toBe(1) // decremented back to 1
      }

      const afterCancel = repo.get()!
      expect(afterCancel.codigo.cliente).toBe(1)
    })

    it('should restore rollo1 correctly', () => {
      // Execute a sale consuming 5 from rollo1
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 5
      executeSale(config, q, 'FERIA', db)

      const afterSale = repo.get()!
      expect(afterSale.ticket.rollo1).toBe(1495) // 1500 - 5

      // Cancel with the same consumption
      const input: CancelSaleInput = { sellos1: 5, sellos2: 0, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)

      const afterCancel = repo.get()!
      expect(afterCancel.ticket.rollo1).toBe(1500) // restored
    })

    it('should restore rollo2 correctly', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS2 = 3
      executeSale(config, q, 'FERIA', db)

      const afterSale = repo.get()!
      expect(afterSale.ticket.rollo2).toBe(1497) // 1500 - 3

      const input: CancelSaleInput = { sellos1: 0, sellos2: 3, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)

      const afterCancel = repo.get()!
      expect(afterCancel.ticket.rollo2).toBe(1500) // restored
    })

    it('should restore tickets correctly', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAT1 = 2 // 2 tiras = 8 stamps, tickets = 2 + 2 = 4
      executeSale(config, q, 'FERIA', db)

      const afterSale = repo.get()!
      expect(afterSale.ticket.tickets).toBe(446) // 450 - 4

      const input: CancelSaleInput = { sellos1: 8, sellos2: 0, tickets: 4 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)

      const afterCancel = repo.get()!
      expect(afterCancel.ticket.tickets).toBe(450) // restored
    })

    it('should insert audit order with event="ELIMINAR ANTERIOR"', () => {
      // Execute a sale first
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 2
      executeSale(config, q, 'FERIA', db)

      // Count orders after sale
      const countBefore = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt

      // Cancel the sale
      const input: CancelSaleInput = { sellos1: 2, sellos2: 0, tickets: 2 }
      cancelSale(input, db)

      // Should have one more order now (the audit record)
      const countAfter = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt
      expect(countAfter).toBe(countBefore + 1)

      // Verify the audit record content
      const auditOrder = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get() as {
        event: string
        machine: string
        payment_status: string
        quantity: number
        value: number
      }
      expect(auditOrder.event).toBe('ELIMINAR ANTERIOR')
      expect(auditOrder.machine).toBe('error de impresión')
      expect(auditOrder.payment_status).toBe('Error')
      expect(auditOrder.quantity).toBe(0)
      expect(auditOrder.value).toBe(0)
    })

    it('should be fully atomic: reverts all changes on failure', () => {
      // Execute a sale to have a valid state
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 1
      executeSale(config, q, 'FERIA', db)

      const afterSale = repo.get()!
      const clienteBefore = afterSale.codigo.cliente
      const rollo1Before = afterSale.ticket.rollo1
      const orderCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt

      // Delete config to simulate a failure during the transaction
      db.prepare('DELETE FROM config').run()

      const input: CancelSaleInput = { sellos1: 1, sellos2: 0, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(false)

      // Verify no audit order was inserted (transaction rolled back)
      const orderCountAfter = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt
      expect(orderCountAfter).toBe(orderCountBefore)
    })

    it('should handle round-trip: sale followed by cancel restores original state', () => {
      const originalConfig = repo.get()!
      const originalCliente = originalConfig.codigo.cliente
      const originalRollo1 = originalConfig.ticket.rollo1
      const originalRollo2 = originalConfig.ticket.rollo2
      const originalTickets = originalConfig.ticket.tickets

      // Execute a sale
      const q = emptyQuantities()
      q.tarifaAS1 = 3
      q.tarifaAT1 = 1
      q.tarifaBS2 = 2
      q.tarifa4T2 = 1
      const saleResult = executeSale(originalConfig, q, 'FERIA', db)
      expect(saleResult.success).toBe(true)
      if (!saleResult.success) return

      // Cancel the sale with the same consumption values
      const input: CancelSaleInput = {
        sellos1: saleResult.sellos1,
        sellos2: saleResult.sellos2,
        tickets: saleResult.tickets
      }
      const cancelResult = cancelSale(input, db)
      expect(cancelResult.success).toBe(true)

      // Verify state is restored
      const restoredConfig = repo.get()!
      expect(restoredConfig.codigo.cliente).toBe(originalCliente)
      expect(restoredConfig.ticket.rollo1).toBe(originalRollo1)
      expect(restoredConfig.ticket.rollo2).toBe(originalRollo2)
      expect(restoredConfig.ticket.tickets).toBe(originalTickets)
    })

    it('should use the correct sesionId in the audit record', () => {
      // Execute two sales to get cliente to 3
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS1 = 1
      executeSale(config, q, 'FERIA', db)
      const config2 = repo.get()!
      executeSale(config2, q, 'FERIA', db)

      const afterSales = repo.get()!
      expect(afterSales.codigo.cliente).toBe(3)

      // Cancel last sale — sesionId should be 2 (decremented from 3)
      const input: CancelSaleInput = { sellos1: 1, sellos2: 0, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sesionId).toBe(2)
      }

      // Verify the audit record uses the reverted sesionId
      const auditOrder = db.prepare('SELECT sesion_id FROM orders ORDER BY id DESC LIMIT 1').get() as { sesion_id: number }
      expect(auditOrder.sesion_id).toBe(2)
    })

    it('should work with only sellos2 > 0 (model 2 only sale)', () => {
      const config = repo.get()!
      const q = emptyQuantities()
      q.tarifaAS2 = 4
      executeSale(config, q, 'FERIA', db)

      const input: CancelSaleInput = { sellos1: 0, sellos2: 4, tickets: 2 }
      const result = cancelSale(input, db)
      expect(result.success).toBe(true)

      const afterCancel = repo.get()!
      expect(afterCancel.ticket.rollo2).toBe(1500) // restored
      expect(afterCancel.codigo.cliente).toBe(1)   // decremented back
    })
  })
})
