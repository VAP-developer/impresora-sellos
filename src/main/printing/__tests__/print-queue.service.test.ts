/**
 * print-queue.service.test.ts
 *
 * Unit tests for PrintQueueService.
 * Tests queue processing, retry logic, and lifecycle management.
 *
 * Validates: Requirements 8.5 (error registration + retry), 8.6 (pause), 8.7 (resume),
 *            18.2 (persist before sending)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PrintQueueService, PrintQueueServiceOptions } from '../print-queue.service'
import { PrinterManager, PrinterBackend, PrintResult, PrinterStatus } from '../printer-manager'
import {
  PrintQueueRepository,
  PrintJob,
  PrinterTarget
} from '../../database/repositories/print-queue.repository'
import { GeneratedPdf } from '../pdf-generator'

// ─── Mock Backend ─────────────────────────────────────────────────────────────

function createMockBackend(overrides?: Partial<PrinterBackend>): PrinterBackend {
  return {
    print: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-1' }),
    getStatus: vi.fn().mockResolvedValue('ready' as PrinterStatus),
    pause: vi.fn().mockResolvedValue(true),
    resume: vi.fn().mockResolvedValue(true),
    discover: vi.fn().mockResolvedValue([]),
    cancelJob: vi.fn().mockResolvedValue(true),
    ...overrides
  }
}

// ─── Mock Repository ──────────────────────────────────────────────────────────

function createMockRepository(overrides?: Partial<PrintQueueRepository>): PrintQueueRepository {
  let nextId = 1
  const jobs: Map<number, PrintJob> = new Map()

  const repo = {
    insert: vi.fn((job) => {
      const id = nextId++
      const printJob: PrintJob = {
        id,
        orderId: job.orderId ?? null,
        printerTarget: job.printerTarget,
        pdfType: job.pdfType,
        status: 'pending',
        filePath: job.filePath ?? null,
        attempts: 0,
        errorMessage: null,
        createdAt: new Date().toISOString()
      }
      jobs.set(id, printJob)
      return id
    }),
    getById: vi.fn((id) => jobs.get(id) ?? null),
    getPending: vi.fn(() =>
      Array.from(jobs.values()).filter((j) => j.status === 'pending')
    ),
    getPendingByTarget: vi.fn((target: PrinterTarget) =>
      Array.from(jobs.values()).filter((j) => j.status === 'pending' && j.printerTarget === target)
    ),
    getAll: vi.fn(() => Array.from(jobs.values())),
    markPrinting: vi.fn((id) => {
      const job = jobs.get(id)
      if (job) job.status = 'printing'
    }),
    markCompleted: vi.fn((id) => {
      const job = jobs.get(id)
      if (job) job.status = 'completed'
    }),
    markError: vi.fn((id, errorMessage) => {
      const job = jobs.get(id)
      if (job) {
        job.status = 'error'
        job.errorMessage = errorMessage
        job.attempts++
      }
    }),
    retry: vi.fn((id) => {
      const job = jobs.get(id)
      if (job) {
        job.status = 'pending'
        job.errorMessage = null
      }
    }),
    retryAllByTarget: vi.fn((target) => {
      for (const job of jobs.values()) {
        if (job.status === 'error' && job.printerTarget === target) {
          job.status = 'pending'
          job.errorMessage = null
        }
      }
    }),
    countByStatus: vi.fn(() => {
      const counts = { pending: 0, printing: 0, completed: 0, error: 0 }
      for (const job of jobs.values()) {
        counts[job.status]++
      }
      return counts
    }),
    count: vi.fn(() => jobs.size),
    purgeCompleted: vi.fn(() => 0),
    insertMany: vi.fn(() => []),
    getByOrderId: vi.fn(() => []),
    ...overrides
  } as unknown as PrintQueueRepository

  return repo
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTestPdfs(count = 2): GeneratedPdf[] {
  const pdfs: GeneratedPdf[] = []
  for (let i = 0; i < count; i++) {
    pdfs.push({
      buffer: Buffer.from(`pdf-content-${i}`),
      target: i % 2 === 0 ? 'printer1' : 'printer2',
      pdfType: i % 2 === 0 ? 'stamp_simple' : 'stamp_tira',
      description: `Test PDF ${i}`
    })
  }
  return pdfs
}

function createTicketPdf(): GeneratedPdf {
  return {
    buffer: Buffer.from('ticket-content'),
    target: 'ticket',
    pdfType: 'ticket',
    description: 'Test ticket'
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PrintQueueService', () => {
  let backend: PrinterBackend
  let printerManager: PrinterManager
  let repository: PrintQueueRepository
  let service: PrintQueueService
  const serviceOptions: PrintQueueServiceOptions = {
    maxAttempts: 3,
    pollIntervalMs: 100,
    retryDelayMs: 10
  }

  beforeEach(() => {
    backend = createMockBackend()
    printerManager = new PrinterManager(backend, {
      printer1: 'ipp://printer1.local',
      printer2: 'ipp://printer2.local',
      ticket: 'ipp://ticket.local'
    })
    repository = createMockRepository()
    service = new PrintQueueService(printerManager, repository, serviceOptions)
  })

  afterEach(() => {
    service.stop()
  })

  // ─── Enqueue ────────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('inserts jobs into the repository and returns their IDs', () => {
      const pdfs = createTestPdfs(3)
      const ids = service.enqueue(pdfs)

      expect(ids).toHaveLength(3)
      expect(repository.insert).toHaveBeenCalledTimes(3)
    })

    it('stores PDF buffers in the internal cache', () => {
      const pdfs = createTestPdfs(2)
      service.enqueue(pdfs)

      expect(service.getBufferCacheSize()).toBe(2)
    })

    it('associates jobs with an order ID when provided', () => {
      const pdfs = createTestPdfs(1)
      service.enqueue(pdfs, 42)

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 42 })
      )
    })

    it('passes null orderId when not provided', () => {
      const pdfs = createTestPdfs(1)
      service.enqueue(pdfs)

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: null })
      )
    })

    it('correctly maps pdfType and printerTarget from GeneratedPdf', () => {
      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'ticket',
          pdfType: 'ticket_caja',
          description: 'Copia ticket'
        }
      ]
      service.enqueue(pdfs)

      expect(repository.insert).toHaveBeenCalledWith({
        orderId: null,
        printerTarget: 'ticket',
        pdfType: 'ticket_caja',
        filePath: null
      })
    })
  })

  // ─── Process Queue ──────────────────────────────────────────────────────

  describe('processQueue', () => {
    it('processes all pending jobs successfully', async () => {
      const pdfs = createTestPdfs(2)
      service.enqueue(pdfs)

      const processed = await service.processQueue()

      expect(processed).toBe(2)
      expect(repository.markPrinting).toHaveBeenCalledTimes(2)
      expect(repository.markCompleted).toHaveBeenCalledTimes(2)
    })

    it('marks jobs as printing before sending to printer', async () => {
      const pdfs = createTestPdfs(1)
      const ids = service.enqueue(pdfs)

      await service.processQueue()

      expect(repository.markPrinting).toHaveBeenCalledWith(ids[0])
    })

    it('removes buffer from cache after successful print', async () => {
      const pdfs = createTestPdfs(1)
      service.enqueue(pdfs)

      expect(service.getBufferCacheSize()).toBe(1)
      await service.processQueue()
      expect(service.getBufferCacheSize()).toBe(0)
    })

    it('skips jobs for paused printers', async () => {
      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test'
        }
      ]
      service.enqueue(pdfs)

      await printerManager.pause('printer1')

      const processed = await service.processQueue()

      expect(processed).toBe(0)
      expect(backend.print).not.toHaveBeenCalled()
    })

    it('processes jobs for non-paused printers even when some are paused', async () => {
      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test1'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'paused printer'
        },
        {
          buffer: Buffer.from('test2'),
          target: 'printer2',
          pdfType: 'stamp_simple',
          description: 'active printer'
        }
      ]
      service.enqueue(pdfs)

      await printerManager.pause('printer1')

      const processed = await service.processQueue()

      expect(processed).toBe(1)
    })

    it('handles printer errors by marking job as error', async () => {
      const failBackend = createMockBackend({
        print: vi.fn().mockResolvedValue({ success: false, error: 'Paper jam' })
      })
      const failManager = new PrinterManager(failBackend, {
        printer1: 'ipp://printer1.local'
      })
      const failService = new PrintQueueService(failManager, repository, serviceOptions)

      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test'
        }
      ]
      failService.enqueue(pdfs)

      const processed = await failService.processQueue()

      expect(processed).toBe(0)
      expect(repository.markError).toHaveBeenCalledWith(1, 'Paper jam')
    })

    it('handles exceptions from the printer backend', async () => {
      const throwBackend = createMockBackend({
        print: vi.fn().mockRejectedValue(new Error('Connection refused'))
      })
      const throwManager = new PrinterManager(throwBackend, {
        printer1: 'ipp://printer1.local'
      })
      const throwService = new PrintQueueService(throwManager, repository, serviceOptions)

      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test'
        }
      ]
      throwService.enqueue(pdfs)

      const processed = await throwService.processQueue()

      expect(processed).toBe(0)
      expect(repository.markError).toHaveBeenCalledWith(1, 'Connection refused')
    })

    it('marks error for jobs with no buffer in cache', async () => {
      // Simulate a job in the DB without a cached buffer (e.g., after restart)
      const pdfs = createTestPdfs(1)
      service.enqueue(pdfs)
      service.clearBufferCache()

      const processed = await service.processQueue()

      expect(processed).toBe(0)
      expect(repository.markError).toHaveBeenCalledWith(
        1,
        'PDF buffer not found in cache (possible restart)'
      )
    })

    it('skips jobs that have exceeded maxAttempts', async () => {
      const failBackend = createMockBackend({
        print: vi.fn().mockResolvedValue({ success: false, error: 'Offline' })
      })
      const failManager = new PrinterManager(failBackend, {
        printer1: 'ipp://printer1.local'
      })
      // maxAttempts = 1 so after one failure the job won't be retried in processQueue
      const failService = new PrintQueueService(failManager, repository, {
        ...serviceOptions,
        maxAttempts: 1
      })

      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test'
        }
      ]
      failService.enqueue(pdfs)

      // First process: job fails and gets retry scheduled (retry sets back to pending)
      await failService.processQueue()

      // At this point attempts=1 and job is back to pending, but maxAttempts=1,
      // so next processQueue should skip it
      const processed = await failService.processQueue()
      expect(processed).toBe(0)
    })

    it('prevents concurrent processing cycles', async () => {
      const slowBackend = createMockBackend({
        print: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50))
        )
      })
      const slowManager = new PrinterManager(slowBackend, {
        printer1: 'ipp://printer1.local'
      })
      const slowService = new PrintQueueService(slowManager, repository, serviceOptions)

      const pdfs = createTestPdfs(1)
      slowService.enqueue(pdfs)

      // Start two concurrent processQueue calls
      const [result1, result2] = await Promise.all([
        slowService.processQueue(),
        slowService.processQueue()
      ])

      // One should process, the other should return 0 (skipped)
      expect(result1 + result2).toBe(1)
    })
  })

  // ─── Print Options ──────────────────────────────────────────────────────

  describe('print options', () => {
    it('sends stamp jobs with DC55x25 media and landscape orientation', async () => {
      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('stamp'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test stamp'
        }
      ]
      service.enqueue(pdfs)
      await service.processQueue()

      expect(backend.print).toHaveBeenCalledWith(
        'ipp://printer1.local',
        Buffer.from('stamp'),
        expect.objectContaining({
          media: 'DC55x25',
          orientation: 6
        })
      )
    })

    it('sends ticket jobs with custom media and portrait orientation', async () => {
      const pdfs: GeneratedPdf[] = [createTicketPdf()]
      service.enqueue(pdfs)
      await service.processQueue()

      expect(backend.print).toHaveBeenCalledWith(
        'ipp://ticket.local',
        Buffer.from('ticket-content'),
        expect.objectContaining({
          media: 'Custom.78x200mm',
          orientation: 3
        })
      )
    })
  })

  // ─── Retry Logic ────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('retries a failed job by resetting it to pending', async () => {
      const failOnceBackend = createMockBackend({
        print: vi
          .fn()
          .mockResolvedValueOnce({ success: false, error: 'Busy' })
          .mockResolvedValue({ success: true })
      })
      const retryManager = new PrinterManager(failOnceBackend, {
        printer1: 'ipp://printer1.local'
      })
      const retryService = new PrintQueueService(retryManager, repository, serviceOptions)

      const pdfs: GeneratedPdf[] = [
        {
          buffer: Buffer.from('test'),
          target: 'printer1',
          pdfType: 'stamp_simple',
          description: 'test'
        }
      ]
      retryService.enqueue(pdfs)

      // First attempt fails, schedules retry
      await retryService.processQueue()
      expect(repository.markError).toHaveBeenCalled()
      expect(repository.retry).toHaveBeenCalledWith(1)

      // Second attempt succeeds
      const processed = await retryService.processQueue()
      expect(processed).toBe(1)
      expect(repository.markCompleted).toHaveBeenCalled()
    })

    it('retryErrorsByTarget resets error jobs for the target', () => {
      service.retryErrorsByTarget('printer1')
      expect(repository.retryAllByTarget).toHaveBeenCalledWith('printer1')
    })
  })

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('starts and stops the background processing loop', () => {
      expect(service.isRunning()).toBe(false)

      service.start()
      expect(service.isRunning()).toBe(true)

      service.stop()
      expect(service.isRunning()).toBe(false)
    })

    it('does not start twice', () => {
      service.start()
      service.start() // should not throw or create duplicate timers

      expect(service.isRunning()).toBe(true)
      service.stop()
    })
  })

  // ─── Queue Management ─────────────────────────────────────────────────

  describe('queue management', () => {
    it('returns queue status from repository', () => {
      const status = service.getStatus()
      expect(status).toEqual({ pending: 0, printing: 0, completed: 0, error: 0 })
    })

    it('returns all jobs', () => {
      const pdfs = createTestPdfs(2)
      service.enqueue(pdfs)

      const jobs = service.getQueue()
      expect(jobs).toHaveLength(2)
    })

    it('returns pending jobs by target', () => {
      service.getPendingByTarget('printer1')
      expect(repository.getPendingByTarget).toHaveBeenCalledWith('printer1')
    })

    it('purges completed jobs', () => {
      service.purgeCompleted(14)
      expect(repository.purgeCompleted).toHaveBeenCalledWith(14)
    })

    it('clears the buffer cache', () => {
      const pdfs = createTestPdfs(3)
      service.enqueue(pdfs)
      expect(service.getBufferCacheSize()).toBe(3)

      service.clearBufferCache()
      expect(service.getBufferCacheSize()).toBe(0)
    })
  })
})
