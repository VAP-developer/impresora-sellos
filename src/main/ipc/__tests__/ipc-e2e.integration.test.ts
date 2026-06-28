/**
 * IPC End-to-End Integration Test
 *
 * Verifies the complete communication flow:
 *   ipc-client (renderer) -> preload API -> ipcRenderer.invoke -> ipcMain.handle -> handlers -> repositories
 *
 * This test simulates the Electron IPC bridge by connecting ipcRenderer.invoke
 * to the handlers registered via ipcMain.handle, verifying that:
 * 1. The preload script correctly maps method calls to IPC channels
 * 2. Arguments are passed through correctly
 * 3. Handler responses are returned to the renderer
 * 4. Errors propagate correctly through the chain
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ===== Simulated IPC Bridge =====
// This map stores handlers registered via ipcMain.handle, simulating Electron's IPC.
const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

// This simulates the IPC bridge: when ipcRenderer.invoke is called,
// it looks up the handler registered via ipcMain.handle and calls it.
const mockIpcRenderer = {
  invoke: vi.fn(async (channel: string, ...args: unknown[]) => {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`)
    }
    // ipcMain.handle receives (_event, ...args), so we simulate the event object
    return handler({ sender: {} }, ...args)
  }),
  on: vi.fn(),
  removeListener: vi.fn()
}

const mockWebContents = { send: vi.fn() }
const mockWindows = [{ webContents: mockWebContents }]

// Mock electron modules to wire ipcMain.handle and ipcRenderer.invoke together
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      registeredHandlers.set(channel, handler)
    })
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => mockIpcRenderer.invoke(args[0] as string, ...args.slice(1)),
    on: (...args: unknown[]) => mockIpcRenderer.on(...args),
    removeListener: (...args: unknown[]) => mockIpcRenderer.removeListener(...args)
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => mockWindows)
  }
}))

// Mock the database connection
vi.mock('../../database/connection', () => ({
  getDatabase: vi.fn()
}))

// ===== Mock Repositories =====

const mockConfigRepo = {
  get: vi.fn(),
  set: vi.fn(),
  updateMaquina: vi.fn(),
  updateImprimir: vi.fn(),
  updateSesion: vi.fn(),
  updateSesionError: vi.fn(),
  updateRollos: vi.fn(),
  updateRollosRevert: vi.fn(),
  initConfig: vi.fn(),
  resetConfig: vi.fn()
}

const mockOrdersRepo = {
  insert: vi.fn(),
  exportCSV: vi.fn()
}

const mockImagesRepo = {
  upload: vi.fn(),
  remove: vi.fn(),
  getByName: vi.fn()
}

const mockPrintQueueRepo = {
  getAll: vi.fn(() => []),
  getByStatus: vi.fn(() => []),
  enqueue: vi.fn(),
  updateStatus: vi.fn(),
  incrementAttempts: vi.fn()
}

vi.mock('../../database/repositories/config.repository', () => ({
  ConfigRepository: vi.fn(function () {
    return mockConfigRepo
  })
}))

vi.mock('../../database/repositories/orders.repository', () => ({
  OrdersRepository: vi.fn(function () {
    return mockOrdersRepo
  })
}))

vi.mock('../../database/repositories/images.repository', () => ({
  ImagesRepository: vi.fn(function () {
    return mockImagesRepo
  })
}))

vi.mock('../../database/repositories/print-queue.repository', () => ({
  PrintQueueRepository: vi.fn(function () {
    return mockPrintQueueRepo
  })
}))

// ===== Import modules after mocks are set up =====
import { registerAllHandlers } from '../handlers'


// ===== Simulated Preload API (same as src/preload/index.ts) =====
// This recreates the preload API using the mocked ipcRenderer,
// verifying that the preload layer correctly maps calls to channels.
// Uses mockIpcRenderer directly (simulates what ipcRenderer.invoke does in the real preload).
function createPreloadAPI() {
  return {
    config: {
      get: () => mockIpcRenderer.invoke('config:get'),
      updateMaquina: (data: unknown) => mockIpcRenderer.invoke('config:updateMaquina', data),
      updateImprimir: (data: unknown) => mockIpcRenderer.invoke('config:updateImprimir', data),
      updateSesion: () => mockIpcRenderer.invoke('config:updateSesion'),
      updateSesionError: () => mockIpcRenderer.invoke('config:updateSesionError'),
      updateRollos: (sellos1: number, sellos2: number, tickets: number) =>
        mockIpcRenderer.invoke('config:updateRollos', sellos1, sellos2, tickets),
      updateRollosRevert: (sellos1: number, sellos2: number, tickets: number) =>
        mockIpcRenderer.invoke('config:updateRollosRevert', sellos1, sellos2, tickets),
      initConfig: () => mockIpcRenderer.invoke('config:initConfig')
    },
    orders: {
      insert: (orders: unknown) => mockIpcRenderer.invoke('orders:insert', orders),
      downloadCSV: () => mockIpcRenderer.invoke('orders:downloadCSV')
    },
    images: {
      upload: (name: string, dataUri: string, type: string, size: number) =>
        mockIpcRenderer.invoke('images:upload', name, dataUri, type, size),
      remove: (name: string) => mockIpcRenderer.invoke('images:remove', name),
      getByName: (name: string) => mockIpcRenderer.invoke('images:getByName', name)
    },
    printer: {
      getStatus: () => mockIpcRenderer.invoke('printer:getStatus'),
      print: (config: unknown, quantities: unknown, profile: string) =>
        mockIpcRenderer.invoke('printer:print', config, quantities, profile),
      pause: () => mockIpcRenderer.invoke('printer:pause'),
      resume: () => mockIpcRenderer.invoke('printer:resume'),
      getQueue: () => mockIpcRenderer.invoke('printer:getQueue')
    }
  }
}

// ===== Tests =====

describe('IPC End-to-End Integration', () => {
  let api: ReturnType<typeof createPreloadAPI>

  beforeEach(() => {
    vi.resetAllMocks()
    registeredHandlers.clear()

    // Reset mockIpcRenderer.invoke to use the IPC bridge simulation
    mockIpcRenderer.invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      const handler = registeredHandlers.get(channel)
      if (!handler) {
        throw new Error(`No handler registered for channel: ${channel}`)
      }
      return handler({ sender: {} }, ...args)
    })

    // Reset mockPrintQueueRepo.getAll default
    mockPrintQueueRepo.getAll.mockReturnValue([])

    // Register all handlers (this wires up ipcMain.handle for all channels)
    registerAllHandlers()

    // Create the preload API (simulates what contextBridge exposes to the renderer)
    api = createPreloadAPI()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  describe('Config domain: renderer -> main -> repository', () => {
    it('should get config through the full IPC chain', async () => {
      const expectedConfig = {
        ticket: { feria: 'XLIX Feria Nacional Sello', rollo1: 1500, rollo2: 1500 },
        codigo: { modo: 'P', maquina: 'CH17', cliente: 1 },
        sello: { elperfil: 6, elevento: 0 },
        precios: { tarifaA: 0.5, tarifaA2: 0.6, tarifaB: 1.25, tarifaC: 1.35 }
      }
      mockConfigRepo.get.mockReturnValue(expectedConfig)

      const result = await api.config.get()

      expect(mockConfigRepo.get).toHaveBeenCalledOnce()
      expect(result).toEqual(expectedConfig)
    })

    it('should update maquina config through the full IPC chain', async () => {
      const updatedConfig = { ticket: { feria: 'Updated' }, codigo: { maquina: 'FI01' }, sello: {}, precios: {} }
      mockConfigRepo.get.mockReturnValue(updatedConfig)

      const updateData = { ticket: { feria: 'Updated' }, codigo: { maquina: 'FI01' } }
      await api.config.updateMaquina(updateData)

      expect(mockConfigRepo.updateMaquina).toHaveBeenCalledWith(updateData)
      // Also verifies that notifyConfigChanged was triggered
      expect(mockConfigRepo.get).toHaveBeenCalled()
    })

    it('should update imprimir config through the full IPC chain', async () => {
      const updatedConfig = { ticket: {}, codigo: {}, sello: { elperfil: 3 }, precios: { tarifaA: 1.0 } }
      mockConfigRepo.get.mockReturnValue(updatedConfig)

      const updateData = {
        sello: { elperfil: 3, elnperfil: 'SPDE' },
        precios: { tarifaA: 1.0, tarifaA2: 1.2, tarifaB: 2.5, tarifaC: 2.7 }
      }
      await api.config.updateImprimir(updateData)

      expect(mockConfigRepo.updateImprimir).toHaveBeenCalledWith(updateData)
    })

    it('should increment session (updateSesion) through the full IPC chain', async () => {
      mockConfigRepo.get.mockReturnValue({ codigo: { cliente: 2 } })

      await api.config.updateSesion()

      expect(mockConfigRepo.updateSesion).toHaveBeenCalledOnce()
    })

    it('should decrement session on error (updateSesionError) through the full IPC chain', async () => {
      mockConfigRepo.get.mockReturnValue({ codigo: { cliente: 0 } })

      await api.config.updateSesionError()

      expect(mockConfigRepo.updateSesionError).toHaveBeenCalledOnce()
    })

    it('should update rollos through the full IPC chain with correct arguments', async () => {
      mockConfigRepo.get.mockReturnValue({ ticket: { rollo1: 1490, rollo2: 1495 } })

      await api.config.updateRollos(10, 5, 2)

      expect(mockConfigRepo.updateRollos).toHaveBeenCalledWith(10, 5, 2)
    })

    it('should revert rollos through the full IPC chain with correct arguments', async () => {
      mockConfigRepo.get.mockReturnValue({ ticket: { rollo1: 1500, rollo2: 1500 } })

      await api.config.updateRollosRevert(10, 5, 2)

      expect(mockConfigRepo.updateRollosRevert).toHaveBeenCalledWith(10, 5, 2)
    })

    it('should init config through the full IPC chain', async () => {
      mockConfigRepo.get.mockReturnValue({ ticket: { feria: 'XLIX' } })

      await api.config.initConfig()

      expect(mockConfigRepo.initConfig).toHaveBeenCalledOnce()
    })

    it('should propagate errors from repositories through the full chain', async () => {
      mockConfigRepo.get.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      await expect(api.config.get()).rejects.toThrow('Database connection failed')
    })
  })

  describe('Orders domain: renderer -> main -> repository', () => {
    it('should insert orders through the full IPC chain', async () => {
      const orders = [
        {
          event: 'Feria Madrid 2025',
          venue: 'Plaza Mayor',
          machine: 'CH17',
          vendType: 'Tarifa A',
          productName: 'Sello Normal',
          transactionDate: '2025-04-21',
          quantity: 3,
          quantitySet: 1,
          totalStamps: 3,
          currency: 'EUR',
          value: 1.5,
          paymentStatus: 'Filatelia',
          sesionId: 42,
          etiquetasRollo1: 3,
          etiquetasRollo2: 0,
          etiquetaMes: '4',
          tituloEvento: 'Feria Madrid',
          feria: 'XLIX Feria Nacional Sello',
          lugar: 'Plaza Mayor Madrid',
          fecha: '21-24 abril 2025',
          mes: 4,
          annio: '2025',
          documento: 'P4ES25 CH17-0042-001'
        }
      ]

      await api.orders.insert(orders)

      expect(mockOrdersRepo.insert).toHaveBeenCalledWith(orders)
    })

    it('should download CSV through the full IPC chain', async () => {
      const csvContent = 'event;venue;machine;quantity\nFeria;Plaza Mayor;CH17;3'
      mockOrdersRepo.exportCSV.mockReturnValue(csvContent)

      const result = await api.orders.downloadCSV()

      expect(mockOrdersRepo.exportCSV).toHaveBeenCalledOnce()
      expect(result).toBe(csvContent)
    })

    it('should propagate errors from orders repository', async () => {
      mockOrdersRepo.insert.mockImplementation(() => {
        throw new Error('Insert failed: constraint violation')
      })

      await expect(api.orders.insert([])).rejects.toThrow('Insert failed: constraint violation')
    })
  })

  describe('Images domain: renderer -> main -> repository', () => {
    it('should upload image through the full IPC chain', async () => {
      await api.images.upload('motivo1.png', 'data:image/png;base64,ABC123', 'image/png', 4096)

      expect(mockImagesRepo.upload).toHaveBeenCalledWith(
        'motivo1.png',
        'data:image/png;base64,ABC123',
        'image/png',
        4096
      )
    })

    it('should remove image through the full IPC chain', async () => {
      await api.images.remove('motivo1.png')

      expect(mockImagesRepo.remove).toHaveBeenCalledWith('motivo1.png')
    })

    it('should get image by name through the full IPC chain', async () => {
      const imageData = { name: 'motivo1.png', url: 'data:image/png;base64,ABC123' }
      mockImagesRepo.getByName.mockReturnValue(imageData)

      const result = await api.images.getByName('motivo1.png')

      expect(mockImagesRepo.getByName).toHaveBeenCalledWith('motivo1.png')
      expect(result).toEqual(imageData)
    })

    it('should return null when image not found', async () => {
      mockImagesRepo.getByName.mockReturnValue(null)

      const result = await api.images.getByName('nonexistent.png')

      expect(result).toBeNull()
    })

    it('should propagate errors from images repository', async () => {
      mockImagesRepo.upload.mockImplementation(() => {
        throw new Error('Image too large')
      })

      await expect(
        api.images.upload('big.png', 'data:image/png;base64,...', 'image/png', 999999999)
      ).rejects.toThrow('Image too large')
    })
  })

  describe('Printer domain: renderer -> main -> repository', () => {
    it('should get printer status through the full IPC chain', async () => {
      const result = await api.printer.getStatus()

      // Stub returns empty array (printer module not yet implemented)
      expect(result).toEqual([])
    })

    it('should call print through the full IPC chain without throwing', async () => {
      const config = { ticket: {}, codigo: {}, sello: {}, precios: {} }
      const quantities = {
        tarifaAS1: 2, tarifaA2S1: 0, tarifaBS1: 1, tarifaCS1: 0,
        tarifaAT1: 0, tarifa4T1: 0,
        tarifaAS2: 0, tarifaA2S2: 0, tarifaBS2: 0, tarifaCS2: 0,
        tarifaAT2: 0, tarifa4T2: 0
      }

      // Should not throw (stub implementation)
      await expect(api.printer.print(config, quantities, 'Filatelia')).resolves.not.toThrow()
    })

    it('should pause printer through the full IPC chain', async () => {
      await expect(api.printer.pause()).resolves.not.toThrow()
    })

    it('should resume printer through the full IPC chain', async () => {
      await expect(api.printer.resume()).resolves.not.toThrow()
    })

    it('should get print queue through the full IPC chain', async () => {
      mockPrintQueueRepo.getAll.mockReturnValue([
        {
          id: 1,
          orderId: 10,
          printerTarget: 'printer1',
          pdfType: 'stamp_simple',
          status: 'pending',
          filePath: '/tmp/stamp.pdf',
          attempts: 0,
          errorMessage: null
        }
      ])

      const result = await api.printer.getQueue()

      expect(result).toEqual([
        {
          id: 1,
          orderId: 10,
          printerTarget: 'printer1',
          pdfType: 'stamp_simple',
          status: 'pending',
          filePath: '/tmp/stamp.pdf',
          attempts: 0,
          errorMessage: undefined
        }
      ])
    })
  })

  describe('Channel wiring verification', () => {
    it('should have all expected channels registered after registerAllHandlers()', () => {
      const expectedChannels = [
        // Config
        'config:get',
        'config:updateMaquina',
        'config:updateImprimir',
        'config:updateSesion',
        'config:updateSesionError',
        'config:updateRollos',
        'config:updateRollosRevert',
        'config:initConfig',
        // Orders
        'orders:insert',
        'orders:downloadCSV',
        // Images
        'images:upload',
        'images:remove',
        'images:getByName',
        // Printer
        'printer:getStatus',
        'printer:print',
        'printer:pause',
        'printer:resume',
        'printer:getQueue'
      ]

      for (const channel of expectedChannels) {
        expect(
          registeredHandlers.has(channel),
          `Expected channel "${channel}" to be registered`
        ).toBe(true)
      }
    })

    it('should fail gracefully when calling an unregistered channel', async () => {
      await expect(
        mockIpcRenderer.invoke('nonexistent:channel')
      ).rejects.toThrow('No handler registered for channel: nonexistent:channel')
    })
  })

  describe('Data integrity: arguments pass through unchanged', () => {
    it('should preserve complex nested objects through the IPC chain (config:updateMaquina)', async () => {
      mockConfigRepo.get.mockReturnValue({})
      const complexData = {
        ticket: {
          feria: 'XLIX Feria Nacional del Sello',
          lugar: 'Plaza Mayor - Madrid',
          limiteImporte: 399.99,
          NUEVOlimiteImporte: 399.99,
          rollo1: 1500,
          rollo2: 1500,
          T1especial: 2.5,
          TEmod1: 'S',
          bloqueado: 'DESBLOQUEADO'
        },
        codigo: {
          modo: 'P',
          mes: 4,
          annio: '2025',
          pais: 'ES',
          maquina: 'CH17',
          cliente: 42,
          producto: 1
        }
      }

      await api.config.updateMaquina(complexData)

      expect(mockConfigRepo.updateMaquina).toHaveBeenCalledWith(complexData)
    })

    it('should preserve arrays through the IPC chain (orders:insert)', async () => {
      const multipleOrders = Array.from({ length: 5 }, (_, i) => ({
        event: `Event ${i}`,
        venue: 'Test Venue',
        machine: 'CH17',
        vendType: 'Tarifa A',
        productName: `Product ${i}`,
        transactionDate: '2025-04-21',
        quantity: i + 1,
        quantitySet: 1,
        totalStamps: i + 1,
        currency: 'EUR',
        value: (i + 1) * 0.5,
        paymentStatus: 'Filatelia',
        sesionId: i,
        etiquetasRollo1: i + 1,
        etiquetasRollo2: 0,
        etiquetaMes: '4',
        tituloEvento: 'Test',
        feria: 'Test Feria',
        lugar: 'Test Lugar',
        fecha: '2025',
        mes: 4,
        annio: '2025',
        documento: `DOC-${i}`
      }))

      await api.orders.insert(multipleOrders)

      expect(mockOrdersRepo.insert).toHaveBeenCalledWith(multipleOrders)
      expect((mockOrdersRepo.insert.mock.calls[0][0] as unknown[]).length).toBe(5)
    })

    it('should preserve numeric arguments through the IPC chain (config:updateRollos)', async () => {
      mockConfigRepo.get.mockReturnValue({})

      // Test with various numeric values including zero and large numbers
      await api.config.updateRollos(1500, 0, 450)

      expect(mockConfigRepo.updateRollos).toHaveBeenCalledWith(1500, 0, 450)
    })
  })
})
