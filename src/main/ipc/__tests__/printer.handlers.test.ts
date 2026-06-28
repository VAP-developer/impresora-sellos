import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Store registered handlers so we can invoke them in tests
const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      registeredHandlers.set(channel, handler)
    })
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock the database connection
vi.mock('../../database/connection', () => ({
  getDatabase: vi.fn()
}))

// Create the mock repo instance for PrintQueueRepository
const mockQueueRepo = {
  insert: vi.fn(),
  insertMany: vi.fn(),
  getById: vi.fn(),
  getAll: vi.fn(),
  getPending: vi.fn(),
  getPendingByTarget: vi.fn(),
  getByOrderId: vi.fn(),
  markPrinting: vi.fn(),
  markCompleted: vi.fn(),
  markError: vi.fn(),
  retry: vi.fn(),
  retryAllByTarget: vi.fn(),
  purgeCompleted: vi.fn(),
  countByStatus: vi.fn(),
  count: vi.fn()
}

vi.mock('../../database/repositories/print-queue.repository', () => ({
  PrintQueueRepository: vi.fn(function () {
    return mockQueueRepo
  })
}))

import { ipcMain } from 'electron'
import { registerPrinterHandlers } from '../printer.handlers'

/**
 * Invokes a registered IPC handler simulating the Electron IPC call.
 */
async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel)
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`)
  }
  return handler({ sender: {} }, ...args)
}

describe('ipc/printer.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    registerPrinterHandlers()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  it('should register all expected IPC channels', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('printer:getStatus', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('printer:print', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('printer:pause', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('printer:resume', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('printer:getQueue', expect.any(Function))
  })

  describe('printer:getStatus', () => {
    it('should return an empty array (stub implementation)', async () => {
      const result = await invokeHandler('printer:getStatus')

      expect(result).toEqual([])
    })
  })

  describe('printer:print', () => {
    it('should accept config, quantities, and profile without throwing (stub)', async () => {
      const config = { ticket: {}, codigo: {}, sello: {}, precios: {} }
      const quantities = {
        tarifaAS1: 2, tarifaA2S1: 0, tarifaBS1: 0, tarifaCS1: 0,
        tarifaAT1: 0, tarifa4T1: 0,
        tarifaAS2: 1, tarifaA2S2: 0, tarifaBS2: 0, tarifaCS2: 0,
        tarifaAT2: 0, tarifa4T2: 0
      }
      const profile = 'FERIA'

      // Should not throw - it's a stub
      await expect(
        invokeHandler('printer:print', config, quantities, profile)
      ).resolves.not.toThrow()
    })
  })

  describe('printer:pause', () => {
    it('should execute without throwing (stub implementation)', async () => {
      await expect(invokeHandler('printer:pause')).resolves.not.toThrow()
    })
  })

  describe('printer:resume', () => {
    it('should execute without throwing (stub implementation)', async () => {
      await expect(invokeHandler('printer:resume')).resolves.not.toThrow()
    })
  })

  describe('printer:getQueue', () => {
    it('should return mapped print jobs from the queue repository', async () => {
      mockQueueRepo.getAll.mockReturnValue([
        {
          id: 1,
          orderId: 10,
          printerTarget: 'printer1',
          pdfType: 'stamp_simple',
          status: 'pending',
          filePath: '/tmp/stamp1.pdf',
          attempts: 0,
          errorMessage: null,
          createdAt: '2025-04-21T10:00:00'
        },
        {
          id: 2,
          orderId: 10,
          printerTarget: 'ticket',
          pdfType: 'ticket_main',
          status: 'completed',
          filePath: '/tmp/ticket1.pdf',
          attempts: 1,
          errorMessage: null,
          createdAt: '2025-04-21T10:00:01'
        }
      ])

      const result = await invokeHandler('printer:getQueue')

      expect(mockQueueRepo.getAll).toHaveBeenCalledOnce()
      expect(result).toEqual([
        {
          id: 1,
          orderId: 10,
          printerTarget: 'printer1',
          pdfType: 'stamp_simple',
          status: 'pending',
          filePath: '/tmp/stamp1.pdf',
          attempts: 0,
          errorMessage: undefined
        },
        {
          id: 2,
          orderId: 10,
          printerTarget: 'ticket',
          pdfType: 'ticket_main',
          status: 'completed',
          filePath: '/tmp/ticket1.pdf',
          attempts: 1,
          errorMessage: undefined
        }
      ])
    })

    it('should return empty array when queue is empty', async () => {
      mockQueueRepo.getAll.mockReturnValue([])

      const result = await invokeHandler('printer:getQueue')

      expect(result).toEqual([])
    })

    it('should handle jobs with null orderId and filePath', async () => {
      mockQueueRepo.getAll.mockReturnValue([
        {
          id: 3,
          orderId: null,
          printerTarget: 'printer2',
          pdfType: 'stamp_tira',
          status: 'error',
          filePath: null,
          attempts: 3,
          errorMessage: 'Printer not responding',
          createdAt: '2025-04-21T10:05:00'
        }
      ])

      const result = await invokeHandler('printer:getQueue')

      expect(result).toEqual([
        {
          id: 3,
          orderId: undefined,
          printerTarget: 'printer2',
          pdfType: 'stamp_tira',
          status: 'error',
          filePath: undefined,
          attempts: 3,
          errorMessage: 'Printer not responding'
        }
      ])
    })

    it('should propagate errors from the repository', async () => {
      mockQueueRepo.getAll.mockImplementation(() => {
        throw new Error('Database error')
      })

      await expect(invokeHandler('printer:getQueue')).rejects.toThrow('Database error')
    })
  })
})
