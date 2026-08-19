import { handleIpc } from './handlers'
import { StampsRepository, StampRecord } from '../database/repositories/stamps.repository'
import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'

/**
 * Reads an image file from disk and returns it as a base64 data URI.
 * Returns null if the file does not exist or cannot be read.
 */
function fileToDataUri(filePath: string): string | null {
  if (!filePath || !existsSync(filePath)) return null

  try {
    const buffer = readFileSync(filePath)
    const ext = extname(filePath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Constructs the image name key (same format as the legacy system for compatibility).
 * Format: "{year}/{stampName}-{type}" e.g. "2026/Año Serpiente-fondo"
 */
export function buildImageName(year: string, fairName: string, imageType: string): string {
  return `${year}/${fairName}-${imageType}`
}

/**
 * Registers IPC handlers for image management.
 * All images are now sourced exclusively from the cloud-synced stamps table.
 * Local upload/remove is no longer supported.
 *
 * Channels:
 * - images:getByName — Retrieves an image by stamp name (reads from disk file)
 * - images:getFairList — Returns list of available fairs from stamps table
 * - images:getByFair — Returns fondo/sello images for a specific fair
 * - images:getSyncStatus — Returns stamp sync info
 */
export function registerImagesHandlers(): void {
  const stampsRepo = new StampsRepository()

  // No-op handlers for upload/remove (kept for backward compat with preload contract)
  handleIpc('images:upload', () => {
    // Local image upload is disabled. All images come from cloud sync.
    console.warn('[images:upload] Disabled — images are managed via cloud sync only.')
  })

  handleIpc('images:remove', () => {
    // Local image removal is disabled.
    console.warn('[images:remove] Disabled — images are managed via cloud sync only.')
  })

  handleIpc('images:getByName', (name: unknown) => {
    const imageName = name as string
    if (!imageName) return null

    const allStamps = stampsRepo.getAll()

    // Strategy 1: exact match by stampName (e.g. motivoi = "Año Serpiente")
    const exactMatch = allStamps.find(
      (s) => s.stampName.toLowerCase() === imageName.toLowerCase()
    )
    if (exactMatch && exactMatch.fondoPath) {
      const url = fileToDataUri(exactMatch.fondoPath)
      if (url) return { name: exactMatch.stampName, url }
    }

    // Strategy 2: match by constructed image name key (e.g. "2026/Año Serpiente-fondo")
    // This handles the case where pdf-generator passes buildImageName results
    const lowerName = imageName.toLowerCase()
    for (const stamp of allStamps) {
      const fondoKey = buildImageName(stamp.year, stamp.stampName, 'fondo')
      const selloKey = buildImageName(stamp.year, stamp.stampName, 'sello')

      if (fondoKey.toLowerCase() === lowerName) {
        const url = fileToDataUri(stamp.fondoPath ?? '')
        if (url) return { name: fondoKey, url }
      }
      if (selloKey.toLowerCase() === lowerName) {
        const url = fileToDataUri(stamp.logoPath ?? '')
        if (url) return { name: selloKey, url }
      }
    }

    // Strategy 3: partial match (e.g. user typed "serpiente" and we have "Año Serpiente")
    const partialMatch = allStamps.find(
      (s) => s.stampName.toLowerCase().includes(lowerName)
    )
    if (partialMatch && partialMatch.fondoPath) {
      const url = fileToDataUri(partialMatch.fondoPath)
      if (url) return { name: partialMatch.stampName, url }
    }

    return null
  })

  handleIpc('images:getFairList', () => {
    const stamps = stampsRepo.getAll()
    // Return unique year+stampName pairs (deduplicated)
    const seen = new Set<string>()
    const result: Array<{ year: string; fairName: string }> = []

    for (const stamp of stamps) {
      const key = `${stamp.year}#${stamp.stampName}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ year: stamp.year, fairName: stamp.stampName })
      }
    }

    return result
  })

  handleIpc('images:getByFair', (year: unknown, fairName: unknown) => {
    const y = year as string
    const fn = fairName as string

    const stamps = stampsRepo.getAll()
    const match = stamps.find(
      (s) => s.year === y && s.stampName.toLowerCase() === fn.toLowerCase()
    )

    if (!match) {
      return { fondo: null, sello: null }
    }

    return {
      fondo: fileToDataUri(match.fondoPath ?? ''),
      sello: fileToDataUri(match.logoPath ?? '')
    }
  })

  handleIpc('images:getSyncStatus', () => {
    // Return basic stamp sync info instead of the old bbdd-ferias sync result
    const stamps = stampsRepo.getAll()
    return {
      inserted: stamps.length,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      errors: []
    }
  })

  handleIpc('images:resync', () => {
    // No-op: resync from local folder is disabled.
    // Cloud sync is done via stamps:sync channel.
    console.warn('[images:resync] Disabled — use stamps:sync for cloud synchronization.')
    const stamps = stampsRepo.getAll()
    return {
      inserted: stamps.length,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      errors: []
    }
  })
}
