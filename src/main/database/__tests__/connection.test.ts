import { describe, it, expect, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-test'),
    isPackaged: false
  }
}))

// Mock fs — need to keep the real module behavior but intercept calls
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn()
  }
})

import { initDatabase, getDatabase, closeDatabase } from '../connection'

describe('database/connection', () => {
  afterEach(() => {
    closeDatabase()
  })

  it('should throw if getDatabase is called before initDatabase', () => {
    expect(() => getDatabase()).toThrow('Database not initialized')
  })

  it('should initialize the database and return an instance', () => {
    const db = initDatabase()
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })

  it('should return the same instance on subsequent calls', () => {
    const db1 = initDatabase()
    const db2 = initDatabase()
    expect(db1).toBe(db2)
  })

  it('should return the instance via getDatabase after init', () => {
    const db1 = initDatabase()
    const db2 = getDatabase()
    expect(db1).toBe(db2)
  })

  it('should have WAL journal mode enabled', () => {
    const db = initDatabase()
    const result = db.pragma('journal_mode', { simple: true })
    expect(result).toBe('wal')
  })

  it('should have foreign keys enabled', () => {
    const db = initDatabase()
    const result = db.pragma('foreign_keys', { simple: true })
    expect(result).toBe(1)
  })

  it('should close the database gracefully', () => {
    initDatabase()
    closeDatabase()
    expect(() => getDatabase()).toThrow('Database not initialized')
  })

  it('should allow re-initialization after close', () => {
    initDatabase()
    closeDatabase()
    const db = initDatabase()
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })
})
