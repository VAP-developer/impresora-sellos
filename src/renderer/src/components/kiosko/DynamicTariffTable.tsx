/**
 * DynamicTariffTable.tsx
 *
 * Dynamic tariff table with a shared center tariff column:
 * - Left: Sello A (Modelo 1) — Límite, Cantidad, Subtotal
 * - Center: Tarifa name + price (shared, displayed once)
 * - Right: Sello B (Modelo 2) — Límite, Cantidad, Subtotal
 *
 * Replaces TariffTableSplit when an active tariff group is present.
 * Shows tariffs sorted by their `position` field.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.6
 */

import { useMemo, useCallback } from 'react'
import { useKioskoStore, buildQuantityKey } from '@renderer/stores/kiosko.store'
import { useConfigStore } from '@renderer/stores/config.store'
import { calcDynamicLimits } from '@renderer/lib/tariff-calc'
import type { DynamicQuantities, DynamicLimits } from '@renderer/lib/tariff-calc'

export default function DynamicTariffTable(): JSX.Element {
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const quantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const config = useConfigStore((state) => state.config)

  // Sort tariffs by position (ascending)
  const sortedTariffs = useMemo(() => {
    if (!activeTariffGroup) return []
    return [...activeTariffGroup.tariffs].sort((a, b) => a.position - b.position)
  }, [activeTariffGroup])

  // Compute dynamic limits for all tariff/model combinations
  const limits = useMemo(() => {
    if (!activeTariffGroup || !config) return {}
    return calcDynamicLimits(
      quantities,
      activeTariffGroup.tariffs,
      config.ticket,
      config.sello
    )
  }, [activeTariffGroup, quantities, config])

  const currency = activeTariffGroup?.currency ?? 'EUR'

  const handleChange = useCallback(
    (tariffId: number, model: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(tariffId, model, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )

  if (!activeTariffGroup) {
    return (
      <div
        className="flex items-center justify-center py-8 text-gray-500 text-sm"
        role="alert"
      >
        El evento no tiene tarifas configuradas
      </div>
    )
  }

  return (
    <div className="flex gap-0" role="table" aria-label="Tabla de tarifas dinámica">
      {/* ─── SELLO A (Modelo 1) ─── */}
      <div className="flex-1 border border-blue-200 rounded-l-lg overflow-hidden">
        <div className="bg-[rgb(24,62,117)] text-white text-center py-1 text-sm font-bold">
          SELLO A — Modelo 1
        </div>
        {/* Header */}
        <div className="flex items-center text-center text-[10px] font-semibold text-gray-500 py-1 border-b border-gray-200 px-1">
          <div className="w-[30%]">Límite</div>
          <div className="w-[40%]">Cantidad</div>
          <div className="w-[30%]">Subtotal</div>
        </div>
        {/* Dynamic rows for model 1 */}
        {sortedTariffs.map((tariff) => {
          const key = buildQuantityKey(tariff.id!, 1)
          const qty = (quantities as DynamicQuantities)[key] ?? 0
          const limit = (limits as DynamicLimits)[key] ?? 0
          const subtotal = tariff.price * qty

          return (
            <div
              key={`s1-${tariff.id}`}
              className="flex items-center text-center py-1.5 px-1 bg-gray-50"
              role="row"
              aria-label={`${tariff.name} Sello A`}
            >
              <div className="w-[30%] text-sm font-medium">{limit}</div>
              <div className="w-[40%]">
                <input
                  type="number"
                  min="0"
                  max={limit}
                  value={qty}
                  onChange={handleChange(tariff.id!, 1)}
                  className="w-14 text-center border border-gray-300 text-black rounded py-0.5 text-base"
                  aria-label={`Cantidad ${tariff.name} Sello A`}
                />
              </div>
              <div className="w-[30%] text-xs font-medium">
                {subtotal > 0 ? `${subtotal.toFixed(2)} ${currency}` : '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── TARIFA (Centro, compartida) ─── */}
      <div className="w-[140px] min-w-[140px] border-y border-gray-200 overflow-hidden">
        <div className="bg-gray-600 text-white text-center py-1 text-sm font-bold">
          TARIFA
        </div>
        {/* Header spacer */}
        <div className="flex items-center text-center text-[10px] font-semibold text-gray-500 py-1 border-b border-gray-200 px-1">
          <div className="w-full">Precio</div>
        </div>
        {/* Tariff labels (shared) */}
        {sortedTariffs.map((tariff) => (
          <div
            key={`center-${tariff.id}`}
            className="flex items-center justify-center text-center py-1.5 px-1 bg-gray-50"
          >
            <div className="text-sm">
              <span className="font-semibold">{tariff.name}</span>
              <br />
              <span className="text-xs opacity-80">
                {tariff.price.toFixed(2)} {currency}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── SELLO B (Modelo 2) ─── */}
      <div className="flex-1 border border-green-200 rounded-r-lg overflow-hidden">
        <div className="bg-green-700 text-white text-center py-1 text-sm font-bold">
          SELLO B — Modelo 2
        </div>
        {/* Header */}
        <div className="flex items-center text-center text-[10px] font-semibold text-gray-500 py-1 border-b border-gray-200 px-1">
          <div className="w-[30%]">Límite</div>
          <div className="w-[40%]">Cantidad</div>
          <div className="w-[30%]">Subtotal</div>
        </div>
        {/* Dynamic rows for model 2 */}
        {sortedTariffs.map((tariff) => {
          const key = buildQuantityKey(tariff.id!, 2)
          const qty = (quantities as DynamicQuantities)[key] ?? 0
          const limit = (limits as DynamicLimits)[key] ?? 0
          const subtotal = tariff.price * qty

          return (
            <div
              key={`s2-${tariff.id}`}
              className="flex items-center text-center py-1.5 px-1 bg-gray-50"
              role="row"
              aria-label={`${tariff.name} Sello B`}
            >
              <div className="w-[30%] text-sm font-medium">{limit}</div>
              <div className="w-[40%]">
                <input
                  type="number"
                  min="0"
                  max={limit}
                  value={qty}
                  onChange={handleChange(tariff.id!, 2)}
                  className="w-14 text-center border border-gray-300 text-black rounded py-0.5 text-base"
                  aria-label={`Cantidad ${tariff.name} Sello B`}
                />
              </div>
              <div className="w-[30%] text-xs font-medium">
                {subtotal > 0 ? `${subtotal.toFixed(2)} ${currency}` : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
