import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

/**
 * Repository for the app_state table.
 * Stores persistent key-value application state flags
 * that survive app restarts (e.g., blocking state).
 */
export class AppStateRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Returns the value for a given key, or null if not found.
   */
  get(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM app_state WHERE key = ?')
      .get(key) as { value: string } | undefined

    return row?.value ?? null
  }

  /**
   * Inserts or replaces a key-value pair.
   */
  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO app_state (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`
      )
      .run(key, value)
  }

  /**
   * Deletes a key from the app_state table.
   */
  delete(key: string): void {
    this.db.prepare('DELETE FROM app_state WHERE key = ?').run(key)
  }

  /**
   * Returns true if the 'blocked' key has value 'true'.
   */
  isBlocked(): boolean {
    return this.get('blocked') === 'true'
  }

  /**
   * Sets or clears the blocked state.
   * When blocking, also stores related metadata (machineId, apiKey).
   * When unblocking, removes metadata keys.
   */
  setBlocked(blocked: boolean, details?: { machineId: string; apiKey: string }): void {
    if (blocked) {
      this.set('blocked', 'true')
      if (details) {
        this.set('blocked_machine_id', details.machineId)
        this.set('blocked_api_key', details.apiKey)
      }
    } else {
      this.set('blocked', 'false')
      this.delete('blocked_machine_id')
      this.delete('blocked_api_key')
    }
  }
}
