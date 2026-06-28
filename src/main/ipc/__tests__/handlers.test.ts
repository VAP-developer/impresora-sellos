import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Store registered handlers so we can invoke them in tests
const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

const mockWebContents = { send: vi.fn() }
const mockWindows = [{ webContents: mockWebContents }]

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      registeredHandlers.set(channel, handler)
    })
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => mockWindows)
  }
}))

import { BrowserWindow } from 'electron'
import { handleIpc, notifyConfigChanged } from '../handlers'

describe('ipc/handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
  })

  afterEach(() => {
    registeredHandlers.clear()
  })

  describe('handleIpc()', () => {
    it('should register a handler on ipcMain for the given channel', () => {
      handleIpc('test:channel', () => 'result')

      expect(registeredHandlers.has('test:channel')).toBe(true)
    })

    it('should return the handler result when called successfully', async () => {
      handleIpc('test:success', () => ({ data: 'hello' }))

      const handler = registeredHandlers.get('test:success')!
      const result = await handler({ sender: {} })

      expect(result).toEqual({ data: 'hello' })
    })

    it('should pass arguments from IPC to the handler function', async () => {
      const spy = vi.fn((a: unknown, b: unknown) => `${a}-${b}`)
      handleIpc('test:args', spy)

      const handler = registeredHandlers.get('test:args')!
      await handler({ sender: {} }, 'foo', 'bar')

      expect(spy).toHaveBeenCalledWith('foo', 'bar')
    })

    it('should handle async handlers', async () => {
      handleIpc('test:async', async () => {
        return 'async-result'
      })

      const handler = registeredHandlers.get('test:async')!
      const result = await handler({ sender: {} })

      expect(result).toBe('async-result')
    })

    it('should throw an error with the message when handler throws', async () => {
      handleIpc('test:error', () => {
        throw new Error('Something went wrong')
      })

      const handler = registeredHandlers.get('test:error')!

      await expect(handler({ sender: {} })).rejects.toThrow('Something went wrong')
    })

    it('should convert non-Error throws to string messages', async () => {
      handleIpc('test:string-error', () => {
        throw 'plain string error'
      })

      const handler = registeredHandlers.get('test:string-error')!

      await expect(handler({ sender: {} })).rejects.toThrow('plain string error')
    })
  })

  describe('notifyConfigChanged()', () => {
    it('should send config:changed event to all windows', () => {
      const config = { ticket: { feria: 'Test' } }

      notifyConfigChanged(config)

      expect(BrowserWindow.getAllWindows).toHaveBeenCalled()
      expect(mockWebContents.send).toHaveBeenCalledWith('config:changed', config)
    })

    it('should send to multiple windows', () => {
      const secondWebContents = { send: vi.fn() }
      ;(BrowserWindow.getAllWindows as ReturnType<typeof vi.fn>).mockReturnValue([
        { webContents: mockWebContents },
        { webContents: secondWebContents }
      ])

      const config = { ticket: { feria: 'Multi' } }
      notifyConfigChanged(config)

      expect(mockWebContents.send).toHaveBeenCalledWith('config:changed', config)
      expect(secondWebContents.send).toHaveBeenCalledWith('config:changed', config)
    })

    it('should handle no open windows gracefully', () => {
      ;(BrowserWindow.getAllWindows as ReturnType<typeof vi.fn>).mockReturnValue([])

      // Should not throw
      expect(() => notifyConfigChanged({ test: true })).not.toThrow()
    })
  })
})
