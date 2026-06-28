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

// Create the mock repo instance
const mockRepo = {
  insert: vi.fn(),
  exportCSV: vi.fn(),
  getAll: vi.fn(),
  count: vi.fn()
}

vi.mock('../../database/repositories/orders.repository', () => ({
  OrdersRepository: vi.fn(function () {
    return mockRepo
  })
}))

import { ipcMain } from 'electron'
import { registerOrdersHandlers } from '../orders.handlers'

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

describe('ipc/orders.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    registerOrdersHandlers()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  it('should register all expected IPC channels', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('orders:insert', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('orders:downloadCSV', expect.any(Function))
  })

  describe('orders:insert', () => {
    it('should call repo.insert with the provided order lines', async () => {
      const orderLines = [
        {
          event: 'Feria Madrid 2025',
          venue: 'Plaza Mayor',
          machine: 'CH17',
          vendType: 'Tarifa A',
          productName: 'Sello A',
          transactionDate: '2025-04-21T10:00:00',
          quantity: 2,
          quantitySet: 1,
          totalStamps: 2,
          currency: 'EUR',
          value: 1.0,
          paymentStatus: 'FERIA',
          sesionId: 1,
          etiquetasRollo1: 2,
          etiquetasRollo2: 0,
          etiquetaMes: '4',
          tituloEvento: 'Feria Madrid',
          feria: 'XLIX Feria Nacional Sello',
          lugar: 'Plaza Mayor Madrid',
          fecha: '21-24 abril 2025',
          mes: 4,
          annio: '25',
          documento: 'P4ES25 CH17-0001-001'
        }
      ]

      await invokeHandler('orders:insert', orderLines)

      expect(mockRepo.insert).toHaveBeenCalledWith(orderLines)
    })

    it('should handle multiple order lines', async () => {
      const orderLines = [
        {
          event: 'Feria 1',
          venue: 'Place 1',
          machine: 'CH17',
          vendType: 'Tarifa A',
          productName: 'Sello A',
          transactionDate: '2025-04-21T10:00:00',
          quantity: 1,
          quantitySet: 1,
          totalStamps: 1,
          currency: 'EUR',
          value: 0.5,
          paymentStatus: 'FERIA',
          sesionId: 1,
          etiquetasRollo1: 1,
          etiquetasRollo2: 0,
          etiquetaMes: '4',
          tituloEvento: 'Feria 1',
          feria: 'Feria Nacional',
          lugar: 'Madrid',
          fecha: '21 abril',
          mes: 4,
          annio: '25',
          documento: 'P4ES25 CH17-0001-001'
        },
        {
          event: 'Feria 1',
          venue: 'Place 1',
          machine: 'CH17',
          vendType: 'Tarifa B',
          productName: 'Sello B',
          transactionDate: '2025-04-21T10:00:00',
          quantity: 3,
          quantitySet: 1,
          totalStamps: 3,
          currency: 'EUR',
          value: 3.75,
          paymentStatus: 'FERIA',
          sesionId: 1,
          etiquetasRollo1: 0,
          etiquetasRollo2: 3,
          etiquetaMes: '4',
          tituloEvento: 'Feria 1',
          feria: 'Feria Nacional',
          lugar: 'Madrid',
          fecha: '21 abril',
          mes: 4,
          annio: '25',
          documento: 'P4ES25 CH17-0001-002'
        }
      ]

      await invokeHandler('orders:insert', orderLines)

      expect(mockRepo.insert).toHaveBeenCalledWith(orderLines)
    })

    it('should handle empty order array', async () => {
      await invokeHandler('orders:insert', [])

      expect(mockRepo.insert).toHaveBeenCalledWith([])
    })

    it('should propagate errors from the repository', async () => {
      mockRepo.insert.mockImplementation(() => {
        throw new Error('SQLITE_CONSTRAINT: NOT NULL constraint failed')
      })

      await expect(
        invokeHandler('orders:insert', [{ event: 'test' }])
      ).rejects.toThrow('SQLITE_CONSTRAINT')
    })
  })

  describe('orders:downloadCSV', () => {
    it('should call repo.exportCSV and return the CSV string', async () => {
      const csvData = 'id;event;venue\n1;Feria;Madrid'
      mockRepo.exportCSV.mockReturnValue(csvData)

      const result = await invokeHandler('orders:downloadCSV')

      expect(mockRepo.exportCSV).toHaveBeenCalledOnce()
      expect(result).toBe(csvData)
    })

    it('should return empty string when no orders exist', async () => {
      mockRepo.exportCSV.mockReturnValue('')

      const result = await invokeHandler('orders:downloadCSV')

      expect(result).toBe('')
    })

    it('should propagate errors from the repository', async () => {
      mockRepo.exportCSV.mockImplementation(() => {
        throw new Error('Database locked')
      })

      await expect(invokeHandler('orders:downloadCSV')).rejects.toThrow('Database locked')
    })
  })
})
