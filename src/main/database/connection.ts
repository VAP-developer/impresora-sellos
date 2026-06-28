import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { runMigrations } from './migrator'

let db: Database.Database | null = null

/**
 * Returns the path to the SQLite database file.
 * In development, the DB lives in the project root.
 * In production, it lives in the app's userData directory.
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  return join(dbDir, 'stamp-sales.db')
}

/**
 * Initializes the SQLite database connection with WAL mode and
 * recommended pragmas for performance and data integrity.
 * Automatically runs any pending migrations.
 * Returns the singleton database instance.
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()

  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  // Ensure data integrity — full fsync on commits
  db.pragma('synchronous = FULL')
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON')
  // Set a busy timeout (5 seconds) to avoid SQLITE_BUSY errors
  db.pragma('busy_timeout = 5000')

  // Run pending migrations automatically
  runMigrations(db)

  return db
}

/**
 * Returns the existing database instance.
 * Throws if the database has not been initialized yet.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initDatabase() first during app startup.'
    )
  }
  return db
}

/**
 * Closes the database connection gracefully.
 * Should be called when the app is quitting.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
