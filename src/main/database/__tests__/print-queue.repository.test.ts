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
import { PrintQueueRepository } from '../repositories/print-queue.repository'
import type { CreatePrintJob } from '../repositories/print-queue.repository'

/**
 * Helper to create a valid CreatePrintJob with sensible defaults.
 */
function makeJob(overrides: Partial<CreatePrintJob> = {}): CreatePrintJob {
  return {
    orderId: null,
    printerTarget: 'printer1',
    pdfType: 'stamp_simple',
    filePath: '/tmp/stamp_001.pdf',
    ...overrides
  }
}

describe('database/repositories/print-queue.repository', () => {
  let db: Database.Database
  let repo: PrintQueueRepository

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const migrationsPath = join(__dirname, '..', 'migrations')
    runMigrations(db, migrationsPath)

    repo = new PrintQueueRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('insert()', () => {
    it('should insert a print job and return its ID', () => {
      const id = repo.insert(makeJob())

      expect(id).toBeGreaterThan(0)
      expect(repo.count()).toBe(1)
    })

    it('should assign sequential IDs', () => {
      const id1 = repo.insert(makeJob())
      const id2 = repo.insert(makeJob({ printerTarget: 'printer2' }))

      expect(id2).toBe(id1 + 1)
    })

    it('should default status to pending', () => {
      const id = repo.insert(makeJob())

      const job = repo.getById(id)
      expect(job!.status).toBe('pending')
    })

    it('should default attempts to 0', () => {
      const id = repo.insert(makeJob())

      const job = repo.getById(id)
      expect(job!.attempts).toBe(0)
    })

    it('should handle null orderId', () => {
      const id = repo.insert(makeJob({ orderId: null }))

      const job = repo.getById(id)
      expect(job!.orderId).toBeNull()
    })

    it('should handle null filePath', () => {
      const id = repo.insert(makeJob({ filePath: null }))

      const job = repo.getById(id)
      expect(job!.filePath).toBeNull()
    })

    it('should accept all valid printer targets', () => {
      const id1 = repo.insert(makeJob({ printerTarget: 'printer1' }))
      const id2 = repo.insert(makeJob({ printerTarget: 'printer2' }))
      const id3 = repo.insert(makeJob({ printerTarget: 'ticket' }))

      expect(repo.getById(id1)!.printerTarget).toBe('printer1')
      expect(repo.getById(id2)!.printerTarget).toBe('printer2')
      expect(repo.getById(id3)!.printerTarget).toBe('ticket')
    })

    it('should reject invalid printer targets', () => {
      expect(() =>
        repo.insert({ printerTarget: 'invalid' as any, pdfType: 'stamp' })
      ).toThrow()
    })
  })

  describe('insertMany()', () => {
    it('should insert multiple jobs and return their IDs', () => {
      const jobs = [
        makeJob({ pdfType: 'stamp_1' }),
        makeJob({ pdfType: 'stamp_2', printerTarget: 'printer2' }),
        makeJob({ pdfType: 'ticket', printerTarget: 'ticket' })
      ]

      const ids = repo.insertMany(jobs)

      expect(ids).toHaveLength(3)
      expect(repo.count()).toBe(3)
    })

    it('should insert in a single transaction (all or nothing)', () => {
      const jobs = [
        makeJob({ pdfType: 'valid' }),
        { printerTarget: 'invalid_target' as any, pdfType: 'will_fail' }
      ]

      expect(() => repo.insertMany(jobs)).toThrow()
      expect(repo.count()).toBe(0)
    })

    it('should return sequential IDs', () => {
      const ids = repo.insertMany([
        makeJob({ pdfType: 'a' }),
        makeJob({ pdfType: 'b' }),
        makeJob({ pdfType: 'c' })
      ])

      expect(ids[1]).toBe(ids[0] + 1)
      expect(ids[2]).toBe(ids[1] + 1)
    })
  })

  describe('getById()', () => {
    it('should return null for non-existent ID', () => {
      const result = repo.getById(999)
      expect(result).toBeNull()
    })

    it('should return the full job record', () => {
      const id = repo.insert(makeJob({
        orderId: null,
        printerTarget: 'printer1',
        pdfType: 'stamp_tira',
        filePath: '/tmp/tira.pdf'
      }))

      const job = repo.getById(id)
      expect(job).not.toBeNull()
      expect(job!.id).toBe(id)
      expect(job!.orderId).toBeNull()
      expect(job!.printerTarget).toBe('printer1')
      expect(job!.pdfType).toBe('stamp_tira')
      expect(job!.status).toBe('pending')
      expect(job!.filePath).toBe('/tmp/tira.pdf')
      expect(job!.attempts).toBe(0)
      expect(job!.errorMessage).toBeNull()
      expect(job!.createdAt).toBeTruthy()
    })
  })

  describe('getAll()', () => {
    it('should return empty array when no jobs exist', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('should return all jobs ordered by id ASC', () => {
      repo.insert(makeJob({ pdfType: 'first' }))
      repo.insert(makeJob({ pdfType: 'second' }))
      repo.insert(makeJob({ pdfType: 'third' }))

      const all = repo.getAll()
      expect(all).toHaveLength(3)
      expect(all[0].pdfType).toBe('first')
      expect(all[1].pdfType).toBe('second')
      expect(all[2].pdfType).toBe('third')
    })
  })

  describe('getPending()', () => {
    it('should return only pending jobs', () => {
      const id1 = repo.insert(makeJob({ pdfType: 'pending_1' }))
      const id2 = repo.insert(makeJob({ pdfType: 'pending_2' }))
      repo.insert(makeJob({ pdfType: 'will_complete' }))

      // Mark the third as completed
      repo.markCompleted(id1 + 2)
      // Mark the first as printing
      repo.markPrinting(id1)

      const pending = repo.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].pdfType).toBe('pending_2')
    })

    it('should return empty array when no pending jobs', () => {
      const id = repo.insert(makeJob())
      repo.markCompleted(id)

      expect(repo.getPending()).toEqual([])
    })
  })

  describe('getPendingByTarget()', () => {
    it('should return pending jobs only for the specified target', () => {
      repo.insert(makeJob({ printerTarget: 'printer1', pdfType: 'p1_job' }))
      repo.insert(makeJob({ printerTarget: 'printer2', pdfType: 'p2_job' }))
      repo.insert(makeJob({ printerTarget: 'ticket', pdfType: 'ticket_job' }))

      const printer1Jobs = repo.getPendingByTarget('printer1')
      expect(printer1Jobs).toHaveLength(1)
      expect(printer1Jobs[0].pdfType).toBe('p1_job')

      const ticketJobs = repo.getPendingByTarget('ticket')
      expect(ticketJobs).toHaveLength(1)
      expect(ticketJobs[0].pdfType).toBe('ticket_job')
    })

    it('should not include non-pending jobs', () => {
      const id = repo.insert(makeJob({ printerTarget: 'printer1' }))
      repo.markCompleted(id)
      repo.insert(makeJob({ printerTarget: 'printer1', pdfType: 'still_pending' }))

      const pending = repo.getPendingByTarget('printer1')
      expect(pending).toHaveLength(1)
      expect(pending[0].pdfType).toBe('still_pending')
    })
  })

  describe('getByOrderId()', () => {
    it('should return all jobs for a specific order', () => {
      // We need a real order in the orders table to satisfy the FK.
      // But since FK is only a reference constraint and order_id can be null,
      // we'll insert with orderId = null for simplicity.
      // To test with an actual orderId, insert an order first.
      db.prepare(`
        INSERT INTO orders (event, vend_type, transaction_date, quantity, quantity_set, total_stamps, value)
        VALUES ('Test', 'Tarifa A', '2025-01-01', 1, 1, 1, 0.5)
      `).run()

      repo.insert(makeJob({ orderId: 1, pdfType: 'stamp_a' }))
      repo.insert(makeJob({ orderId: 1, pdfType: 'ticket' }))
      repo.insert(makeJob({ orderId: null, pdfType: 'other' }))

      const orderJobs = repo.getByOrderId(1)
      expect(orderJobs).toHaveLength(2)
      expect(orderJobs[0].pdfType).toBe('stamp_a')
      expect(orderJobs[1].pdfType).toBe('ticket')
    })

    it('should return empty array for non-existent order', () => {
      expect(repo.getByOrderId(999)).toEqual([])
    })
  })

  describe('markPrinting()', () => {
    it('should update status to printing', () => {
      const id = repo.insert(makeJob())

      repo.markPrinting(id)

      const job = repo.getById(id)
      expect(job!.status).toBe('printing')
    })

    it('should not affect other jobs', () => {
      const id1 = repo.insert(makeJob({ pdfType: 'job1' }))
      const id2 = repo.insert(makeJob({ pdfType: 'job2' }))

      repo.markPrinting(id1)

      expect(repo.getById(id2)!.status).toBe('pending')
    })
  })

  describe('markCompleted()', () => {
    it('should update status to completed', () => {
      const id = repo.insert(makeJob())

      repo.markCompleted(id)

      const job = repo.getById(id)
      expect(job!.status).toBe('completed')
    })
  })

  describe('markError()', () => {
    it('should update status to error with message and increment attempts', () => {
      const id = repo.insert(makeJob())

      repo.markError(id, 'Printer offline')

      const job = repo.getById(id)
      expect(job!.status).toBe('error')
      expect(job!.errorMessage).toBe('Printer offline')
      expect(job!.attempts).toBe(1)
    })

    it('should accumulate attempts on repeated errors', () => {
      const id = repo.insert(makeJob())

      repo.markError(id, 'First error')
      repo.markError(id, 'Second error')
      repo.markError(id, 'Third error')

      const job = repo.getById(id)
      expect(job!.attempts).toBe(3)
      expect(job!.errorMessage).toBe('Third error')
    })
  })

  describe('retry()', () => {
    it('should reset status to pending and clear error message', () => {
      const id = repo.insert(makeJob())
      repo.markError(id, 'Some error')

      repo.retry(id)

      const job = repo.getById(id)
      expect(job!.status).toBe('pending')
      expect(job!.errorMessage).toBeNull()
    })

    it('should preserve attempt count after retry', () => {
      const id = repo.insert(makeJob())
      repo.markError(id, 'Error 1')
      repo.markError(id, 'Error 2')

      repo.retry(id)

      const job = repo.getById(id)
      expect(job!.attempts).toBe(2) // Attempts not reset
      expect(job!.status).toBe('pending')
    })
  })

  describe('retryAllByTarget()', () => {
    it('should reset all error jobs for a target back to pending', () => {
      const id1 = repo.insert(makeJob({ printerTarget: 'printer1', pdfType: 'a' }))
      const id2 = repo.insert(makeJob({ printerTarget: 'printer1', pdfType: 'b' }))
      const id3 = repo.insert(makeJob({ printerTarget: 'printer2', pdfType: 'c' }))

      repo.markError(id1, 'Error')
      repo.markError(id2, 'Error')
      repo.markError(id3, 'Error')

      repo.retryAllByTarget('printer1')

      expect(repo.getById(id1)!.status).toBe('pending')
      expect(repo.getById(id1)!.errorMessage).toBeNull()
      expect(repo.getById(id2)!.status).toBe('pending')
      // printer2 job should remain in error
      expect(repo.getById(id3)!.status).toBe('error')
    })

    it('should not affect non-error jobs', () => {
      const id1 = repo.insert(makeJob({ printerTarget: 'printer1' }))
      const id2 = repo.insert(makeJob({ printerTarget: 'printer1' }))
      repo.markCompleted(id1)

      repo.retryAllByTarget('printer1')

      expect(repo.getById(id1)!.status).toBe('completed')
      expect(repo.getById(id2)!.status).toBe('pending')
    })
  })

  describe('purgeCompleted()', () => {
    it('should return 0 when no completed jobs exist', () => {
      repo.insert(makeJob())
      const purged = repo.purgeCompleted(0)
      expect(purged).toBe(0)
    })

    it('should not delete pending or error jobs', () => {
      const id1 = repo.insert(makeJob({ pdfType: 'pending_job' }))
      const id2 = repo.insert(makeJob({ pdfType: 'error_job' }))
      repo.markError(id2, 'Error')

      repo.purgeCompleted(0)

      expect(repo.count()).toBe(2)
    })
  })

  describe('countByStatus()', () => {
    it('should return zeros when empty', () => {
      const counts = repo.countByStatus()
      expect(counts).toEqual({
        pending: 0,
        printing: 0,
        completed: 0,
        error: 0
      })
    })

    it('should count jobs by status correctly', () => {
      const id1 = repo.insert(makeJob())
      const id2 = repo.insert(makeJob())
      const id3 = repo.insert(makeJob())
      const id4 = repo.insert(makeJob())
      repo.insert(makeJob()) // stays pending

      repo.markPrinting(id1)
      repo.markCompleted(id2)
      repo.markError(id3, 'Error')
      repo.markError(id4, 'Error')

      const counts = repo.countByStatus()
      expect(counts.pending).toBe(1)
      expect(counts.printing).toBe(1)
      expect(counts.completed).toBe(1)
      expect(counts.error).toBe(2)
    })
  })

  describe('count()', () => {
    it('should return 0 when empty', () => {
      expect(repo.count()).toBe(0)
    })

    it('should count all jobs regardless of status', () => {
      const id1 = repo.insert(makeJob())
      repo.insert(makeJob())
      repo.markCompleted(id1)

      expect(repo.count()).toBe(2)
    })
  })

  describe('status transitions', () => {
    it('should support the full lifecycle: pending -> printing -> completed', () => {
      const id = repo.insert(makeJob())

      expect(repo.getById(id)!.status).toBe('pending')

      repo.markPrinting(id)
      expect(repo.getById(id)!.status).toBe('printing')

      repo.markCompleted(id)
      expect(repo.getById(id)!.status).toBe('completed')
    })

    it('should support error and retry flow: pending -> printing -> error -> retry -> pending', () => {
      const id = repo.insert(makeJob())

      repo.markPrinting(id)
      repo.markError(id, 'Timeout')
      expect(repo.getById(id)!.status).toBe('error')
      expect(repo.getById(id)!.attempts).toBe(1)

      repo.retry(id)
      expect(repo.getById(id)!.status).toBe('pending')
      expect(repo.getById(id)!.attempts).toBe(1) // preserved
    })
  })
})
