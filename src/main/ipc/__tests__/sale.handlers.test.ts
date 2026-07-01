/**
 * Tests for sale.handlers.ts - Integration of sale transaction + PDF generation + print queue
 *
 * These tests verify that:
 * 1. After a successful sale, generateSalePdfs is called with the updated session ID
 * 2. Generated PDFs are stored in the module-level cache
 * 3. PDF metadata (counts) is included in the SaleResult response
 * 4. If PDF generation fails, the sale result still succeeds with a pdfError field
 * 5. If the sale transaction fails, no PDFs are generated (Req 11.3)
 * 6. After PDFs are generated, they are enqueued in the print queue (Req 18.2)
 * 7. If enqueue fails, the sale still succeeds (PDFs remain cached)
 * 8. printJobIds are returned in the sale result
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-test'),
    isPackaged: false
  },
  ipcMain: {
    handle: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock the pdf-generator module
vi.mock('../../printing/pdf-generator', () => ({
  generateSalePdfs: vi.fn()
}))

// Mock the database connection module
vi.mock('../../database/connection', () => ({
  getDatabase: vi.fn()
}))

// Mock the services module
vi.mock('../../services', () => ({
  getPrintQueueService: vi.fn()
}))

import { ipcMain } from 'electron'
import { runMigrations } from '../../database/migrator'
import { ConfigRepository, getDefaultConfig } from '../../database/repositories/config.repository'
import type { AppConfig } from '../../database/repositories/config.repository'
import { getDatabase } from '../../database/connection'
import { generateSalePdfs } from '../../printing/pdf-generator'
import { getPrintQueueService } from '../../services'
import type { SaleGenerationResult, GeneratedPdf } from '../../printing/pdf-generator'
import { registerSaleHandlers, getPdfCache, consumePdfsForSession } from '../sale.handlers'
import type { KioskoQuantities, SaleResult } from '../../sales/sale.service'

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

function setupDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migrationsPath = join(__dirname, '..', '..', 'database', 'migrations')
  runMigrations(db, migrationsPath)

  const repo = new ConfigRepository(db)
  repo.initConfig()

  return db
}

function makeMockPdfResult(stampCount: number, ticketCount: number): SaleGenerationResult {
  const pdfs: GeneratedPdf[] = []

  for (let i = 0; i < stampCount; i++) {
    pdfs.push({
      buffer: Buffer.from(`stamp-pdf-${i}`),
      target: i % 2 === 0 ? 'printer1' : 'printer2',
      pdfType: 'stamp_simple',
      description: `Test stamp #${i + 1}`
    })
  }

  for (let i = 0; i < ticketCount; i++) {
    pdfs.push({
      buffer: Buffer.from(`ticket-pdf-${i}`),
      target: 'ticket',
      pdfType: 'ticket',
      description: `Test ticket #${i + 1}`
    })
  }

  return { pdfs, stampCount, ticketCount }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sale.handlers - PDF generation integration', () => {
  let db: Database.Database
  let saleHandler: (...args: unknown[]) => Promise<unknown>
  let mockEnqueue: ReturnType<typeof vi.fn>

  beforeEach(() => {
    db = setupDb()

    // Point the connection mock to our test DB
    vi.mocked(getDatabase).mockReturnValue(db)

    // Setup mock print queue service
    mockEnqueue = vi.fn().mockReturnValue([1, 2, 3])
    vi.mocked(getPrintQueueService).mockReturnValue({
      enqueue: mockEnqueue,
      start: vi.fn(),
      stop: vi.fn(),
      processQueue: vi.fn(),
      isRunning: vi.fn(),
      getStatus: vi.fn(),
      getQueue: vi.fn(),
      retryErrorsByTarget: vi.fn(),
      getPendingByTarget: vi.fn(),
      purgeCompleted: vi.fn(),
      clearBufferCache: vi.fn(),
      getBufferCacheSize: vi.fn()
    } as unknown as ReturnType<typeof getPrintQueueService>)

    // Clear caches
    getPdfCache().clear()

    // Reset mocks
    vi.mocked(ipcMain.handle).mockReset()
    vi.mocked(generateSalePdfs).mockReset()

    // Register handlers — captures the handler function
    registerSaleHandlers()

    // Extract the registered handler for 'sale:execute'
    // handleIpc calls ipcMain.handle internally, but our mock captures it differently
    // Since handleIpc wraps it, we need to get the raw handler from ipcMain.handle calls
    const handleCalls = vi.mocked(ipcMain.handle).mock.calls
    const saleExecuteCall = handleCalls.find((call) => call[0] === 'sale:execute')
    if (!saleExecuteCall) {
      throw new Error('sale:execute handler not registered')
    }
    // The handler is the second argument passed to ipcMain.handle
    saleHandler = saleExecuteCall[1] as (...args: unknown[]) => Promise<unknown>
  })

  afterEach(() => {
    db.close()
  })

  it('should call generateSalePdfs with updated sesionId after successful sale', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 2 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(2, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    const result = (await saleHandler({} /* event */, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(generateSalePdfs).toHaveBeenCalledTimes(1)

    // Verify the config passed to generateSalePdfs has the UPDATED cliente
    const callArgs = vi.mocked(generateSalePdfs).mock.calls[0]
    const pdfConfig = callArgs[0] as AppConfig
    expect(pdfConfig.codigo.cliente).toBe(result.sesionId)
    // Original config had cliente=1, after sale it should be 2
    expect(result.sesionId).toBe(config.codigo.cliente + 1)
  })

  it('should include PDF metadata in the sale result', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 3, tarifaBS2: 1 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(4, 2)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(result.stampCount).toBe(4)
    expect(result.ticketCount).toBe(2)
    expect(result.pdfCount).toBe(6)
    expect(result.pdfError).toBeUndefined()
  })

  it('should store generated PDFs in the cache keyed by sesionId', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(1, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)

    const cached = getPdfCache().get(result.sesionId)
    expect(cached).toBeDefined()
    expect(cached).toHaveLength(2) // 1 stamp + 1 ticket
  })

  it('should allow consuming cached PDFs via consumePdfsForSession', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaA2S1: 1 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(1, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    // First consume should return PDFs
    const pdfs = consumePdfsForSession(result.sesionId)
    expect(pdfs).toHaveLength(2)

    // Second consume should return null (already consumed)
    const pdfsAgain = consumePdfsForSession(result.sesionId)
    expect(pdfsAgain).toBeNull()
  })

  it('should return pdfError when PDF generation fails but sale remains committed', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    vi.mocked(generateSalePdfs).mockRejectedValue(new Error('Font file not found'))

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(result.sesionId).toBe(config.codigo.cliente + 1)
    expect(result.pdfError).toBe('Error generando PDFs: Font file not found')
    expect(result.pdfCount).toBeUndefined()
    expect(result.stampCount).toBeUndefined()
    expect(result.ticketCount).toBeUndefined()

    // Verify the sale data was committed (session incremented in DB)
    const dbConfig = db
      .prepare('SELECT data FROM config WHERE id = 1')
      .get() as { data: string }
    const savedConfig = JSON.parse(dbConfig.data) as AppConfig
    expect(savedConfig.codigo.cliente).toBe(config.codigo.cliente + 1)
  })

  it('should NOT call generateSalePdfs when sale transaction fails (Req 11.3)', async () => {
    const config = getDefaultConfig()
    // Empty cart — will fail validation
    const quantities: KioskoQuantities = emptyQuantities()
    const profile = 'FERIA'

    const result = await saleHandler({}, config, quantities, profile)

    expect((result as { success: boolean }).success).toBe(false)
    expect(generateSalePdfs).not.toHaveBeenCalled()
  })

  it('should NOT call generateSalePdfs when stock is insufficient', async () => {
    // Set rollo1 to 0 so any model1 sale fails
    const config = getDefaultConfig()
    config.ticket.rollo1 = 0
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    const result = await saleHandler({}, config, quantities, profile)

    expect((result as { success: boolean }).success).toBe(false)
    expect(generateSalePdfs).not.toHaveBeenCalled()
  })

  it('should pass quantities and profile unchanged to generateSalePdfs', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = {
      ...emptyQuantities(),
      tarifaAS1: 2,
      tarifaAT1: 1,
      tarifaBS2: 3
    }
    const profile = 'Filatelia'

    const mockPdfResult = makeMockPdfResult(6, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    await saleHandler({}, config, quantities, profile)

    const callArgs = vi.mocked(generateSalePdfs).mock.calls[0]
    expect(callArgs[1]).toEqual(quantities)
    expect(callArgs[2]).toBe('Filatelia')
  })

  // ─── Print Queue Integration Tests (Task 13.3) ───────────────────────────

  it('should enqueue PDFs in the print queue after successful generation (Req 18.2)', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 2 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(2, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    expect(mockEnqueue).toHaveBeenCalledWith(mockPdfResult.pdfs)
  })

  it('should include printJobIds in the sale result', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(1, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)
    mockEnqueue.mockReturnValue([10, 11])

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(result.printJobIds).toEqual([10, 11])
  })

  it('should NOT enqueue PDFs when sale transaction fails', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = emptyQuantities() // Empty cart → fail
    const profile = 'FERIA'

    await saleHandler({}, config, quantities, profile)

    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('should NOT enqueue PDFs when PDF generation fails', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    vi.mocked(generateSalePdfs).mockRejectedValue(new Error('Font error'))

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(result.pdfError).toBeDefined()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('should succeed even if enqueue throws (PDFs remain cached)', async () => {
    const config = getDefaultConfig()
    const quantities: KioskoQuantities = { ...emptyQuantities(), tarifaAS1: 1 }
    const profile = 'FERIA'

    const mockPdfResult = makeMockPdfResult(1, 1)
    vi.mocked(generateSalePdfs).mockResolvedValue(mockPdfResult)
    mockEnqueue.mockImplementation(() => {
      throw new Error('DB write failed')
    })

    const result = (await saleHandler({}, config, quantities, profile)) as SaleResult

    expect(result.success).toBe(true)
    expect(result.pdfCount).toBe(2) // 1 stamp + 1 ticket
    expect(result.printJobIds).toEqual([]) // Empty because enqueue failed

    // PDFs should still be in cache
    const cached = getPdfCache().get(result.sesionId)
    expect(cached).toBeDefined()
    expect(cached).toHaveLength(2)
  })
})
