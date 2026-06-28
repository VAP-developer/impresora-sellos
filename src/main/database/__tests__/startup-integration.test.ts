import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Integration test: Verifies that on app startup, the database is created,
 * migrations are executed, and default configuration is seeded.
 *
 * This simulates what happens in src/main/index.ts when `initDatabase()` and
 * `configRepo.initConfig()` are called during app.whenReady().
 */

// Create a temp directory to serve as userData for each test
let tempDir: string
let dbPath: string

// Mock electron's app module to use temp directories
vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir,
    getAppPath: () => join(__dirname, '..', '..', '..', '..'),
    isPackaged: false
  }
}))

// We need to import after mocks are set up
import { initDatabase, getDatabase, closeDatabase } from '../connection'
import { runMigrations, getMigrationHistory } from '../migrator'
import { ConfigRepository, getDefaultConfig } from '../repositories/config.repository'

describe('App Startup Integration: DB creation + migrations + config seeding', () => {
  beforeEach(() => {
    // Create a unique temp dir for each test to avoid conflicts
    tempDir = join(tmpdir(), `stamp-sales-startup-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tempDir, { recursive: true })
    dbPath = join(tempDir, 'data', 'stamp-sales.db')
  })

  afterEach(() => {
    closeDatabase()
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should create the database file on first startup', () => {
    // Before init, the DB file should not exist
    expect(existsSync(dbPath)).toBe(false)

    // Simulate app startup: initDatabase()
    initDatabase()

    // After init, the DB file should exist
    expect(existsSync(dbPath)).toBe(true)
  })

  it('should create the data subdirectory if it does not exist', () => {
    const dataDir = join(tempDir, 'data')
    expect(existsSync(dataDir)).toBe(false)

    initDatabase()

    expect(existsSync(dataDir)).toBe(true)
  })

  it('should execute migrations on first startup, creating all required tables', () => {
    const db = initDatabase()

    // Query all application tables (excluding internal _migrations table)
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>

    const tableNames = tables.map((t) => t.name).sort()

    // The 001_initial.sql migration should have created these 5 tables + _migrations
    expect(tableNames).toContain('config')
    expect(tableNames).toContain('orders')
    expect(tableNames).toContain('images')
    expect(tableNames).toContain('print_queue')
    expect(tableNames).toContain('sync_log')
    expect(tableNames).toContain('_migrations')
  })

  it('should record the migration in _migrations table', () => {
    const db = initDatabase()

    const history = getMigrationHistory(db)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].name).toBe('001_initial.sql')
    expect(history[0].applied_at).toBeTruthy()
  })

  it('should seed default configuration after migrations (full startup sequence)', () => {
    // Simulate the full startup sequence from src/main/index.ts:
    // 1. initDatabase() — creates DB + runs migrations
    // 2. configRepo.initConfig() — seeds default config if absent
    const db = initDatabase()
    const configRepo = new ConfigRepository(db)
    configRepo.initConfig()

    // Verify config was seeded
    const config = configRepo.get()
    expect(config).not.toBeNull()

    // Verify key default values match the expected defaults
    const defaults = getDefaultConfig()
    expect(config!.ticket.feria).toBe(defaults.ticket.feria)
    expect(config!.ticket.rollo1).toBe(defaults.ticket.rollo1)
    expect(config!.ticket.rollo2).toBe(defaults.ticket.rollo2)
    expect(config!.codigo.modo).toBe(defaults.codigo.modo)
    expect(config!.codigo.cliente).toBe(defaults.codigo.cliente)
    expect(config!.precios.tarifaA).toBe(defaults.precios.tarifaA)
    expect(config!.sello.elperfil).toBe(defaults.sello.elperfil)
    expect(config!.sello.eventos).toHaveLength(8)
  })

  it('should NOT overwrite existing config on subsequent startups', () => {
    // First startup
    const db = initDatabase()
    const configRepo = new ConfigRepository(db)
    configRepo.initConfig()

    // Modify config (simulate user changes)
    const config = configRepo.get()!
    config.ticket.feria = 'Custom Feria Name'
    config.codigo.cliente = 42
    configRepo.set(config)

    // Close and re-open (simulate app restart)
    closeDatabase()
    const db2 = initDatabase()
    const configRepo2 = new ConfigRepository(db2)
    configRepo2.initConfig() // Should NOT overwrite existing config

    // Verify user changes are preserved
    const reloadedConfig = configRepo2.get()!
    expect(reloadedConfig.ticket.feria).toBe('Custom Feria Name')
    expect(reloadedConfig.codigo.cliente).toBe(42)
  })

  it('should not re-run migrations on subsequent startups', () => {
    // First startup
    initDatabase()
    closeDatabase()

    // Second startup
    const db = initDatabase()

    // The migration should only be recorded once
    const history = getMigrationHistory(db)
    expect(history).toHaveLength(1)
    expect(history[0].name).toBe('001_initial.sql')
  })

  it('should enable WAL journal mode for performance', () => {
    const db = initDatabase()
    const mode = db.pragma('journal_mode', { simple: true })
    expect(mode).toBe('wal')
  })

  it('should enable foreign key constraints', () => {
    const db = initDatabase()
    const fk = db.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)
  })

  it('should have orders table with correct schema for inserting records', () => {
    const db = initDatabase()

    // Insert a test order to verify the schema works
    const stmt = db.prepare(`
      INSERT INTO orders (event, venue, machine, vend_type, product_name, transaction_date,
        quantity, quantity_set, total_stamps, value, payment_status, sesion_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      'Feria Madrid 2025',
      'Plaza Mayor',
      'CH17',
      'Tarifa A',
      'Sello ATM',
      '2025-04-21T10:00:00',
      2,
      1,
      2,
      1.0,
      'FERIA',
      1
    )

    expect(result.changes).toBe(1)
    expect(result.lastInsertRowid).toBe(1)
  })

  it('should have print_queue table with CHECK constraints enforced', () => {
    const db = initDatabase()

    // Insert a valid job
    db.prepare(`
      INSERT INTO orders (event, vend_type, transaction_date, quantity, quantity_set, total_stamps, value)
      VALUES ('test', 'A', '2025-01-01', 1, 1, 1, 0.5)
    `).run()

    const validInsert = db.prepare(`
      INSERT INTO print_queue (order_id, printer_target, pdf_type, status)
      VALUES (1, 'printer1', 'stamp', 'pending')
    `)
    expect(() => validInsert.run()).not.toThrow()

    // Try invalid printer_target — should fail CHECK constraint
    const invalidInsert = db.prepare(`
      INSERT INTO print_queue (order_id, printer_target, pdf_type, status)
      VALUES (1, 'invalid_printer', 'stamp', 'pending')
    `)
    expect(() => invalidInsert.run()).toThrow()
  })

  it('should have images table with UNIQUE constraint on name', () => {
    const db = initDatabase()

    db.prepare(`INSERT INTO images (name, data) VALUES ('test.png', 'data:image/png;base64,abc')`).run()

    // Duplicate name should fail
    expect(() =>
      db.prepare(`INSERT INTO images (name, data) VALUES ('test.png', 'data:image/png;base64,xyz')`).run()
    ).toThrow()
  })

  it('should have sync_log table with CHECK constraint on action', () => {
    const db = initDatabase()

    // Valid actions
    db.prepare(`INSERT INTO sync_log (entity_type, entity_id, action) VALUES ('order', 1, 'create')`).run()
    db.prepare(`INSERT INTO sync_log (entity_type, entity_id, action) VALUES ('order', 1, 'update')`).run()
    db.prepare(`INSERT INTO sync_log (entity_type, entity_id, action) VALUES ('order', 1, 'delete')`).run()

    // Invalid action should fail
    expect(() =>
      db.prepare(`INSERT INTO sync_log (entity_type, entity_id, action) VALUES ('order', 1, 'invalid')`).run()
    ).toThrow()
  })
})
