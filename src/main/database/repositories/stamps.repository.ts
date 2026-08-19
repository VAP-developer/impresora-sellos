import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Stamp Types ===

export interface StampRecord {
  id: number
  stampId: string
  year: string
  stampName: string
  fondoPath: string | null
  logoPath: string | null
  status: string
  syncedAt: string
  createdAt: string
}

/** Raw row shape from SQLite (snake_case columns) */
interface StampRow {
  id: number
  stamp_id: string
  year: string
  stamp_name: string
  fondo_path: string | null
  logo_path: string | null
  status: string
  synced_at: string
  created_at: string
}

/**
 * Repository for the stamps table.
 * Manages stamp records synced from the cloud API.
 */
export class StampsRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Returns all stamp records ordered by year DESC, stamp_name ASC.
   */
  getAll(): StampRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM stamps ORDER BY year DESC, stamp_name ASC')
      .all() as StampRow[]

    return rows.map(this.rowToRecord)
  }

  /**
   * Returns stamps for a given year, ordered by stamp_name ASC.
   */
  getByYear(year: string): StampRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM stamps WHERE year = ? ORDER BY stamp_name ASC')
      .all(year) as StampRow[]

    return rows.map(this.rowToRecord)
  }

  /**
   * Inserts or replaces a stamp record.
   * Uses stamp_id as the conflict key (UNIQUE constraint).
   */
  upsert(stamp: Omit<StampRecord, 'id' | 'createdAt'>): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO stamps (stamp_id, year, stamp_name, fondo_path, logo_path, status, synced_at)
         VALUES (@stampId, @year, @stampName, @fondoPath, @logoPath, @status, @syncedAt)`
      )
      .run({
        stampId: stamp.stampId,
        year: stamp.year,
        stampName: stamp.stampName,
        fondoPath: stamp.fondoPath,
        logoPath: stamp.logoPath,
        status: stamp.status,
        syncedAt: stamp.syncedAt
      })
  }

  /**
   * Deletes a stamp by its stamp_id.
   */
  remove(stampId: string): void {
    this.db.prepare('DELETE FROM stamps WHERE stamp_id = ?').run(stampId)
  }

  /**
   * Removes all records from the stamps table.
   */
  clear(): void {
    this.db.prepare('DELETE FROM stamps').run()
  }

  /**
   * Converts a raw database row (snake_case) to a StampRecord (camelCase).
   */
  private rowToRecord(row: StampRow): StampRecord {
    return {
      id: row.id,
      stampId: row.stamp_id,
      year: row.year,
      stampName: row.stamp_name,
      fondoPath: row.fondo_path,
      logoPath: row.logo_path,
      status: row.status,
      syncedAt: row.synced_at,
      createdAt: row.created_at
    }
  }
}
