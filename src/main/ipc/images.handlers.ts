import { handleIpc } from './handlers'
import { ImagesRepository } from '../database/repositories/images.repository'
import { ImageSyncRepository } from '../database/repositories/image-sync.repository'
import { buildImageName } from '../images/sync-images'
import type { SyncResult } from '../images/sync-images'

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
    return repo.getByName(name as string)
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
}
