/**
 * Integration test: Imprimir (config) → Kiosko (sales view)
 *
 * Verifies that when the user changes the active event or profile in the
 * Imprimir view and saves, those changes are correctly reflected in the
 * Kiosko view's behavior (models displayed, spending limits, etc.).
 *
 * This test exercises the shared Zustand config store that connects both views,
 * without rendering actual React components (pure store-level integration).
 *
 * Validates: Requirements 13.3, 13.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConfigStore } from '../config.store'
import { useKioskoStore, calcLimite, calcAllLimits, calcTotal } from '../kiosko.store'
import type { AppConfig, EventoData, SelloConfig, PreciosConfig } from '@renderer/types/config'

// ─── Mock IPC ─────────────────────────────────────────────────────────────────

vi.mock('@renderer/lib/ipc-client', () => ({
  getConfig: vi.fn(),
  updateMaquina: vi.fn(),
  updateImprimir: vi.fn(),
  updateSesion: vi.fn(),
  updateSesionError: vi.fn(),
  updateRollos: vi.fn(),
  updateRollosRevert: vi.fn(),
  initConfig: vi.fn(),
  onConfigChange: vi.fn(() => vi.fn())
}))

import * as ipc from '@renderer/lib/ipc-client'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function createEventos(): EventoData[] {
  return [
    {
      nevento: 'Feria Madrid 2025',
      nferia: 'XLIX Feria Nacional Sello',
      nlugar: 'Plaza Mayor Madrid',
      motivoi: 'CornamusaAzul',
      motivod: 'PlazaMayorNar',
      fecha: '21-24 abril 2025',
      localidad: 'Madrid'
    },
    {
      nevento: 'Exfilna Sevilla',
      nferia: 'Exfilna 2025',
      nlugar: 'Palacio de Congresos',
      motivoi: 'GiraldaSevilla',
      motivod: 'TorredelOro',
      fecha: '10-13 mayo 2025',
      localidad: 'Sevilla'
    },
    {
      nevento: 'Juvenia Barcelona',
      nferia: 'Juvenia 2025',
      nlugar: 'Feria de Barcelona',
      motivoi: 'SagradaFamilia',
      motivod: 'CasaBatllo',
      fecha: '5-8 junio 2025',
      localidad: 'Barcelona'
    },
    // Events 3-7 are empty placeholders
    ...Array.from({ length: 5 }, () => ({
      nevento: '',
      nferia: '',
      nlugar: '',
      motivoi: '',
      motivod: '',
      fecha: '',
      localidad: ''
    }))
  ]
}

function createBaseConfig(): AppConfig {
  return {
    ticket: {
      feria: 'XLIX Feria Nacional Sello',
      lugar: 'Plaza Mayor - Madrid',
      fecha: 'auto',
      hora: 'auto',
      titulo: 'Factura Simplificada',
      tituloCopia: 'COPIA Factura Simplificada',
      rollo1: 1500,
      rollo2: 1500,
      tickets: 450,
      limiteTickets: 450,
      limiteImporte: 399.99,
      NUEVOlimiteImporte: 150.0,
      empresa: 'S.E. Correos y Telegrafos S.A., S.M.E.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
      ImprimeCopiaTicket: 'S',
      ImprimeMasterTicket: 'N',
      bloqueado: 'DESBLOQUEADO'
    },
    codigo: {
      modo: 'P',
      mes: 0,
      annio: 'auto',
      pais: 'ES',
      maquina: 'CH17',
      cliente: 1,
      producto: 1
    },
    sello: {
      elperfil: 6,
      elnperfil: 'FERIA',
      elevento: 0,
      elnevento: 'Feria Madrid 2025',
      feria: 'XLIX Feria Nacional Sello',
      lugar: 'Plaza Mayor Madrid',
      modelo1: 'CornamusaAzul',
      modelo2: 'PlazaMayorNar',
      modo: 0,
      nperfil1: 'Filatelia',
      nperfil2: 'Esporadicos',
      nperfil3: 'SPDE',
      nperfil4: '',
      nperfil5: 'Abono/Envio',
      nperfil6: 'FERIA',
      eventos: createEventos()
    },
    precios: {
      tarifaA: 0.5,
      tarifaA2: 0.6,
      tarifaB: 1.25,
      tarifaC: 1.35,
      tarifaTA: 2.0,
      tarifaT4: 3.7
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Imprimir → Kiosko Integration', () => {
  let baseConfig: AppConfig

  beforeEach(() => {
    baseConfig = createBaseConfig()
    // Reset both stores
    useConfigStore.setState({ config: baseConfig, loading: false, error: null })
    useKioskoStore.setState({
      quantities: {
        tarifaAS1: 0, tarifaA2S1: 0, tarifaBS1: 0, tarifaCS1: 0, tarifaAT1: 0, tarifa4T1: 0,
        tarifaAS2: 0, tarifaA2S2: 0, tarifaBS2: 0, tarifaCS2: 0, tarifaAT2: 0, tarifa4T2: 0
      },
      lastSale: { sellos1: 0, sellos2: 0, tickets: 0 }
    })
    vi.clearAllMocks()
  })

  // ─── Event Changes → Kiosko Models ───────────────────────────────────

  describe('Cambiar evento activo actualiza modelos en Kiosko', () => {
    it('should reflect motivoi/motivod from event 0 as modelo1/modelo2 in Kiosko', () => {
      const config = useConfigStore.getState().config!
      const activeEvent = config.sello.eventos[config.sello.elevento]

      // With event 0 active, the Kiosko should show event 0's motivos
      expect(activeEvent.motivoi).toBe('CornamusaAzul')
      expect(activeEvent.motivod).toBe('PlazaMayorNar')
      expect(config.sello.modelo1).toBe('CornamusaAzul')
      expect(config.sello.modelo2).toBe('PlazaMayorNar')
    })

    it('should update modelo1/modelo2 when switching to event 1 via updateImprimir', async () => {
      // Simulate what happens when the user selects event 1 and saves in Imprimir view
      const newEvent = baseConfig.sello.eventos[1]
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elevento: 1,
          elnevento: newEvent.nevento,
          feria: newEvent.nferia,
          lugar: newEvent.nlugar,
          modelo1: newEvent.motivoi,
          modelo2: newEvent.motivod
        }
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      // Call updateImprimir (as ImprimirView.handleSave would)
      await useConfigStore.getState().updateImprimir({
        sello: {
          elevento: 1,
          elnevento: newEvent.nevento,
          feria: newEvent.nferia,
          lugar: newEvent.nlugar,
          modelo1: newEvent.motivoi,
          modelo2: newEvent.motivod
        },
        precios: baseConfig.precios
      })

      // After save, config store should have the updated config
      const config = useConfigStore.getState().config!
      expect(config.sello.elevento).toBe(1)
      expect(config.sello.modelo1).toBe('GiraldaSevilla')
      expect(config.sello.modelo2).toBe('TorredelOro')

      // The Kiosko view derives models from:
      //   activeEvent = config.sello.eventos[config.sello.elevento]
      //   modelo1Name = activeEvent.motivoi
      //   modelo2Name = activeEvent.motivod
      const activeEvent = config.sello.eventos[config.sello.elevento]
      expect(activeEvent.motivoi).toBe('GiraldaSevilla')
      expect(activeEvent.motivod).toBe('TorredelOro')
    })

    it('should update modelo1/modelo2 when switching to event 2 via updateImprimir', async () => {
      const newEvent = baseConfig.sello.eventos[2]
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elevento: 2,
          elnevento: newEvent.nevento,
          feria: newEvent.nferia,
          lugar: newEvent.nlugar,
          modelo1: newEvent.motivoi,
          modelo2: newEvent.motivod
        }
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: {
          elevento: 2,
          elnevento: newEvent.nevento,
          modelo1: newEvent.motivoi,
          modelo2: newEvent.motivod
        },
        precios: baseConfig.precios
      })

      const config = useConfigStore.getState().config!
      expect(config.sello.elevento).toBe(2)
      expect(config.sello.modelo1).toBe('SagradaFamilia')
      expect(config.sello.modelo2).toBe('CasaBatllo')
    })

    it('should update event date and locality visible in Kiosko after event change', async () => {
      const newEvent = baseConfig.sello.eventos[1]
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elevento: 1,
          elnevento: newEvent.nevento,
          feria: newEvent.nferia,
          lugar: newEvent.nlugar,
          modelo1: newEvent.motivoi,
          modelo2: newEvent.motivod
        }
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: { elevento: 1, elnevento: newEvent.nevento },
        precios: baseConfig.precios
      })

      const config = useConfigStore.getState().config!
      const activeEvent = config.sello.eventos[config.sello.elevento]

      // StampModels derives fecha and localidad from the active event
      expect(activeEvent.fecha).toBe('10-13 mayo 2025')
      expect(activeEvent.localidad).toBe('Sevilla')
    })
  })

  // ─── Profile Changes → Kiosko Limits ─────────────────────────────────

  describe('Cambiar perfil activo actualiza límite en Kiosko', () => {
    it('profile 6 (FERIA) should use limiteImporte', () => {
      const config = useConfigStore.getState().config!
      // Perfil 6 → limiteImporte = 399.99
      const limite = calcLimite(config.ticket, config.sello)
      expect(limite).toBe(399.99)
    })

    it('switching to profile 1 (non-FERIA) should use NUEVOlimiteImporte', async () => {
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elperfil: 1,
          elnperfil: 'Filatelia'
        }
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: { elperfil: 1, elnperfil: 'Filatelia' },
        precios: baseConfig.precios
      })

      const config = useConfigStore.getState().config!
      // Non-FERIA profile → NUEVOlimiteImporte = 150.0
      const limite = calcLimite(config.ticket, config.sello)
      expect(limite).toBe(150.0)
    })

    it('limit change should affect tariff limits in the Kiosko basket', async () => {
      // Set some quantities in the kiosko basket
      useKioskoStore.getState().setQuantities({ tarifaAS1: 10 })

      // With profile 6: limit = 399.99, total = 10 * 0.5 = 5.0, remaining = 394.99
      const config6 = useConfigStore.getState().config!
      const limits6 = calcAllLimits(
        useKioskoStore.getState().quantities,
        config6.precios,
        config6.ticket,
        config6.sello
      )
      // limiteAS1 with profile 6: min(floor(394.99/0.5), 1500-10) = min(789, 1490) = 789
      expect(limits6.limiteAS1).toBe(789)

      // Now switch to profile 1: limit = 150.0, remaining = 150.0 - 5.0 = 145.0
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: { ...baseConfig.sello, elperfil: 1, elnperfil: 'Filatelia' }
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: { elperfil: 1, elnperfil: 'Filatelia' },
        precios: baseConfig.precios
      })

      const config1 = useConfigStore.getState().config!
      const limits1 = calcAllLimits(
        useKioskoStore.getState().quantities,
        config1.precios,
        config1.ticket,
        config1.sello
      )
      // limiteAS1 with profile 1: min(floor(145.0/0.5), 1500-10) = min(290, 1490) = 290
      expect(limits1.limiteAS1).toBe(290)
    })

    it('all non-FERIA profiles (1-5) should use NUEVOlimiteImporte', async () => {
      for (const perfil of [1, 2, 3, 4, 5]) {
        const updatedConfig: AppConfig = {
          ...baseConfig,
          sello: { ...baseConfig.sello, elperfil: perfil }
        }

        vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
        vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

        await useConfigStore.getState().updateImprimir({
          sello: { elperfil: perfil },
          precios: baseConfig.precios
        })

        const config = useConfigStore.getState().config!
        const limite = calcLimite(config.ticket, config.sello)
        expect(limite).toBe(150.0)
      }
    })
  })

  // ─── Config Persistence Through Store ─────────────────────────────────

  describe('Cambios de config persisten y son accesibles desde ambas vistas', () => {
    it('updateImprimir updates the shared config store atomically', async () => {
      const newPrecios: PreciosConfig = {
        tarifaA: 1.0,
        tarifaA2: 1.2,
        tarifaB: 2.5,
        tarifaC: 2.7,
        tarifaTA: 4.0,
        tarifaT4: 7.4
      }

      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elperfil: 3,
          elnperfil: 'SPDE',
          elevento: 1,
          elnevento: 'Exfilna Sevilla',
          modelo1: 'GiraldaSevilla',
          modelo2: 'TorredelOro'
        },
        precios: newPrecios
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: {
          elperfil: 3,
          elnperfil: 'SPDE',
          elevento: 1,
          elnevento: 'Exfilna Sevilla',
          modelo1: 'GiraldaSevilla',
          modelo2: 'TorredelOro'
        },
        precios: newPrecios
      })

      const config = useConfigStore.getState().config!

      // All changes should be reflected
      expect(config.sello.elperfil).toBe(3)
      expect(config.sello.elnperfil).toBe('SPDE')
      expect(config.sello.elevento).toBe(1)
      expect(config.sello.modelo1).toBe('GiraldaSevilla')
      expect(config.sello.modelo2).toBe('TorredelOro')
      expect(config.precios.tarifaA).toBe(1.0)
      expect(config.precios.tarifaB).toBe(2.5)
    })

    it('Kiosko total uses updated tariff prices after save in Imprimir', async () => {
      // Set some quantities
      useKioskoStore.getState().setQuantities({ tarifaAS1: 10, tarifaBS2: 5 })

      // Original total: 10 * 0.5 + 5 * 1.25 = 11.25
      const originalTotal = calcTotal(
        useKioskoStore.getState().quantities,
        baseConfig.precios
      )
      expect(originalTotal).toBeCloseTo(11.25)

      // Change prices via Imprimir save
      const newPrecios: PreciosConfig = {
        tarifaA: 1.0,
        tarifaA2: 1.2,
        tarifaB: 2.5,
        tarifaC: 2.7,
        tarifaTA: 4.0,
        tarifaT4: 7.4
      }

      const updatedConfig: AppConfig = {
        ...baseConfig,
        precios: newPrecios
      }

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: baseConfig.sello,
        precios: newPrecios
      })

      // Kiosko now uses the new prices
      const config = useConfigStore.getState().config!
      const newTotal = calcTotal(
        useKioskoStore.getState().quantities,
        config.precios
      )
      // New total: 10 * 1.0 + 5 * 2.5 = 22.5
      expect(newTotal).toBeCloseTo(22.5)
    })

    it('onConfigChange callback updates store and affects Kiosko behavior', () => {
      // Simulate receiving a config change event (e.g. from a different window or handler)
      const updatedConfig: AppConfig = {
        ...baseConfig,
        sello: {
          ...baseConfig.sello,
          elperfil: 2,
          elnperfil: 'Esporadicos',
          elevento: 2,
          modelo1: 'SagradaFamilia',
          modelo2: 'CasaBatllo'
        }
      }

      // Directly update config store (simulating onConfigChange callback)
      useConfigStore.setState({ config: updatedConfig })

      const config = useConfigStore.getState().config!

      // Kiosko should see updated models
      expect(config.sello.modelo1).toBe('SagradaFamilia')
      expect(config.sello.modelo2).toBe('CasaBatllo')

      // Kiosko should see updated limit (profile 2 → NUEVOlimiteImporte = 150)
      const limite = calcLimite(config.ticket, config.sello)
      expect(limite).toBe(150.0)
    })

    it('config store error does not corrupt kiosko state', async () => {
      // Set some kiosko state first
      useKioskoStore.getState().setQuantities({ tarifaAS1: 5 })

      // Simulate a failed save in Imprimir
      vi.mocked(ipc.updateImprimir).mockRejectedValue(new Error('DB write error'))

      await expect(
        useConfigStore.getState().updateImprimir({
          sello: { elperfil: 1 },
          precios: baseConfig.precios
        })
      ).rejects.toThrow('DB write error')

      // Config should remain unchanged (original baseConfig)
      const config = useConfigStore.getState().config!
      expect(config.sello.elperfil).toBe(6)

      // Kiosko quantities should remain intact
      expect(useKioskoStore.getState().quantities.tarifaAS1).toBe(5)

      // Limit should still be the original (profile 6 → 399.99)
      const limite = calcLimite(config.ticket, config.sello)
      expect(limite).toBe(399.99)
    })
  })
})
