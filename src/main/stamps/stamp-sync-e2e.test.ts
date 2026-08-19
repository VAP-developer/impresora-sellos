// @vitest-environment node
/**
 * E2E Integration Test: Stamp Sync Flow
 *
 * Este test verifica el flujo completo de sincronización:
 * 1. Subir imágenes al bucket S3
 * 2. Llamar al API de sincronización
 * 3. Verificar que el catálogo incluye el sello
 * 4. Eliminar la carpeta del bucket
 * 5. Re-sincronizar
 * 6. Verificar que el sello desaparece
 *
 * REQUISITOS PARA EJECUTAR:
 * Este test requiere credenciales AWS reales y acceso al endpoint de producción.
 * Para habilitarlo, configura las siguientes variables de entorno:
 *
 *   AWS_ACCESS_KEY_ID=<tu-access-key>
 *   AWS_SECRET_ACCESS_KEY=<tu-secret-key>
 *   AWS_REGION=eu-west-1
 *   TEST_API_KEY=sk_test_Ht3bN6wK9pYf2mA5
 *   TEST_MACHINE_ID=f1419567-2d6e-4fce-950a-160286b0634f
 *
 * Ejecutar con:
 *   TEST_API_KEY=... AWS_ACCESS_KEY_ID=... npx vitest run src/main/stamps/stamp-sync-e2e.test.ts
 *
 * O quitar el .skip del describe y configurar las env vars.
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'

// --- Minimal valid image buffers ---

// 1x1 pixel JPEG (~107 bytes)
const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
    'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR' +
    'CAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgED' +
    'AwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcY' +
    'GRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJ' +
    'ipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo' +
    '6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgEC' +
    'BAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl' +
    '8RcYI4Q/SgSPCQoWFBYXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpz' +
    'dHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT' +
    '1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC/RRRQAf/Z',
  'base64'
)

// 1x1 pixel PNG (~67 bytes)
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
)

// --- Configuration ---

const BUCKET = 'svvs-kiosko-stamps'
const REGION = 'eu-west-1'
const API_ENDPOINT =
  'https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api/stamps/sync'
const USERNAME = 'test'

// Use timestamp to avoid collisions between parallel runs
const TIMESTAMP = Date.now()
const TEST_YEAR = '2099'
const TEST_STAMP_NAME = `E2E-TestStamp-${TIMESTAMP}`
const EXPECTED_STAMP_ID = `${TEST_YEAR}#${TEST_STAMP_NAME}`

const S3_PREFIX = `${USERNAME}/${TEST_YEAR}/${TEST_STAMP_NAME}`
const FONDO_KEY = `${S3_PREFIX}/${TEST_STAMP_NAME}-fondo.jpg`
const LOGO_KEY = `${S3_PREFIX}/${TEST_STAMP_NAME}-sello.png`

// ============================================================================
// Test Suite (skipped by default — requires AWS credentials)
// ============================================================================

describe.skip('E2E: Stamp Sync Flow', () => {
  let s3Client: InstanceType<typeof import('@aws-sdk/client-s3').S3Client>
  let apiKey: string
  let machineId: string

  beforeAll(async () => {
    // Validate required env vars
    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
    const missing = requiredEnvVars.filter((v) => !process.env[v])
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars: ${missing.join(', ')}. ` +
          'Set them to run E2E tests against real AWS infrastructure.'
      )
    }

    apiKey = process.env.TEST_API_KEY || 'sk_test_Ht3bN6wK9pYf2mA5'
    machineId = process.env.TEST_MACHINE_ID || 'f1419567-2d6e-4fce-950a-160286b0634f'

    // Dynamic import to avoid requiring the dependency when test is skipped
    const { S3Client } = await import('@aws-sdk/client-s3')
    s3Client = new S3Client({ region: REGION })
  })

  afterAll(async () => {
    // Always clean up test data from S3
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: FONDO_KEY }))
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: LOGO_KEY }))
    } catch {
      // Ignore cleanup errors — files may already be deleted
    }
  })

  it('should complete full sync round-trip: upload → sync → verify → delete → sync → verify removal', async () => {
    const { PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3')

    // ---- Step 1: Upload test images to S3 ----
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: FONDO_KEY,
        Body: MINIMAL_JPEG,
        ContentType: 'image/jpeg'
      })
    )

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: LOGO_KEY,
        Body: MINIMAL_PNG,
        ContentType: 'image/png'
      })
    )

    // ---- Step 2: Call sync API ----
    const syncResponse1 = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, machineId })
    })

    expect(syncResponse1.status).toBe(200)

    const syncResult1 = (await syncResponse1.json()) as {
      ok: boolean
      catalog: Array<{
        stampId: string
        year: string
        stampName: string
        fondoUrl: string | null
        logoUrl: string | null
        status: string
      }>
      summary: { total: number; added: number; removed: number }
    }

    expect(syncResult1.ok).toBe(true)
    expect(syncResult1.catalog).toBeDefined()
    expect(Array.isArray(syncResult1.catalog)).toBe(true)

    // ---- Step 3: Verify stamp appears in catalog ----
    const uploadedStamp = syncResult1.catalog.find(
      (s) => s.stampId === EXPECTED_STAMP_ID
    )

    expect(uploadedStamp).toBeDefined()
    expect(uploadedStamp!.status).toBe('complete')
    expect(uploadedStamp!.year).toBe(TEST_YEAR)
    expect(uploadedStamp!.stampName).toBe(TEST_STAMP_NAME)
    expect(uploadedStamp!.fondoUrl).toBeTruthy()
    expect(uploadedStamp!.logoUrl).toBeTruthy()

    // Verify presigned URLs are valid (contain expected S3 domain)
    expect(uploadedStamp!.fondoUrl).toContain('s3')
    expect(uploadedStamp!.logoUrl).toContain('s3')

    // ---- Step 4: Remove test stamp from S3 ----
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: FONDO_KEY }))
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: LOGO_KEY }))

    // ---- Step 5: Re-sync ----
    const syncResponse2 = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, machineId })
    })

    expect(syncResponse2.status).toBe(200)

    const syncResult2 = (await syncResponse2.json()) as {
      ok: boolean
      catalog: Array<{ stampId: string }>
      summary: { total: number; added: number; removed: number }
    }

    expect(syncResult2.ok).toBe(true)

    // ---- Step 6: Verify stamp no longer in catalog ----
    const removedStamp = syncResult2.catalog.find(
      (s) => s.stampId === EXPECTED_STAMP_ID
    )

    expect(removedStamp).toBeUndefined()

    // Verify the summary reports the removal
    expect(syncResult2.summary.removed).toBeGreaterThanOrEqual(1)
  }, 60000) // 60s timeout for E2E test with network calls

  it('should return AUTH_FAILED for invalid apiKey', async () => {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk_invalid_key_12345', machineId })
    })

    expect(response.status).toBe(401)

    const result = (await response.json()) as { ok: boolean; error: string }
    expect(result.ok).toBe(false)
    expect(result.error).toBe('AUTH_FAILED')
  }, 15000)

  it('should return AUTH_FAILED for unregistered machineId', async () => {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        machineId: '00000000-0000-0000-0000-000000000000'
      })
    })

    expect(response.status).toBe(401)

    const result = (await response.json()) as { ok: boolean; error: string }
    expect(result.ok).toBe(false)
    expect(result.error).toBe('AUTH_FAILED')
  }, 15000)
})
