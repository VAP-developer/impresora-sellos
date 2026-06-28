import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stamp-sales-test'),
    getAppPath: vi.fn(() => '/tmp/stamp-sales-test'),
    isPackaged: false
  }
}))

import { runMigrations } from '../migrator'
import { ImagesRepository } from '../repositories/images.repository'

describe('database/repositories/images.repository', () => {
  let db: Database.Database
  let repo: ImagesRepository

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const migrationsPath = join(__dirname, '..', 'migrations')
    runMigrations(db, migrationsPath)

    repo = new ImagesRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('upload()', () => {
    it('should insert a new image', () => {
      repo.upload('motivo1.png', 'data:image/png;base64,ABC123', 'image/png', 1024)

      const img = repo.getByName('motivo1.png')
      expect(img).not.toBeNull()
      expect(img!.name).toBe('motivo1.png')
      expect(img!.url).toBe('data:image/png;base64,ABC123')
    })

    it('should replace an existing image with the same name', () => {
      repo.upload('motivo1.png', 'data:image/png;base64,OLD', 'image/png', 500)
      repo.upload('motivo1.png', 'data:image/png;base64,NEW', 'image/png', 800)

      const img = repo.getByName('motivo1.png')
      expect(img!.url).toBe('data:image/png;base64,NEW')
      expect(repo.count()).toBe(1)
    })

    it('should handle null type and size', () => {
      repo.upload('test.png', 'data:image/png;base64,XYZ', null, null)

      const img = repo.getFullByName('test.png')
      expect(img).not.toBeNull()
      expect(img!.type).toBeNull()
      expect(img!.size).toBeNull()
    })

    it('should store multiple images with different names', () => {
      repo.upload('img1.png', 'data:image/png;base64,AAA', 'image/png', 100)
      repo.upload('img2.jpg', 'data:image/jpeg;base64,BBB', 'image/jpeg', 200)
      repo.upload('img3.webp', 'data:image/webp;base64,CCC', 'image/webp', 300)

      expect(repo.count()).toBe(3)
    })
  })

  describe('remove()', () => {
    it('should remove an existing image and return true', () => {
      repo.upload('motivo1.png', 'data:image/png;base64,ABC', 'image/png', 1024)

      const result = repo.remove('motivo1.png')
      expect(result).toBe(true)
      expect(repo.getByName('motivo1.png')).toBeNull()
    })

    it('should return false when image does not exist', () => {
      const result = repo.remove('nonexistent.png')
      expect(result).toBe(false)
    })

    it('should only remove the specified image', () => {
      repo.upload('img1.png', 'data:image/png;base64,AAA', 'image/png', 100)
      repo.upload('img2.png', 'data:image/png;base64,BBB', 'image/png', 200)

      repo.remove('img1.png')

      expect(repo.getByName('img1.png')).toBeNull()
      expect(repo.getByName('img2.png')).not.toBeNull()
      expect(repo.count()).toBe(1)
    })
  })

  describe('getByName()', () => {
    it('should return null for non-existent image', () => {
      const result = repo.getByName('nonexistent.png')
      expect(result).toBeNull()
    })

    it('should return name and url (data URI) for existing image', () => {
      repo.upload('sello-madrid.png', 'data:image/png;base64,MADRIDDATA', 'image/png', 2048)

      const result = repo.getByName('sello-madrid.png')
      expect(result).toEqual({
        name: 'sello-madrid.png',
        url: 'data:image/png;base64,MADRIDDATA'
      })
    })
  })

  describe('getFullByName()', () => {
    it('should return null for non-existent image', () => {
      const result = repo.getFullByName('nonexistent.png')
      expect(result).toBeNull()
    })

    it('should return full image record with metadata', () => {
      repo.upload('fondo.png', 'data:image/png;base64,FONDO', 'image/png', 4096)

      const result = repo.getFullByName('fondo.png')
      expect(result).not.toBeNull()
      expect(result!.id).toBeGreaterThan(0)
      expect(result!.name).toBe('fondo.png')
      expect(result!.type).toBe('image/png')
      expect(result!.size).toBe(4096)
      expect(result!.data).toBe('data:image/png;base64,FONDO')
      expect(result!.createdAt).toBeTruthy()
    })
  })

  describe('getAll()', () => {
    it('should return empty array when no images exist', () => {
      const result = repo.getAll()
      expect(result).toEqual([])
    })

    it('should return all images ordered by name ASC', () => {
      repo.upload('zebra.png', 'data:image/png;base64,Z', 'image/png', 10)
      repo.upload('alpha.png', 'data:image/png;base64,A', 'image/png', 20)
      repo.upload('beta.png', 'data:image/png;base64,B', 'image/png', 30)

      const result = repo.getAll()
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('alpha.png')
      expect(result[1].name).toBe('beta.png')
      expect(result[2].name).toBe('zebra.png')
    })

    it('should return full image records', () => {
      repo.upload('test.png', 'data:image/png;base64,TEST', 'image/png', 512)

      const result = repo.getAll()
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('type')
      expect(result[0]).toHaveProperty('size')
      expect(result[0]).toHaveProperty('data')
      expect(result[0]).toHaveProperty('createdAt')
    })
  })

  describe('count()', () => {
    it('should return 0 when no images exist', () => {
      expect(repo.count()).toBe(0)
    })

    it('should return the correct count', () => {
      repo.upload('img1.png', 'data:image/png;base64,1', 'image/png', 10)
      repo.upload('img2.png', 'data:image/png;base64,2', 'image/png', 20)

      expect(repo.count()).toBe(2)
    })

    it('should reflect removals', () => {
      repo.upload('img1.png', 'data:image/png;base64,1', 'image/png', 10)
      repo.upload('img2.png', 'data:image/png;base64,2', 'image/png', 20)
      repo.remove('img1.png')

      expect(repo.count()).toBe(1)
    })
  })
})
