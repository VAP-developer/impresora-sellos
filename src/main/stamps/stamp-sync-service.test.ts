// @vitest-environment node
/**
 * Tests for stamp-sync-service.ts
 *
 * Covers:
 * 1. Mock del endpoint API y verificar flujo completo
 * 2. Verificar que el bloqueo elimina datos locales correctamente
 * 3. Verificar que la descarga de imágenes las guarda en la ruta correcta
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter, Writable } from 'stream'

// ============================================================================
// Mocks
// ============================================================================

const FAKE_USER_DATA = '/tmp/fake-user-data'
const FAKE_MACHINE_ID = 'abc123machine'
const FAKE_API_KEY = 'test-api-key-12345'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return FAKE_USER_DATA
      return '/tmp/fake-path'
    })
  }
}))

// Mock user-config
vi.mock('../user-config', () => ({
  getUserConfig: vi.fn(() => ({
    version: 1,
    user: { id: 'test', username: 'testuser', displayName: 'Test User' },
    app: { welcomeMessage: 'Hola' },
    license: { apiKey: FAKE_API_KEY },
    database: {}
  }))
}))

// Mock machine-id
vi.mock('../license/machine-id', () => ({
  getMachineId: vi.fn(() => FAKE_MACHINE_ID)
}))

// Mock StampsRepository
const mockStampsRepo = {
  getAll: vi.fn(() => []),
  getByYear: vi.fn(() => []),
  upsert: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn()
}

vi.mock('../database/repositories/stamps.repository', () => {
  return {
    StampsRepository: class {
      getAll = mockStampsRepo.getAll
      getByYear = mockStampsRepo.getByYear
      upsert = mockStampsRepo.upsert
      remove = mockStampsRepo.remove
      clear = mockStampsRepo.clear
    }
  }
})

// Mock AppStateRepository
const mockAppStateRepo = {
  get: vi.fn(() => null),
  set: vi.fn(),
  delete: vi.fn(),
  isBlocked: vi.fn(() => false),
  setBlocked: vi.fn()
}

vi.mock('../database/repositories/app-state.repository', () => {
  return {
    AppStateRepository: class {
      get = mockAppStateRepo.get
      set = mockAppStateRepo.set
      delete = mockAppStateRepo.delete
      isBlocked = mockAppStateRepo.isBlocked
      setBlocked = mockAppStateRepo.setBlocked
    }
  }
})

// Mock fs
const mockExistsSync = vi.fn(() => false)
const mockMkdirSync = vi.fn()
const mockRmSync = vi.fn()
const mockCreateWriteStream = vi.fn()
const mockUnlinkSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
  createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args)
}))

// Mock https
const mockHttpsRequest = vi.fn()

vi.mock('https', () => ({
  request: (...args: unknown[]) => mockHttpsRequest(...args),
  default: { request: (...args: unknown[]) => mockHttpsRequest(...args) }
}))

// ============================================================================
// Helpers
// ============================================================================

/**
 * Creates a fake IncomingMessage (readable stream) that emits a JSON body.
 */
function createFakeResponse(data: unknown, statusCode = 200) {
  const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string> }
  response.statusCode = statusCode
  response.headers = {}
  // Emit data on next tick to allow listeners to attach
  setTimeout(() => {
    response.emit('data', JSON.stringify(data))
    response.emit('end')
  }, 0)
  return response
}

/**
 * Creates a fake writable stream for createWriteStream mock.
 */
function createFakeWriteStream() {
  const stream = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    }
  }) as Writable & { close: () => void }
  stream.close = () => stream.destroy()
  // Emit finish after a small delay
  const originalEnd = stream.end.bind(stream)
  stream.end = (...args: unknown[]) => {
    const result = originalEnd(...(args as []))
    setTimeout(() => stream.emit('finish'), 0)
    return result
  }
  return stream
}

/**
 * Creates a fake response stream for file downloads (pipes to writeStream).
 */
function createFakeDownloadResponse(statusCode = 200) {
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number
    headers: Record<string, string>
    pipe: (dest: Writable) => Writable
  }
  response.statusCode = statusCode
  response.headers = {}
  response.pipe = (dest: Writable) => {
    // Simulate piping data then finishing
    setTimeout(() => {
      dest.write(Buffer.from('fake-image-data'))
      dest.end()
    }, 0)
    return dest
  }
  return response
}

