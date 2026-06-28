/**
 * kiosko.store.ts
 *
 * Zustand store for the Kiosko (point-of-sale) view state.
 * Manages tariff quantities for both stamp models, computes totals,
 * calculates per-tariff limits based on remaining budget and roll stock,
 * and provides sale/reset/revert actions.
 *
 * Replicates the computed logic from the legacy KioskoView.vue.
 * Pure calculation functions are in @renderer/lib/tariff-calc.ts.
 */

import { create } from 'zustand'
import type { AppConfig, PreciosConfig, TicketConfig, SelloConfig } from '@renderer/types/config'
import {
  normalizeQty,
  calcTotal,
  calcLimite,
  calcLimiteSimple,
  calcLimiteTira,
  calcAllLimits,
  calcUsedRollo1,
  calcUsedRollo2,
  calcUsedTickets,
  validateSale,
  type KioskoQuantities,
  type KioskoLimits
} from '@renderer/lib/tariff-calc'

// ─── Types ────────────────────────────────────────────────────────────────────

// Re-export types from tariff-calc for backward compatibility
export type { KioskoQuantities, KioskoLimits }

/** Tracks amounts consumed in the last sale (for error reversal) */
export interface LastSaleConsumption {
  sellos1: number
  sellos2: number
  tickets: number
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface KioskoState {
  /** Current quantities selected per tariff/model */
  quantities: KioskoQuantities

  /** Consumption data from the last completed sale (for error reversal) */
  lastSale: LastSaleConsumption

  // --- Derived getters (computed from quantities + config) ---

  /** Calculate the total cost of the basket given prices config */
  getTotal: (precios: PreciosConfig) => number

  /** Calculate the spending limit based on config */
  getLimite: (ticket: TicketConfig, sello: SelloConfig) => number

  /** Calculate the remaining budget */
  getBudgetRemaining: (precios: PreciosConfig, ticket: TicketConfig, sello: SelloConfig) => number

  /** Get all tariff limits given current config */
  getLimits: (precios: PreciosConfig, ticket: TicketConfig, sello: SelloConfig) => KioskoLimits

  /** Get stamps consumed from roll 1 */
  getUsedRollo1: () => number

  /** Get stamps consumed from roll 2 */
  getUsedRollo2: () => number

  /** Get tickets consumed by tiras */
  getUsedTickets: () => number

  /** Get remaining roll 1 stock */
  getRemainingRollo1: (ticket: TicketConfig) => number

  /** Get remaining roll 2 stock */
  getRemainingRollo2: (ticket: TicketConfig) => number

  /** Get remaining tickets (with the -2 offset for mandatory ticket/copy) */
  getRemainingTickets: (ticket: TicketConfig) => number

  // --- Actions ---

  /** Set a specific quantity field. Negative/NaN values are normalized to 0. */
  setQuantity: (field: keyof KioskoQuantities, value: number) => void

  /** Set multiple quantity fields at once. */
  setQuantities: (partial: Partial<KioskoQuantities>) => void

  /** Reset all quantities to zero. */
  reset: () => void

  /** Normalize all quantities (clamp negatives to 0). */
  normalizeAll: () => void

  /**
   * Record the last sale's consumption (for potential error reversal).
   * Should be called right before committing a sale.
   */
  recordLastSale: (sellos1: number, sellos2: number, tickets: number) => void

  /** Clear the last sale record (after successful reversal or new sale context). */
  clearLastSale: () => void

  /**
   * Validate whether the current basket can be sold.
   * Returns null if valid, or an error message string if invalid.
   */
  validateSale: (config: AppConfig) => string | null
}

const EMPTY_QUANTITIES: KioskoQuantities = {
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

export const useKioskoStore = create<KioskoState>((set, get) => ({
  quantities: { ...EMPTY_QUANTITIES },
  lastSale: { sellos1: 0, sellos2: 0, tickets: 0 },

  // --- Derived getters ---

  getTotal: (precios) => {
    return calcTotal(get().quantities, precios)
  },

  getLimite: (ticket, sello) => {
    return calcLimite(ticket, sello)
  },

  getBudgetRemaining: (precios, ticket, sello) => {
    const limite = calcLimite(ticket, sello)
    const total = calcTotal(get().quantities, precios)
    return limite - total
  },

  getLimits: (precios, ticket, sello) => {
    return calcAllLimits(get().quantities, precios, ticket, sello)
  },

  getUsedRollo1: () => {
    return calcUsedRollo1(get().quantities)
  },

  getUsedRollo2: () => {
    return calcUsedRollo2(get().quantities)
  },

  getUsedTickets: () => {
    return calcUsedTickets(get().quantities)
  },

  getRemainingRollo1: (ticket) => {
    return (ticket.rollo1 ?? 0) - calcUsedRollo1(get().quantities)
  },

  getRemainingRollo2: (ticket) => {
    return (ticket.rollo2 ?? 0) - calcUsedRollo2(get().quantities)
  },

  getRemainingTickets: (ticket) => {
    return (ticket.tickets ?? 0) - 2 - calcUsedTickets(get().quantities)
  },

  // --- Actions ---

  setQuantity: (field, value) => {
    set((state) => ({
      quantities: {
        ...state.quantities,
        [field]: normalizeQty(value)
      }
    }))
  },

  setQuantities: (partial) => {
    set((state) => {
      const updated = { ...state.quantities }
      for (const [key, value] of Object.entries(partial)) {
        if (key in updated && value !== undefined) {
          updated[key as keyof KioskoQuantities] = normalizeQty(value)
        }
      }
      return { quantities: updated }
    })
  },

  reset: () => {
    set({ quantities: { ...EMPTY_QUANTITIES } })
  },

  normalizeAll: () => {
    set((state) => {
      const q = state.quantities
      return {
        quantities: {
          tarifaAS1: normalizeQty(q.tarifaAS1),
          tarifaA2S1: normalizeQty(q.tarifaA2S1),
          tarifaBS1: normalizeQty(q.tarifaBS1),
          tarifaCS1: normalizeQty(q.tarifaCS1),
          tarifaAT1: normalizeQty(q.tarifaAT1),
          tarifa4T1: normalizeQty(q.tarifa4T1),
          tarifaAS2: normalizeQty(q.tarifaAS2),
          tarifaA2S2: normalizeQty(q.tarifaA2S2),
          tarifaBS2: normalizeQty(q.tarifaBS2),
          tarifaCS2: normalizeQty(q.tarifaCS2),
          tarifaAT2: normalizeQty(q.tarifaAT2),
          tarifa4T2: normalizeQty(q.tarifa4T2)
        }
      }
    })
  },

  recordLastSale: (sellos1, sellos2, tickets) => {
    set({ lastSale: { sellos1, sellos2, tickets } })
  },

  clearLastSale: () => {
    set({ lastSale: { sellos1: 0, sellos2: 0, tickets: 0 } })
  },

  validateSale: (config) => {
    const q = get().quantities
    const { precios, ticket, sello, codigo } = config
    return validateSale(q, precios, ticket, sello, codigo.cliente)
  }
}))

// ─── Re-exported pure helpers (from tariff-calc.ts for backward compatibility) ─

export {
  calcTotal,
  calcLimite,
  calcLimiteSimple,
  calcLimiteTira,
  calcAllLimits,
  calcUsedRollo1,
  calcUsedRollo2,
  calcUsedTickets,
  normalizeQty,
  validateSale
}
