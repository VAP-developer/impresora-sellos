/**
 * sync-images.ts
 *
 * Synchronizer module for fair images.
 * Scans the bbdd-ferias/{year}/{fair}/ folder structure, detects changes
 * by comparing file mtime against stored records, and synchronizes
 * the SQLite database accordingly.
 *
 * Validates: Requirements 1.1–1.5, 2.1–2.6
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'
import { ImageSyncRepository } from '../database/repositories/image-sync.repository'
import { ImagesRepository } from '../database/repositories/images.repository'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Metadata of an image file detected on disk */
export interface ScannedImageFile {
  year: string
  fairName: string
  imageType: 'fondo' | 'sello'
  filePath: string // absolute path
  fileName: string // file name without path
  mtime: number // modification timestamp (ms)
}

/** Result of a synchronization run */
export interface SyncResult {
  inserted: number
  updated: number
  deleted: number
  unchanged: number
  errors: Array<{ path: string; error: string }>
}

// ─── Supported extensions ─────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

// ─── Classification functions ─────────────────────────────────────────────────

/**
 * Classifies an image file by its suffix before the extension.
 * Returns 'fondo' if the file name ends with `-fondo` before the extension,
 * 'sello' if it ends with `-sello`, or null otherwise.
 *
 * @param fileName - The file name (with extension) to classify
 * @returns 'fondo' | 'sello' | null
 */
export function classifyImageFile(fileName: string): 'fondo' | 'sello' | null {
  const ext = extname(fileName).toLowerCase()

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return null
  }

  // Remove extension to inspect the base name
  const baseName = fileName.slice(0, fileName.length - ext.length)

  if (baseName.endsWith('-fondo')) {
    return 'fondo'
  }

  if (baseName.endsWith('-sello')) {
    return 'sello'
  }

  return null
}

/**
 * Generates a unique image name for the images table.
 * Format: `{year}/{fairName}-{imageType}`
 *
 * @param year - The year folder name
 * @param fairName - The fair folder name
 * @param imageType - 'fondo' or 'sello'
 * @returns The unique image name string
 */
export function buildImageName(year: string, fairName: string, imageType: string): string {
  return `${year}/${fairName}-${imageType}`
}

/**
 * Reads a file from disk and converts it to a Data URI Base64 string.
 *
 * @param filePath - Absolute path to the image file
 * @returns Data URI string (e.g., "data:image/png;base64,...")
 */
export function fileToDataUri(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const buffer = readFileSync(filePath)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Scans the bbdd-ferias/ folder structure and returns all valid image files found.
 * Structure expected: basePath/{year}/{fairName}/{imageName}-{fondo|sello}.{jpg|png}
 *
 * Tolerates missing or empty folders without error (Req 1.4, 1.5).
 *
 * @param basePath - Absolute path to the bbdd-ferias/ directory
 * @returns Array of scanned image file metadata
 */
export function scanFairFolders(basePath: string): ScannedImageFile[] {
  const results: ScannedImageFile[] = []

  if (!existsSync(basePath)) {
    return results
  }

  // Read year-level directories
  let yearEntries: string[]
  try {
    yearEntries = readdirSync(basePath)
  } catch {
    return results
  }

  for (const yearEntry of yearEntries) {
    const yearPath = join(basePath, yearEntry)

    // Skip non-directories
    try {
      if (!statSync(yearPath).isDirectory()) continue
    } catch {
      continue
    }

    // Read fair-level directories within the year
    let fairEntries: string[]
    try {
      fairEntries = readdirSync(yearPath)
    } catch {
      continue
    }

    for (const fairEntry of fairEntries) {
      const fairPath = join(yearPath, fairEntry)

      // Skip non-directories
      try {
        if (!statSync(fairPath).isDirectory()) continue
      } catch {
        continue
      }

      // Read files within the fair folder
      let fileEntries: string[]
      try {
        fileEntries = readdirSync(fairPath)
      } catch {
        continue
      }

      for (const fileEntry of fileEntries) {
        const imageType = classifyImageFile(fileEntry)
        if (!imageType) continue

        const filePath = join(fairPath, fileEntry)

        try {
          const stat = statSync(filePath)
          if (!stat.isFile()) continue

          results.push({
            year: yearEntry,
            fairName: fairEntry,
            imageType,
            filePath,
            fileName: fileEntry,
            mtime: stat.mtimeMs
          })
        } catch {
          // Skip files we can't stat
          continue
        }
      }
    }
  }

  return results
}

// ─── Main synchronization logic ──────────────────────────────────────────────

/**
 * Synchronizes the bbdd-ferias/ folder structure with SQLite.
 *
 * - Compares file mtime against stored records to detect changes
 * - Inserts new files (reads + converts to Base64 + stores in images + image_sync)
 * - Updates modified files (mtime changed → re-read + re-convert + update)
 * - Deletes orphan records (no corresponding file on disk)
 * - No writes if nothing has changed
 *
 * @param basePath - Absolute path to the bbdd-ferias/ directory
 * @returns SyncResult with operation counters and any errors encountered
 */
export function syncImages(basePath: string): SyncResult {
  const syncRepo = new ImageSyncRepository()
  const imagesRepo = new ImagesRepository()

  const result: SyncResult = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    errors: []
  }

  // 1. Scan disk for current image files
  const scannedFiles = scanFairFolders(basePath)

  // 2. Build a map of existing sync records by file path for quick lookup
  const existingRecords = syncRepo.getAll()
  const recordsByPath = new Map(existingRecords.map((r) => [r.filePath, r]))

  // 3. Track which file paths we've seen on disk (for orphan detection)
  const diskPaths = new Set<string>()

  // 4. Process each scanned file
  for (const file of scannedFiles) {
    diskPaths.add(file.filePath)

    const existingRecord = recordsByPath.get(file.filePath)
    const imageName = buildImageName(file.year, file.fairName, file.imageType)

    if (!existingRecord) {
      // New file → insert
      try {
        const dataUri = fileToDataUri(file.filePath)
        const ext = extname(file.fileName).toLowerCase()
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
        const stat = statSync(file.filePath)

        imagesRepo.upload(imageName, dataUri, mimeType, stat.size)
        syncRepo.upsert({
          year: file.year,
          fairName: file.fairName,
          imageType: file.imageType,
          filePath: file.filePath,
          mtime: file.mtime,
          imageName
        })

        result.inserted++
      } catch (err) {
        result.errors.push({
          path: file.filePath,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } else if (file.mtime > existingRecord.mtime) {
      // Modified file → update
      try {
        const dataUri = fileToDataUri(file.filePath)
        const ext = extname(file.fileName).toLowerCase()
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
        const stat = statSync(file.filePath)

        imagesRepo.upload(imageName, dataUri, mimeType, stat.size)
        syncRepo.upsert({
          year: file.year,
          fairName: file.fairName,
          imageType: file.imageType,
          filePath: file.filePath,
          mtime: file.mtime,
          imageName
        })

        result.updated++
      } catch (err) {
        result.errors.push({
          path: file.filePath,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } else {
      // Unchanged
      result.unchanged++
    }
  }

  // 5. Delete orphan records (records with no corresponding file on disk)
  const validPaths = Array.from(diskPaths)
  const orphanedRecords = existingRecords.filter((r) => !diskPaths.has(r.filePath))

  for (const orphan of orphanedRecords) {
    try {
      imagesRepo.remove(orphan.imageName)
    } catch {
      // Best effort removal from images table
    }
  }

  if (orphanedRecords.length > 0) {
    const deletedCount = syncRepo.deleteOrphans(validPaths)
    result.deleted = deletedCount
  }

  return result
}
