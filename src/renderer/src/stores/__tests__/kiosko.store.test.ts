import { describe, it, expect, beforeEach } from 'vitest'
import {
  useKioskoStore,
  calcTotal,
  calcLimite,
  calcLimiteSimple,
  calcLimiteTira,
  calcAllLimits,
  calcUsedRollo1,
  calcUsedRollo2,
  calcUsedTickets,
  normalizeQty
} from '../kiosko.store'
import type { KioskoQuantities } from '../kiosko.store'
import type { AppConfig, PreciosConfig, TicketConfig, SelloConfig } from '@renderer/types/config'

// --- Test fixtures ---

const mockPrecios: PreciosConfig = {
  tarifaA: 0.5,
  tarifaA2: 0.6,
  tarifaB: 1.25,
  tarifaC: 1.35,
  tarifaTA: 2.0,
  tarifaT4: 3.7
}

const mockTicket: TicketConfig = {
  feria: 'Test Feria',
  lugar: 'Test Lugar',
  fecha: 'auto',
  hora: 'auto',
  titulo: 'Factura Simplificada',
  tituloCopia: 'COPIA',
  rollo1: 1500,
  rollo2: 1500,
  tickets: 450,
  limiteTickets: 450,
  limiteImporte: 399.99,
  NUEVOlimiteImporte: 399.99,
  empresa: 'Test Empresa',
  cif: 'A00000000',
  cp: '28001',
  l1: '',
  l2: '',
  l3: ''
}

const mockSello: SelloConfig = {
  elperfil: 6,
  elnperfil: 'FERIA',
  elevento: 0,
  elnevento: 'Test Evento',
  feria: 'Test Feria',
  lugar: 'Test Lugar',
  modelo1: 'modelo1',
  modelo2: 'modelo2',
  modo: 0,
  nperfil1: 'Filatelia',
  nperfil2: 'Esporadicos',
  nperfil3: 'SPDE',
  nperfil4: '',
  nperfil5: 'Abono/Envio',
  nperfil6: 'FERIA',
  eventos: []
}

const mockConfig: AppConfig = {
  ticket: mockTicket,
  codigo: {
    modo: 'P',
    mes: 0,
    annio: 'auto',
    pais: 'ES',
    maquina: 'CH17',
    cliente: 1,
    producto: 1
  },
  sello: mockSello,
  precios: mockPrecios
}

const emptyQuantities: KioskoQuantities = {
  tarifaAS1: 0,
  tarifaA2S1: 0,
  tarifaBS1: 0,
  tarifaCS1: 0,
  tarifaAT1: 0,
  tarifa4T1: 0,
  tarifaAS2: 0,
  tarifaA2S2: 0,
  tarifaBS2: 0,
  tarifaCS2: 0,
  tarifaAT2: 0,
  tarifa4T2: 0
}

