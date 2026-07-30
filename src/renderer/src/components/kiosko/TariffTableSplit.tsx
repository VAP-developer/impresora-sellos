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
      {rows.map((row, idx) => {
        const qtyS1 = quantities[row.qtyFieldS1]
        const qtyS2 = quantities[row.qtyFieldS2]
        const limitS1 = limits[row.limitFieldS1]
        const limitS2 = limits[row.limitFieldS2]
        const activePrice = showSecondary ? row.secondaryPrice : row.localPrice
        const subtotalS1 = activePrice * qtyS1
        const subtotalS2 = activePrice * qtyS2

        const stripBg = row.isStrip ? 'bg-amber-100 border-l-4 border-l-amber-500' : ''
        const rowBorder = idx < rows.length - 1 ? 'border-b border-gray-200' : ''

        return (
          <div
            key={row.qtyFieldS1}
            className={`grid grid-cols-[1fr_1fr_1.2fr_1.4fr_1fr_1.2fr_1fr_1fr] items-center ${stripBg} ${rowBorder}`}
            role="row"
            aria-label={row.label}
          >
            {/* Subtotal Sello A */}
            <div className="px-2 py-2 text-center text-lg font-bold text-gray-800">
              {subtotalS1 > 0 ? `${subtotalS1.toFixed(2)}€` : '—'}
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
                onChange={handleChange(row.qtyFieldS1)}
                className="w-20 h-12 text-center text-2xl font-bold border-2 border-gray-400 rounded-lg
                           focus:border-blue-600 focus:ring-2 focus:ring-blue-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={`Cantidad ${row.label} Sello A`}
              />
            </div>

            {/* Modalidad (center) */}
            <div className="px-2 py-2 flex flex-col items-center justify-center">
              <span className={`text-xl font-extrabold ${row.isStrip ? 'text-amber-800' : 'text-gray-900'}`}>
                {row.label}
              </span>
            </div>

            {/* Precio (plain text, toggle is in header) */}
            <div className="px-2 py-2 text-center text-lg font-bold text-green-700">
              {activePrice.toFixed(2)}€
            </div>

            {/* Cantidad Sello B */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS2}
                onChange={handleChange(row.qtyFieldS2)}
                className="w-20 h-12 text-center text-2xl font-bold border-2 border-gray-400 rounded-lg
                           focus:border-green-600 focus:ring-2 focus:ring-green-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={`Cantidad ${row.label} Sello B`}
              />
            </div>

            {/* Límite Sello B */}
            <div className="px-2 py-2 text-center text-lg font-semibold text-gray-700">
              {limitS2}
            </div>

            {/* Subtotal Sello B */}
            <div className="px-2 py-2 text-center text-lg font-bold text-gray-800">
              {subtotalS2 > 0 ? `${subtotalS2.toFixed(2)}€` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