/**
 * Sets up the https mock for a POST (first call) and optional GETs (subsequent calls).
 */
function setupHttpsMock(
  postResponse: unknown,
  downloadCount = 0,
  postStatusCode = 200
) {
  let callIndex = 0

  mockHttpsRequest.mockImplementation((_options: unknown, callback?: (res: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { write: (data: string) => void; end: () => void }
    req.write = vi.fn()
    req.end = vi.fn()

    setTimeout(() => {
      if (callIndex === 0) {
        // First call is the POST to the sync API
        const response = createFakeResponse(postResponse, postStatusCode)
        if (callback) callback(response)
      } else {
        // Subsequent calls are file downloads
        const response = createFakeDownloadResponse(200)
        if (callback) callback(response)
      }
      callIndex++
    }, 0)

    return req
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('stamp-sync-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    mockCreateWriteStream.mockImplementation(() => {
      const ws = new Writable({
        write(_chunk, _encoding, cb) { cb() }
      }) as Writable & { close: () => void }
      ws.close = () => ws.destroy()
      // Emit finish when stream ends
      ws.on('finish', () => { /* already emitted by Writable */ })
      return ws
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // 1. Mock del endpoint API y verificar flujo completo
  // ==========================================================================
  describe('syncStamps - flujo completo con API mock', () => {
    it('devuelve error cuando no hay apiKey en la configuración', async () => {
      const { getUserConfig } = await import('../user-config')
      vi.mocked(getUserConfig).mockReturnValueOnce({
        version: 1,
        user: { id: 'test', username: 'testuser', displayName: 'Test User' },
        app: { welcomeMessage: 'Hola' },
        license: {},
        database: {}
      })

      const { syncStamps } = await import('./stamp-sync-service')
      const result = await syncStamps()

      expect(result.ok).toBe(false)
      expect(result.error).toContain('apiKey')
    })

    it('sincroniza correctamente cuando la API devuelve un catálogo con sellos nuevos', async () => {
      const catalogResponse = {
        ok: true,
        catalog: [
          {
            stampId: '2026#Boston 2026',
            year: '2026',
            stampName: 'Boston 2026',
            fondoUrl: 'https://s3.amazonaws.com/bucket/fondo.jpg?signed=1',
            logoUrl: 'https://s3.amazonaws.com/bucket/logo.png?signed=2',
            status: 'complete'
          },
          {
            stampId: '2026#Diwali 2026',
            year: '2026',
            stampName: 'Diwali 2026',
            fondoUrl: 'https://s3.amazonaws.com/bucket/diwali-fondo.jpg?signed=3',
            logoUrl: 'https://s3.amazonaws.com/bucket/diwali-logo.png?signed=4',
            status: 'complete'
          }
        ],
        summary: { total: 2, added: 2, removed: 0 }
      }

      // No local stamps exist yet
      mockStampsRepo.getAll.mockReturnValue([])

      setupHttpsMock(catalogResponse, 4) // 4 downloads (2 stamps × 2 images)

      const { syncStamps } = await import('./stamp-sync-service')
      const result = await syncStamps()

      expect(result.ok).toBe(true)
      expect(result.added).toBe(2)
      expect(result.removed).toBe(0)
      expect(result.total).toBe(2)

      // Verify upsert was called for each catalog item
      expect(mockStampsRepo.upsert).toHaveBeenCalledTimes(2)
      expect(mockStampsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          stampId: '2026#Boston 2026',
          year: '2026',
          stampName: 'Boston 2026',
          status: 'complete'
        })
      )
    })

    it('elimina sellos locales que no están en el catálogo remoto', async () => {
      const catalogResponse = {
        ok: true,
        catalog: [
          {
            stampId: '2026#Boston 2026',
            year: '2026',
            stampName: 'Boston 2026',
            fondoUrl: 'https://s3.amazonaws.com/bucket/fondo.jpg?signed=1',
            logoUrl: 'https://s3.amazonaws.com/bucket/logo.png?signed=2',
            status: 'complete'
          }
        ],
        summary: { total: 1, added: 0, removed: 1 }
      }

      // Local DB has a stamp that's no longer in the catalog
      mockStampsRepo.getAll.mockReturnValue([
        {
          id: 1,
          stampId: '2026#Boston 2026',
          year: '2026',
          stampName: 'Boston 2026',
          fondoPath: '/tmp/fake-user-data/stamps/2026/Boston 2026/Boston 2026-fondo.jpg',
          logoPath: '/tmp/fake-user-data/stamps/2026/Boston 2026/Boston 2026-sello.png',
          status: 'complete',
          syncedAt: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          stampId: '2025#OldStamp',
          year: '2025',
          stampName: 'OldStamp',
          fondoPath: '/tmp/fake-user-data/stamps/2025/OldStamp/OldStamp-fondo.jpg',
          logoPath: '/tmp/fake-user-data/stamps/2025/OldStamp/OldStamp-sello.png',
          status: 'complete',
          syncedAt: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z'
        }
      ])

      setupHttpsMock(catalogResponse, 0)

      const { syncStamps } = await import('./stamp-sync-service')
      const result = await syncStamps()

      expect(result.ok).toBe(true)
      expect(result.removed).toBe(1)

      // Verify the old stamp was removed from the DB
      expect(mockStampsRepo.remove).toHaveBeenCalledWith('2025#OldStamp')
    })

    it('devuelve error cuando la conexión falla', async () => {
      mockHttpsRequest.mockImplementation((_options: unknown, _callback?: unknown) => {
        const req = new EventEmitter() as EventEmitter & { write: (data: string) => void; end: () => void }
        req.write = vi.fn()
        req.end = vi.fn()
        setTimeout(() => {
          req.emit('error', new Error('ECONNREFUSED'))
        }, 0)
        return req
      })

      const { syncStamps } = await import('./stamp-sync-service')
      const result = await syncStamps()

      expect(result.ok).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })
  })

  // ==========================================================================
  // 2. Verificar que el bloqueo elimina datos locales correctamente
  // ==========================================================================
  describe('blockApplication - eliminación de datos locales', () => {
    it('limpia la tabla stamps de la base de datos', async () => {
      const { blockApplication } = await import('./stamp-sync-service')
      blockApplication(FAKE_API_KEY, FAKE_MACHINE_ID)

      expect(mockStampsRepo.clear).toHaveBeenCalled()
    })

    it('elimina la carpeta userData/stamps/ recursivamente', async () => {
      mockExistsSync.mockReturnValue(true)

      const { blockApplication } = await import('./stamp-sync-service')
      blockApplication(FAKE_API_KEY, FAKE_MACHINE_ID)

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('stamps'),
        expect.objectContaining({ recursive: true, force: true })
      )
    })

    it('elimina el archivo .license-ticket', async () => {
      mockExistsSync.mockReturnValue(true)

      const { blockApplication } = await import('./stamp-sync-service')
      blockApplication(FAKE_API_KEY, FAKE_MACHINE_ID)

      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('.license-ticket')
      )
    })

    it('establece el flag blocked = true en app_state', async () => {
      const { blockApplication } = await import('./stamp-sync-service')
      blockApplication(FAKE_API_KEY, FAKE_MACHINE_ID)

      expect(mockAppStateRepo.setBlocked).toHaveBeenCalledWith(true, {
        machineId: FAKE_MACHINE_ID,
        apiKey: FAKE_API_KEY
      })
    })

    it('registra la fecha del bloqueo', async () => {
      const { blockApplication } = await import('./stamp-sync-service')
      blockApplication(FAKE_API_KEY, FAKE_MACHINE_ID)

      expect(mockAppStateRepo.set).toHaveBeenCalledWith(
        'blocked_at',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      )
    })

    it('syncStamps llama a blockApplication cuando la API devuelve AUTH_FAILED', async () => {
      const authFailedResponse = {
        ok: false,
        error: 'AUTH_FAILED',
        reason: 'machineId no registrado para este usuario'
      }

      setupHttpsMock(authFailedResponse, 0, 401)

      const { syncStamps } = await import('./stamp-sync-service')
      const result = await syncStamps()

      expect(result.ok).toBe(false)
      expect(result.error).toBe('AUTH_FAILED')
      expect(result.blocked).toBe(true)

      // Verify block operations were executed
      expect(mockStampsRepo.clear).toHaveBeenCalled()
      expect(mockAppStateRepo.setBlocked).toHaveBeenCalledWith(true, {
        machineId: FAKE_MACHINE_ID,
        apiKey: FAKE_API_KEY
      })
    })
  })

  // ==========================================================================
  // 3. Verificar que la descarga de imágenes las guarda en la ruta correcta
  // ==========================================================================
  describe('syncStamps - rutas de descarga de imágenes', () => {
    it('crea el directorio {userData}/stamps/{year}/{stampName}/', async () => {
      const catalogResponse = {
        ok: true,
        catalog: [
          {
            stampId: '2026#Feria Madrid',
            year: '2026',
            stampName: 'Feria Madrid',
            fondoUrl: 'https://s3.amazonaws.com/bucket/fondo.jpg?signed=1',
            logoUrl: 'https://s3.amazonaws.com/bucket/logo.png?signed=2',
            status: 'complete'
          }
        ],
        summary: { total: 1, added: 1, removed: 0 }
      }

      mockStampsRepo.getAll.mockReturnValue([])
      setupHttpsMock(catalogResponse, 2)

      const { syncStamps } = await import('./stamp-sync-service')
      await syncStamps()

      // Verify directory creation for stamps base dir
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('stamps'),
        expect.objectContaining({ recursive: true })
      )

      // Verify directory creation for specific stamp folder
      const mkdirCalls = mockMkdirSync.mock.calls.map((c) => c[0] as string)
      const stampDirCall = mkdirCalls.find(
        (p) => p.includes('2026') && p.includes('Feria Madrid')
      )
      expect(stampDirCall).toBeDefined()
      // Verify path structure: userData/stamps/year/stampName
      expect(stampDirCall).toMatch(/stamps[/\\]2026[/\\]Feria Madrid/)
    })

    it('guarda fondo como {stampName}-fondo.jpg y sello como {stampName}-sello.png', async () => {
      const catalogResponse = {
        ok: true,
        catalog: [
          {
            stampId: '2026#Diwali 2026',
            year: '2026',
            stampName: 'Diwali 2026',
            fondoUrl: 'https://s3.amazonaws.com/bucket/diwali-fondo.jpg?signed=1',
            logoUrl: 'https://s3.amazonaws.com/bucket/diwali-logo.png?signed=2',
            status: 'complete'
          }
        ],
        summary: { total: 1, added: 1, removed: 0 }
      }

      mockStampsRepo.getAll.mockReturnValue([])
      setupHttpsMock(catalogResponse, 2)

      const { syncStamps } = await import('./stamp-sync-service')
      await syncStamps()

      // Verify createWriteStream was called with correct file paths
      const writeStreamCalls = mockCreateWriteStream.mock.calls.map((c) => c[0] as string)

      const fondoCall = writeStreamCalls.find((p) => p.includes('Diwali 2026-fondo.jpg'))
      const logoCall = writeStreamCalls.find((p) => p.includes('Diwali 2026-sello.png'))

      expect(fondoCall).toBeDefined()
      expect(logoCall).toBeDefined()

      // Verify full path structure
      expect(fondoCall).toMatch(/stamps[/\\]2026[/\\]Diwali 2026[/\\]Diwali 2026-fondo\.jpg/)
      expect(logoCall).toMatch(/stamps[/\\]2026[/\\]Diwali 2026[/\\]Diwali 2026-sello\.png/)
    })

    it('registra las rutas correctas en la base de datos al hacer upsert', async () => {
      const catalogResponse = {
        ok: true,
        catalog: [
          {
            stampId: '2025#Seoul 2025',
            year: '2025',
            stampName: 'Seoul 2025',
            fondoUrl: 'https://s3.amazonaws.com/bucket/seoul-fondo.jpg?signed=1',
            logoUrl: 'https://s3.amazonaws.com/bucket/seoul-logo.png?signed=2',
            status: 'complete'
          }
        ],
        summary: { total: 1, added: 1, removed: 0 }
      }

      mockStampsRepo.getAll.mockReturnValue([])
      setupHttpsMock(catalogResponse, 2)

      const { syncStamps } = await import('./stamp-sync-service')
      await syncStamps()

      expect(mockStampsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          stampId: '2025#Seoul 2025',
          year: '2025',
          stampName: 'Seoul 2025',
          fondoPath: expect.stringMatching(/stamps[/\\]2025[/\\]Seoul 2025[/\\]Seoul 2025-fondo\.jpg/),
          logoPath: expect.stringMatching(/stamps[/\\]2025[/\\]Seoul 2025[/\\]Seoul 2025-sello\.png/)
        })
      )
    })
  })
})
