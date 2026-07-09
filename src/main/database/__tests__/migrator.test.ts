import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-test'),
    isPackaged: false
  }
}))

import { runMigrations, discoverMigrationFiles, getMigrationHistory } from '../migrator'

describe('database/migrator', () => {
  let db: Database.Database
  let migrationsDir: string

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Create a temporary migrations directory
    migrationsDir = join(tmpdir(), `stamp-sales-migrations-${Date.now()}`)
    mkdirSync(migrationsDir, { recursive: true })
  })

  afterEach(() => {
    db.close()
    // Clean up temp directory
    try {
      rmSync(migrationsDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('discoverMigrationFiles', () => {
    it('should return empty array if directory does not exist', () => {
      const result = discoverMigrationFiles('/non/existent/path')
      expect(result).toEqual([])
    })

    it('should return only .sql files sorted alphabetically', () => {
      writeFileSync(join(migrationsDir, '002_second.sql'), 'SELECT 1;')
      writeFileSync(join(migrationsDir, '001_first.sql'), 'SELECT 1;')
      writeFileSync(join(migrationsDir, 'readme.txt'), 'not a migration')
      writeFileSync(join(migrationsDir, '003_third.sql'), 'SELECT 1;')

      const result = discoverMigrationFiles(migrationsDir)
      expect(result).toEqual(['001_first.sql', '002_second.sql', '003_third.sql'])
    })

    it('should sort numerically (010 after 009, not after 001)', () => {
      writeFileSync(join(migrationsDir, '010_tenth.sql'), 'SELECT 1;')
      writeFileSync(join(migrationsDir, '009_ninth.sql'), 'SELECT 1;')
      writeFileSync(join(migrationsDir, '001_first.sql'), 'SELECT 1;')

      const result = discoverMigrationFiles(migrationsDir)
      expect(result).toEqual(['001_first.sql', '009_ninth.sql', '010_tenth.sql'])
    })
  })

  describe('runMigrations', () => {
    it('should create _migrations table if it does not exist', () => {
      runMigrations(db, migrationsDir)

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
        .all()
      expect(tables).toHaveLength(1)
    })

    it('should return empty array when no migration files exist', () => {
      const result = runMigrations(db, migrationsDir)
      expect(result).toEqual([])
    })

    it('should apply a single migration and record it', () => {
      writeFileSync(
        join(migrationsDir, '001_initial.sql'),
        'CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);'
      )

      const result = runMigrations(db, migrationsDir)

      expect(result).toEqual(['001_initial.sql'])

      // Verify the table was created
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
        .all()
      expect(tables).toHaveLength(1)

      // Verify the migration was recorded
      const history = getMigrationHistory(db)
      expect(history).toHaveLength(1)
      expect(history[0].name).toBe('001_initial.sql')
    })

    it('should apply multiple migrations in order', () => {
      writeFileSync(
        join(migrationsDir, '001_create_users.sql'),
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'
      )
      writeFileSync(
        join(migrationsDir, '002_create_posts.sql'),
        'CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT);'
      )

      const result = runMigrations(db, migrationsDir)

      expect(result).toEqual(['001_create_users.sql', '002_create_posts.sql'])

      // Verify both tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts')")
        .all()
      expect(tables).toHaveLength(2)
    })

    it('should skip already applied migrations', () => {
      writeFileSync(
        join(migrationsDir, '001_initial.sql'),
        'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      )

      // First run
      runMigrations(db, migrationsDir)

      // Add a new migration
      writeFileSync(
        join(migrationsDir, '002_second.sql'),
        'CREATE TABLE test2 (id INTEGER PRIMARY KEY);'
      )

      // Second run — should only apply the new one
      const result = runMigrations(db, migrationsDir)

      expect(result).toEqual(['002_second.sql'])

      const history = getMigrationHistory(db)
      expect(history).toHaveLength(2)
      expect(history[0].name).toBe('001_initial.sql')
      expect(history[1].name).toBe('002_second.sql')
    })

    it('should not apply any migration if no new ones exist', () => {
      writeFileSync(
        join(migrationsDir, '001_initial.sql'),
        'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      )

      runMigrations(db, migrationsDir)
      const result = runMigrations(db, migrationsDir)

      expect(result).toEqual([])
    })

    it('should roll back a failed migration without affecting previous ones', () => {
      writeFileSync(
        join(migrationsDir, '001_good.sql'),
        'CREATE TABLE good_table (id INTEGER PRIMARY KEY);'
      )
      writeFileSync(
        join(migrationsDir, '002_bad.sql'),
        'INVALID SQL STATEMENT THAT WILL FAIL;'
      )

      // The first migration should succeed, but the second should throw
      expect(() => runMigrations(db, migrationsDir)).toThrow()

      // The first migration should still be applied
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'")
        .all()
      expect(tables).toHaveLength(1)

      // The first migration should be recorded
      const history = getMigrationHistory(db)
      expect(history).toHaveLength(1)
      expect(history[0].name).toBe('001_good.sql')
    })

    it('should handle multi-statement migrations', () => {
      const multiStatementSql = `
        CREATE TABLE table_a (id INTEGER PRIMARY KEY, value TEXT);
        CREATE TABLE table_b (id INTEGER PRIMARY KEY, ref_id INTEGER REFERENCES table_a(id));
        CREATE INDEX idx_table_b_ref ON table_b(ref_id);
      `
      writeFileSync(join(migrationsDir, '001_multi.sql'), multiStatementSql)

      const result = runMigrations(db, migrationsDir)

      expect(result).toEqual(['001_multi.sql'])

      // Verify all objects were created
      const objects = db
        .prepare("SELECT name, type FROM sqlite_master WHERE name LIKE 'table_%' OR name LIKE 'idx_%'")
        .all() as Array<{ name: string; type: string }>
      expect(objects).toHaveLength(3)
    })

    it('should work with the actual migrations', () => {
      // Use the real migration files from the project
      const realMigrationsPath = join(__dirname, '..', 'migrations')
      const result = runMigrations(db, realMigrationsPath)

      expect(result).toEqual([
        '001_initial.sql',
        '002_printer_assignments.sql',
        '003_image_sync.sql'
      ])

      // Verify expected tables exist
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('config', 'orders', 'images', 'print_queue', 'sync_log', 'printer_assignments', 'image_sync')"
        )
        .all() as Array<{ name: string }>
      const tableNames = tables.map((t) => t.name).sort()
      expect(tableNames).toEqual([
        'config',
        'image_sync',
        'images',
        'orders',
        'print_queue',
        'printer_assignments',
        'sync_log'
      ])
    })
  })

  describe('getMigrationHistory', () => {
    it('should return empty array on fresh database', () => {
      const history = getMigrationHistory(db)
      expect(history).toEqual([])
    })

    it('should return applied migrations with timestamps', () => {
      writeFileSync(
        join(migrationsDir, '001_initial.sql'),
        'CREATE TABLE test (id INTEGER PRIMARY KEY);'
      )

      runMigrations(db, migrationsDir)

      const history = getMigrationHistory(db)
      expect(history).toHaveLength(1)
      expect(history[0]).toHaveProperty('id')
      expect(history[0]).toHaveProperty('name', '001_initial.sql')
      expect(history[0]).toHaveProperty('applied_at')
      expect(history[0].applied_at).toBeTruthy()
    })
  })
})
