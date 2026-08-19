/**
 * Stamp Sync Service
 *
 * Synchronizes the local stamp database with the cloud catalog.
 *
 * Flow:
 * 1. Get apiKey from config.json and machineId
 * 2. POST to /api/stamps/sync with credentials
 * 3. If AUTH_FAILED → block the application
 * 4. Compare received catalog with local DB
 * 5. Download new stamp images (presigned URLs → userData/stamps/)
 * 6. Delete images for removed stamps
 * 7. Update stamps table in SQLite
 * 8. Return summary
 */

import { app } from 'electron'
import { existsSync, mkdirSync, rmSync, createWriteStream, unlinkSync } from 'fs'
import { join } from 'path'
import * as https from 'https'
import { URL } from 'url'

import { getUserConfig } from '../user-config'
import { getMachineId } from '../license/machine-id'
import { StampsRepository } from '../database/repositories/stamps.repository'
import { AppStateRepository } from '../database/repositories/app-state.repository'

// ============================================================================
// Types
// ============================================================================

export interface StampSyncResult {
  ok: boolean
  added: number
  removed: number
  total: number
  error?: string
  blocked?: boolean
}

export interface CatalogItem {
  stampId: string
  year: string
  stampName: string
  fondoUrl: string
  logoUrl: string
  status: string
}

interface SyncApiResponse {
  ok: boolean
  catalog?: CatalogItem[]
  summary?: { total: number; added: number; removed: number }
  error?: string
  reason?: string
}

// ============================================================================
// Configuration
// ============================================================================

const API_URL = 'https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api/stamps/sync'

// ============================================================================
// Public API
// ============================================================================

/**
 * Synchronizes stamps from the cloud API to the local database.
 * Downloads new images, removes deleted ones, and updates SQLite.
 */
