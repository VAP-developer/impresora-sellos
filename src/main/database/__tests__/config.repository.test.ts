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
import { ConfigRepository, getDefaultConfig } from '../repositories/config.repository'
import type { AppConfig } from '../repositories/config.repository'

describe('database/repositories/config.repository', () => {
  let db: Database.Database
  let repo: ConfigRepository

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Run the real migration to create tables
    const migrationsPath = join(__dirname, '..', 'migrations')
    runMigrations(db, migrationsPath)

    repo = new ConfigRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('get()', () => {
    it('should return null when no config exists', () => {
      const config = repo.get()
      expect(config).toBeNull()
    })

    it('should return the config after it has been set', () => {
      repo.initConfig()
      const config = repo.get()
      expect(config).not.toBeNull()
      expect(config!.ticket.feria).toBe('XLIX Feria Nacional Sello')
    })
  })

  describe('set()', () => {
    it('should insert config when none exists', () => {
      const defaultConfig = getDefaultConfig()
      repo.set(defaultConfig)

      const config = repo.get()
      expect(config).toEqual(defaultConfig)
    })

    it('should replace existing config', () => {
      repo.initConfig()
      const config = repo.get()!
      config.ticket.feria = 'Modified Feria'
      repo.set(config)

      const updated = repo.get()
      expect(updated!.ticket.feria).toBe('Modified Feria')
    })
  })

  describe('initConfig()', () => {
    it('should insert the default configuration when none exists', () => {
      repo.initConfig()
      const config = repo.get()!

      expect(config.ticket.feria).toBe('XLIX Feria Nacional Sello')
      expect(config.ticket.lugar).toBe('Plaza Mayor - Madrid')
      expect(config.ticket.rollo1).toBe(1500)
      expect(config.ticket.rollo2).toBe(1500)
      expect(config.ticket.tickets).toBe(450)
      expect(config.ticket.limiteImporte).toBe(399.99)
      expect(config.codigo.modo).toBe('P')
      expect(config.codigo.mes).toBe(0)
      expect(config.codigo.cliente).toBe(1)
      expect(config.precios.tarifaA).toBe(0.5)
      expect(config.precios.tarifaB).toBe(1.25)
      expect(config.sello.elperfil).toBe(6)
      expect(config.sello.elnperfil).toBe('FERIA')
      expect(config.sello.eventos).toHaveLength(8)
    })

    it('should NOT overwrite existing config if already present', () => {
      repo.initConfig()
      const config = repo.get()!
      config.codigo.cliente = 999
      config.ticket.rollo1 = 0
      repo.set(config)

      // Calling initConfig again should not reset
      repo.initConfig()

      const current = repo.get()!
      expect(current.codigo.cliente).toBe(999)
      expect(current.ticket.rollo1).toBe(0)
    })

    it('should be idempotent when called multiple times on empty DB', () => {
      repo.initConfig()
      repo.initConfig()
      repo.initConfig()

      const config = repo.get()!
      expect(config.codigo.cliente).toBe(1)
      expect(config.ticket.rollo1).toBe(1500)
    })
  })

  describe('resetConfig()', () => {
    it('should reset config to defaults even if already modified', () => {
      repo.initConfig()
      const config = repo.get()!
      config.codigo.cliente = 999
      config.ticket.rollo1 = 0
      repo.set(config)

      repo.resetConfig()

      const fresh = repo.get()!
      expect(fresh.codigo.cliente).toBe(1)
      expect(fresh.ticket.rollo1).toBe(1500)
    })

    it('should work even when no config exists', () => {
      repo.resetConfig()

      const config = repo.get()!
      expect(config.ticket.feria).toBe('XLIX Feria Nacional Sello')
      expect(config.codigo.cliente).toBe(1)
    })
  })

  describe('updateMaquina()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should update ticket fields', () => {
      repo.updateMaquina({
        ticket: { feria: 'New Feria', lugar: 'New Lugar' },
        codigo: {}
      })

      const config = repo.get()!
      expect(config.ticket.feria).toBe('New Feria')
      expect(config.ticket.lugar).toBe('New Lugar')
      // Other ticket fields remain unchanged
      expect(config.ticket.rollo1).toBe(1500)
    })

    it('should update codigo fields', () => {
      repo.updateMaquina({
        ticket: {},
        codigo: { maquina: 'FI01', pais: 'AD' }
      })

      const config = repo.get()!
      expect(config.codigo.maquina).toBe('FI01')
      expect(config.codigo.pais).toBe('AD')
      // Other codigo fields remain unchanged
      expect(config.codigo.modo).toBe('P')
    })

    it('should update both ticket and codigo together', () => {
      repo.updateMaquina({
        ticket: { limiteImporte: 500 },
        codigo: { cliente: 42 }
      })

      const config = repo.get()!
      expect(config.ticket.limiteImporte).toBe(500)
      expect(config.codigo.cliente).toBe(42)
    })

    it('should throw if config not initialized', () => {
      const emptyRepo = new ConfigRepository(db)
      // Reset by deleting config
      db.prepare('DELETE FROM config').run()

      expect(() =>
        emptyRepo.updateMaquina({ ticket: {}, codigo: {} })
      ).toThrow('Config not initialized')
    })
  })

  describe('updateImprimir()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should update sello fields (partial merge)', () => {
      repo.updateImprimir({
        sello: { elperfil: 3, elnperfil: 'SPDE' },
        precios: getDefaultConfig().precios
      })

      const config = repo.get()!
      expect(config.sello.elperfil).toBe(3)
      expect(config.sello.elnperfil).toBe('SPDE')
      // Other sello fields remain unchanged
      expect(config.sello.nperfil1).toBe('Filatelia')
    })

    it('should replace precios entirely', () => {
      repo.updateImprimir({
        sello: {},
        precios: { tarifaA: 1.0, tarifaA2: 1.2, tarifaB: 2.5, tarifaC: 2.7, tarifaTA: 4.0, tarifaT4: 7.4 }
      })

      const config = repo.get()!
      expect(config.precios.tarifaA).toBe(1.0)
      expect(config.precios.tarifaA2).toBe(1.2)
      expect(config.precios.tarifaB).toBe(2.5)
      expect(config.precios.tarifaC).toBe(2.7)
      expect(config.precios.tarifaTA).toBe(4.0)
      expect(config.precios.tarifaT4).toBe(7.4)
    })

    it('should throw if config not initialized', () => {
      db.prepare('DELETE FROM config').run()

      expect(() =>
        repo.updateImprimir({
          sello: {},
          precios: { tarifaA: 1, tarifaA2: 1, tarifaB: 1, tarifaC: 1 }
        })
      ).toThrow('Config not initialized')
    })
  })

  describe('updateSesion()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should increment cliente by 1', () => {
      repo.updateSesion()
      const config = repo.get()!
      expect(config.codigo.cliente).toBe(2)
    })

    it('should increment multiple times correctly', () => {
      repo.updateSesion()
      repo.updateSesion()
      repo.updateSesion()
      const config = repo.get()!
      expect(config.codigo.cliente).toBe(4)
    })

    it('should throw if config not initialized', () => {
      db.prepare('DELETE FROM config').run()
      expect(() => repo.updateSesion()).toThrow('Config not initialized')
    })
  })

  describe('updateSesionError()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should decrement cliente by 1', () => {
      // First increment, then revert
      repo.updateSesion()
      repo.updateSesionError()
      const config = repo.get()!
      expect(config.codigo.cliente).toBe(1)
    })

    it('should throw if config not initialized', () => {
      db.prepare('DELETE FROM config').run()
      expect(() => repo.updateSesionError()).toThrow('Config not initialized')
    })
  })

  describe('updateRollos()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should decrement rollo1, rollo2, and tickets', () => {
      repo.updateRollos(5, 3, 2)

      const config = repo.get()!
      expect(config.ticket.rollo1).toBe(1495)
      expect(config.ticket.rollo2).toBe(1497)
      expect(config.ticket.tickets).toBe(448)
    })

    it('should handle decrement of zero correctly', () => {
      repo.updateRollos(0, 0, 0)

      const config = repo.get()!
      expect(config.ticket.rollo1).toBe(1500)
      expect(config.ticket.rollo2).toBe(1500)
      expect(config.ticket.tickets).toBe(450)
    })

    it('should accumulate multiple decrements', () => {
      repo.updateRollos(10, 10, 4)
      repo.updateRollos(5, 8, 2)

      const config = repo.get()!
      expect(config.ticket.rollo1).toBe(1485)
      expect(config.ticket.rollo2).toBe(1482)
      expect(config.ticket.tickets).toBe(444)
    })

    it('should throw if config not initialized', () => {
      db.prepare('DELETE FROM config').run()
      expect(() => repo.updateRollos(1, 1, 1)).toThrow('Config not initialized')
    })
  })

  describe('updateRollosRevert()', () => {
    beforeEach(() => {
      repo.initConfig()
    })

    it('should restore rollo1, rollo2, and tickets', () => {
      repo.updateRollos(10, 8, 3)
      repo.updateRollosRevert(10, 8, 3)

      const config = repo.get()!
      expect(config.ticket.rollo1).toBe(1500)
      expect(config.ticket.rollo2).toBe(1500)
      expect(config.ticket.tickets).toBe(450)
    })

    it('should throw if config not initialized', () => {
      db.prepare('DELETE FROM config').run()
      expect(() => repo.updateRollosRevert(1, 1, 1)).toThrow('Config not initialized')
    })
  })

  describe('getDefaultConfig()', () => {
    it('should return a deep clone of the default config', () => {
      const config1 = getDefaultConfig()
      const config2 = getDefaultConfig()

      // Should be equal
      expect(config1).toEqual(config2)

      // But not the same reference
      config1.codigo.cliente = 999
      expect(config2.codigo.cliente).toBe(1)
    })

    it('should have all required sections', () => {
      const config = getDefaultConfig()
      expect(config).toHaveProperty('ticket')
      expect(config).toHaveProperty('codigo')
      expect(config).toHaveProperty('sello')
      expect(config).toHaveProperty('precios')
    })
  })
})
