/**
 * TariffTableSplit.tsx
 *
 * Tariff table with a shared center tariff column:
 * - Left: Sello A (Modelo 1 / printer 1) — Límite, Cantidad, Subtotal
 * - Center: Tarifa name + price (shared, displayed once)
 * - Right: Sello B (Modelo 2 / printer 2) — Límite, Cantidad, Subtotal
 */

import { useMemo, useCallback } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { KioskoQuantities, KioskoLimits } from '@renderer/lib/tariff-calc'

interface TariffRowDef {
  label: string
  price: number
  qtyFieldS1: keyof KioskoQuantities
  qtyFieldS2: keyof KioskoQuantities
  limitFieldS1: keyof KioskoLimits
  limitFieldS2: keyof KioskoLimits
  highlighted?: boolean
  bgClass?: string
}

export default function TariffTableSplit(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const rawQuantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const getLimits = useKioskoStore((state) => state.getLimits)

  const quantities = rawQuantities as unknown as KioskoQuantities

  const precios = config?.precios
  const tarifaA = precios?.tarifaA ?? 0
  const tarifaA2 = precios?.tarifaA2 ?? 0
  const tarifaB = precios?.tarifaB ?? 0
  const tarifaC = precios?.tarifaC ?? 0
  const tarifaTA = precios?.tarifaTA ?? 0
  const tarifaT4 = precios?.tarifaT4 ?? 0

  const limits = useMemo(() => {
    if (!config) {
      return {
        limiteAT1: 0, limiteAT2: 0, limite4T1: 0, limite4T2: 0,
        limiteAS1: 0, limiteAS2: 0, limiteA2S1: 0, limiteA2S2: 0,
        limiteBS1: 0, limiteBS2: 0, limiteCS1: 0, limiteCS2: 0
      }
    }
    return getLimits(config.precios, config.ticket, config.sello)
  }, [config, quantities, getLimits])

  const rows: TariffRowDef[] = useMemo(() => [
    {
      label: 'Tira A×4',
      price: tarifaTA,
      qtyFieldS1: 'tarifaAT1',
      qtyFieldS2: 'tarifaAT2',
      limitFieldS1: 'limiteAT1',
      limitFieldS2: 'limiteAT2',
      bgClass: 'bg-gray-50'
    },
    {
      label: 'Tira 4 Tar.',
      price: tarifaT4,
      qtyFieldS1: 'tarifa4T1',
      qtyFieldS2: 'tarifa4T2',
      limitFieldS1: 'limite4T1',
      limitFieldS2: 'limite4T2',
      highlighted: true,
      bgClass: 'bg-[rgb(24,62,117)]'
    },
    {
      label: 'Tarifa A',
      price: tarifaA,
      qtyFieldS1: 'tarifaAS1',
      qtyFieldS2: 'tarifaAS2',
      limitFieldS1: 'limiteAS1',
      limitFieldS2: 'limiteAS2',
      bgClass: 'bg-[rgb(255,192,0)]'
    },
    {
      label: 'Tarifa A2',
      price: tarifaA2,
      qtyFieldS1: 'tarifaA2S1',
      qtyFieldS2: 'tarifaA2S2',
      limitFieldS1: 'limiteA2S1',
      limitFieldS2: 'limiteA2S2',
      bgClass: 'bg-gray-50'
    },
    {
      label: 'Tarifa B',
      price: tarifaB,
      qtyFieldS1: 'tarifaBS1',
      qtyFieldS2: 'tarifaBS2',
      limitFieldS1: 'limiteBS1',
      limitFieldS2: 'limiteBS2',
      bgClass: 'bg-gray-50'
    },
    {
      label: 'Tarifa C',
      price: tarifaC,
      qtyFieldS1: 'tarifaCS1',
      qtyFieldS2: 'tarifaCS2',
      limitFieldS1: 'limiteCS1',
      limitFieldS2: 'limiteCS2',
      bgClass: 'bg-gray-50'
    }
  ], [tarifaTA, tarifaT4, tarifaA, tarifaA2, tarifaB, tarifaC])

  const handleChange = useCallback(
    (field: keyof KioskoQuantities) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(field, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )

  return (
    <div className="flex gap-0" role="table" aria-label="Tabla de tarifas dividida por sello">
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
        {/* Rows */}
        {rows.map((row) => {
          const qty = quantities[row.qtyFieldS1]
          const limit = limits[row.limitFieldS1]
          const subtotal = row.price * qty
          const isHL = row.highlighted
          const textClass = isHL ? 'text-white' : ''
          const inputClass = isHL
            ? 'bg-[rgb(24,62,117)] text-white border-gray-500'
            : 'border-gray-300 text-black'
          const textSize = isHL ? 'text-xl' : 'text-base'

          return (
            <div
              key={row.qtyFieldS1}
              className={`flex items-center text-center py-1.5 px-1 ${row.bgClass} ${textClass}`}
              role="row"
              aria-label={`${row.label} Sello A`}
            >
              <div className="w-[30%] text-sm font-medium">{limit}</div>
              <div className="w-[40%]">
                <input
                  type="number"
                  min="0"
                  value={qty}
                  onChange={handleChange(row.qtyFieldS1)}
                  className={`w-14 text-center border rounded py-0.5 ${textSize} ${inputClass}`}
                  aria-label={`Cantidad ${row.label} Sello A`}
                />
              </div>
              <div className="w-[30%] text-xs font-medium">
                {subtotal > 0 ? `${subtotal.toFixed(2)}€` : '—'}
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
        {/* Tariff labels */}
        {rows.map((row) => {
          const isHL = row.highlighted
          const textClass = isHL ? 'text-white' : ''
          return (
            <div
              key={`center-${row.label}`}
              className={`flex items-center justify-center text-center py-1.5 px-1 ${row.bgClass} ${textClass}`}
            >
              <div className="text-sm">
                <span className={`font-semibold ${isHL ? 'text-base' : ''}`}>{row.label}</span>
                <br />
                <span className="text-xs opacity-80">{row.price.toFixed(2)}€</span>
              </div>
            </div>
          )
        })}
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
        {/* Rows */}
        {rows.map((row) => {
          const qty = quantities[row.qtyFieldS2]
          const limit = limits[row.limitFieldS2]
          const subtotal = row.price * qty
          const isHL = row.highlighted
          const textClass = isHL ? 'text-white' : ''
          const inputClass = isHL
            ? 'bg-[rgb(24,62,117)] text-white border-gray-500'
            : 'border-gray-300 text-black'
          const textSize = isHL ? 'text-xl' : 'text-base'

          return (
            <div
              key={row.qtyFieldS2}
              className={`flex items-center text-center py-1.5 px-1 ${row.bgClass} ${textClass}`}
              role="row"
              aria-label={`${row.label} Sello B`}
            >
              <div className="w-[30%] text-sm font-medium">{limit}</div>
              <div className="w-[40%]">
                <input
                  type="number"
                  min="0"
                  value={qty}
                  onChange={handleChange(row.qtyFieldS2)}
                  className={`w-14 text-center border rounded py-0.5 ${textSize} ${inputClass}`}
                  aria-label={`Cantidad ${row.label} Sello B`}
                />
              </div>
              <div className="w-[30%] text-xs font-medium">
                {subtotal > 0 ? `${subtotal.toFixed(2)}€` : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
