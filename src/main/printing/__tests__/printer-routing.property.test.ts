/**
 * printer-routing.property.test.ts
 *
 * Property-based tests for print routing with a mock printer backend.
 *
 * Validates Correctness Property 9: Enrutamiento determinista de impresión
 *
 * "For any generated print job, model 1 stamps must route exclusively to PRINTER_1,
 *  model 2 stamps to PRINTER_2, and all tickets to PRINTER_TICKET.
 *  Media options must be DC55x25 for stamps and Custom.78x{height}mm for tickets."
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  PrinterManager,
  PrinterBackend,
  PrintOptions,
  PrintResult,
  PrinterTarget,
  STAMP_MEDIA,
  STAMP_ORIENTATION,
  TICKET_ORIENTATION,
  buildTicketMedia
} from '../printer-manager'
import { PrintQueueService } from '../print-queue.service'
import type { GeneratedPdf } from '../pdf-generator'
import type { PrintJob, PrinterTarget as RepoTarget } from '../../database/repositories/print-queue.repository'

// ─── Mock Printer Backend ─────────────────────────────────────────────────────

/** Recorded print call for assertion */
interface RecordedPrintCall {
  printerUri: string
  buffer: Buffer
  options: PrintOptions
}

/**
 * Creates a mock PrinterBackend that records all print calls for later assertion.
 * This enables verifying routing: which URI received which PDF with what options.
 */
