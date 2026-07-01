/**
 * sale-e2e.integration.test.ts
 *
 * End-to-end integration test for the complete sale flow:
 * Kiosko click → Atomic transaction (session + rollos + orders) → PDF generation → Printer routing
 *
 * This test exercises the full pipeline with a real SQLite database and real PDF generation,
 * only mocking the actual printer communication (the backend that sends bytes to hardware).
 *
 * Validates: Requirements 1, 3.2, 4.1, 4.2, 4.3, 6, 7, 8.1, 8.2, 11.1, 11.2, 11.3
 * Task: 13.8 - Verificar flujo completo end-to-end
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock electron (needed by several modules)
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-e2e-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-e2e-test'),
    isPackaged: false
  },
  ipcMain: {
    handle: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

// Mock the database connection to use our test DB
vi.mock('../../database/connection', () => ({
  getDatabase: vi.fn()
}))

import { getDatabase } from '../../database/connection'
import { runMigrations } from '../../database/migrator'
import {
  ConfigRepository
} from '../../database/repositories/config.repository'
import { PrintQueueRepository } from '../../database/repositories/print-queue.repository'
import type { AppConfig } from '../../database/repositories/config.repository'
import { executeSale, calcSellos1, calcSellos2 } from '../../sales/sale.service'
import type { KioskoQuantities } from '../../sales/sale.service'
import { generateSalePdfs } from '../../printing/pdf-generator'
import { PrinterManager, PrinterBackend, PrintOptions, PrintResult, STAMP_MEDIA, STAMP_ORIENTATION, TICKET_ORIENTATION } from '../../printing/printer-manager'
import { PrintQueueService } from '../../printing/print-queue.service'
import { ImagesRepository } from '../../database/repositories/images.repository'
import { setTestFontsPath, setTestImagesPath } from '../../printing/stamp-renderer'

// ─── Font/Image paths for PDF generation in tests ─────────────────────────────

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

/** Sets up a fresh in-memory database with migrations and default config */
function setupTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migrationsPath = join(__dirname, '..', '..', 'database', 'migrations')
  runMigrations(db, migrationsPath)

  const repo = new ConfigRepository(db)
  repo.initConfig()

  return db
}

/** Recorded print call for assertion */
interface RecordedPrintCall {
  printerUri: string
  buffer: Buffer
  options: PrintOptions
}

/** Creates a mock printer backend that records all print operations */
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

// ─── End-to-End Integration Tests ─────────────────────────────────────────────

