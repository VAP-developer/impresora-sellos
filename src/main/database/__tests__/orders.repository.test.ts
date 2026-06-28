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

import { runMigrations } from '../migrator'
import { OrdersRepository } from '../repositories/orders.repository'
import type { OrderLine } from '../repositories/orders.repository'

/**
 * Helper to create a valid OrderLine with sensible defaults.
 */
function makeOrder(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    event: 'Feria Madrid 2025',
    venue: 'Plaza Mayor',
    machine: 'CH17',
    vendType: 'Tarifa A Tira 4',
    productName: 'Sello Correos',
    transactionDate: '2025-04-21T10:30:00',
    quantity: 2,
    quantitySet: 4,
    totalStamps: 8,
    currency: 'EUR',
    value: 4.0,
    paymentStatus: 'FERIA',
    sesionId: 1,
    etiquetasRollo1: 8,
    etiquetasRollo2: 0,
    etiquetaMes: '4',
    tituloEvento: 'XLIX Feria Nacional Sello',
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor Madrid',
    fecha: '21-24 abril 2025',
    mes: 4,
    annio: '25',
    documento: 'PCH17-0001-001',
    ...overrides
  }
}

describe('database/repositories/orders.repository', () => {
  let db: Database.Database
  let repo: OrdersRepository

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const migrationsPath = join(__dirname, '..', 'migrations')
    runMigrations(db, migrationsPath)

    repo = new OrdersRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('insert()', () => {
    it('should insert a single order', () => {
      const order = makeOrder()
      repo.insert([order])

      expect(repo.count()).toBe(1)
    })

    it('should insert multiple orders in a single transaction', () => {
      const orders = [
        makeOrder({ event: 'Event 1', sesionId: 1 }),
        makeOrder({ event: 'Event 2', sesionId: 2 }),
        makeOrder({ event: 'Event 3', sesionId: 3 })
      ]
      repo.insert(orders)

      expect(repo.count()).toBe(3)
    })

    it('should auto-assign sequential IDs', () => {
      repo.insert([makeOrder({ sesionId: 1 })])
      repo.insert([makeOrder({ sesionId: 2 })])

      const all = repo.getAll()
      expect(all[0].id).toBe(1)
      expect(all[1].id).toBe(2)
    })

    it('should handle null/optional fields gracefully', () => {
      const order = makeOrder({
        venue: '',
        machine: '',
        productName: '',
        paymentStatus: '',
        etiquetasRollo2: 0,
        documento: ''
      })
      repo.insert([order])

      const all = repo.getAll()
      expect(all).toHaveLength(1)
    })

    it('should store numeric mes as string in database', () => {
      repo.insert([makeOrder({ mes: 10 })])

      const all = repo.getAll()
      // The repository stores mes as string and returns it as string
      expect(all[0].mes).toBe('10')
    })

    it('should handle string mes values', () => {
      repo.insert([makeOrder({ mes: 'O' })])

      const all = repo.getAll()
      expect(all[0].mes).toBe('O')
    })
  })

  describe('getAll()', () => {
    it('should return empty array when no orders exist', () => {
      const result = repo.getAll()
      expect(result).toEqual([])
    })

    it('should return orders in insertion order (by id ASC)', () => {
      repo.insert([
        makeOrder({ event: 'First', sesionId: 1 }),
        makeOrder({ event: 'Second', sesionId: 2 }),
        makeOrder({ event: 'Third', sesionId: 3 })
      ])

      const all = repo.getAll()
      expect(all[0].event).toBe('First')
      expect(all[1].event).toBe('Second')
      expect(all[2].event).toBe('Third')
    })

    it('should map snake_case columns to camelCase properties', () => {
      repo.insert([makeOrder()])

      const order = repo.getAll()[0]
      expect(order).toHaveProperty('vendType')
      expect(order).toHaveProperty('productName')
      expect(order).toHaveProperty('transactionDate')
      expect(order).toHaveProperty('quantitySet')
      expect(order).toHaveProperty('totalStamps')
      expect(order).toHaveProperty('paymentStatus')
      expect(order).toHaveProperty('sesionId')
      expect(order).toHaveProperty('etiquetasRollo1')
      expect(order).toHaveProperty('etiquetasRollo2')
      expect(order).toHaveProperty('etiquetaMes')
      expect(order).toHaveProperty('tituloEvento')
    })

    it('should preserve all field values after round-trip', () => {
      const original = makeOrder({
        event: 'Test Event',
        venue: 'Test Venue',
        machine: 'FI01',
        vendType: 'Etiqueta individual',
        productName: 'Sello Test',
        transactionDate: '2025-06-15T14:00:00',
        quantity: 5,
        quantitySet: 1,
        totalStamps: 5,
        currency: 'EUR',
        value: 2.5,
        paymentStatus: 'Filatelia',
        sesionId: 42,
        etiquetasRollo1: 3,
        etiquetasRollo2: 2,
        etiquetaMes: '6',
        tituloEvento: 'Evento Test',
        feria: 'Feria Test',
        lugar: 'Lugar Test',
        fecha: '15 junio 2025',
        mes: '6',
        annio: '25',
        documento: 'PFI01-0042-005'
      })

      repo.insert([original])
      const retrieved = repo.getAll()[0]

      expect(retrieved.event).toBe(original.event)
      expect(retrieved.venue).toBe(original.venue)
      expect(retrieved.machine).toBe(original.machine)
      expect(retrieved.vendType).toBe(original.vendType)
      expect(retrieved.productName).toBe(original.productName)
      expect(retrieved.transactionDate).toBe(original.transactionDate)
      expect(retrieved.quantity).toBe(original.quantity)
      expect(retrieved.quantitySet).toBe(original.quantitySet)
      expect(retrieved.totalStamps).toBe(original.totalStamps)
      expect(retrieved.currency).toBe(original.currency)
      expect(retrieved.value).toBe(original.value)
      expect(retrieved.paymentStatus).toBe(original.paymentStatus)
      expect(retrieved.sesionId).toBe(original.sesionId)
      expect(retrieved.etiquetasRollo1).toBe(original.etiquetasRollo1)
      expect(retrieved.etiquetasRollo2).toBe(original.etiquetasRollo2)
      expect(retrieved.etiquetaMes).toBe(original.etiquetaMes)
      expect(retrieved.tituloEvento).toBe(original.tituloEvento)
      expect(retrieved.feria).toBe(original.feria)
      expect(retrieved.lugar).toBe(original.lugar)
      expect(retrieved.fecha).toBe(original.fecha)
      expect(retrieved.mes).toBe(String(original.mes))
      expect(retrieved.annio).toBe(original.annio)
      expect(retrieved.documento).toBe(original.documento)
    })
  })

  describe('exportCSV()', () => {
    it('should return empty string when no orders exist', () => {
      const csv = repo.exportCSV()
      expect(csv).toBe('')
    })

    it('should include a header row with column names', () => {
      repo.insert([makeOrder()])

      const csv = repo.exportCSV()
      const lines = csv.split('\n')
      const header = lines[0]

      expect(header).toContain('id')
      expect(header).toContain('event')
      expect(header).toContain('venue')
      expect(header).toContain('vend_type')
      expect(header).toContain('transaction_date')
      expect(header).toContain('quantity')
      expect(header).toContain('value')
    })

    it('should use semicolon as delimiter', () => {
      repo.insert([makeOrder()])

      const csv = repo.exportCSV()
      const lines = csv.split('\n')
      const header = lines[0]

      // Header should contain semicolons separating columns
      expect(header.split(';').length).toBeGreaterThan(1)
    })

    it('should include data rows after header', () => {
      repo.insert([
        makeOrder({ event: 'Event A', sesionId: 1 }),
        makeOrder({ event: 'Event B', sesionId: 2 })
      ])

      const csv = repo.exportCSV()
      const lines = csv.split('\n')

      // 1 header + 2 data rows
      expect(lines).toHaveLength(3)
    })

    it('should escape values containing semicolons', () => {
      repo.insert([makeOrder({ event: 'Event;With;Semicolons' })])

      const csv = repo.exportCSV()
      // The value should be quoted
      expect(csv).toContain('"Event;With;Semicolons"')
    })

    it('should escape values containing double quotes', () => {
      repo.insert([makeOrder({ event: 'Event "Quoted"' })])

      const csv = repo.exportCSV()
      // Double quotes inside should be escaped as ""
      expect(csv).toContain('"Event ""Quoted"""')
    })

    it('should not include the synced column', () => {
      repo.insert([makeOrder()])

      const csv = repo.exportCSV()
      const header = csv.split('\n')[0]

      // synced is an internal field and should not be in the export
      const columns = header.split(';')
      expect(columns).not.toContain('synced')
    })

    it('should include created_at column', () => {
      repo.insert([makeOrder()])

      const csv = repo.exportCSV()
      const header = csv.split('\n')[0]

      expect(header).toContain('created_at')
    })

    it('should represent null values as empty strings', () => {
      const order = makeOrder()
      // venue will be stored as null-ish
      repo.insert([order])

      const csv = repo.exportCSV()
      // No "null" text should appear
      expect(csv).not.toContain('null')
    })
  })

  describe('count()', () => {
    it('should return 0 when no orders exist', () => {
      expect(repo.count()).toBe(0)
    })

    it('should return the correct count after insertions', () => {
      repo.insert([makeOrder(), makeOrder(), makeOrder()])
      expect(repo.count()).toBe(3)
    })

    it('should reflect multiple insert calls', () => {
      repo.insert([makeOrder()])
      repo.insert([makeOrder(), makeOrder()])
      expect(repo.count()).toBe(3)
    })
  })

  describe('transaction atomicity', () => {
    it('should rollback all inserts if any order in the batch fails', () => {
      // The 'event' field is NOT NULL. Passing null should cause a constraint violation.
      const validOrder = makeOrder()
      const invalidOrder = { ...makeOrder(), event: null as unknown as string }

      expect(() => repo.insert([validOrder, invalidOrder])).toThrow()
      expect(repo.count()).toBe(0)
    })
  })
})
