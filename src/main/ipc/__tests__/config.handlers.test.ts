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

// Create the mock repo instance that will be returned by ConfigRepository constructor
const mockRepo = {
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

vi.mock('../../database/repositories/config.repository', () => ({
  ConfigRepository: vi.fn(function () {
    return mockRepo
  })
}))

import { ipcMain } from 'electron'
import { registerConfigHandlers } from '../config.handlers'

/**
 * Invokes a registered IPC handler simulating the Electron IPC call.
 * ipcMain.handle registers handlers with signature (event, ...args).
 * We pass a fake event object followed by the actual arguments.
 */
async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel)
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`)
  }
  // The handler registered by ipcMain.handle receives (_event, ...args)
  return handler({ sender: {} }, ...args)
}

describe('ipc/config.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    registerConfigHandlers()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  it('should register all expected IPC channels', () => {
    const expectedChannels = [
      'config:get',
      'config:updateMaquina',
      'config:updateImprimir',
      'config:updateSesion',
      'config:updateSesionError',
      'config:updateRollos',
      'config:updateRollosRevert',
      'config:initConfig'
    ]

    for (const channel of expectedChannels) {
      expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
    }
  })

  describe('config:get', () => {
    it('should call repo.get() and return the config', async () => {
      const mockConfig = { ticket: { feria: 'Test' }, codigo: {}, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      const result = await invokeHandler('config:get')

      expect(mockRepo.get).toHaveBeenCalledOnce()
      expect(result).toBe(mockConfig)
    })

    it('should return null when no config exists', async () => {
      mockRepo.get.mockReturnValue(null)

      const result = await invokeHandler('config:get')

      expect(result).toBeNull()
    })

    it('should propagate errors as thrown exceptions', async () => {
      mockRepo.get.mockImplementation(() => {
        throw new Error('Database error')
      })

      await expect(invokeHandler('config:get')).rejects.toThrow('Database error')
    })
  })

  describe('config:updateMaquina', () => {
    it('should call repo.updateMaquina with provided data', async () => {
      const mockConfig = { ticket: { feria: 'Updated' }, codigo: {}, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      const updateData = { ticket: { feria: 'New Feria' }, codigo: { maquina: 'FI01' } }
      await invokeHandler('config:updateMaquina', updateData)

      expect(mockRepo.updateMaquina).toHaveBeenCalledWith(updateData)
    })

    it('should notify config changed after update', async () => {
      const mockConfig = { ticket: { feria: 'Updated' }, codigo: {}, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:updateMaquina', { ticket: {}, codigo: {} })

      // get() is called after updateMaquina to fetch the updated config for notification
      expect(mockRepo.get).toHaveBeenCalled()
    })

    it('should propagate repository errors', async () => {
      mockRepo.updateMaquina.mockImplementation(() => {
        throw new Error('Config not initialized. Call initConfig() first.')
      })

      await expect(
        invokeHandler('config:updateMaquina', { ticket: {}, codigo: {} })
      ).rejects.toThrow('Config not initialized')
    })
  })

  describe('config:updateImprimir', () => {
    it('should call repo.updateImprimir with provided data', async () => {
      const mockConfig = { ticket: {}, codigo: {}, sello: { elperfil: 3 }, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      const updateData = {
        sello: { elperfil: 3, elnperfil: 'SPDE' },
        precios: { tarifaA: 1.0, tarifaA2: 1.2, tarifaB: 2.5, tarifaC: 2.7 }
      }
      await invokeHandler('config:updateImprimir', updateData)

      expect(mockRepo.updateImprimir).toHaveBeenCalledWith(updateData)
      expect(mockRepo.get).toHaveBeenCalled()
    })

    it('should propagate repository errors', async () => {
      mockRepo.updateImprimir.mockImplementation(() => {
        throw new Error('Config not initialized. Call initConfig() first.')
      })

      await expect(
        invokeHandler('config:updateImprimir', { sello: {}, precios: {} })
      ).rejects.toThrow('Config not initialized')
    })
  })

  describe('config:updateSesion', () => {
    it('should call repo.updateSesion and notify', async () => {
      const mockConfig = { ticket: {}, codigo: { cliente: 2 }, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:updateSesion')

      expect(mockRepo.updateSesion).toHaveBeenCalledOnce()
      expect(mockRepo.get).toHaveBeenCalled()
    })

    it('should propagate errors when config is not initialized', async () => {
      mockRepo.updateSesion.mockImplementation(() => {
        throw new Error('Config not initialized. Call initConfig() first.')
      })

      await expect(invokeHandler('config:updateSesion')).rejects.toThrow('Config not initialized')
    })
  })

  describe('config:updateSesionError', () => {
    it('should call repo.updateSesionError and notify', async () => {
      const mockConfig = { ticket: {}, codigo: { cliente: 1 }, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:updateSesionError')

      expect(mockRepo.updateSesionError).toHaveBeenCalledOnce()
      expect(mockRepo.get).toHaveBeenCalled()
    })
  })

  describe('config:updateRollos', () => {
    it('should call repo.updateRollos with correct arguments', async () => {
      const mockConfig = { ticket: { rollo1: 1490, rollo2: 1495, tickets: 448 }, codigo: {}, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:updateRollos', 10, 5, 2)

      expect(mockRepo.updateRollos).toHaveBeenCalledWith(10, 5, 2)
      expect(mockRepo.get).toHaveBeenCalled()
    })

    it('should handle zero decrements', async () => {
      mockRepo.get.mockReturnValue({})

      await invokeHandler('config:updateRollos', 0, 0, 0)

      expect(mockRepo.updateRollos).toHaveBeenCalledWith(0, 0, 0)
    })
  })

  describe('config:updateRollosRevert', () => {
    it('should call repo.updateRollosRevert with correct arguments', async () => {
      const mockConfig = { ticket: { rollo1: 1500, rollo2: 1500, tickets: 450 }, codigo: {}, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:updateRollosRevert', 10, 5, 2)

      expect(mockRepo.updateRollosRevert).toHaveBeenCalledWith(10, 5, 2)
      expect(mockRepo.get).toHaveBeenCalled()
    })
  })

  describe('config:initConfig', () => {
    it('should call repo.initConfig and notify', async () => {
      const mockConfig = { ticket: { feria: 'XLIX' }, codigo: { cliente: 1 }, sello: {}, precios: {} }
      mockRepo.get.mockReturnValue(mockConfig)

      await invokeHandler('config:initConfig')

      expect(mockRepo.initConfig).toHaveBeenCalledOnce()
      expect(mockRepo.get).toHaveBeenCalled()
    })
  })
})
