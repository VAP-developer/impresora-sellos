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
    return calcDynamicLimits(quantities, allTariffs, config.ticket, config.sello)
  }, [activeTariffGroup, quantities, config])

  const localCurrency = activeTariffGroup?.local_currency ?? 'EUR'
  const secondaryCurrency = activeTariffGroup?.complementary_currency ?? 'EUR'
  const activeCurrency = showSecondary ? secondaryCurrency : localCurrency

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
      <div className="grid grid-cols-[1fr_1fr_1.2fr_2fr_1.2fr_1fr_1fr] bg-gray-100 border-b border-gray-300">
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Subtotal
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Límite
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Cantidad
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Modalidad
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Cantidad
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Límite
        </div>
        <div className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
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

        const stripBg = row._isStrip ? 'bg-blue-50' : ''
        const rowBorder = idx < allRows.length - 1 ? 'border-b border-gray-100' : ''

        return (
          <div
            key={`row-${tariffId}`}
            className={`grid grid-cols-[1fr_1fr_1.2fr_2fr_1.2fr_1fr_1fr] items-center ${stripBg} ${rowBorder}`}
            role="row"
            aria-label={row.name}
          >
            {/* Subtotal Sello A */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-700">
              {subtotalS1 > 0 ? `${subtotalS1.toFixed(2)} ${activeCurrency}` : '—'}
            </div>

            {/* Límite Sello A */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-600">
              {limitS1}
            </div>

            {/* Cantidad Sello A */}
            <div className="px-3 py-3 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS1}
                onChange={handleChange(tariffId, 1)}
                className="w-16 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                aria-label={`Cantidad ${row.name} Sello A`}
              />
            </div>

            {/* Modalidad + Precio (center) */}
            <div className="px-3 py-3 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-800">{row.name}</span>
              {row.description && (
                <span className="text-xs text-gray-500">{row.description}</span>
              )}
              <button
                type="button"
                onClick={togglePrice}
                className="mt-0.5 text-sm font-semibold text-blue-700 hover:text-blue-900
                           hover:bg-blue-100 rounded px-2 py-0.5 transition-colors cursor-pointer"
                aria-label={`Alternar precio: ${showSecondary ? 'secundario' : 'local'}`}
                title={showSecondary ? 'Precio secundario (clic para volver a local)' : 'Precio local (clic para ver secundario)'}
              >
                {activePrice.toFixed(2)} {activeCurrency}
                <span className="ml-1 text-[10px] text-gray-500">
                  {showSecondary ? '(sec)' : '(loc)'}
                </span>
              </button>
            </div>

            {/* Cantidad Sello B */}
            <div className="px-3 py-3 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS2}
                onChange={handleChange(tariffId, 2)}
                className="w-16 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg
                           focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-colors"
                aria-label={`Cantidad ${row.name} Sello B`}
              />
            </div>

            {/* Límite Sello B */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-600">
              {limitS2}
            </div>

            {/* Subtotal Sello B */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-700">
              {subtotalS2 > 0 ? `${subtotalS2.toFixed(2)} ${activeCurrency}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
