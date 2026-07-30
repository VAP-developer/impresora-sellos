/**
 * DynamicTariffTable.tsx
 *
 * Dynamic tariff panel — unified block with mirrored columns:
 *   Subtotal | Límite | Cantidad | [ Modalidad · Precio ] | Cantidad | Límite | Subtotal
 *
 * Left = Sello A (Modelo 1), Right = Sello B (Modelo 2).
 * Strips are shown first, then individual tariffs.
 * A toggle on the price lets the user switch between local and secondary (complementary) price.
 *
 * Replaces TariffTableSplit when an active tariff group is present.
 */

import { useMemo, useCallback } from 'react'
import { useKioskoStore, buildQuantityKey } from '@renderer/stores/kiosko.store'
import { useConfigStore } from '@renderer/stores/config.store'
import { calcDynamicLimits } from '@renderer/lib/tariff-calc'
import type { DynamicQuantities, DynamicLimits } from '@renderer/lib/tariff-calc'
import type { Tariff, Strip } from '@renderer/lib/ipc-client'

// ─── Component ────────────────────────────────────────────────────────────────

export default function DynamicTariffTable(): JSX.Element {
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const quantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const config = useConfigStore((state) => state.config)

  // Toggle: read from store (syncs with CartControls for printing)
  const showSecondary = useKioskoStore((state) => state.useSecondaryPrice)
  const setUseSecondaryPrice = useKioskoStore((state) => state.setUseSecondaryPrice)

  // Separate strips and individual tariffs, sorted by position
  const strips = useMemo(() => {
    if (!activeTariffGroup) return []
    return [...(activeTariffGroup.strips ?? [])].sort((a, b) => a.position - b.position)
  }, [activeTariffGroup])

  const tariffs = useMemo(() => {
    if (!activeTariffGroup) return []
    return [...(activeTariffGroup.tariffs ?? [])].sort((a, b) => a.position - b.position)
  }, [activeTariffGroup])

  // Merged list: strips first, then individual tariffs
  const allRows = useMemo(() => {
    const result: Array<(Tariff | Strip) & { _isStrip: boolean }> = []
    for (const s of strips) {
      result.push({ ...s, _isStrip: true })
    }
    for (const t of tariffs) {
      result.push({ ...t, _isStrip: false })
    }
    return result
  }, [strips, tariffs])

  // Compute dynamic limits for all tariff/model combinations
  const limits = useMemo(() => {
    if (!activeTariffGroup || !config) return {}
    // Combine tariffs and strips for limit calculation
    const allTariffs = [...(activeTariffGroup.tariffs ?? []), ...(activeTariffGroup.strips ?? [])]
    return calcDynamicLimits(quantities, allTariffs, config.ticket, config.sello, showSecondary)
  }, [activeTariffGroup, quantities, config, showSecondary])

  const localCurrency = activeTariffGroup?.local_currency ?? 'EUR'
  const secondaryCurrency = activeTariffGroup?.complementary_currency ?? 'EUR'
  const activeCurrency = showSecondary ? secondaryCurrency : localCurrency

  // Convert currency code to symbol
  const currencySymbol = useMemo(() => {
    const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' }
    return symbols[activeCurrency] ?? activeCurrency
  }, [activeCurrency])

  const handleChange = useCallback(
    (tariffId: number, model: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(tariffId, model, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )

  const togglePrice = useCallback(() => {
    setUseSecondaryPrice(!showSecondary)
  }, [showSecondary, setUseSecondaryPrice])

  if (!activeTariffGroup) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 text-sm" role="alert">
        El evento no tiene tarifas configuradas
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      role="table"
      aria-label="Tabla de tarifas dinámica"
    >
      {/* ─── Header row ─── */}
      <div className="grid grid-cols-[1fr_1fr_1.2fr_1.4fr_1fr_1.2fr_1fr_1fr] bg-gradient-to-r from-blue-600 to-blue-700 border-b-2 border-blue-800">
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Subtotal
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Límite
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Cantidad
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Modalidad
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          <button
            type="button"
            onClick={togglePrice}
            className="cursor-pointer hover:text-blue-200 transition-colors"
            aria-label={`Alternar precio: ${showSecondary ? 'secundario' : 'local'}`}
            title="Clic para alternar entre precio local y secundario"
          >
            Precio {showSecondary ? '(sec)' : '(loc)'}
          </button>
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Cantidad
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Límite
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          Subtotal
        </div>
      </div>

      {/* ─── Data rows ─── */}
      {allRows.map((row, idx) => {
        const tariffId = row.id!
        const key1 = buildQuantityKey(tariffId, 1)
        const key2 = buildQuantityKey(tariffId, 2)
        const qtyS1 = (quantities as DynamicQuantities)[key1] ?? 0
        const qtyS2 = (quantities as DynamicQuantities)[key2] ?? 0
        const limitS1 = (limits as DynamicLimits)[key1] ?? 0
        const limitS2 = (limits as DynamicLimits)[key2] ?? 0

        const activePrice = showSecondary ? row.secondary_price : row.local_price
        const subtotalS1 = activePrice * qtyS1
        const subtotalS2 = activePrice * qtyS2

        const stripBg = row._isStrip ? 'bg-amber-100 border-l-4 border-l-amber-500' : ''
        const rowBorder = idx < allRows.length - 1 ? 'border-b border-gray-200' : ''

        return (
          <div
            key={`row-${tariffId}`}
            className={`grid grid-cols-[1fr_1fr_1.2fr_1.4fr_1fr_1.2fr_1fr_1fr] items-center ${stripBg} ${rowBorder}`}
            role="row"
            aria-label={row.name}
          >
            {/* Subtotal Sello A */}
            <div className="px-2 py-2 text-center text-lg font-bold text-gray-800">
              {subtotalS1 > 0 ? `${subtotalS1.toFixed(2)}${currencySymbol}` : '—'}
            </div>

            {/* Límite Sello A */}
            <div className="px-2 py-2 text-center text-lg font-semibold text-gray-700">
              {limitS1}
            </div>

            {/* Cantidad Sello A */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS1}
                onChange={handleChange(tariffId, 1)}
                className="w-20 h-12 text-center text-2xl font-bold border-2 border-gray-400 rounded-lg
                           focus:border-blue-600 focus:ring-2 focus:ring-blue-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={`Cantidad ${row.name} Sello A`}
              />
            </div>

            {/* Modalidad (name + description) */}
            <div className="px-2 py-2 flex flex-col items-center justify-center">
              <span className={`text-xl font-extrabold ${row._isStrip ? 'text-amber-800' : 'text-gray-900'}`}>
                {row.name}
              </span>
              {'description' in row && row.description && (
                <span className="text-xs text-gray-600 mt-0.5">{row.description}</span>
              )}
            </div>

            {/* Precio (plain text, toggle is in header) */}
            <div className="px-2 py-2 text-center text-lg font-bold text-green-700">
              {activePrice.toFixed(2)}{currencySymbol}
            </div>

            {/* Cantidad Sello B */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS2}
                onChange={handleChange(tariffId, 2)}
                className="w-20 h-12 text-center text-2xl font-bold border-2 border-gray-400 rounded-lg
                           focus:border-green-600 focus:ring-2 focus:ring-green-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={`Cantidad ${row.name} Sello B`}
              />
            </div>

            {/* Límite Sello B */}
            <div className="px-2 py-2 text-center text-lg font-semibold text-gray-700">
              {limitS2}
            </div>

            {/* Subtotal Sello B */}
            <div className="px-2 py-2 text-center text-lg font-bold text-gray-800">
              {subtotalS2 > 0 ? `${subtotalS2.toFixed(2)}${currencySymbol}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
