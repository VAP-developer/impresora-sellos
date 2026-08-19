/**
 * code-formatter.ts
 *
 * Pure functions for formatting the label code (Código de Etiqueta)
 * printed on each stamp. Replicates the computed logic from the legacy
 * KioskoView.vue (modocod, elmes, elannio, clientecod) and the
 * Python demonio (report.py) for producto formatting.
 *
 * Label code format:
 *   {modo}{mes}{pais}{año} {maquina}-{cliente4dígitos}-{producto3dígitos}
 *
 * Examples:
 *   "P5ES25 CH17-0001-001"
 *   "FOES25 FI01-0142-001"
 *   "P1AD24 CH17-9999-012"
 *
 * Validates: Requirement 3 (Gestión de Código de Etiqueta)
 * Correctness Property: 3
 */

import type { CodigoConfig } from '@renderer/types/config'

// ─── Month formatting ─────────────────────────────────────────────────────────

/**
 * Format the month component of the label code.
 *
 * - When mes config is 0 (auto), uses the current system month.
 * - Months 1-9 are represented as their numeric value ("1"-"9").
 * - Month 10 (October) → "O"
 * - Month 11 (November) → "N"
 * - Month 12 (December) → "D"
 *
 * @param mesCfg - The configured month (0 = auto, 1-12 = manual)
 * @param now - Optional Date for testability (defaults to current date)
 */
export function formatMes(mesCfg: number, now?: Date): string {
  const month = mesCfg === 0 ? (now ?? new Date()).getMonth() + 1 : mesCfg

  if (month === 10) return 'O'
  if (month === 11) return 'N'
  if (month === 12) return 'D'
  return month.toString()
}

// ─── Year formatting ──────────────────────────────────────────────────────────

/**
 * Format the year component of the label code.
 *
 * - When annio is "auto", uses the last two digits of the current year.
 * - Otherwise, returns the configured value as-is (expected to be 2 digits).
 *
 * @param annioCfg - The configured year ("auto" or a 2-digit string)
 * @param now - Optional Date for testability (defaults to current date)
 */
export function formatAnnio(annioCfg: string, now?: Date): string {
  if (annioCfg === 'auto') {
    return ((now ?? new Date()).getFullYear() - 2000).toString()
  }
  return annioCfg
}

// ─── Client ID formatting ─────────────────────────────────────────────────────

/**
 * Format the client/session ID with zero-padding to 4 digits.
 *
 * - Values 0-9999 are padded with leading zeros to 4 digits.
 * - Values > 9999 return the overflow sentinel "HACER RESET".
 *
 * @param cliente - The numeric client ID (auto-incrementing session counter)
 */
export function formatCliente(cliente: number): string {
  if (cliente > 9999) return 'HACER RESET'
  return cliente.toString().padStart(4, '0')
}

// ─── Product ID formatting ────────────────────────────────────────────────────

/**
 * Format the product ID with zero-padding to 3 digits.
 *
 * @param producto - The numeric product ID
 */
export function formatProducto(producto: number): string {
  return producto.toString().padStart(3, '0')
}

// ─── Full label code ──────────────────────────────────────────────────────────

/**
 * Format the complete label code (Código de Etiqueta).
 *
 * New pattern (with feria codes): {feria1}-{mes}{feria2} {cliente4dígitos}-{producto3dígitos}
 * Example: "ABCD-8EF 0001-001" (4 chars + mes + 2 chars)
 *
 * Legacy pattern: {modo}{mes}{pais}{año} {maquina}-{cliente4dígitos}-{producto3dígitos}
 *
 * Property 3: For any valid code configuration, the formatted code must conform
 * to the pattern with months 10/11/12 as O/N/D, client zero-padded to 4 digits,
 * and product zero-padded to 3 digits.
 *
 * @param codigo - The full CodigoConfig object
 * @param now - Optional Date for testability (defaults to current date)
 * @returns The formatted label code string, or null if client exceeds 9999
 */
export function formatLabelCode(codigo: CodigoConfig, now?: Date): string | null {
  const clienteStr = formatCliente(codigo.cliente)
  if (clienteStr === 'HACER RESET') return null

  const producto = formatProducto(codigo.producto)
  const feria1 = codigo.codigo_feria_1 ?? ''
  const feria2 = codigo.codigo_feria_2 ?? ''

  // New format when feria codes are configured
  // Pattern: {feria1}-{mes}{feria2} {cliente}-{producto}
  // The month char from pestaña Máquina is prepended to the second block
  if (feria1 || feria2) {
    const mes = formatMes(codigo.mes, now)
    return `${feria1}-${mes}${feria2} ${clienteStr}-${producto}`
  }

  // Legacy fallback
  const modo = codigo.modo
  const mes = formatMes(codigo.mes, now)
  const pais = codigo.pais
  const annio = formatAnnio(codigo.annio, now)
  const maquina = codigo.maquina

  return `${modo}${mes}${pais}${annio} ${maquina}-${clienteStr}-${producto}`
}

/**
 * Check whether the client ID has overflowed (exceeds 9999).
 * When true, sales must be blocked until the vendor resets the counter.
 *
 * @param cliente - The current client counter value
 */
export function isClienteOverflow(cliente: number): boolean {
  return cliente > 9999
}
