import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConfigStore } from '../config.store'
import type { AppConfig } from '@renderer/types/config'

// Mock the ipc-client module
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

const mockConfig: AppConfig = {
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
    NUEVOlimiteImporte: 399.99,
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
    modelo1: 'modelo1',
    modelo2: 'modelo2',
    modo: 0,
    nperfil1: 'Filatelia',
    nperfil2: 'Esporadicos',
    nperfil3: 'SPDE',
    nperfil4: '',
    nperfil5: 'Abono/Envio',
    nperfil6: 'FERIA',
    eventos: [
      {
        nevento: 'Feria Madrid',
        nferia: 'XLIX Feria Nacional Sello',
        nlugar: 'Plaza Mayor Madrid',
        motivoi: 'NombreModeloIzq',
        motivod: 'NombreModeloDer',
        fecha: '21-24 abril 2025',
        localidad: 'Madrid'
      }
    ]
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

describe('config.store', () => {
  beforeEach(() => {
    // Reset zustand store state between tests
    useConfigStore.setState({ config: null, loading: false, error: null })
    vi.clearAllMocks()
  })

  describe('loadConfig', () => {
    it('should load config from IPC and set state', async () => {
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)

      await useConfigStore.getState().loadConfig()

      const state = useConfigStore.getState()
      expect(state.config).toEqual(mockConfig)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should subscribe to config changes after loading', async () => {
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
      const mockUnsubscribe = vi.fn()
      vi.mocked(ipc.onConfigChange).mockReturnValue(mockUnsubscribe)

      await useConfigStore.getState().loadConfig()

      expect(ipc.onConfigChange).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should update state when config change event fires', async () => {
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
      let changeCallback: ((config: AppConfig) => void) | undefined
      vi.mocked(ipc.onConfigChange).mockImplementation((cb) => {
        changeCallback = cb
        return vi.fn()
      })

      await useConfigStore.getState().loadConfig()

      const updatedConfig = { ...mockConfig, codigo: { ...mockConfig.codigo, cliente: 42 } }
      changeCallback!(updatedConfig)

      expect(useConfigStore.getState().config).toEqual(updatedConfig)
    })

    it('should set error on IPC failure', async () => {
      vi.mocked(ipc.getConfig).mockRejectedValue(new Error('IPC unavailable'))

      await useConfigStore.getState().loadConfig()

      const state = useConfigStore.getState()
      expect(state.config).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('IPC unavailable')
    })

    it('should not load concurrently if already loading', async () => {
      let resolveGetConfig: (value: AppConfig) => void
      vi.mocked(ipc.getConfig).mockImplementation(
        () => new Promise((resolve) => { resolveGetConfig = resolve })
      )

      // Start first load
      const loadPromise = useConfigStore.getState().loadConfig()
      expect(useConfigStore.getState().loading).toBe(true)

      // Attempt second load (should be ignored)
      useConfigStore.getState().loadConfig()
      expect(ipc.getConfig).toHaveBeenCalledTimes(1)

      resolveGetConfig!(mockConfig)
      await loadPromise
    })
  })

  describe('updateMaquina', () => {
    it('should call IPC and refresh config', async () => {
      const updatedConfig = {
        ...mockConfig,
        codigo: { ...mockConfig.codigo, maquina: 'FI01' }
      }
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { maquina: 'FI01' }
      })

      expect(ipc.updateMaquina).toHaveBeenCalledWith({
        ticket: {},
        codigo: { maquina: 'FI01' }
      })
      expect(useConfigStore.getState().config).toEqual(updatedConfig)
      expect(useConfigStore.getState().error).toBeNull()
    })

    it('should set error and throw on failure', async () => {
      vi.mocked(ipc.updateMaquina).mockRejectedValue(new Error('DB error'))

      await expect(
        useConfigStore.getState().updateMaquina({ ticket: {}, codigo: {} })
      ).rejects.toThrow('DB error')

      expect(useConfigStore.getState().error).toBe('DB error')
    })
  })

  describe('updateImprimir', () => {
    it('should call IPC and refresh config', async () => {
      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)

      await useConfigStore.getState().updateImprimir({
        sello: { elperfil: 3 },
        precios: mockConfig.precios
      })

      expect(ipc.updateImprimir).toHaveBeenCalledWith({
        sello: { elperfil: 3 },
        precios: mockConfig.precios
      })
      expect(useConfigStore.getState().config).toEqual(mockConfig)
    })
  })

  describe('updateSesion', () => {
    it('should increment session and refresh config', async () => {
      const updatedConfig = {
        ...mockConfig,
        codigo: { ...mockConfig.codigo, cliente: 2 }
      }
      vi.mocked(ipc.updateSesion).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateSesion()

      expect(ipc.updateSesion).toHaveBeenCalled()
      expect(useConfigStore.getState().config?.codigo.cliente).toBe(2)
    })
  })

  describe('updateSesionError', () => {
    it('should decrement session and refresh config', async () => {
      const updatedConfig = {
        ...mockConfig,
        codigo: { ...mockConfig.codigo, cliente: 0 }
      }
      vi.mocked(ipc.updateSesionError).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateSesionError()

      expect(ipc.updateSesionError).toHaveBeenCalled()
      expect(useConfigStore.getState().config?.codigo.cliente).toBe(0)
    })
  })

  describe('updateRollos', () => {
    it('should decrement rollos and refresh config', async () => {
      const updatedConfig = {
        ...mockConfig,
        ticket: { ...mockConfig.ticket, rollo1: 1495, rollo2: 1498, tickets: 448 }
      }
      vi.mocked(ipc.updateRollos).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateRollos(5, 2, 2)

      expect(ipc.updateRollos).toHaveBeenCalledWith(5, 2, 2)
      expect(useConfigStore.getState().config?.ticket.rollo1).toBe(1495)
      expect(useConfigStore.getState().config?.ticket.rollo2).toBe(1498)
      expect(useConfigStore.getState().config?.ticket.tickets).toBe(448)
    })
  })

  describe('updateRollosRevert', () => {
    it('should revert rollos and refresh config', async () => {
      vi.mocked(ipc.updateRollosRevert).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)

      await useConfigStore.getState().updateRollosRevert(5, 2, 2)

      expect(ipc.updateRollosRevert).toHaveBeenCalledWith(5, 2, 2)
      expect(useConfigStore.getState().config).toEqual(mockConfig)
    })
  })

  describe('initConfig', () => {
    it('should initialize default config and refresh', async () => {
      vi.mocked(ipc.initConfig).mockResolvedValue(undefined)
      vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)

      await useConfigStore.getState().initConfig()

      expect(ipc.initConfig).toHaveBeenCalled()
      expect(useConfigStore.getState().config).toEqual(mockConfig)
    })

    it('should set error on failure', async () => {
      vi.mocked(ipc.initConfig).mockRejectedValue(new Error('Init failed'))

      await expect(useConfigStore.getState().initConfig()).rejects.toThrow('Init failed')
      expect(useConfigStore.getState().error).toBe('Init failed')
    })
  })
})
