/**
 * printer-assignments.repository.ts
 *
 * Persists printer target → URI assignments to SQLite so they survive app restarts.
 */

import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

export interface PrinterAssignmentRow {
  target: string
  uri: string
  name: string | null
}

/**
 * Repository for persisting printer assignments.
 */
export class PrinterAssignmentsRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Gets all stored assignments as a target → URI map.
   */
  getAll(): Record<string, string> {
    const rows = this.db
      .prepare('SELECT target, uri FROM printer_assignments')
      .all() as PrinterAssignmentRow[]

    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.target] = row.uri
    }
    return result
  }

  /**
   * Saves or updates a single assignment.
   */
  set(target: string, uri: string, name?: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO printer_assignments (target, uri, name, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .run(target, uri, name ?? null)
  }

  /**
   * Removes an assignment.
   */
  remove(target: string): void {
    this.db.prepare('DELETE FROM printer_assignments WHERE target = ?').run(target)
  }
}
