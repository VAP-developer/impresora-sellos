// @vitest-environment node
/**
 * Tests for the sync-stamps Lambda handler.
 *
 * The Lambda lives in aws/lambdas/sync-stamps/ with its own node_modules.
 * Since vi.mock can't intercept CJS requires that resolve to a different
 * node_modules tree, we use a wrapper approach: we read the handler source,
 * inject our mocked dependencies, and test the behavior.
 *
 * Strategy: We create mock instances for DynamoDB and S3 clients, then
 * patch the module's global scope by requiring the handler with mocked requires.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolve } from 'path'
import Module from 'module'

// --- Mock AWS SDK instances ---
const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()
const mockGetSignedUrl = vi.fn()

// Lambda directory for module resolution
const lambdaDir = resolve(__dirname, '../../../aws/lambdas/sync-stamps')

// Mocked module implementations
const mockedModules: Record<string, unknown> = {
  '@aws-sdk/client-dynamodb': {
    DynamoDBClient: class {
      send(...args: unknown[]) {
        return mockDynamoSend(...args)
      }
    },
    ScanCommand: class ScanCommand {
      constructor(public params: unknown) {}
    },
    QueryCommand: class QueryCommand {
      constructor(public params: unknown) {}
    },
    PutItemCommand: class PutItemCommand {
      constructor(public params: unknown) {}
    },
    DeleteItemCommand: class DeleteItemCommand {
      constructor(public params: unknown) {}
    }
  },
  '@aws-sdk/client-s3': {
    S3Client: class {
      send(...args: unknown[]) {
        return mockS3Send(...args)
      }
    },
    ListObjectsV2Command: class ListObjectsV2Command {
      constructor(public params: unknown) {}
    },
    GetObjectCommand: class GetObjectCommand {
      Bucket: string | undefined
      Key: string | undefined
      constructor(params: { Bucket?: string; Key?: string }) {
        this.Bucket = params?.Bucket
        this.Key = params?.Key
      }
    }
  },
  '@aws-sdk/s3-request-presigner': {
    getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args)
  }
}

// Patch require to intercept AWS SDK imports from the Lambda directory
const originalRequire = Module.prototype.require
// @ts-expect-error - patching Node internals
Module.prototype.require = function (id: string) {
  if (mockedModules[id]) {
    return mockedModules[id]
  }
  return originalRequire.apply(this, [id])
}

// Set environment variables
process.env.STAMPS_BUCKET = 'svvs-kiosko-stamps'
process.env.STAMP_CATALOG_TABLE = 'svvs-kiosko-stamp-catalog'
process.env.USERS_TABLE = 'svvs-kiosko-users'

// Clear module cache for the Lambda to force fresh require with our mocks
const lambdaPath = resolve(lambdaDir, 'index.js')
delete require.cache[lambdaPath]

// Now require the Lambda - it will use our mocked modules
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('../../../aws/lambdas/sync-stamps/index')

// Restore original require after loading
Module.prototype.require = originalRequire

// --- Helpers ---

function makeEvent(body: Record<string, unknown>) {
  return {
    httpMethod: 'POST',
    body: JSON.stringify(body)
  }
}

function validUserItem(username = 'testuser', machineId = 'machine-abc') {
  return {
    username: { S: username },
    apiKey: { S: 'valid-api-key' },
    activeMachines: {
      L: [{ M: { machineId: { S: machineId } } }]
    }
  }
}

function completeStampKeys(username: string, year: string, stampName: string) {
  return [
    { Key: `${username}/${year}/${stampName}/${stampName}-fondo.jpg` },
    { Key: `${username}/${year}/${stampName}/${stampName}-sello.png` }
  ]
}

function incompleteStampKeys(username: string, year: string, stampName: string) {
  return [{ Key: `${username}/${year}/${stampName}/${stampName}-fondo.jpg` }]
}

function setupSuccessfulFlow(
  username: string,
  machineId: string,
  s3Contents: { Key: string }[],
  existingCatalog: Record<string, unknown>[] = []
) {
  let dynamoCallCount = 0
  mockDynamoSend.mockImplementation(() => {
    dynamoCallCount++
    if (dynamoCallCount === 1) {
      return Promise.resolve({ Items: [validUserItem(username, machineId)] })
    }
    if (dynamoCallCount === 2) {
      return Promise.resolve({ Items: existingCatalog, LastEvaluatedKey: undefined })
    }
    return Promise.resolve({})
  })

  mockS3Send.mockResolvedValue({
    Contents: s3Contents,
    IsTruncated: false
  })

  mockGetSignedUrl.mockImplementation((_client: unknown, command: { Key?: string }) => {
    const key = command?.Key || 'unknown'
    return Promise.resolve(`https://signed-url/${key}`)
  })
}

describe('Lambda sync-stamps', () => {
  beforeEach(() => {
    mockDynamoSend.mockReset()
    mockS3Send.mockReset()
    mockGetSignedUrl.mockReset()
  })

  describe('Autenticación', () => {
    it('devuelve 401 con apiKey inválida (no encontrado en tabla de usuarios)', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] })

      const result = await handler(makeEvent({ apiKey: 'invalid-key', machineId: 'machine-abc' }))

      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('AUTH_FAILED')
      expect(body.reason).toContain('API Key')
    })

    it('devuelve 401 cuando machineId no está registrado para el usuario', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [validUserItem('testuser', 'registered-machine')]
      })

      const result = await handler(
        makeEvent({ apiKey: 'valid-api-key', machineId: 'unregistered-machine' })
      )

      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('AUTH_FAILED')
      expect(body.reason).toContain('machineId no registrado')
    })

    it('devuelve 401 cuando falta apiKey en el body', async () => {
      const result = await handler(makeEvent({ machineId: 'machine-abc' }))

      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('AUTH_FAILED')
      expect(body.reason).toContain('apiKey')
    })

    it('devuelve 401 cuando falta machineId en el body', async () => {
      const result = await handler(makeEvent({ apiKey: 'valid-api-key' }))

      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('AUTH_FAILED')
      expect(body.reason).toContain('machineId')
    })
  })

  describe('Sincronización exitosa', () => {
    it('devuelve 200 con catálogo correcto cuando el usuario es válido y tiene sellos completos', async () => {
      const username = 'testuser'
      const machineId = 'machine-abc'

      setupSuccessfulFlow(username, machineId, [
        ...completeStampKeys(username, '2026', 'Boston 2026'),
        ...completeStampKeys(username, '2026', 'Diwali 2026')
      ])

      const result = await handler(makeEvent({ apiKey: 'valid-api-key', machineId }))

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(true)
      expect(body.catalog).toHaveLength(2)
      expect(body.summary.total).toBe(2)
      expect(body.summary.added).toBe(2)

      const boston = body.catalog.find(
        (s: { stampName: string }) => s.stampName === 'Boston 2026'
      )
      expect(boston).toBeDefined()
      expect(boston.status).toBe('complete')
      expect(boston.fondoUrl).toContain('https://signed-url/')
      expect(boston.logoUrl).toContain('https://signed-url/')
      expect(boston.year).toBe('2026')
    })
  })

  describe('Carpeta incompleta', () => {
    it('devuelve status "incomplete" cuando un sello no tiene logo', async () => {
      const username = 'testuser'
      const machineId = 'machine-abc'

      setupSuccessfulFlow(username, machineId, [
        ...completeStampKeys(username, '2026', 'Boston 2026'),
        ...incompleteStampKeys(username, '2026', 'Madrid 2026')
      ])

      const result = await handler(makeEvent({ apiKey: 'valid-api-key', machineId }))

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.ok).toBe(true)

      const madridStamp = body.catalog.find(
        (s: { stampName: string }) => s.stampName === 'Madrid 2026'
      )
      expect(madridStamp).toBeDefined()
      expect(madridStamp.status).toBe('incomplete')
      expect(madridStamp.logoUrl).toBeNull()
      expect(madridStamp.fondoUrl).toContain('https://signed-url/')

      const bostonStamp = body.catalog.find(
        (s: { stampName: string }) => s.stampName === 'Boston 2026'
      )
      expect(bostonStamp).toBeDefined()
      expect(bostonStamp.status).toBe('complete')
    })
  })

  describe('CORS', () => {
    it('devuelve 200 para OPTIONS (preflight)', async () => {
      const result = await handler({ httpMethod: 'OPTIONS' })

      expect(result.statusCode).toBe(200)
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*')
      expect(result.headers['Access-Control-Allow-Methods']).toContain('POST')
    })
  })
})
