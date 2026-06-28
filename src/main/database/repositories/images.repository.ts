import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Image Types ===

export interface ImageRecord {
  id: number
  name: string
  type: string | null
  size: number | null
  data: string // Base64 data URI
  createdAt: string
}

/** Raw row shape from SQLite (snake_case columns) */
interface ImageRow {
  id: number
  name: string
  type: string | null
  size: number | null
  data: string
  created_at: string
}

/**
 * Repository for the images table.
 * Handles upload (insert/replace), remove, and retrieval of stamp background images.
 * Replicates the legacy Meteor Images collection behavior.
 */
export class ImagesRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Uploads (inserts or replaces) an image in the database.
   * If an image with the same name already exists, it will be replaced.
   *
   * @param name - Unique name/identifier for the image
   * @param dataUri - Base64-encoded data URI string
   * @param type - MIME type of the image (e.g. "image/png")
   * @param size - File size in bytes
   */
  upload(name: string, dataUri: string, type: string | null, size: number | null): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO images (name, type, size, data)
         VALUES (@name, @type, @size, @data)`
      )
      .run({
        name,
        type: type ?? null,
        size: size ?? null,
        data: dataUri
      })
  }

  /**
   * Removes an image from the database by name.
   * No-op if the image does not exist.
   *
   * @param name - Name of the image to remove
   * @returns true if an image was deleted, false if not found
   */
  remove(name: string): boolean {
    const result = this.db.prepare('DELETE FROM images WHERE name = ?').run(name)
    return result.changes > 0
  }

  /**
   * Retrieves an image by its unique name.
   * Returns the image record with name and data URI, or null if not found.
   *
   * @param name - Name of the image to retrieve
   */
  getByName(name: string): { name: string; url: string } | null {
    const row = this.db
      .prepare('SELECT * FROM images WHERE name = ?')
      .get(name) as ImageRow | undefined

    if (!row) {
      return null
    }

    return {
      name: row.name,
      url: row.data
    }
  }

  /**
   * Retrieves the full image record by name, including metadata.
   *
   * @param name - Name of the image to retrieve
   */
  getFullByName(name: string): ImageRecord | null {
    const row = this.db
      .prepare('SELECT * FROM images WHERE name = ?')
      .get(name) as ImageRow | undefined

    if (!row) {
      return null
    }

    return this.rowToImageRecord(row)
  }

  /**
   * Returns all images stored in the database.
   */
  getAll(): ImageRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM images ORDER BY name ASC')
      .all() as ImageRow[]

    return rows.map(this.rowToImageRecord)
  }

  /**
   * Returns the count of images in the database.
   */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM images').get() as { cnt: number }
    return row.cnt
  }

  /**
   * Converts a raw database row (snake_case) to an ImageRecord (camelCase).
   */
  private rowToImageRecord(row: ImageRow): ImageRecord {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      size: row.size,
      data: row.data,
      createdAt: row.created_at
    }
  }
}
