import { handleIpc } from './handlers'
import { ImagesRepository } from '../database/repositories/images.repository'
import { ImageSyncRepository } from '../database/repositories/image-sync.repository'
import { buildImageName, syncImages } from '../images/sync-images'
import type { SyncResult } from '../images/sync-images'
import { join, dirname } from 'path'
import { app } from 'electron'

// Module-level storage for the last sync result.
// Set via `setLastSyncResult` after running syncImages() at startup.
let lastSyncResult: SyncResult | null = null

/**
 * Stores the result of the last image synchronization run.
 * Called from the app startup flow after syncImages() completes.
 */
export function setLastSyncResult(result: SyncResult): void {
  lastSyncResult = result
}

/**
 * Returns the stored last sync result (for testing or internal use).
 */
export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult
}

/**
 * Registers IPC handlers for image management.
 *
 * Channels:
 * - images:upload — Uploads (inserts or replaces) an image as Base64 data URI
 * - images:remove — Removes an image by name
 * - images:getByName — Retrieves an image's name and data URI by name
 * - images:getFairList — Returns list of available fairs from sync records
 * - images:getByFair — Returns fondo/sello images for a specific fair
 * - images:getSyncStatus — Returns the last synchronization result
 */
export function registerImagesHandlers(): void {
  const repo = new ImagesRepository()
  const syncRepo = new ImageSyncRepository()

  handleIpc('images:upload', (name: unknown, dataUri: unknown, type: unknown, size: unknown) => {
    repo.upload(name as string, dataUri as string, type as string, size as number)
  })

  handleIpc('images:remove', (name: unknown) => {
    repo.remove(name as string)
  })

  handleIpc('images:getByName', (name: unknown) => {
    const imageName = name as string

    // Direct lookup by exact name (legacy uploaded images)
    const directResult = repo.getByName(imageName)
    if (directResult) return directResult

    // Fallback: try to find by fair name from bbdd-ferias sync
    // When the user puts "serpiente" in the motivo field, the image is stored
    // as "{year}/serpiente-fondo" from the folder sync. We search the image_sync
    // table for a matching fair name and then look up the fondo image.
    const fairs = syncRepo.getFairList()
    const matchedFair = fairs.find(
      (f) => f.fairName.toLowerCase() === imageName.toLowerCase()
    )
    if (matchedFair) {
      const fondoName = buildImageName(matchedFair.year, matchedFair.fairName, 'fondo')
      return repo.getByName(fondoName)
    }

    return null
  })

  handleIpc('images:getFairList', () => {
    return syncRepo.getFairList()
  })

  handleIpc('images:getByFair', (year: unknown, fairName: unknown) => {
    const y = year as string
    const fn = fairName as string

    const fondoName = buildImageName(y, fn, 'fondo')
    const selloName = buildImageName(y, fn, 'sello')

    const fondoRecord = repo.getByName(fondoName)
    const selloRecord = repo.getByName(selloName)

    return {
      fondo: fondoRecord?.url ?? null,
      sello: selloRecord?.url ?? null
    }
  })

  handleIpc('images:getSyncStatus', () => {
    return lastSyncResult
  })

  handleIpc('images:resync', () => {
    const basePath = join(
      app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath(),
      'bbdd-ferias'
    )
    const result = syncImages(basePath)
    lastSyncResult = result
    return result
  })
}