export async function syncStamps(): Promise<StampSyncResult> {
  // Step 1: Get apiKey and machineId
  const config = getUserConfig()
  const apiKey = (config.license as { apiKey?: string })?.apiKey || ''
  const machineId = getMachineId()

  if (!apiKey) {
    return { ok: false, added: 0, removed: 0, total: 0, error: 'No se encontró apiKey en la configuración' }
  }

  // Step 2: POST to /api/stamps/sync
  let response: SyncApiResponse
  try {
    response = await httpPost(API_URL, { apiKey, machineId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de conexión'
    return { ok: false, added: 0, removed: 0, total: 0, error: message }
  }

  // Step 3: Handle AUTH_FAILED → block application
  if (!response.ok && response.error === 'AUTH_FAILED') {
    console.error('[stamp-sync] AUTH_FAILED:', response.reason)
    blockApplication(apiKey, machineId)
    return { ok: false, added: 0, removed: 0, total: 0, error: 'AUTH_FAILED', blocked: true }
  }

  if (!response.ok) {
    return { ok: false, added: 0, removed: 0, total: 0, error: response.error || 'Error desconocido del servidor' }
  }

  const catalog = response.catalog || []
  const stampsRepo = new StampsRepository()
  const stampsDir = join(app.getPath('userData'), 'stamps')

  // Ensure stamps directory exists
  if (!existsSync(stampsDir)) {
    mkdirSync(stampsDir, { recursive: true })
  }

  // Step 4: Compare received catalog with local DB
  const localStamps = stampsRepo.getAll()
  const localStampIds = new Set(localStamps.map((s) => s.stampId))
  const remoteStampIds = new Set(catalog.map((c) => c.stampId))

  const newItems = catalog.filter((c) => !localStampIds.has(c.stampId))
  const removedItems = localStamps.filter((s) => !remoteStampIds.has(s.stampId))

  // Step 5: Download new stamp images
  for (const item of newItems) {
    const stampDir = join(stampsDir, item.year, item.stampName)
    if (!existsSync(stampDir)) {
      mkdirSync(stampDir, { recursive: true })
    }

    const fondoPath = join(stampDir, `${item.stampName}-fondo.jpg`)
    const logoPath = join(stampDir, `${item.stampName}-sello.png`)

    try {
      await downloadFile(item.fondoUrl, fondoPath)
      await downloadFile(item.logoUrl, logoPath)
    } catch (err) {
      console.error(`[stamp-sync] Error downloading images for ${item.stampId}:`, err)
      // Revert partial download — clean up files for this stamp
      try {
        if (existsSync(stampDir)) {
          rmSync(stampDir, { recursive: true, force: true })
        }
      } catch { /* ignore cleanup errors */ }
      return {
        ok: false,
        added: 0,
        removed: 0,
        total: localStamps.length,
        error: `Error descargando imágenes para "${item.stampName}": ${err instanceof Error ? err.message : 'Error desconocido'}`
      }
    }
  }

  // Step 6: Delete images for removed stamps
  for (const removed of removedItems) {
    const stampDir = join(stampsDir, removed.year, removed.stampName)
    try {
      if (existsSync(stampDir)) {
        rmSync(stampDir, { recursive: true, force: true })
      }
    } catch (err) {
      console.error(`[stamp-sync] Error removing stamp folder ${removed.stampId}:`, err)
    }
    stampsRepo.remove(removed.stampId)
  }

  // Step 7: Update stamps table in SQLite (upsert all catalog items)
  const now = new Date().toISOString()
  for (const item of catalog) {
    const stampDir = join(stampsDir, item.year, item.stampName)
    const fondoPath = join(stampDir, `${item.stampName}-fondo.jpg`)
    const logoPath = join(stampDir, `${item.stampName}-sello.png`)

    stampsRepo.upsert({
      stampId: item.stampId,
      year: item.year,
      stampName: item.stampName,
      fondoPath,
      logoPath,
      status: item.status,
      syncedAt: now
    })
  }

  // Step 8: Return summary
  const total = catalog.length
  const added = newItems.length
  const removed = removedItems.length

  console.log(`[stamp-sync] Sync complete: ${added} added, ${removed} removed, ${total} total`)

  return { ok: true, added, removed, total }
}

/**
 * Blocks the application due to failed authentication.
 * Clears local stamp data, removes license ticket, and sets blocked state.
 */
export function blockApplication(apiKey: string, machineId: string): void {
  console.error(`[stamp-sync] BLOCKING APPLICATION — apiKey: ${apiKey.slice(0, 8)}..., machineId: ${machineId.slice(0, 8)}...`)

  // 1. Clear all stamps from the database
  const stampsRepo = new StampsRepository()
  stampsRepo.clear()

  // 2. Delete the userData/stamps/ folder recursively
  const stampsDir = join(app.getPath('userData'), 'stamps')
  try {
    if (existsSync(stampsDir)) {
      rmSync(stampsDir, { recursive: true, force: true })
    }
  } catch (err) {
    console.error('[stamp-sync] Error removing stamps folder:', err)
  }

  // 3. Delete the .license-ticket file
  const ticketPath = join(app.getPath('userData'), '.license-ticket')
  try {
    if (existsSync(ticketPath)) {
      unlinkSync(ticketPath)
    }
  } catch (err) {
    console.error('[stamp-sync] Error removing license ticket:', err)
  }

  // 4. Set blocked = true in the DB with metadata
  const appStateRepo = new AppStateRepository()
  appStateRepo.setBlocked(true, { machineId, apiKey })

  // 5. Record the failed attempt timestamp
  appStateRepo.set('blocked_at', new Date().toISOString())
}

// ============================================================================
// Internal: HTTP helper (same pattern as license-service.ts)
// ============================================================================

function httpPost(url: string, body: Record<string, unknown>): Promise<SyncApiResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const parsedUrl = new URL(url)

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk.toString()
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData) as SyncApiResponse
          resolve(parsed)
        } catch {
          reject(new Error(`Respuesta inválida del servidor: ${responseData.slice(0, 200)}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.write(bodyStr)
    req.end()
  })
}

// ============================================================================
// Internal: File download helper using https + createWriteStream
// ============================================================================

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)

    // Extract path+search from the raw URL string to preserve percent-encoding.
    // URL.pathname decodes %C3%B1 → ñ which breaks S3 presigned URLs with
    // non-ASCII characters (e.g., "Año Serpiente").
    const originEnd = url.indexOf('/', url.indexOf('://') + 3)
    const rawPathAndSearch = originEnd !== -1 ? url.slice(originEnd) : parsedUrl.pathname + parsedUrl.search

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: rawPathAndSearch,
      method: 'GET'
    }

    const req = https.request(options, (res) => {
      // Follow redirects (S3 presigned URLs may redirect)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} descargando ${parsedUrl.pathname}`))
        return
      }

      const fileStream = createWriteStream(destPath)

      res.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })

      fileStream.on('error', (err) => {
        fileStream.close()
        reject(err)
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}