function createRecordingBackend(): { backend: PrinterBackend; calls: RecordedPrintCall[] } {
  const calls: RecordedPrintCall[] = []

  const backend: PrinterBackend = {
    print: vi.fn(async (printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> => {
      calls.push({ printerUri, buffer: pdfBuffer, options })
      return { success: true, jobId: `job-${calls.length}` }
    }),
    getStatus: vi.fn(async () => 'ready' as const),
    pause: vi.fn(async () => true),
    resume: vi.fn(async () => true),
    discover: vi.fn(async () => []),
    cancelJob: vi.fn(async () => true)
  }

  return { backend, calls }
}

// ─── Mock Print Queue Repository ──────────────────────────────────────────────

function createMockRepository() {
  let nextId = 1
  const jobs: Map<number, PrintJob> = new Map()

  return {
    insert: vi.fn((job: { orderId: number | null; printerTarget: string; pdfType: string; filePath: string | null }) => {
      const id = nextId++
      const printJob: PrintJob = {
        id,
        orderId: job.orderId ?? null,
        printerTarget: job.printerTarget as RepoTarget,
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
    getById: vi.fn((id: number) => jobs.get(id) ?? null),
    getPending: vi.fn(() => Array.from(jobs.values()).filter((j) => j.status === 'pending')),
    getPendingByTarget: vi.fn((target: string) =>
      Array.from(jobs.values()).filter((j) => j.status === 'pending' && j.printerTarget === target)
    ),
    getAll: vi.fn(() => Array.from(jobs.values())),
    markPrinting: vi.fn((id: number) => {
      const job = jobs.get(id)
      if (job) job.status = 'printing'
    }),
    markCompleted: vi.fn((id: number) => {
      const job = jobs.get(id)
      if (job) job.status = 'completed'
    }),
    markError: vi.fn((id: number, errorMessage: string) => {
      const job = jobs.get(id)
      if (job) {
        job.status = 'error'
        job.errorMessage = errorMessage
        job.attempts++
      }
    }),
    retry: vi.fn((id: number) => {
      const job = jobs.get(id)
      if (job) {
        job.status = 'pending'
        job.errorMessage = null
      }
    }),
    retryAllByTarget: vi.fn(),
    countByStatus: vi.fn(() => ({ pending: 0, printing: 0, completed: 0, error: 0 })),
    count: vi.fn(() => jobs.size),
    purgeCompleted: vi.fn(() => 0),
    insertMany: vi.fn(() => []),
    getByOrderId: vi.fn(() => [])
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Arbitrary for printer target (printer1, printer2, or ticket) */
const arbPrinterTarget: fc.Arbitrary<PrinterTarget> = fc.constantFrom('printer1', 'printer2', 'ticket')

/** Arbitrary for stamp targets only (printer1 or printer2) */
const arbStampTarget: fc.Arbitrary<'printer1' | 'printer2'> = fc.constantFrom('printer1', 'printer2')

/** Arbitrary for PDF types */
const arbStampPdfType = fc.constantFrom('stamp_simple', 'stamp_tira', 'stamp_especial')
const arbTicketPdfType = fc.constantFrom('ticket', 'ticket_caja', 'ticket_master')

/** Arbitrary for a small positive integer (buffer size simulation) */
const arbBufferSize = fc.integer({ min: 10, max: 500 })

/** Arbitrary for a valid ticket height in mm */
const arbTicketHeight = fc.integer({ min: 50, max: 500 })

/** Generates a batch of stamp PDFs all targeting a single printer */
const arbStampPdfBatch: fc.Arbitrary<GeneratedPdf[]> = fc
  .tuple(
    arbStampTarget,
    fc.integer({ min: 1, max: 8 }),
    arbBufferSize
  )
  .map(([target, count, bufSize]) => {
    const pdfs: GeneratedPdf[] = []
    for (let i = 0; i < count; i++) {
      const pdfType = i % 2 === 0 ? 'stamp_simple' : 'stamp_tira'
      pdfs.push({
        buffer: Buffer.alloc(bufSize, `stamp-${target}-${i}`),
        target,
        pdfType,
        description: `${pdfType} ${target} #${i}`
      })
    }
    return pdfs
  })

/** Generates a batch of ticket PDFs */
const arbTicketPdfBatch: fc.Arbitrary<GeneratedPdf[]> = fc
  .integer({ min: 1, max: 3 })
  .map((count) => {
    const types = ['ticket', 'ticket_caja', 'ticket_master']
    const pdfs: GeneratedPdf[] = []
    for (let i = 0; i < count; i++) {
      pdfs.push({
        buffer: Buffer.alloc(100, `ticket-${i}`),
        target: 'ticket',
        pdfType: types[i % types.length],
        description: `${types[i % types.length]} #${i}`
      })
    }
    return pdfs
  })

/** Generates a mixed batch of stamp and ticket PDFs */
const arbMixedPdfBatch: fc.Arbitrary<GeneratedPdf[]> = fc
  .tuple(
    fc.integer({ min: 0, max: 5 }), // printer1 stamps
    fc.integer({ min: 0, max: 5 }), // printer2 stamps
    fc.integer({ min: 0, max: 3 })  // tickets
  )
  .filter(([p1, p2, t]) => p1 + p2 + t > 0) // at least one PDF
  .map(([printer1Count, printer2Count, ticketCount]) => {
    const pdfs: GeneratedPdf[] = []
    for (let i = 0; i < printer1Count; i++) {
      pdfs.push({
        buffer: Buffer.alloc(50, `p1-${i}`),
        target: 'printer1',
        pdfType: i % 2 === 0 ? 'stamp_simple' : 'stamp_tira',
        description: `stamp printer1 #${i}`
      })
    }
    for (let i = 0; i < printer2Count; i++) {
      pdfs.push({
        buffer: Buffer.alloc(50, `p2-${i}`),
        target: 'printer2',
        pdfType: i % 2 === 0 ? 'stamp_simple' : 'stamp_tira',
        description: `stamp printer2 #${i}`
      })
    }
    for (let i = 0; i < ticketCount; i++) {
      const types = ['ticket', 'ticket_caja', 'ticket_master']
      pdfs.push({
        buffer: Buffer.alloc(80, `tk-${i}`),
        target: 'ticket',
        pdfType: types[i % types.length],
        description: `ticket #${i}`
      })
    }
    return pdfs
  })

// ─── Printer URI constants for test setup ─────────────────────────────────────

const PRINTER_1_URI = 'ipp://192.168.1.101/ipp/print'
const PRINTER_2_URI = 'ipp://192.168.1.102/ipp/print'
const PRINTER_TICKET_URI = 'ipp://192.168.1.200/ipp/print'

// ─── Property 9: Enrutamiento determinista de impresión ───────────────────────

describe('Property 9: Enrutamiento determinista de impresión', () => {
  describe('9.1: Model 1 stamps route exclusively to PRINTER_1', () => {
    it('all printer1-targeted PDFs are sent to the printer1 URI', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8 }),
          async (stampCount) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            // Send multiple stamps to printer1
            for (let i = 0; i < stampCount; i++) {
              const buf = Buffer.alloc(50, `stamp1-${i}`)
              await manager.printStamp('printer1', buf, `stamp_simple_${i}`)
            }

            // All calls must go to PRINTER_1_URI
            expect(calls).toHaveLength(stampCount)
            for (const call of calls) {
              expect(call.printerUri).toBe(PRINTER_1_URI)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('printer1 stamps never arrive at printer2 or ticket URIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 6 }),
          async (count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printStamp('printer1', Buffer.from(`s1-${i}`))
            }

            for (const call of calls) {
              expect(call.printerUri).not.toBe(PRINTER_2_URI)
              expect(call.printerUri).not.toBe(PRINTER_TICKET_URI)
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('9.2: Model 2 stamps route exclusively to PRINTER_2', () => {
    it('all printer2-targeted PDFs are sent to the printer2 URI', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8 }),
          async (stampCount) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < stampCount; i++) {
              const buf = Buffer.alloc(50, `stamp2-${i}`)
              await manager.printStamp('printer2', buf, `stamp_tira_${i}`)
            }

            expect(calls).toHaveLength(stampCount)
            for (const call of calls) {
              expect(call.printerUri).toBe(PRINTER_2_URI)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('printer2 stamps never arrive at printer1 or ticket URIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 6 }),
          async (count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printStamp('printer2', Buffer.from(`s2-${i}`))
            }

            for (const call of calls) {
              expect(call.printerUri).not.toBe(PRINTER_1_URI)
              expect(call.printerUri).not.toBe(PRINTER_TICKET_URI)
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('9.3: All tickets route exclusively to PRINTER_TICKET', () => {
    it('all ticket PDFs are sent to the ticket printer URI', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTicketHeight,
          fc.integer({ min: 1, max: 5 }),
          async (height, ticketCount) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < ticketCount; i++) {
              const buf = Buffer.alloc(80, `ticket-${i}`)
              await manager.printTicket(buf, height, `ticket_${i}`)
            }

            expect(calls).toHaveLength(ticketCount)
            for (const call of calls) {
              expect(call.printerUri).toBe(PRINTER_TICKET_URI)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('tickets never arrive at stamp printer URIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTicketHeight,
          fc.integer({ min: 1, max: 3 }),
          async (height, count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printTicket(Buffer.from(`t-${i}`), height)
            }

            for (const call of calls) {
              expect(call.printerUri).not.toBe(PRINTER_1_URI)
              expect(call.printerUri).not.toBe(PRINTER_2_URI)
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('9.4: Stamp media is DC55x25 with landscape orientation (value 6)', () => {
    it('all stamp print calls use media DC55x25', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbStampTarget,
          fc.integer({ min: 1, max: 6 }),
          async (target, count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printStamp(target, Buffer.from(`stamp-${i}`))
            }

            for (const call of calls) {
              expect(call.options.media).toBe('DC55x25')
              expect(call.options.media).toBe(STAMP_MEDIA)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('all stamp print calls use landscape orientation (6)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbStampTarget,
          fc.integer({ min: 1, max: 6 }),
          async (target, count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printStamp(target, Buffer.from(`stamp-${i}`))
            }

            for (const call of calls) {
              expect(call.options.orientation).toBe(6)
              expect(call.options.orientation).toBe(STAMP_ORIENTATION)
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('9.5: Ticket media is Custom.78x{height}mm with portrait orientation (value 3)', () => {
    it('all ticket print calls use Custom.78x{height}mm media format', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTicketHeight,
          fc.integer({ min: 1, max: 4 }),
          async (height, count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printTicket(Buffer.from(`t-${i}`), height)
            }

            const expectedMedia = `Custom.78x${Math.ceil(height)}mm`
            for (const call of calls) {
              expect(call.options.media).toBe(expectedMedia)
              expect(call.options.media).toBe(buildTicketMedia(height))
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('all ticket print calls use portrait orientation (3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTicketHeight,
          fc.integer({ min: 1, max: 4 }),
          async (height, count) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            for (let i = 0; i < count; i++) {
              await manager.printTicket(Buffer.from(`t-${i}`), height)
            }

            for (const call of calls) {
              expect(call.options.orientation).toBe(3)
              expect(call.options.orientation).toBe(TICKET_ORIENTATION)
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('9.6: Mixed batches route correctly through PrintQueueService', () => {
    it('each PDF in a mixed batch reaches the correct printer URI with correct options', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbMixedPdfBatch,
          async (pdfs) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })
            const repository = createMockRepository()
            const service = new PrintQueueService(manager, repository as any, {
              maxAttempts: 3,
              pollIntervalMs: 100,
              retryDelayMs: 1
            })

            service.enqueue(pdfs)
            await service.processQueue()

            // Should have processed all PDFs
            expect(calls).toHaveLength(pdfs.length)

            // Verify each call was routed to the correct URI
            for (let i = 0; i < pdfs.length; i++) {
              const pdf = pdfs[i]
              const call = calls[i]

              // Verify correct URI routing
              if (pdf.target === 'printer1') {
                expect(call.printerUri).toBe(PRINTER_1_URI)
              } else if (pdf.target === 'printer2') {
                expect(call.printerUri).toBe(PRINTER_2_URI)
              } else {
                expect(call.printerUri).toBe(PRINTER_TICKET_URI)
              }

              // Verify correct media options
              if (pdf.target === 'ticket') {
                expect(call.options.orientation).toBe(TICKET_ORIENTATION)
                expect(call.options.media).toMatch(/^Custom\.78x\d+mm$/)
              } else {
                expect(call.options.media).toBe(STAMP_MEDIA)
                expect(call.options.orientation).toBe(STAMP_ORIENTATION)
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('printer1 PDFs never reach printer2 URI and vice versa in mixed batches', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbMixedPdfBatch,
          async (pdfs) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })
            const repository = createMockRepository()
            const service = new PrintQueueService(manager, repository as any, {
              maxAttempts: 3,
              pollIntervalMs: 100,
              retryDelayMs: 1
            })

            service.enqueue(pdfs)
            await service.processQueue()

            // Group calls by expected target
            const printer1Pdfs = pdfs.filter((p) => p.target === 'printer1')
            const printer2Pdfs = pdfs.filter((p) => p.target === 'printer2')
            const ticketPdfs = pdfs.filter((p) => p.target === 'ticket')

            // Count calls per URI
            const callsToPrinter1 = calls.filter((c) => c.printerUri === PRINTER_1_URI)
            const callsToPrinter2 = calls.filter((c) => c.printerUri === PRINTER_2_URI)
            const callsToTicket = calls.filter((c) => c.printerUri === PRINTER_TICKET_URI)

            expect(callsToPrinter1).toHaveLength(printer1Pdfs.length)
            expect(callsToPrinter2).toHaveLength(printer2Pdfs.length)
            expect(callsToTicket).toHaveLength(ticketPdfs.length)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('9.7: Routing is deterministic (same input → same routing)', () => {
    it('processing the same batch twice produces identical routing', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbMixedPdfBatch,
          async (pdfs) => {
            // First run
            const { backend: backend1, calls: calls1 } = createRecordingBackend()
            const manager1 = new PrinterManager(backend1, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })
            const repo1 = createMockRepository()
            const service1 = new PrintQueueService(manager1, repo1 as any, {
              maxAttempts: 3,
              pollIntervalMs: 100,
              retryDelayMs: 1
            })
            service1.enqueue(pdfs)
            await service1.processQueue()

            // Second run with same input
            const { backend: backend2, calls: calls2 } = createRecordingBackend()
            const manager2 = new PrinterManager(backend2, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })
            const repo2 = createMockRepository()
            const service2 = new PrintQueueService(manager2, repo2 as any, {
              maxAttempts: 3,
              pollIntervalMs: 100,
              retryDelayMs: 1
            })
            service2.enqueue(pdfs)
            await service2.processQueue()

            // Same number of calls
            expect(calls1).toHaveLength(calls2.length)

            // Same routing for each position
            for (let i = 0; i < calls1.length; i++) {
              expect(calls1[i].printerUri).toBe(calls2[i].printerUri)
              expect(calls1[i].options.media).toBe(calls2[i].options.media)
              expect(calls1[i].options.orientation).toBe(calls2[i].options.orientation)
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('9.8: Error cases for unassigned printers', () => {
    it('returns error when target printer is not assigned', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbPrinterTarget,
          async (target) => {
            const { backend, calls } = createRecordingBackend()
            // Manager with NO assignments
            const manager = new PrinterManager(backend, {})

            const result = await manager.print(target, Buffer.from('test'), {
              media: STAMP_MEDIA,
              orientation: STAMP_ORIENTATION
            })

            expect(result.success).toBe(false)
            expect(result.error).toContain(target)
            // Backend should NOT be called when no assignment exists
            expect(calls).toHaveLength(0)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('returns error when target printer is paused', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbStampTarget,
          async (target) => {
            const { backend, calls } = createRecordingBackend()
            const manager = new PrinterManager(backend, {
              printer1: PRINTER_1_URI,
              printer2: PRINTER_2_URI,
              ticket: PRINTER_TICKET_URI
            })

            await manager.pause(target)

            const result = await manager.printStamp(target, Buffer.from('paused-test'))

            expect(result.success).toBe(false)
            expect(result.error).toContain('paused')
            // Backend should NOT be called when paused
            expect(calls).toHaveLength(0)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('9.9: buildTicketMedia produces correct format', () => {
    it('buildTicketMedia(h) always returns "Custom.78x{ceil(h)}mm"', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 50, max: 600, noNaN: true }),
          (height) => {
            const media = buildTicketMedia(height)
            const expected = `Custom.78x${Math.ceil(height)}mm`
            expect(media).toBe(expected)
            // Must match the pattern
            expect(media).toMatch(/^Custom\.78x\d+mm$/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('buildTicketMedia for integer heights produces exact format', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 500 }),
          (height) => {
            const media = buildTicketMedia(height)
            expect(media).toBe(`Custom.78x${height}mm`)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
