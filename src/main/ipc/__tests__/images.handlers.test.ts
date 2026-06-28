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
  upload: vi.fn(),
  remove: vi.fn(),
  getByName: vi.fn(),
  getAll: vi.fn(),
  count: vi.fn()
}

vi.mock('../../database/repositories/images.repository', () => ({
  ImagesRepository: vi.fn(function () {
    return mockRepo
  })
}))

import { ipcMain } from 'electron'
import { registerImagesHandlers } from '../images.handlers'

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

describe('ipc/images.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    registerImagesHandlers()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  it('should register all expected IPC channels', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('images:upload', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('images:remove', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('images:getByName', expect.any(Function))
  })

  describe('images:upload', () => {
    it('should call repo.upload with name, dataUri, type, and size', async () => {
      const name = 'motivo-feria-2025.png'
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS...'
      const type = 'image/png'
      const size = 45678

      await invokeHandler('images:upload', name, dataUri, type, size)

      expect(mockRepo.upload).toHaveBeenCalledWith(name, dataUri, type, size)
    })

    it('should handle images with no type/size', async () => {
      await invokeHandler('images:upload', 'test.jpg', 'data:image/jpeg;base64,...', null, null)

      expect(mockRepo.upload).toHaveBeenCalledWith('test.jpg', 'data:image/jpeg;base64,...', null, null)
    })

    it('should propagate errors when upload fails', async () => {
      mockRepo.upload.mockImplementation(() => {
        throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: images.name')
      })

      await expect(
        invokeHandler('images:upload', 'dup.png', 'data:...', 'image/png', 100)
      ).rejects.toThrow('UNIQUE constraint failed')
    })
  })

  describe('images:remove', () => {
    it('should call repo.remove with the image name', async () => {
      mockRepo.remove.mockReturnValue(true)

      await invokeHandler('images:remove', 'old-motivo.png')

      expect(mockRepo.remove).toHaveBeenCalledWith('old-motivo.png')
    })

    it('should not throw when image does not exist', async () => {
      mockRepo.remove.mockReturnValue(false)

      // Should not throw even if image doesn't exist
      await expect(invokeHandler('images:remove', 'nonexistent.png')).resolves.not.toThrow()
      expect(mockRepo.remove).toHaveBeenCalledWith('nonexistent.png')
    })
  })

  describe('images:getByName', () => {
    it('should return image data when found', async () => {
      const imageData = { name: 'motivo1.png', url: 'data:image/png;base64,abc123' }
      mockRepo.getByName.mockReturnValue(imageData)

      const result = await invokeHandler('images:getByName', 'motivo1.png')

      expect(mockRepo.getByName).toHaveBeenCalledWith('motivo1.png')
      expect(result).toEqual(imageData)
    })

    it('should return null when image is not found', async () => {
      mockRepo.getByName.mockReturnValue(null)

      const result = await invokeHandler('images:getByName', 'nonexistent.png')

      expect(mockRepo.getByName).toHaveBeenCalledWith('nonexistent.png')
      expect(result).toBeNull()
    })

    it('should propagate errors from the repository', async () => {
      mockRepo.getByName.mockImplementation(() => {
        throw new Error('Database error')
      })

      await expect(
        invokeHandler('images:getByName', 'broken.png')
      ).rejects.toThrow('Database error')
    })
  })
})
