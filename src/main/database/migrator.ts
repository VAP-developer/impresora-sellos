import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'

/**
 * Record of an applied migration stored in the _migrations table.
 */
export interface MigrationRecord {
  id: number
  name: string
  applied_at: string
}

/**
 * Ensures the _migrations tracking table exists.
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

/**
 * Returns the list of migration filenames that have already been applied.
 */
function getAppliedMigrations(db: Database.Database): string[] {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY id ASC').all() as Array<{
    name: string
  }>
  return rows.map((row) => row.name)
}

/**
 * Returns the path to the migrations directory.
 * In production (packaged app), migrations are inside app.asar under the main process directory.
 * In development, they are relative to the source.
 */
export function getMigrationsPath(): string {
  // When running in Electron context (both dev and prod), __dirname points to
  // the output directory for the main process. Migrations are bundled as static assets.
  // We use a resolution strategy that works for both electron-vite dev and packaged builds.
  const isDev = !app.isPackaged

  if (isDev) {
    // In development, resolve from the project root
    return join(app.getAppPath(), 'src', 'main', 'database', 'migrations')
  }

  // In production (packaged), migrations are copied to resources
  return join(process.resourcesPath, 'migrations')
}

/**
 * Reads all .sql files from the migrations directory, sorted alphabetically.
 * Migration files must follow the naming convention: NNN_description.sql
 * (e.g., 001_initial.sql, 002_add_index.sql)
 */
export function discoverMigrationFiles(migrationsPath: string): string[] {
  try {
    const files = readdirSync(migrationsPath)
    return files
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch {
    // If the directory doesn't exist, no migrations to run
    return []
  }
}

/**
 * Runs all pending migrations against the database.
 * Each migration is executed inside a transaction — if any statement fails,
 * the entire migration is rolled back and the error is thrown.
 *
 * @param db - The initialized better-sqlite3 database instance
 * @param migrationsPath - Optional override for the migrations directory (useful for testing)
 * @returns The list of migration names that were applied in this run
 */
export function runMigrations(db: Database.Database, migrationsPath?: string): string[] {
  const resolvedPath = migrationsPath ?? getMigrationsPath()

  // Ensure tracking table exists
  ensureMigrationsTable(db)

  // Get already applied migrations
  const applied = new Set(getAppliedMigrations(db))

  // Discover migration files
  const files = discoverMigrationFiles(resolvedPath)

  // Filter to only pending migrations
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    return []
  }

  const appliedNow: string[] = []

  for (const file of pending) {
    const filePath = join(resolvedPath, file)
    const sql = readFileSync(filePath, 'utf-8')

    // Run each migration in its own transaction
    const runMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    })

    runMigration()
    appliedNow.push(file)
  }

  return appliedNow
}

/**
 * Returns all migration records from the database.
 */
export function getMigrationHistory(db: Database.Database): MigrationRecord[] {
  ensureMigrationsTable(db)
  return db.prepare('SELECT id, name, applied_at FROM _migrations ORDER BY id ASC').all() as MigrationRecord[]
}
