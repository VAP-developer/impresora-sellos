/**
 * tariff-calc.ts
 *
 * Pure functions for tariff limit and total calculations.
 * These replicate the computed logic from the legacy KioskoView.vue
 * and are extracted here for testability (property-based tests)
 * and reuse across stores and components.
 *
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 13.4
 * Correctness Properties: 1, 2, 14
 */

import type { PreciosConfig, TicketConfig, SelloConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Quantities per tariff and model */
export interface KioskoQuantities {
  // Modelo 1 (izquierdo / printer1)
  tarifaAS1: number
  tarifaA2S1: number
  tarifaBS1: number
  tarifaCS1: number
  tarifaAT1: number
  tarifa4T1: number
  // Modelo 2 (derecho / printer2)
  tarifaAS2: number
  tarifaA2S2: number
  tarifaBS2: number
  tarifaCS2: number
  tarifaAT2: number
  tarifa4T2: number
}

/** Limits for each tariff row (max units that can still be added) */
export interface KioskoLimits {
  limiteAT1: number
  limiteAT2: number
  limite4T1: number
  limite4T2: number
  limiteAS1: number
  limiteAS2: number
  limiteA2S1: number
  limiteA2S2: number
  limiteBS1: number
  limiteBS2: number
  limiteCS1: number
  limiteCS2: number
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a quantity value: negative, NaN, or Infinity becomes 0.
 * Non-integer values are floored.
 */
export function normalizeQty(val: number): number {
  if (!Number.isFinite(val) || val < 0) return 0
  return Math.floor(val)
}

// ─── Roll / Ticket consumption ────────────────────────────────────────────────

/**
 * Calculate stamps consumed from roll 1 given current quantities.
 * Simple stamps count 1 each; tiras (strips) count 4 each.
 */
export function calcUsedRollo1(q: KioskoQuantities): number {
  return (
    q.tarifaAT1 * 4 +
    q.tarifa4T1 * 4 +
    q.tarifaAS1 +
    q.tarifaA2S1 +
    q.tarifaBS1 +
    q.tarifaCS1
  )
}

/**
 * Calculate stamps consumed from roll 2 given current quantities.
 * Simple stamps count 1 each; tiras (strips) count 4 each.
 */
export function calcUsedRollo2(q: KioskoQuantities): number {
  return (
    q.tarifaAT2 * 4 +
    q.tarifa4T2 * 4 +
    q.tarifaAS2 +
    q.tarifaA2S2 +
    q.tarifaBS2 +
    q.tarifaCS2
  )
}

/**
 * Calculate tickets consumed by tiras (strips).
 * Each tira sale (from either model) consumes 1 ticket.
 */
export function calcUsedTickets(q: KioskoQuantities): number {
  return q.tarifaAT1 + q.tarifa4T1 + q.tarifaAT2 + q.tarifa4T2
}

// ─── Total calculation ────────────────────────────────────────────────────────

/**
 * Calculate the total cost of the current basket.
 * Sum of (quantity × price) for each tariff across both models.
 *
 * Property 1: For any set of quantities and positive prices,
 * total = Σ(quantity_i × price_i) for all tariff/model combinations.
 */
export function calcTotal(q: KioskoQuantities, precios: PreciosConfig): number {
  const tarifaA = precios.tarifaA ?? 0
  const tarifaA2 = precios.tarifaA2 ?? 0
  const tarifaB = precios.tarifaB ?? 0
  const tarifaC = precios.tarifaC ?? 0
  const tarifaTA = precios.tarifaTA ?? 0
  const tarifaT4 = precios.tarifaT4 ?? 0

  return (
    tarifaA * (q.tarifaAS1 + q.tarifaAS2) +
    tarifaA2 * (q.tarifaA2S1 + q.tarifaA2S2) +
    tarifaB * (q.tarifaBS1 + q.tarifaBS2) +
    tarifaC * (q.tarifaCS1 + q.tarifaCS2) +
    tarifaTA * (q.tarifaAT1 + q.tarifaAT2) +
    tarifaT4 * (q.tarifa4T1 + q.tarifa4T2)
  )
}

// ─── Limit determination ──────────────────────────────────────────────────────

/**
 * Determine the spending limit based on active profile.
 *
 * Property 14: Profile 6 (FERIA) uses limiteImporte;
 * all other profiles use NUEVOlimiteImporte (fallback to limiteImporte).
 */
export function calcLimite(ticket: TicketConfig, sello: SelloConfig): number {
  const perfil = sello.elperfil
  if (perfil === 6) {
    return Number(ticket.limiteImporte) || 0
  }
  const nuevoLimite = Number(ticket.NUEVOlimiteImporte)
  return nuevoLimite || Number(ticket.limiteImporte) || 0
}

/**
 * Calculate limit for a simple (individual) tariff.
 *
 * Property 2 (simple): limit = min(floor(budgetRemaining / price), availableRollStock)
 * Returns 0 when price is ≤ 0 or when no budget/stock remains.
 */
export function calcLimiteSimple(
  budgetRemaining: number,
  precio: number,
  rolloDisponible: number
): number {
  if (precio <= 0) return 0
  return Math.max(
    0,
    Math.min(Math.floor(budgetRemaining / precio), rolloDisponible)
  )
}

/**
 * Calculate limit for a tira (strip of 4 stamps) tariff.
 *
 * Property 2 (tira): limit = min(floor(budgetRemaining / price), ticketsDisponibles, floor(rolloDisponible / 4))
 * Returns 0 when price is ≤ 0 or when no budget/stock/tickets remain.
 */
export function calcLimiteTira(
  budgetRemaining: number,
  precio: number,
  rolloDisponible: number,
  ticketsDisponibles: number
): number {
  if (precio <= 0) return 0
  return Math.max(
    0,
    Math.min(
      Math.floor(budgetRemaining / precio),
      ticketsDisponibles,
      Math.floor(rolloDisponible / 4)
    )
  )
}

// ─── All limits computation ───────────────────────────────────────────────────

/**
 * Compute all tariff limits given the current quantities and configuration.
 *
 * This recalculates the budget remaining and available stock, then derives
 * the maximum additional units for each tariff/model combination.
 *
 * The "- 2" on tickets accounts for the mandatory ticket + copy printed
 * with every tira sale (legacy behavior).
 */
export function calcAllLimits(
  q: KioskoQuantities,
  precios: PreciosConfig,
  ticket: TicketConfig,
  sello: SelloConfig
): KioskoLimits {
  const limite = calcLimite(ticket, sello)
  const total = calcTotal(q, precios)
  const budgetRemaining = limite - total

  const usedRollo1 = calcUsedRollo1(q)
  const usedRollo2 = calcUsedRollo2(q)
  const usedTickets = calcUsedTickets(q)

  const rollo1Available = (ticket.rollo1 ?? 0) - usedRollo1
  const rollo2Available = (ticket.rollo2 ?? 0) - usedRollo2
  // Legacy: tickets available = tickets - 2 - usedTickets
  // The "- 2" accounts for the mandatory ticket + copy that every tira sale produces
  const ticketsAvailable = (ticket.tickets ?? 0) - 2 - usedTickets

  const tarifaA = precios.tarifaA ?? 0
  const tarifaA2 = precios.tarifaA2 ?? 0
  const tarifaB = precios.tarifaB ?? 0
  const tarifaC = precios.tarifaC ?? 0
  const tarifaTA = precios.tarifaTA ?? 0
  const tarifaT4 = precios.tarifaT4 ?? 0

  return {
    // Tiras (strips)
    limiteAT1: calcLimiteTira(budgetRemaining, tarifaTA, rollo1Available, ticketsAvailable),
    limiteAT2: calcLimiteTira(budgetRemaining, tarifaTA, rollo2Available, ticketsAvailable),
    limite4T1: calcLimiteTira(budgetRemaining, tarifaT4, rollo1Available, ticketsAvailable),
    limite4T2: calcLimiteTira(budgetRemaining, tarifaT4, rollo2Available, ticketsAvailable),
    // Simples (individual stamps)
    limiteAS1: calcLimiteSimple(budgetRemaining, tarifaA, rollo1Available),
    limiteAS2: calcLimiteSimple(budgetRemaining, tarifaA, rollo2Available),
    limiteA2S1: calcLimiteSimple(budgetRemaining, tarifaA2, rollo1Available),
    limiteA2S2: calcLimiteSimple(budgetRemaining, tarifaA2, rollo2Available),
    limiteBS1: calcLimiteSimple(budgetRemaining, tarifaB, rollo1Available),
    limiteBS2: calcLimiteSimple(budgetRemaining, tarifaB, rollo2Available),
    limiteCS1: calcLimiteSimple(budgetRemaining, tarifaC, rollo1Available),
    limiteCS2: calcLimiteSimple(budgetRemaining, tarifaC, rollo2Available)
  }
}

// ─── Sale validation ──────────────────────────────────────────────────────────

/**
 * Validate whether the current basket can be sold.
 * Returns null if valid, or an error message string if invalid.
 *
 * Checks:
 * - Basket is not empty (total > 0)
 * - Total does not exceed spending limit
 * - Sufficient roll stock for both models
 * - Sufficient tickets for tiras
 */
export function validateSale(
  q: KioskoQuantities,
  precios: PreciosConfig,
  ticket: TicketConfig,
  sello: SelloConfig,
  clienteId: number
): string | null {
  const sellos1 = calcUsedRollo1(q)
  const sellos2 = calcUsedRollo2(q)
  const total = calcTotal(q, precios)
  const limite = calcLimite(ticket, sello)
  const ticketsNeeded = 2 + calcUsedTickets(q)

  // Check if basket is empty
  if (total === 0) {
    return 'empty'
  }

  // Check client ID overflow
  if (clienteId > 9999) {
    return 'Límite de ID Cliente, haga reset en menú MÁQUINA'
  }

  // Check roll stock
  if (sellos1 > ticket.rollo1 && sellos2 > ticket.rollo2) {
    return 'No hay suficientes sellos del primer motivo ni del segundo'
  }
  if (sellos1 > ticket.rollo1) {
    return 'No hay suficientes sellos del primer motivo'
  }
  if (sellos2 > ticket.rollo2) {
    return 'No hay suficientes sellos del segundo motivo'
  }

  // Check spending limit
  if (total > limite) {
    return `Ha excedido el límite de compra de ${limite}€`
  }

  // Check ticket stock
  if (ticketsNeeded > ticket.tickets) {
    return 'No hay suficientes tickets'
  }

  return null
}