describe('kiosko.store', () => {
  beforeEach(() => {
    useKioskoStore.setState({
      quantities: { ...emptyQuantities },
      lastSale: { sellos1: 0, sellos2: 0, tickets: 0 }
    })
  })

  // ─── Pure calculation functions ───────────────────────────────────────

  describe('normalizeQty', () => {
    it('should return 0 for negative values', () => {
      expect(normalizeQty(-1)).toBe(0)
      expect(normalizeQty(-100)).toBe(0)
    })

    it('should return 0 for NaN', () => {
      expect(normalizeQty(NaN)).toBe(0)
    })

    it('should return 0 for Infinity', () => {
      expect(normalizeQty(Infinity)).toBe(0)
      expect(normalizeQty(-Infinity)).toBe(0)
    })

    it('should floor decimal values', () => {
      expect(normalizeQty(3.7)).toBe(3)
      expect(normalizeQty(0.9)).toBe(0)
    })

    it('should pass through valid integers', () => {
      expect(normalizeQty(0)).toBe(0)
      expect(normalizeQty(5)).toBe(5)
      expect(normalizeQty(100)).toBe(100)
    })
  })

  describe('calcUsedRollo1', () => {
    it('should return 0 for empty quantities', () => {
      expect(calcUsedRollo1(emptyQuantities)).toBe(0)
    })

    it('should count simple tariffs as 1 each', () => {
      const q = { ...emptyQuantities, tarifaAS1: 3, tarifaBS1: 2 }
      expect(calcUsedRollo1(q)).toBe(5)
    })

    it('should count tiras as 4 each', () => {
      const q = { ...emptyQuantities, tarifaAT1: 2, tarifa4T1: 1 }
      expect(calcUsedRollo1(q)).toBe(12) // 2*4 + 1*4
    })

    it('should sum all modelo 1 quantities correctly', () => {
      const q: KioskoQuantities = {
        ...emptyQuantities,
        tarifaAS1: 1,
        tarifaA2S1: 2,
        tarifaBS1: 3,
        tarifaCS1: 4,
        tarifaAT1: 1,
        tarifa4T1: 1
      }
      // 1 + 2 + 3 + 4 + 4 + 4 = 18
      expect(calcUsedRollo1(q)).toBe(18)
    })

    it('should not include modelo 2 quantities', () => {
      const q = { ...emptyQuantities, tarifaAS2: 10, tarifaAT2: 5 }
      expect(calcUsedRollo1(q)).toBe(0)
    })
  })

  describe('calcUsedRollo2', () => {
    it('should count modelo 2 quantities correctly', () => {
      const q: KioskoQuantities = {
        ...emptyQuantities,
        tarifaAS2: 2,
        tarifaA2S2: 3,
        tarifaBS2: 1,
        tarifaCS2: 1,
        tarifaAT2: 2,
        tarifa4T2: 1
      }
      // 2 + 3 + 1 + 1 + 8 + 4 = 19
      expect(calcUsedRollo2(q)).toBe(19)
    })

    it('should not include modelo 1 quantities', () => {
      const q = { ...emptyQuantities, tarifaAS1: 10, tarifaAT1: 5 }
      expect(calcUsedRollo2(q)).toBe(0)
    })
  })

  describe('calcUsedTickets', () => {
    it('should return 0 for no tiras', () => {
      const q = { ...emptyQuantities, tarifaAS1: 5, tarifaBS2: 3 }
      expect(calcUsedTickets(q)).toBe(0)
    })

    it('should sum all tira quantities from both models', () => {
      const q = { ...emptyQuantities, tarifaAT1: 2, tarifa4T1: 1, tarifaAT2: 3, tarifa4T2: 2 }
      expect(calcUsedTickets(q)).toBe(8)
    })
  })

  describe('calcTotal', () => {
    it('should return 0 for empty quantities', () => {
      expect(calcTotal(emptyQuantities, mockPrecios)).toBe(0)
    })

    it('should calculate total correctly for simple tariffs', () => {
      const q = { ...emptyQuantities, tarifaAS1: 2, tarifaBS2: 1 }
      // 2 * 0.5 + 1 * 1.25 = 2.25
      expect(calcTotal(q, mockPrecios)).toBeCloseTo(2.25)
    })

    it('should calculate total correctly for tiras', () => {
      const q = { ...emptyQuantities, tarifaAT1: 1, tarifa4T2: 2 }
      // 1 * 2.0 + 2 * 3.7 = 9.4
      expect(calcTotal(q, mockPrecios)).toBeCloseTo(9.4)
    })

    it('should sum quantities across both models for same tariff', () => {
      const q = { ...emptyQuantities, tarifaAS1: 3, tarifaAS2: 2 }
      // (3 + 2) * 0.5 = 2.5
      expect(calcTotal(q, mockPrecios)).toBeCloseTo(2.5)
    })

    it('should handle full basket correctly', () => {
      const q: KioskoQuantities = {
        tarifaAS1: 1,
        tarifaA2S1: 1,
        tarifaBS1: 1,
        tarifaCS1: 1,
        tarifaAT1: 1,
        tarifa4T1: 1,
        tarifaAS2: 1,
        tarifaA2S2: 1,
        tarifaBS2: 1,
        tarifaCS2: 1,
        tarifaAT2: 1,
        tarifa4T2: 1
      }
      // A: 2*0.5 + A2: 2*0.6 + B: 2*1.25 + C: 2*1.35 + TA: 2*2.0 + T4: 2*3.7
      // = 1.0 + 1.2 + 2.5 + 2.7 + 4.0 + 7.4 = 18.8
      expect(calcTotal(q, mockPrecios)).toBeCloseTo(18.8)
    })
  })

  describe('calcLimite', () => {
    it('should use limiteImporte for perfil 6 (FERIA)', () => {
      const ticket = { ...mockTicket, limiteImporte: 400, NUEVOlimiteImporte: 200 }
      const sello = { ...mockSello, elperfil: 6 }
      expect(calcLimite(ticket, sello)).toBe(400)
    })

    it('should use NUEVOlimiteImporte for other profiles when defined', () => {
      const ticket = { ...mockTicket, limiteImporte: 400, NUEVOlimiteImporte: 200 }
      const sello = { ...mockSello, elperfil: 1 }
      expect(calcLimite(ticket, sello)).toBe(200)
    })

    it('should fall back to limiteImporte when NUEVOlimiteImporte is 0 or undefined', () => {
      const ticket = { ...mockTicket, limiteImporte: 400, NUEVOlimiteImporte: 0 }
      const sello = { ...mockSello, elperfil: 3 }
      expect(calcLimite(ticket, sello)).toBe(400)
    })

    it('should return 0 when both limits are 0', () => {
      const ticket = { ...mockTicket, limiteImporte: 0, NUEVOlimiteImporte: 0 }
      const sello = { ...mockSello, elperfil: 1 }
      expect(calcLimite(ticket, sello)).toBe(0)
    })
  })

  describe('calcLimiteSimple', () => {
    it('should return min of budget-based and stock-based limits', () => {
      // budget: 10€, price: 0.5€ → 20 units by budget; stock: 15
      expect(calcLimiteSimple(10, 0.5, 15)).toBe(15)
    })

    it('should use budget limit when stock is higher', () => {
      // budget: 5€, price: 1.25€ → 4 units by budget; stock: 100
      expect(calcLimiteSimple(5, 1.25, 100)).toBe(4)
    })

    it('should return 0 when price is 0', () => {
      expect(calcLimiteSimple(100, 0, 50)).toBe(0)
    })

    it('should return 0 when budget is 0', () => {
      expect(calcLimiteSimple(0, 0.5, 50)).toBe(0)
    })

    it('should return 0 when budget is negative', () => {
      expect(calcLimiteSimple(-5, 0.5, 50)).toBe(0)
    })

    it('should floor the result', () => {
      // budget: 1€, price: 0.6€ → 1.666... → 1
      expect(calcLimiteSimple(1, 0.6, 100)).toBe(1)
    })
  })

  describe('calcLimiteTira', () => {
    it('should return min of budget, tickets, and roll/4', () => {
      // budget: 20€, price: 2€ → 10; tickets: 8; roll/4: 12 → min is 8
      expect(calcLimiteTira(20, 2, 48, 8)).toBe(8)
    })

    it('should limit by roll stock divided by 4', () => {
      // budget: 100€, price: 2€ → 50; tickets: 100; roll: 12 → roll/4 = 3
      expect(calcLimiteTira(100, 2, 12, 100)).toBe(3)
    })

    it('should limit by budget', () => {
      // budget: 5€, price: 3.7€ → 1; tickets: 100; roll/4: 100
      expect(calcLimiteTira(5, 3.7, 400, 100)).toBe(1)
    })

    it('should return 0 when price is 0', () => {
      expect(calcLimiteTira(100, 0, 400, 100)).toBe(0)
    })

    it('should return 0 when budget is negative', () => {
      expect(calcLimiteTira(-5, 2, 100, 50)).toBe(0)
    })

    it('should return 0 when no tickets available', () => {
      expect(calcLimiteTira(100, 2, 400, 0)).toBe(0)
    })
  })

  describe('calcAllLimits', () => {
    it('should calculate all limits for empty basket', () => {
      const limits = calcAllLimits(emptyQuantities, mockPrecios, mockTicket, mockSello)

      // With empty basket, budgetRemaining = 399.99
      // rollo1Available = 1500, rollo2Available = 1500
      // ticketsAvailable = 450 - 2 - 0 = 448

      // limiteAS1 = min(floor(399.99/0.5), 1500) = min(799, 1500) = 799
      expect(limits.limiteAS1).toBe(799)
      expect(limits.limiteAS2).toBe(799)

      // limiteAT1 = min(floor(399.99/2.0), 448, floor(1500/4)) = min(199, 448, 375) = 199
      expect(limits.limiteAT1).toBe(199)
      expect(limits.limiteAT2).toBe(199)
    })

    it('should reduce limits when basket has items', () => {
      const q = { ...emptyQuantities, tarifaAS1: 100 }
      // total = 100 * 0.5 = 50
      // budgetRemaining = 399.99 - 50 = 349.99
      // rollo1Available = 1500 - 100 = 1400
      const limits = calcAllLimits(q, mockPrecios, mockTicket, mockSello)

      // limiteAS1 = min(floor(349.99/0.5), 1400) = min(699, 1400) = 699
      expect(limits.limiteAS1).toBe(699)
      // limiteAS2 still uses rollo2Available = 1500
      expect(limits.limiteAS2).toBe(699)
    })
  })

  // ─── Store actions ─────────────────────────────────────────────────────

  describe('setQuantity', () => {
    it('should set a quantity field', () => {
      useKioskoStore.getState().setQuantity('tarifaAS1', 5)
      expect(useKioskoStore.getState().quantities.tarifaAS1).toBe(5)
    })

    it('should normalize negative values to 0', () => {
      useKioskoStore.getState().setQuantity('tarifaAS1', -3)
      expect(useKioskoStore.getState().quantities.tarifaAS1).toBe(0)
    })

    it('should normalize NaN to 0', () => {
      useKioskoStore.getState().setQuantity('tarifaBS2', NaN)
      expect(useKioskoStore.getState().quantities.tarifaBS2).toBe(0)
    })

    it('should floor decimal values', () => {
      useKioskoStore.getState().setQuantity('tarifaCS1', 3.9)
      expect(useKioskoStore.getState().quantities.tarifaCS1).toBe(3)
    })
  })

  describe('setQuantities', () => {
    it('should set multiple fields at once', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 3, tarifaBS2: 7 })
      const q = useKioskoStore.getState().quantities
      expect(q.tarifaAS1).toBe(3)
      expect(q.tarifaBS2).toBe(7)
      expect(q.tarifaA2S1).toBe(0) // unchanged
    })

    it('should normalize all provided values', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: -1, tarifaBS1: NaN, tarifaCS1: 2.5 })
      const q = useKioskoStore.getState().quantities
      expect(q.tarifaAS1).toBe(0)
      expect(q.tarifaBS1).toBe(0)
      expect(q.tarifaCS1).toBe(2)
    })
  })

  describe('reset', () => {
    it('should set all quantities to 0', () => {
      useKioskoStore.getState().setQuantities({
        tarifaAS1: 5,
        tarifaAT1: 3,
        tarifa4T2: 2
      })
      useKioskoStore.getState().reset()
      const q = useKioskoStore.getState().quantities
      expect(q).toEqual(emptyQuantities)
    })
  })

  describe('normalizeAll', () => {
    it('should clamp any negative values to 0', () => {
      // Directly set state to simulate bad data
      useKioskoStore.setState({
        quantities: {
          ...emptyQuantities,
          tarifaAS1: -5,
          tarifaBS2: -1,
          tarifaAT1: 3
        }
      })
      useKioskoStore.getState().normalizeAll()
      const q = useKioskoStore.getState().quantities
      expect(q.tarifaAS1).toBe(0)
      expect(q.tarifaBS2).toBe(0)
      expect(q.tarifaAT1).toBe(3)
    })
  })

  describe('recordLastSale / clearLastSale', () => {
    it('should record last sale consumption', () => {
      useKioskoStore.getState().recordLastSale(10, 5, 4)
      expect(useKioskoStore.getState().lastSale).toEqual({
        sellos1: 10,
        sellos2: 5,
        tickets: 4
      })
    })

    it('should clear last sale record', () => {
      useKioskoStore.getState().recordLastSale(10, 5, 4)
      useKioskoStore.getState().clearLastSale()
      expect(useKioskoStore.getState().lastSale).toEqual({
        sellos1: 0,
        sellos2: 0,
        tickets: 0
      })
    })
  })

  // ─── Store getters ─────────────────────────────────────────────────────

  describe('getTotal', () => {
    it('should return basket total based on current quantities', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 2, tarifaBS2: 1 })
      const total = useKioskoStore.getState().getTotal(mockPrecios)
      expect(total).toBeCloseTo(2.25) // 2*0.5 + 1*1.25
    })
  })

  describe('getLimite', () => {
    it('should return the correct spending limit', () => {
      expect(useKioskoStore.getState().getLimite(mockTicket, mockSello)).toBe(399.99)
    })
  })

  describe('getBudgetRemaining', () => {
    it('should return limite minus current total', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 10 })
      // Remaining = 399.99 - 10*0.5 = 394.99
      const remaining = useKioskoStore.getState().getBudgetRemaining(mockPrecios, mockTicket, mockSello)
      expect(remaining).toBeCloseTo(394.99)
    })
  })

  describe('getRemainingRollo1 / getRemainingRollo2', () => {
    it('should return roll stock minus consumed stamps', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 5, tarifaAT1: 2 })
      // Used = 5 + 2*4 = 13
      expect(useKioskoStore.getState().getRemainingRollo1(mockTicket)).toBe(1500 - 13)
    })

    it('should return full stock for modelo 2 when only modelo 1 has items', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 100 })
      expect(useKioskoStore.getState().getRemainingRollo2(mockTicket)).toBe(1500)
    })
  })

  describe('getRemainingTickets', () => {
    it('should subtract 2 (mandatory ticket + copy) plus tiras', () => {
      useKioskoStore.getState().setQuantities({ tarifaAT1: 3, tarifa4T2: 1 })
      // Available = 450 - 2 - (3 + 1) = 444
      expect(useKioskoStore.getState().getRemainingTickets(mockTicket)).toBe(444)
    })
  })

  // ─── Validation ────────────────────────────────────────────────────────

  describe('validateSale', () => {
    it('should return "empty" when basket total is 0', () => {
      expect(useKioskoStore.getState().validateSale(mockConfig)).toBe('empty')
    })

    it('should return null for a valid sale', () => {
      useKioskoStore.getState().setQuantities({ tarifaAS1: 2 })
      expect(useKioskoStore.getState().validateSale(mockConfig)).toBeNull()
    })

    it('should reject when exceeding roll 1 stock', () => {
      const config = {
        ...mockConfig,
        ticket: { ...mockTicket, rollo1: 5, rollo2: 1500 }
      }
      useKioskoStore.getState().setQuantities({ tarifaAS1: 6 })
      expect(useKioskoStore.getState().validateSale(config)).toBe(
        'No hay suficientes sellos del primer motivo'
      )
    })

    it('should reject when exceeding roll 2 stock', () => {
      const config = {
        ...mockConfig,
        ticket: { ...mockTicket, rollo1: 1500, rollo2: 3 }
      }
      useKioskoStore.getState().setQuantities({ tarifaAS2: 4 })
      expect(useKioskoStore.getState().validateSale(config)).toBe(
        'No hay suficientes sellos del segundo motivo'
      )
    })

    it('should reject when exceeding both rolls', () => {
      const config = {
        ...mockConfig,
        ticket: { ...mockTicket, rollo1: 2, rollo2: 2 }
      }
      useKioskoStore.getState().setQuantities({ tarifaAS1: 3, tarifaAS2: 3 })
      expect(useKioskoStore.getState().validateSale(config)).toBe(
        'No hay suficientes sellos del primer motivo ni del segundo'
      )
    })

    it('should reject when exceeding spending limit', () => {
      const config = {
        ...mockConfig,
        ticket: { ...mockTicket, limiteImporte: 1.0 }
      }
      useKioskoStore.getState().setQuantities({ tarifaBS1: 2 })
      // total = 2 * 1.25 = 2.5 > 1.0
      expect(useKioskoStore.getState().validateSale(config)).toContain('límite de compra')
    })

    it('should reject when not enough tickets', () => {
      const config = {
        ...mockConfig,
        ticket: { ...mockTicket, tickets: 3 }
      }
      // needs 2 + 2 = 4 tickets
      useKioskoStore.getState().setQuantities({ tarifaAT1: 1, tarifaAT2: 1 })
      expect(useKioskoStore.getState().validateSale(config)).toBe(
        'No hay suficientes tickets'
      )
    })

    it('should reject when client ID exceeds 9999', () => {
      const config = {
        ...mockConfig,
        codigo: { ...mockConfig.codigo, cliente: 10000 }
      }
      useKioskoStore.getState().setQuantities({ tarifaAS1: 1 })
      expect(useKioskoStore.getState().validateSale(config)).toContain('reset')
    })
  })
})
