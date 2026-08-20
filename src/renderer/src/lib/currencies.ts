/**
 * currencies.ts
 *
 * Shared currency definitions used across the kiosk UI:
 * - CurrencySelector (settings)
 * - DynamicTariffTable (price display)
 * - CartControls (total / budget display)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrencyDef {
  code: string
  symbol: string
  label: string
}

// ─── Currency list ────────────────────────────────────────────────────────────

/** Predefined currencies with reliable symbols */
export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', symbol: '€', label: 'EUR €' },
  { code: 'USD', symbol: '$', label: 'USD $' },
  { code: 'GBP', symbol: '£', label: 'GBP £' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF Fr' },
  { code: 'JPY', symbol: '¥', label: 'JPY ¥' },
  { code: 'CNY', symbol: '¥', label: 'CNY ¥ (Yuan)' },
  { code: 'INR', symbol: '₹', label: 'INR ₹' },
  { code: 'KRW', symbol: '₩', label: 'KRW ₩' },
  { code: 'THB', symbol: '฿', label: 'THB ฿' },
  { code: 'MXN', symbol: '$', label: 'MXN $' },
  { code: 'ARS', symbol: '$', label: 'ARS $' },
  { code: 'COP', symbol: '$', label: 'COP $' },
  { code: 'PLN', symbol: 'zł', label: 'PLN zł' },
  { code: 'CZK', symbol: 'Kč', label: 'CZK Kč' },
  { code: 'HUF', symbol: 'Ft', label: 'HUF Ft' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD NZ$' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR R' },
  { code: 'ILS', symbol: '₪', label: 'ILS ₪' },
  { code: 'SGD', symbol: 'S$', label: 'SGD S$' },
  { code: 'HKD', symbol: 'HK$', label: 'HKD HK$' },
  { code: 'TWD', symbol: 'NT$', label: 'TWD NT$' },
  { code: 'PHP', symbol: '₱', label: 'PHP ₱' },
  { code: 'MYR', symbol: 'RM', label: 'MYR RM' },
  { code: 'IDR', symbol: 'Rp', label: 'IDR Rp' },
  { code: 'VND', symbol: '₫', label: 'VND ₫' }
]

/** Special code prefix used for user-defined custom currency */
export const CUSTOM_CURRENCY_CODE = 'CUSTOM'

// ─── Lookup map (code → symbol) ──────────────────────────────────────────────

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
)

/**
 * Check whether a currency value represents a custom (user-defined) entry.
 * Custom values are stored as "CUSTOM:symbol" (e.g. "CUSTOM:元").
 */
export function isCustomCurrency(value: string): boolean {
  return value.startsWith(CUSTOM_CURRENCY_CODE + ':')
}

/**
 * Extract the user-defined symbol from a custom currency value.
 * E.g. "CUSTOM:元" → "元"
 */
export function getCustomSymbol(value: string): string {
  if (!isCustomCurrency(value)) return ''
  return value.slice(CUSTOM_CURRENCY_CODE.length + 1)
}

/**
 * Build the stored value for a custom currency with the given symbol.
 * E.g. buildCustomCurrencyValue("元") → "CUSTOM:元"
 */
export function buildCustomCurrencyValue(symbol: string): string {
  return `${CUSTOM_CURRENCY_CODE}:${symbol}`
}

/**
 * Resolve a currency code to its display symbol.
 * Handles both predefined codes (EUR, USD...) and custom values (CUSTOM:X).
 * Falls back to the code itself if unknown.
 */
export function getCurrencySymbol(code: string): string {
  if (isCustomCurrency(code)) {
    return getCustomSymbol(code) || '?'
  }
  return CURRENCY_SYMBOLS[code] ?? code
}