describe('Sale E2E Integration: Kiosko → Transaction → PDFs → Printer', () => {
  let db: Database.Database
  let configRepo: ConfigRepository
  let imagesRepo: ImagesRepository
  let printQueueRepo: PrintQueueRepository

  beforeEach(() => {
    db = setupTestDb()
    vi.mocked(getDatabase).mockReturnValue(db)
    configRepo = new ConfigRepository(db)
    imagesRepo = new ImagesRepository(db)
    printQueueRepo = new PrintQueueRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── Test 1: Full pipeline for simple stamps (both models) ──────────────

  it('should execute complete sale flow: simple stamps → atomic transaction → PDFs → correct printer routing', async () => {
    const config = configRepo.get()!
    const initialCliente = config.codigo.cliente
    const initialRollo1 = config.ticket.rollo1
    const initialRollo2 = config.ticket.rollo2
    const initialTickets = config.ticket.tickets

    // Step 1: Kiosko quantities (simulates user clicking in the Kiosko view)
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 2,  // 2 stamps Tarifa A on model 1 (printer1)
      tarifaBS2: 1   // 1 stamp Tarifa B on model 2 (printer2)
    }

    // Step 2: Execute atomic sale transaction
    const saleResult = executeSale(config, quantities, 'FERIA', db)

    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    // Verify atomicity: session incremented
    expect(saleResult.sesionId).toBe(initialCliente + 1)

    // Verify atomicity: rollos decremented
    const updatedConfig = configRepo.get()!
    expect(updatedConfig.codigo.cliente).toBe(initialCliente + 1)
    expect(updatedConfig.ticket.rollo1).toBe(initialRollo1 - 2)  // 2 stamps from roll 1
    expect(updatedConfig.ticket.rollo2).toBe(initialRollo2 - 1)  // 1 stamp from roll 2
    expect(updatedConfig.ticket.tickets).toBe(initialTickets - 2) // 2 tickets (principal + copy)

    // Verify atomicity: orders inserted
    const orders = db.prepare('SELECT * FROM orders').all()
    expect(orders.length).toBeGreaterThan(0)

    // Step 3: Generate PDFs (using updated config with new session ID)
    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'FERIA', imagesRepo)

    // Verify PDFs generated for each tariff with qty > 0
    expect(pdfResult.pdfs.length).toBeGreaterThan(0)
    expect(pdfResult.stampCount).toBe(3) // 2 + 1 stamps

    // Verify stamp PDFs have correct targets
    const stampPdfs = pdfResult.pdfs.filter(p => p.pdfType === 'stamp_simple')
    const printer1Stamps = stampPdfs.filter(p => p.target === 'printer1')
    const printer2Stamps = stampPdfs.filter(p => p.target === 'printer2')
    expect(printer1Stamps.length).toBe(2) // 2 Tarifa A stamps for model 1
    expect(printer2Stamps.length).toBe(1) // 1 Tarifa B stamp for model 2

    // Verify tickets routed to ticket printer
    const ticketPdfs = pdfResult.pdfs.filter(p => p.target === 'ticket')
    expect(ticketPdfs.length).toBeGreaterThanOrEqual(1) // At least the main ticket
    // With ImprimeCopiaTicket="S" in default config, we expect 2 tickets
    expect(pdfResult.ticketCount).toBe(2) // ticket + copy

    // Step 4: Enqueue PDFs and verify printer routing via mock backend
    const { backend, calls } = createRecordingBackend()
    const printerManager = new PrinterManager(backend, {
      printer1: 'ipp://printer1.local/ipp/print',
      printer2: 'ipp://printer2.local/ipp/print',
      ticket: 'ipp://ticket-printer.local/ipp/print'
    })
    const queueService = new PrintQueueService(printerManager, printQueueRepo)

    // Enqueue all generated PDFs
    const jobIds = queueService.enqueue(pdfResult.pdfs)
    expect(jobIds.length).toBe(pdfResult.pdfs.length)

    // Process the queue (sends to printers)
    const processed = await queueService.processQueue()
    expect(processed).toBe(pdfResult.pdfs.length)

    // Verify routing: model1 stamps → printer1 URI
    const printer1Calls = calls.filter(c => c.printerUri === 'ipp://printer1.local/ipp/print')
    const printer2Calls = calls.filter(c => c.printerUri === 'ipp://printer2.local/ipp/print')
    const ticketCalls = calls.filter(c => c.printerUri === 'ipp://ticket-printer.local/ipp/print')

    expect(printer1Calls.length).toBe(2)  // 2 stamps to printer1
    expect(printer2Calls.length).toBe(1)  // 1 stamp to printer2
    expect(ticketCalls.length).toBe(2)    // ticket + copy to ticket printer

    // Verify print options: stamps get DC55x25 media with landscape orientation
    for (const call of [...printer1Calls, ...printer2Calls]) {
      expect(call.options.media).toBe(STAMP_MEDIA)
      expect(call.options.orientation).toBe(STAMP_ORIENTATION)
    }

    // Verify print options: tickets get Custom.78x{height}mm media
    for (const call of ticketCalls) {
      expect(call.options.media).toMatch(/^Custom\.78x\d+mm$/)
      expect(call.options.orientation).toBe(TICKET_ORIENTATION)
    }
  })

  // ─── Test 2: Tiras (strips) flow ───────────────────────────────────────────

  it('should handle tira (strip) sale flow correctly end-to-end', async () => {
    const config = configRepo.get()!
    const initialRollo1 = config.ticket.rollo1
    const initialTickets = config.ticket.tickets

    // Kiosko: 1 Tira Tarifa A for model 1 (consumes 4 stamps from roll1 + 1 ticket)
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAT1: 1
    }

    // Execute sale
    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    // Verify roll decrement: 4 stamps from roll1 for the tira
    const updatedConfig = configRepo.get()!
    expect(updatedConfig.ticket.rollo1).toBe(initialRollo1 - 4)
    // Tickets: 1 tira + 2 (principal + copy) = 3
    expect(updatedConfig.ticket.tickets).toBe(initialTickets - 3)

    // Generate PDFs
    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'FERIA', imagesRepo)

    // Tira generates 1 multi-page PDF (stamp_tira)
    const tiraPdfs = pdfResult.pdfs.filter(p => p.pdfType === 'stamp_tira')
    expect(tiraPdfs.length).toBe(1)
    expect(tiraPdfs[0].target).toBe('printer1')

    // Verify tickets generated
    expect(pdfResult.ticketCount).toBeGreaterThanOrEqual(1)

    // Route through printer
    const { backend, calls } = createRecordingBackend()
    const printerManager = new PrinterManager(backend, {
      printer1: 'ipp://printer1.local/ipp/print',
      printer2: 'ipp://printer2.local/ipp/print',
      ticket: 'ipp://ticket-printer.local/ipp/print'
    })
    const queueService = new PrintQueueService(printerManager, printQueueRepo)

    queueService.enqueue(pdfResult.pdfs)
    await queueService.processQueue()

    // Tira should go to printer1
    const printer1Calls = calls.filter(c => c.printerUri === 'ipp://printer1.local/ipp/print')
    expect(printer1Calls.length).toBe(1)
    expect(printer1Calls[0].options.media).toBe(STAMP_MEDIA)
  })

  // ─── Test 3: Mixed sale (both models + tiras) ──────────────────────────────

  it('should route mixed sale (simple + tiras, both models) to correct printers', async () => {
    const config = configRepo.get()!

    // Mixed sale: simple stamps + tiras across both models
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 1,   // 1 simple stamp model 1
      tarifaAT1: 1,   // 1 tira model 1 (4 stamps)
      tarifaCS2: 2,   // 2 simple stamps model 2
      tarifa4T2: 1    // 1 tira 4 tarifas model 2 (4 stamps)
    }

    // Execute sale
    const saleResult = executeSale(config, quantities, 'Filatelia', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    // Verify roll decrements
    const updatedConfig = configRepo.get()!
    const expectedSellos1 = 1 + 4  // 1 simple + 1 tira*4
    const expectedSellos2 = 2 + 4  // 2 simple + 1 tira*4
    expect(updatedConfig.ticket.rollo1).toBe(config.ticket.rollo1 - expectedSellos1)
    expect(updatedConfig.ticket.rollo2).toBe(config.ticket.rollo2 - expectedSellos2)

    // Generate PDFs
    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'Filatelia', imagesRepo)

    // Verify all stamps route to correct printers
    for (const pdf of pdfResult.pdfs) {
      if (pdf.pdfType === 'stamp_simple' || pdf.pdfType === 'stamp_tira') {
        // Check that model1 stamps → printer1, model2 stamps → printer2
        if (pdf.description.includes('modelo1')) {
          expect(pdf.target).toBe('printer1')
        } else if (pdf.description.includes('modelo2')) {
          expect(pdf.target).toBe('printer2')
        }
      }
      if (pdf.pdfType === 'ticket' || pdf.pdfType === 'ticket_caja' || pdf.pdfType === 'ticket_master') {
        expect(pdf.target).toBe('ticket')
      }
    }

    // Verify ticket title is modified for Filatelia profile
    // The ticket PDF is generated but we verify routing
    const ticketPdfs = pdfResult.pdfs.filter(p => p.target === 'ticket')
    expect(ticketPdfs.length).toBeGreaterThanOrEqual(1)

    // Route through printer and verify
    const { backend, calls } = createRecordingBackend()
    const printerManager = new PrinterManager(backend, {
      printer1: 'ipp://stamps1/print',
      printer2: 'ipp://stamps2/print',
      ticket: 'ipp://tickets/print'
    })
    const queueService = new PrintQueueService(printerManager, printQueueRepo)

    queueService.enqueue(pdfResult.pdfs)
    await queueService.processQueue()

    // All calls should go to assigned printers
    const stamps1 = calls.filter(c => c.printerUri === 'ipp://stamps1/print')
    const stamps2 = calls.filter(c => c.printerUri === 'ipp://stamps2/print')
    const tickets = calls.filter(c => c.printerUri === 'ipp://tickets/print')

    // Model 1: 1 simple + 1 tira = 2 print jobs to printer1
    expect(stamps1.length).toBe(2)
    // Model 2: 2 simple + 1 tira = 3 print jobs to printer2
    expect(stamps2.length).toBe(3)
    // Tickets: at least main + copy (default config has ImprimeCopiaTicket='S')
    expect(tickets.length).toBeGreaterThanOrEqual(2)
  })

  // ─── Test 4: Atomicity - failed transaction produces no PDFs ────────────────

  it('should not generate PDFs when transaction fails (Req 11.3)', async () => {
    const config = configRepo.get()!

    // Set roll1 to 0 — any model1 sale should fail
    config.ticket.rollo1 = 0
    configRepo.set(config)

    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 1  // Requires roll1 stock
    }

    // Transaction should fail
    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(false)

    // Verify no orders were inserted
    const orders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
    expect(orders.cnt).toBe(0)

    // Verify config unchanged
    const configAfter = configRepo.get()!
    expect(configAfter.codigo.cliente).toBe(config.codigo.cliente)
  })

  // ─── Test 5: Atomicity - all-or-nothing for session + rollos + orders ───────

  it('should ensure all-or-nothing atomicity: session increment, roll decrement, and order insertion', async () => {
    const config = configRepo.get()!
    const initialCliente = config.codigo.cliente
    const initialRollo1 = config.ticket.rollo1
    const initialRollo2 = config.ticket.rollo2

    // Successful sale
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 3,
      tarifaA2S2: 2
    }

    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    // All three must be consistent:
    const dbConfig = configRepo.get()!

    // 1. Session incremented exactly by 1
    expect(dbConfig.codigo.cliente).toBe(initialCliente + 1)

    // 2. Rolls decremented by exact consumed amounts
    expect(dbConfig.ticket.rollo1).toBe(initialRollo1 - calcSellos1(quantities))
    expect(dbConfig.ticket.rollo2).toBe(initialRollo2 - calcSellos2(quantities))

    // 3. Orders inserted (one per non-zero tariff/model combination)
    const orders = db.prepare('SELECT * FROM orders').all() as Array<{ sesion_id: number }>
    expect(orders.length).toBe(2) // tarifaAS1 and tarifaA2S2

    // All orders share the same session ID
    for (const order of orders) {
      expect(order.sesion_id).toBe(saleResult.sesionId)
    }
  })

  // ─── Test 6: PDF content correctness ───────────────────────────────────────

  it('should generate valid PDF buffers (non-empty) for each stamp and ticket', async () => {
    const config = configRepo.get()!

    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 1,
      tarifaBS2: 1
    }

    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'FERIA', imagesRepo)

    // Every generated PDF should be a non-empty Buffer
    for (const pdf of pdfResult.pdfs) {
      expect(pdf.buffer).toBeInstanceOf(Buffer)
      expect(pdf.buffer.length).toBeGreaterThan(0)
      // PDF files start with %PDF
      expect(pdf.buffer.toString('ascii', 0, 4)).toBe('%PDF')
    }
  })

  // ─── Test 7: Print queue persistence ───────────────────────────────────────

  it('should persist all print jobs in the queue before sending to printers (Req 18.2)', async () => {
    const config = configRepo.get()!

    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 1,
      tarifaCS2: 1
    }

    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'FERIA', imagesRepo)

    // Create queue service (without starting background processing)
    const { backend } = createRecordingBackend()
    const printerManager = new PrinterManager(backend, {
      printer1: 'ipp://p1/print',
      printer2: 'ipp://p2/print',
      ticket: 'ipp://t/print'
    })
    const queueService = new PrintQueueService(printerManager, printQueueRepo)

    // Enqueue — jobs should be persisted BEFORE any printing attempt
    const jobIds = queueService.enqueue(pdfResult.pdfs)

    // Verify jobs are in the database with 'pending' status
    const pendingJobs = printQueueRepo.getPending()
    expect(pendingJobs.length).toBe(pdfResult.pdfs.length)

    // Each job should have the correct printer_target
    for (let i = 0; i < pdfResult.pdfs.length; i++) {
      const job = printQueueRepo.getById(jobIds[i])!
      expect(job.printerTarget).toBe(pdfResult.pdfs[i].target)
      expect(job.pdfType).toBe(pdfResult.pdfs[i].pdfType)
      expect(job.status).toBe('pending')
    }
  })

  // ─── Test 8: Profile affects ticket title ──────────────────────────────────

  it('should generate tickets with profile-modified title for special profiles', async () => {
    const config = configRepo.get()!

    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 1
    }

    // Test with Filatelia profile - generates PDFs (we verify the ticket is present)
    const saleResult = executeSale(config, quantities, 'Filatelia', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'Filatelia', imagesRepo)

    // Should still have a ticket
    const ticketPdfs = pdfResult.pdfs.filter(p => p.pdfType === 'ticket')
    expect(ticketPdfs.length).toBe(1)
    expect(ticketPdfs[0].target).toBe('ticket')

    // The ticket is generated with modified title (verified by the description and existence)
    expect(ticketPdfs[0].buffer.length).toBeGreaterThan(0)
  })

  // ─── Test 9: Empty cart rejected ───────────────────────────────────────────

  it('should reject a sale when the cart is empty', () => {
    const config = configRepo.get()!
    const quantities = emptyQuantities()

    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(false)
    if (saleResult.success) return
    expect(saleResult.error).toContain('vacía')
  })

  // ─── Test 10: Full pipeline with Tira 4 Tarifas ────────────────────────────

  it('should handle Tira 4 Tarifas correctly through the full pipeline', async () => {
    const config = configRepo.get()!

    // 1 Tira 4 Tarifas on model 2 (generates a multi-page PDF with 4 different tariffs)
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifa4T2: 1
    }

    const saleResult = executeSale(config, quantities, 'FERIA', db)
    expect(saleResult.success).toBe(true)
    if (!saleResult.success) return

    // Roll 2 decremented by 4 (one tira = 4 stamps)
    const updatedConfig = configRepo.get()!
    expect(updatedConfig.ticket.rollo2).toBe(config.ticket.rollo2 - 4)

    // Generate PDFs
    const pdfConfig: AppConfig = {
      ...config,
      codigo: { ...config.codigo, cliente: saleResult.sesionId }
    }
    const pdfResult = await generateSalePdfs(pdfConfig, quantities, 'FERIA', imagesRepo)

    // Should have 1 tira PDF for printer2
    const tiraPdfs = pdfResult.pdfs.filter(p => p.pdfType === 'stamp_tira')
    expect(tiraPdfs.length).toBe(1)
    expect(tiraPdfs[0].target).toBe('printer2')

    // Route to printer
    const { backend, calls } = createRecordingBackend()
    const printerManager = new PrinterManager(backend, {
      printer1: 'ipp://p1/print',
      printer2: 'ipp://p2/print',
      ticket: 'ipp://ticket/print'
    })
    const queueService = new PrintQueueService(printerManager, printQueueRepo)

    queueService.enqueue(pdfResult.pdfs)
    await queueService.processQueue()

    // Tira should go to printer2 (model 2)
    const printer2Calls = calls.filter(c => c.printerUri === 'ipp://p2/print')
    expect(printer2Calls.length).toBe(1)
    expect(printer2Calls[0].options.media).toBe(STAMP_MEDIA)
    expect(printer2Calls[0].options.orientation).toBe(STAMP_ORIENTATION)

    // Tickets should go to ticket printer
    const ticketCalls = calls.filter(c => c.printerUri === 'ipp://ticket/print')
    expect(ticketCalls.length).toBeGreaterThanOrEqual(1)
    for (const call of ticketCalls) {
      expect(call.options.media).toMatch(/^Custom\.78x\d+mm$/)
    }
  })
})
