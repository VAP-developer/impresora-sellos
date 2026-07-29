/**
 * TariffTableSplit.tsx
 *
 * Unified tariff panel — one solid block with mirrored columns:
 *   Subtotal | Límite | Cantidad | [ Modalidad · Precio ] | Cantidad | Límite | Subtotal
 *
 * Left = Sello A (Modelo 1), Right = Sello B (Modelo 2).
 * Tiras (strips) are shown first, then individual tariffs.
 * A toggle on the price lets the user switch between local and secondary price.
 */

import { useMemo, useCallback } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { KioskoQuantities, KioskoLimits } from '@renderer/lib/tariff-calc'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TariffRowDef {
  label: string
  localPrice: number
  secondaryPrice: number
  qtyFieldS1: keyof KioskoQuantities
  qtyFieldS2: keyof KioskoQuantities
  limitFieldS1: keyof KioskoLimits
  limitFieldS2: keyof KioskoLimits
  isStrip: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTableSplit(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const rawQuantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const getLimits = useKioskoStore((state) => state.getLimits)

  const quantities = rawQuantities as unknown as KioskoQuantities

  // Toggle: read from store (syncs with CartControls for printing)
  const showSecondary = useKioskoStore((state) => state.useSecondaryPrice)
  const setUseSecondaryPrice = useKioskoStore((state) => state.setUseSecondaryPrice)

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

  // Row definitions — strips first, then individual
  const rows: TariffRowDef[] = useMemo(() => [
    // ─── Tiras (strips) ───
    {
      label: 'Tira A×4',
      localPrice: tarifaTA,
      secondaryPrice: tarifaTA, // strips don't have secondary in static mode
      qtyFieldS1: 'tarifaAT1',
      qtyFieldS2: 'tarifaAT2',
      limitFieldS1: 'limiteAT1',
      limitFieldS2: 'limiteAT2',
      isStrip: true
    },
    {
      label: 'Tira 4 Tar.',
      localPrice: tarifaT4,
      secondaryPrice: tarifaT4,
      qtyFieldS1: 'tarifa4T1',
      qtyFieldS2: 'tarifa4T2',
      limitFieldS1: 'limite4T1',
      limitFieldS2: 'limite4T2',
      isStrip: true
    },
    // ─── Individual tariffs ───
    {
      label: 'Tarifa A',
      localPrice: tarifaA,
      secondaryPrice: tarifaA,
      qtyFieldS1: 'tarifaAS1',
      qtyFieldS2: 'tarifaAS2',
      limitFieldS1: 'limiteAS1',
      limitFieldS2: 'limiteAS2',
      isStrip: false
    },
    {
      label: 'Tarifa A2',
      localPrice: tarifaA2,
      secondaryPrice: tarifaA2,
      qtyFieldS1: 'tarifaA2S1',
      qtyFieldS2: 'tarifaA2S2',
      limitFieldS1: 'limiteA2S1',
      limitFieldS2: 'limiteA2S2',
      isStrip: false
    },
    {
      label: 'Tarifa B',
      localPrice: tarifaB,
      secondaryPrice: tarifaB,
      qtyFieldS1: 'tarifaBS1',
      qtyFieldS2: 'tarifaBS2',
      limitFieldS1: 'limiteBS1',
      limitFieldS2: 'limiteBS2',
      isStrip: false
    },
    {
      label: 'Tarifa C',
      localPrice: tarifaC,
      secondaryPrice: tarifaC,
      qtyFieldS1: 'tarifaCS1',
      qtyFieldS2: 'tarifaCS2',
      limitFieldS1: 'limiteCS1',
      limitFieldS2: 'limiteCS2',
      isStrip: false
    }
  ], [tarifaTA, tarifaT4, tarifaA, tarifaA2, tarifaB, tarifaC])

  const handleChange = useCallback(
    (field: keyof KioskoQuantities) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(field, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )

  const togglePrice = useCallback(() => {
    setUseSecondaryPrice(!showSecondary)
  }, [showSecondary, setUseSecondaryPrice])

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      role="table"
      aria-label="Tabla de tarifas"
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
      {rows.map((row, idx) => {
        const qtyS1 = quantities[row.qtyFieldS1]
        const qtyS2 = quantities[row.qtyFieldS2]
        const limitS1 = limits[row.limitFieldS1]
        const limitS2 = limits[row.limitFieldS2]
        const activePrice = showSecondary ? row.secondaryPrice : row.localPrice
        const subtotalS1 = activePrice * qtyS1
        const subtotalS2 = activePrice * qtyS2

        const stripBg = row.isStrip ? 'bg-blue-50' : ''
        const rowBorder = idx < rows.length - 1 ? 'border-b border-gray-100' : ''

        return (
          <div
            key={row.qtyFieldS1}
            className={`grid grid-cols-[1fr_1fr_1.2fr_2fr_1.2fr_1fr_1fr] items-center ${stripBg} ${rowBorder}`}
            role="row"
            aria-label={row.label}
          >
            {/* Subtotal Sello A */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-700">
              {subtotalS1 > 0 ? `${subtotalS1.toFixed(2)}€` : '—'}
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
                onChange={handleChange(row.qtyFieldS1)}
                className="w-16 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                aria-label={`Cantidad ${row.label} Sello A`}
              />
            </div>

            {/* Modalidad + Precio (center) */}
            <div className="px-3 py-3 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-800">{row.label}</span>
              <button
                type="button"
                onClick={togglePrice}
                className="mt-0.5 text-sm font-semibold text-blue-700 hover:text-blue-900
                           hover:bg-blue-100 rounded px-2 py-0.5 transition-colors cursor-pointer"
                aria-label={`Alternar precio: ${showSecondary ? 'secundario' : 'local'}`}
                title={showSecondary ? 'Precio secundario (clic para volver a local)' : 'Precio local (clic para ver secundario)'}
              >
                {activePrice.toFixed(2)}€
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
                onChange={handleChange(row.qtyFieldS2)}
                className="w-16 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg
                           focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-colors"
                aria-label={`Cantidad ${row.label} Sello B`}
              />
            </div>

            {/* Límite Sello B */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-600">
              {limitS2}
            </div>

            {/* Subtotal Sello B */}
            <div className="px-3 py-3 text-center text-sm font-medium text-gray-700">
              {subtotalS2 > 0 ? `${subtotalS2.toFixed(2)}€` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
