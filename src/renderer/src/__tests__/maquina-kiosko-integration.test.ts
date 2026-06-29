/**
 * Integration test: MaquinaView config changes → KioskoView store propagation.
 *
 * Verifies that when configuration is saved via the Maquina view's updateMaquina
 * flow (persisting código, ticket, and rollos changes), those changes are correctly
 * reflected in the KioskoView's stores and calculations.
 *
 * Validates: Requirements 12.1, 12.2, 12.3
 * - When rollos are updated, stock limits in KioskoView's TariffTable update
 * - When precios change and are saved, KioskoView recalculates totals
 * - When código config is changed, label code generation in KioskoView updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import { calcAllLimits, calcTotal } from '@renderer/lib/tariff-calc'
import { formatLabelCode } from '@renderer/lib/code-formatter'
import type { AppConfig } from '@renderer/types/config'

// Mock the ipc-client module (simulates main process IPC)
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseConfig: AppConfig = {
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
    mes: 5,
    annio: '25',
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MaquinaView → KioskoView integration: config changes propagation', () => {
  beforeEach(() => {
    // Reset stores to clean state
    useConfigStore.setState({ config: null, loading: false, error: null })
    useKioskoStore.setState({
      quantities: {
        tarifaAS1: 0, tarifaA2S1: 0, tarifaBS1: 0, tarifaCS1: 0, tarifaAT1: 0, tarifa4T1: 0,
        tarifaAS2: 0, tarifaA2S2: 0, tarifaBS2: 0, tarifaCS2: 0, tarifaAT2: 0, tarifa4T2: 0
      },
      lastSale: { sellos1: 0, sellos2: 0, tickets: 0 }
    })
    vi.clearAllMocks()
  })

  // ─── Rollos changes → KioskoView limits update ─────────────────────────────

  describe('Rollos changes propagate to KioskoView limits', () => {
    it('should update stock limits when rollo1 is reduced via MaquinaView save', async () => {
      // 1. Initial config with rollo1 = 1500
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      // 2. Simulate MaquinaView saving rollo1 = 200
      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, rollo1: 200 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { rollo1: 200 },
        codigo: {}
      })

      // 3. Verify KioskoView's limit calculations reflect new rollo1
      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)

      // With rollo1 = 200, budget limit for A: floor(399.99/0.5) = 799
      // Stock limit for A is 200 (rollo1). So limiteAS1 = min(799, 200) = 200
      expect(limits.limiteAS1).toBe(200)
      // Tira A limit: min(floor(399.99/2.0)=199, tickets-2=448, floor(200/4)=50) = 50
      expect(limits.limiteAT1).toBe(50)
    })

    it('should update stock limits when rollo2 is reduced via MaquinaView save', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, rollo2: 100 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { rollo2: 100 },
        codigo: {}
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)

      // limiteAS2 should be limited by rollo2 = 100
      expect(limits.limiteAS2).toBe(100)
      // Tira A model2: min(199, 448, floor(100/4)=25) = 25
      expect(limits.limiteAT2).toBe(25)
      // rollo1 should still be unrestricted (1500)
      expect(limits.limiteAS1).toBe(799) // budget-limited
    })

    it('should reflect rollo = -1 (removed) as zero available stock', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, rollo1: -1 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { rollo1: -1 },
        codigo: {}
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)

      // rollo1 = -1 means no stock → all model1 limits should be 0
      expect(limits.limiteAS1).toBe(0)
      expect(limits.limiteA2S1).toBe(0)
      expect(limits.limiteBS1).toBe(0)
      expect(limits.limiteCS1).toBe(0)
      expect(limits.limiteAT1).toBe(0)
      expect(limits.limite4T1).toBe(0)
    })

    it('should update ticket limits when tickets count is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, tickets: 10 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { tickets: 10 },
        codigo: {}
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)

      // tickets = 10, available = 10 - 2 = 8
      // Tira A limit: min(floor(399.99/2.0)=199, 8, floor(1500/4)=375) = 8
      expect(limits.limiteAT1).toBe(8)
      expect(limits.limiteAT2).toBe(8)
      expect(limits.limite4T1).toBe(8)
      expect(limits.limite4T2).toBe(8)
    })

    it('should correctly reflect limits with existing kiosko quantities after rollo update', async () => {
      // Pre-set some quantities in the kiosko (customer already selected some)
      useKioskoStore.getState().setQuantities({ tarifaAS1: 50, tarifaAT1: 5 })

      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)
      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, rollo1: 100 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { rollo1: 100 },
        codigo: {}
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)

      // used from rollo1: 50 + 5*4 = 70
      // available rollo1: 100 - 70 = 30
      // total spent: 50*0.5 + 5*2.0 = 25 + 10 = 35
      // budget remaining: 399.99 - 35 = 364.99
      // limiteAS1: min(floor(364.99/0.5)=729, 30) = 30
      expect(limits.limiteAS1).toBe(30)
    })
  })

  // ─── Precios changes → KioskoView total recalculation ──────────────────────

  describe('Precios changes propagate to KioskoView total recalculation', () => {
    it('should recalculate kiosko total with new prices after MaquinaView save', async () => {
      // Set some quantities in the kiosko basket
      useKioskoStore.getState().setQuantities({ tarifaAS1: 10, tarifaBS2: 5 })

      // Before update: total = 10*0.5 + 5*1.25 = 11.25
      const totalBefore = useKioskoStore.getState().getTotal(baseConfig.precios)
      expect(totalBefore).toBeCloseTo(11.25)

      // Simulate MaquinaView saving new limiteImporte (which triggers config refresh)
      // The precios come from updateImprimir, but let's test the flow where
      // config store is updated and kiosko recalculates
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      // New config with changed limiteImporte (affecting how much can be spent)
      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: { ...baseConfig.ticket, limiteImporte: 50.0, NUEVOlimiteImporte: 50.0 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { limiteImporte: 50.0, NUEVOlimiteImporte: 50.0 },
        codigo: {}
      })

      // The total is still the same (quantities * prices unchanged)
      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities
      const totalAfter = calcTotal(quantities, config.precios)
      expect(totalAfter).toBeCloseTo(11.25)

      // But the limits should now be much more restrictive
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)
      // budget remaining = 50.0 - 11.25 = 38.75
      // limiteAS1: min(floor(38.75/0.5)=77, 1500-10=1490) = 77
      expect(limits.limiteAS1).toBe(77)
    })

    it('should recalculate limits when precios change via updateImprimir', async () => {
      // Set some quantities in the kiosko
      useKioskoStore.getState().setQuantities({ tarifaAS1: 4, tarifaAS2: 4 })

      vi.mocked(ipc.updateImprimir).mockResolvedValue(undefined)

      // Simulate price increase: tarifaA goes from 0.5 to 2.0
      const updatedConfig: AppConfig = {
        ...baseConfig,
        precios: { ...baseConfig.precios, tarifaA: 2.0 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateImprimir({
        sello: {},
        precios: { ...baseConfig.precios, tarifaA: 2.0 }
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities

      // New total: (4 + 4) * 2.0 = 16.0 (was 4.0 with price 0.5)
      const newTotal = calcTotal(quantities, config.precios)
      expect(newTotal).toBeCloseTo(16.0)

      // Budget remaining: 399.99 - 16.0 = 383.99
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)
      // limiteAS1: min(floor(383.99/2.0)=191, 1500 - 4 = 1496) = 191
      expect(limits.limiteAS1).toBe(191)
    })
  })

  // ─── Código config changes → KioskoView label code generation ──────────────

  describe('Código config changes propagate to KioskoView label code', () => {
    it('should update label code when maquina identifier is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, maquina: 'FI01' }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { maquina: 'FI01' }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      // modo=P, mes=5, pais=ES, annio=25, maquina=FI01, cliente=0001, producto=001
      expect(labelCode).toBe('P5ES25 FI01-0001-001')
    })

    it('should update label code when modo is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, modo: 'F' }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { modo: 'F' }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      expect(labelCode).toBe('F5ES25 CH17-0001-001')
    })

    it('should update label code when país is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, pais: 'AD' }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { pais: 'AD' }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      expect(labelCode).toBe('P5AD25 CH17-0001-001')
    })

    it('should update label code when mes is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, mes: 10 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { mes: 10 }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      // mes 10 → "O" (October)
      expect(labelCode).toBe('POES25 CH17-0001-001')
    })

    it('should update label code when año is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, annio: '24' }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { annio: '24' }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      expect(labelCode).toBe('P5ES24 CH17-0001-001')
    })

    it('should update label code when cliente is changed', async () => {
      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      const updatedConfig: AppConfig = {
        ...baseConfig,
        codigo: { ...baseConfig.codigo, cliente: 42 }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: {},
        codigo: { cliente: 42 }
      })

      const config = useConfigStore.getState().config!
      const labelCode = formatLabelCode(config.codigo)

      expect(labelCode).toBe('P5ES25 CH17-0042-001')
    })
  })

  // ─── Combined scenario: full MaquinaView save ──────────────────────────────

  describe('Full MaquinaView save scenario (rollos + código combined)', () => {
    it('should propagate all changes from a full Guardar operation to KioskoView', async () => {
      // Set some quantities in the kiosko (simulating an active shopping session)
      useKioskoStore.getState().setQuantities({
        tarifaAS1: 5,
        tarifaBS1: 2,
        tarifaAT2: 1
      })

      vi.mocked(ipc.updateMaquina).mockResolvedValue(undefined)

      // Simulate a full Guardar: change maquina, reduce rollo1, change limiteImporte
      const updatedConfig: AppConfig = {
        ...baseConfig,
        ticket: {
          ...baseConfig.ticket,
          rollo1: 500,
          limiteImporte: 100.0,
          NUEVOlimiteImporte: 100.0
        },
        codigo: {
          ...baseConfig.codigo,
          maquina: 'MA01',
          cliente: 15
        }
      }
      vi.mocked(ipc.getConfig).mockResolvedValue(updatedConfig)

      await useConfigStore.getState().updateMaquina({
        ticket: { rollo1: 500, limiteImporte: 100.0, NUEVOlimiteImporte: 100.0 },
        codigo: { maquina: 'MA01', cliente: 15 }
      })

      const config = useConfigStore.getState().config!
      const quantities = useKioskoStore.getState().quantities

      // 1. Verify label code reflects new maquina and cliente
      const labelCode = formatLabelCode(config.codigo)
      expect(labelCode).toBe('P5ES25 MA01-0015-001')

      // 2. Verify limits reflect new rollo1 and limiteImporte
      const limits = calcAllLimits(quantities, config.precios, config.ticket, config.sello)
      // used rollo1: 5 + 2 + 0 + 0 + 0*4 + 0*4 = 7 (simple tariffs only for model 1)
      // available rollo1: 500 - 7 = 493
      // total: 5*0.5 + 2*1.25 + 1*2.0 = 2.5 + 2.5 + 2.0 = 7.0
      // budget remaining: 100.0 - 7.0 = 93.0
      // limiteAS1: min(floor(93.0/0.5)=186, 493) = 186
      expect(limits.limiteAS1).toBe(186)

      // 3. Verify total calculation uses current config prices
      const total = calcTotal(quantities, config.precios)
      expect(total).toBeCloseTo(7.0)

      // 4. Verify remaining rollo1 from KioskoStore perspective
      const remainingRollo1 = useKioskoStore.getState().getRemainingRollo1(config.ticket)
      // rollo1: 500, used: 5+2+0+0+0*4+0*4 = 7
      expect(remainingRollo1).toBe(493)
    })
  })
})
