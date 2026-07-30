/**
 * kiosko.store.ts
 *
 * Zustand store for the Kiosko (point-of-sale) view state.
 * Manages tariff quantities for both stamp models, computes totals,
 * calculates per-tariff limits based on remaining budget and roll stock,
 * and provides sale/reset/revert actions.
 *
 * Refactored to support dynamic tariff groups: quantities are now stored
 * as a Record<string, number> keyed by `tariff_${tariffId}_s${model}`.
 * Legacy fixed-field access is maintained for backward compatibility
 * during the migration period.
 *
 * Pure calculation functions are in @renderer/lib/tariff-calc.ts.
 */

import { create } from 'zustand'
import type { AppConfig, PreciosConfig, TicketConfig, SelloConfig } from '@renderer/types/config'
import type { TariffGroup, EventoRow } from '@renderer/lib/ipc-client'
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

/** Dynamic quantities keyed by `tariff_${tariffId}_s${model}` */
export type DynamicQuantities = Record<string, number>

/** Dynamic limits keyed similarly */
export type DynamicLimits = Record<string, number>

/** Tracks amounts consumed in the last sale (for error reversal) */
export interface LastSaleConsumption {
  sellos1: number
  sellos2: number
  tickets: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a dynamic quantity key from tariffId and model */
export function buildQuantityKey(tariffId: number, model: 1 | 2): string {
  return `tariff_${tariffId}_s${model}`
}

/** Parse a dynamic quantity key into tariffId and model */
export function parseQuantityKey(key: string): { tariffId: number; model: 1 | 2 } | null {
  const match = key.match(/^tariff_(\d+)_s([12])$/)
  if (!match) return null
  return { tariffId: Number(match[1]), model: Number(match[2]) as 1 | 2 }
}

/**
 * Get filtered tariffs based on activeEvento selections.
 * If evento has selected_tariff_ids, return only those tariffs.
 * Otherwise, return all tariffs from the group.
 */
function getFilteredTariffs(group: TariffGroup | null, evento: EventoRow | null) {
  if (!group) return []
  const allTariffs = group.tariffs ?? []
  
  if (evento && evento.selected_tariff_ids && evento.selected_tariff_ids.length > 0) {
    const selectedIds = new Set(evento.selected_tariff_ids)
    return allTariffs.filter(t => t.id && selectedIds.has(t.id))
  }
  
  return allTariffs
}

/**
 * Get filtered strips based on activeEvento selections.
 * If evento has selected_strip_ids, return only those strips.
 * Otherwise, return all strips from the group.
 */
function getFilteredStrips(group: TariffGroup | null, evento: EventoRow | null) {
  if (!group) return []
  const allStrips = group.strips ?? []
  
  if (evento && evento.selected_strip_ids && evento.selected_strip_ids.length > 0) {
    const selectedIds = new Set(evento.selected_strip_ids)
    return allStrips.filter(s => s.id && selectedIds.has(s.id))
  }
  
  return allStrips
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface KioskoState {
  /** Current quantities selected per tariff/model (dynamic keys) */
  quantities: DynamicQuantities

  /** The active tariff group determining which tariffs are available */
  activeTariffGroup: TariffGroup | null

  /** The active event (contains selected tariff/strip IDs) */
  activeEvento: EventoRow | null

  /** Whether the user toggled to secondary/complementary pricing */
  useSecondaryPrice: boolean

  /** Consumption data from the last completed sale (for error reversal) */
  lastSale: LastSaleConsumption

  // --- Derived getters (computed from quantities + config) ---

  /** Calculate the total cost of the basket given prices config (legacy) */
  getTotal: (precios: PreciosConfig) => number

  /** Calculate the total using the active tariff group (dynamic) */
  getDynamicTotal: () => number

  /** Calculate the spending limit based on config */
  getLimite: (ticket: TicketConfig, sello: SelloConfig) => number

  /** Calculate the remaining budget */
  getBudgetRemaining: (precios: PreciosConfig, ticket: TicketConfig, sello: SelloConfig) => number

  /** Get all tariff limits given current config (legacy) */
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

  /**
   * Set a quantity for a dynamic tariff by tariffId and model.
   * Negative/NaN values are normalized to 0.
   */
  setQuantity: (tariffIdOrField: number | keyof KioskoQuantities, modelOrValue: (1 | 2) | number, value?: number) => void

  /** Set multiple quantity fields at once (legacy). */
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
   * Set the active tariff group. Resets quantities when changing group.
   */
  setActiveTariffGroup: (group: TariffGroup | null) => void

  /**
   * Set the active evento (contains selected tariff/strip IDs).
   */
  setActiveEvento: (evento: EventoRow | null) => void

  /**
   * Toggle between local and secondary pricing.
   */
  setUseSecondaryPrice: (value: boolean) => void

  /**
   * Validate whether the current basket can be sold.
   * Returns null if valid, or an error message string if invalid.
   */
  validateSale: (config: AppConfig) => string | null
}

/** Legacy empty quantities for backward compatibility when no dynamic group is active */
const LEGACY_EMPTY_QUANTITIES: DynamicQuantities = {
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

/**
 * Convert DynamicQuantities to legacy KioskoQuantities format.
 * This is used for backward compatibility with legacy calc functions.
 */
function toLegacyQuantities(quantities: DynamicQuantities): KioskoQuantities {
  return {
    tarifaAS1: quantities['tarifaAS1'] ?? 0,
    tarifaA2S1: quantities['tarifaA2S1'] ?? 0,
    tarifaBS1: quantities['tarifaBS1'] ?? 0,
    tarifaCS1: quantities['tarifaCS1'] ?? 0,
    tarifaAT1: quantities['tarifaAT1'] ?? 0,
    tarifa4T1: quantities['tarifa4T1'] ?? 0,
    tarifaAS2: quantities['tarifaAS2'] ?? 0,
    tarifaA2S2: quantities['tarifaA2S2'] ?? 0,
    tarifaBS2: quantities['tarifaBS2'] ?? 0,
    tarifaCS2: quantities['tarifaCS2'] ?? 0,
    tarifaAT2: quantities['tarifaAT2'] ?? 0,
    tarifa4T2: quantities['tarifa4T2'] ?? 0
  }
}

export const useKioskoStore = create<KioskoState>((set, get) => ({
  quantities: { ...LEGACY_EMPTY_QUANTITIES },
  activeTariffGroup: null,
  activeEvento: null,
  useSecondaryPrice: false,
  lastSale: { sellos1: 0, sellos2: 0, tickets: 0 },

  // --- Derived getters ---

  getTotal: (precios) => {
    const state = get()
    // If there's an active tariff group, use dynamic calculation
    if (state.activeTariffGroup) {
      return state.getDynamicTotal()
    }
    // Legacy: convert to KioskoQuantities and use calcTotal
    return calcTotal(toLegacyQuantities(state.quantities), precios)
  },

  getDynamicTotal: () => {
    const { quantities, activeTariffGroup, activeEvento, useSecondaryPrice } = get()
    if (!activeTariffGroup) return 0

    const filteredTariffs = getFilteredTariffs(activeTariffGroup, activeEvento)
    const filteredStrips = getFilteredStrips(activeTariffGroup, activeEvento)
    const allTariffs = [...filteredTariffs, ...filteredStrips]
    
    let total = 0
    for (const tariff of allTariffs) {
      if (!tariff.id) continue
      const key1 = buildQuantityKey(tariff.id, 1)
      const key2 = buildQuantityKey(tariff.id, 2)
      const qty1 = quantities[key1] ?? 0
      const qty2 = quantities[key2] ?? 0
      const price = useSecondaryPrice ? (tariff.secondary_price ?? 0) : (tariff.local_price ?? 0)
      total += (qty1 + qty2) * price
    }
    return total
  },

  getLimite: (ticket, sello) => {
    return calcLimite(ticket, sello)
  },

  getBudgetRemaining: (precios, ticket, sello) => {
    const limite = calcLimite(ticket, sello)
    const total = get().getTotal(precios)
    return limite - total
  },

  getLimits: (precios, ticket, sello) => {
    return calcAllLimits(toLegacyQuantities(get().quantities), precios, ticket, sello)
  },

  getUsedRollo1: () => {
    const state = get()
    if (state.activeTariffGroup) {
      // Dynamic: sum all quantities for model 1
      // Individual tariffs: 1 stamp each
      // Strips: number of tariffs they contain
      let used = 0
      const filteredTariffs = getFilteredTariffs(state.activeTariffGroup, state.activeEvento)
      const filteredStrips = getFilteredStrips(state.activeTariffGroup, state.activeEvento)
      
      // Count individual tariffs
      for (const tariff of filteredTariffs) {
        if (!tariff.id) continue
        const key = buildQuantityKey(tariff.id, 1)
        used += state.quantities[key] ?? 0
      }
      
      // Count strips (each strip = number of tariffs it contains)
      for (const strip of filteredStrips) {
        if (!strip.id) continue
        const key = buildQuantityKey(strip.id, 1)
        const stripQty = state.quantities[key] ?? 0
        used += stripQty * (strip.tariff_ids?.length ?? 0)
      }
      
      return used
    }
    return calcUsedRollo1(toLegacyQuantities(state.quantities))
  },

  getUsedRollo2: () => {
    const state = get()
    if (state.activeTariffGroup) {
      // Dynamic: sum all quantities for model 2
      // Individual tariffs: 1 stamp each
      // Strips: number of tariffs they contain
      let used = 0
      const filteredTariffs = getFilteredTariffs(state.activeTariffGroup, state.activeEvento)
      const filteredStrips = getFilteredStrips(state.activeTariffGroup, state.activeEvento)
      
      // Count individual tariffs
      for (const tariff of filteredTariffs) {
        if (!tariff.id) continue
        const key = buildQuantityKey(tariff.id, 2)
        used += state.quantities[key] ?? 0
      }
      
      // Count strips (each strip = number of tariffs it contains)
      for (const strip of filteredStrips) {
        if (!strip.id) continue
        const key = buildQuantityKey(strip.id, 2)
        const stripQty = state.quantities[key] ?? 0
        used += stripQty * (strip.tariff_ids?.length ?? 0)
      }
      
      return used
    }
    return calcUsedRollo2(toLegacyQuantities(state.quantities))
  },

  getUsedTickets: () => {
    // In the dynamic model, tickets are consumed by strips (1 per strip)
    const state = get()
    if (state.activeTariffGroup) {
      let totalStripQty = 0
      const filteredStrips = getFilteredStrips(state.activeTariffGroup, state.activeEvento)
      
      for (const strip of filteredStrips) {
        if (!strip.id) continue
        const key1 = buildQuantityKey(strip.id, 1)
        const key2 = buildQuantityKey(strip.id, 2)
        totalStripQty += (state.quantities[key1] ?? 0) + (state.quantities[key2] ?? 0)
      }
      
      return totalStripQty
    }
    return calcUsedTickets(toLegacyQuantities(state.quantities))
  },

  getRemainingRollo1: (ticket) => {
    return (ticket.rollo1 ?? 0) - get().getUsedRollo1()
  },

  getRemainingRollo2: (ticket) => {
    return (ticket.rollo2 ?? 0) - get().getUsedRollo2()
  },

  getRemainingTickets: (ticket) => {
    return (ticket.tickets ?? 0) - 2 - get().getUsedTickets()
  },

  // --- Actions ---

  setQuantity: (tariffIdOrField: number | keyof KioskoQuantities, modelOrValue: (1 | 2) | number, value?: number) => {
    if (typeof tariffIdOrField === 'number' && value !== undefined) {
      // New dynamic API: setQuantity(tariffId, model, value)
      const key = buildQuantityKey(tariffIdOrField, modelOrValue as 1 | 2)
      set((state) => ({
        quantities: {
          ...state.quantities,
          [key]: normalizeQty(value)
        }
      }))
    } else {
      // Legacy API: setQuantity(field, value)
      const field = tariffIdOrField as keyof KioskoQuantities
      const val = modelOrValue as number
      set((state) => ({
        quantities: {
          ...state.quantities,
          [field]: normalizeQty(val)
        }
      }))
    }
  },

  setQuantities: (partial) => {
    set((state) => {
      const updated = { ...state.quantities }
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) {
          updated[key] = normalizeQty(value)
        }
      }
      return { quantities: updated }
    })
  },

  reset: () => {
    const { activeTariffGroup } = get()
    if (activeTariffGroup) {
      // Dynamic mode: reset to empty map
      set({ quantities: {} })
    } else {
      // Legacy mode: reset to fixed field structure
      set({ quantities: { ...LEGACY_EMPTY_QUANTITIES } })
    }
  },

  normalizeAll: () => {
    set((state) => {
      const normalized: DynamicQuantities = {}
      for (const [key, value] of Object.entries(state.quantities)) {
        normalized[key] = normalizeQty(value)
      }
      return { quantities: normalized }
    })
  },

  recordLastSale: (sellos1, sellos2, tickets) => {
    set({ lastSale: { sellos1, sellos2, tickets } })
  },

  clearLastSale: () => {
    set({ lastSale: { sellos1: 0, sellos2: 0, tickets: 0 } })
  },

  setActiveTariffGroup: (group) => {
    if (group) {
      // Switching to dynamic mode: reset quantities to empty map
      set({
        activeTariffGroup: group,
        quantities: {}
      })
    } else {
      // Switching back to legacy mode: reset to fixed field structure
      set({
        activeTariffGroup: null,
        quantities: { ...LEGACY_EMPTY_QUANTITIES }
      })
    }
  },

  setActiveEvento: (evento) => {
    set({ activeEvento: evento })
  },

  setUseSecondaryPrice: (value) => {
    set({ useSecondaryPrice: value })
  },

  validateSale: (config) => {
    const state = get()
    const { ticket, sello, codigo } = config

    if (state.activeTariffGroup) {
      // Dynamic validation
      const total = state.getDynamicTotal()
      const limite = calcLimite(ticket, sello)
      const usedRollo1 = state.getUsedRollo1()
      const usedRollo2 = state.getUsedRollo2()

      // Check if basket is empty
      if (total === 0) {
        return 'empty'
      }

      // Check client ID overflow
      if (codigo.cliente > 9999) {
        return 'Límite de ID Cliente, haga reset en menú MÁQUINA'
      }

      // Check roll stock
      if (usedRollo1 > (ticket.rollo1 ?? 0) && usedRollo2 > (ticket.rollo2 ?? 0)) {
        return 'No hay suficientes sellos del primer motivo ni del segundo'
      }
      if (usedRollo1 > (ticket.rollo1 ?? 0)) {
        return 'No hay suficientes sellos del primer motivo'
      }
      if (usedRollo2 > (ticket.rollo2 ?? 0)) {
        return 'No hay suficientes sellos del segundo motivo'
      }

      // Check spending limit
      if (total > limite) {
        return `Ha excedido el límite de compra de ${limite}€`
      }

      return null
    }

    // Legacy validation
    const q = toLegacyQuantities(state.quantities)
    const { precios } = config
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
