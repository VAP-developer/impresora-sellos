import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Image Sync Types ===

export interface ImageSyncRecord {
  id: number
  year: string
  fairName: string
  imageType: 'fondo' | 'sello'
  filePath: string
  mtime: number
  imageName: string
  syncedAt: string
}

/** Raw row shape from SQLite (snake_case columns) */
interface ImageSyncRow {
  id: number
  year: string
  fair_name: string
  image_type: 'fondo' | 'sello'
  file_path: string
  mtime: number
  image_name: string
  synced_at: string
}

/**
 * Repository for the image_sync table.
 * Manages synchronization metadata for fair images scanned from
 * the bbdd-ferias/ folder structure.
 */
export class ImageSyncRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Returns all sync records.
   */
  getAll(): ImageSyncRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM image_sync ORDER BY year DESC, fair_name ASC')
      .all() as ImageSyncRow[]

    return rows.map(this.rowToRecord)
  }

  /**
   * Retrieves a sync record by its file path.
   * Returns null if no record exists for that path.
   */
  getByFilePath(filePath: string): ImageSyncRecord | null {
    const row = this.db
      .prepare('SELECT * FROM image_sync WHERE file_path = ?')
      .get(filePath) as ImageSyncRow | undefined

    if (!row) {
      return null
    }

    return this.rowToRecord(row)
  }

  /**
   * Inserts or updates a sync record.
   * Uses the UNIQUE(year, fair_name, image_type) constraint for conflict resolution.
   */
  upsert(record: {
    year: string
    fairName: string
    imageType: 'fondo' | 'sello'
    filePath: string
    mtime: number
    imageName: string
  }): void {
    this.db
      .prepare(
        `INSERT INTO image_sync (year, fair_name, image_type, file_path, mtime, image_name, synced_at)
         VALUES (@year, @fairName, @imageType, @filePath, @mtime, @imageName, datetime('now'))
         ON CONFLICT(year, fair_name, image_type) DO UPDATE SET
           file_path = @filePath,
           mtime = @mtime,
           image_name = @imageName,
           synced_at = datetime('now')`
      )
      .run({
        year: record.year,
        fairName: record.fairName,
        imageType: record.imageType,
        filePath: record.filePath,
        mtime: record.mtime,
        imageName: record.imageName
      })
  }

  /**
   * Deletes sync records whose file paths are NOT in the provided list.
   * Used to clean up orphan records after a sync scan.
   *
   * @param validPaths - Array of file paths that still exist on disk
   * @returns Number of records deleted
   */
  deleteOrphans(validPaths: string[]): number {
    if (validPaths.length === 0) {
      // All records are orphans — delete everything
      const result = this.db.prepare('DELETE FROM image_sync').run()
      return result.changes
    }

    const placeholders = validPaths.map(() => '?').join(', ')
    const result = this.db
      .prepare(`DELETE FROM image_sync WHERE file_path NOT IN (${placeholders})`)
      .run(...validPaths)

    return result.changes
  }

  /**
   * Returns a list of unique fairs (year + name) from the sync records.
   * Ordered by year descending, then fair name ascending.
   */
  getFairList(): Array<{ year: string; fairName: string }> {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT year, fair_name
         FROM image_sync
         ORDER BY year DESC, fair_name ASC`
      )
      .all() as Array<{ year: string; fair_name: string }>

    return rows.map((row) => ({
      year: row.year,
      fairName: row.fair_name
    }))
  }

  /**
   * Returns all sync records for a specific fair.
   */
  getByFair(year: string, fairName: string): ImageSyncRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM image_sync WHERE year = ? AND fair_name = ?')
      .all(year, fairName) as ImageSyncRow[]

    return rows.map(this.rowToRecord)
  }

  /**
   * Converts a raw database row (snake_case) to an ImageSyncRecord (camelCase).
   */
  private rowToRecord(row: ImageSyncRow): ImageSyncRecord {
    return {
      id: row.id,
      year: row.year,
      fairName: row.fair_name,
      imageType: row.image_type,
      filePath: row.file_path,
      mtime: row.mtime,
      imageName: row.image_name,
      syncedAt: row.synced_at
    }
  }
}
