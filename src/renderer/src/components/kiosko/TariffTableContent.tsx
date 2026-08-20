/**
 * TariffTableContent.tsx
 *
 * Pure presentation component that renders the tariff table structure:
 *   - Header row with 8 columns
 *   - Data rows with quantity inputs, limits, and subtotals
 *   - Price toggle button in header
 *
 * This component is fully stateless and receives all data via props.
 * It is used by both the strip table and individual tariff table in the tabbed interface.
 */

import { useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TariffRowDef {
  label: string
  localPrice: number
  secondaryPrice: number
  qtyFieldS1: string
  qtyFieldS2: string
  limitFieldS1: string
  limitFieldS2: string
  isStrip: boolean
  isLabel: boolean
}

interface TariffTableContentProps {
  rows: TariffRowDef[]
  quantities: Record<string, number>
  setQuantity: (field: string, value: number) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTableContent({
  rows,
  quantities,
  setQuantity,
  limits,
  showSecondary,
  toggleSecondary,
  currencySymbol
}: TariffTableContentProps): JSX.Element {
  const handleChange = useCallback(
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(field, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )

  return (
    <div role="table" aria-label="Tabla de tarifas">
      {/* ─── Header row ─── */}
      <div className="grid grid-cols-[1fr_2fr_3fr_4fr_2fr_3fr_2fr_1fr] bg-[rgb(24,62,117)] border-b-2 border-blue-800">
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
            onClick={toggleSecondary}
            className="cursor-pointer text-yellow-300 hover:text-yellow-100 transition-colors font-bold"
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
        const qtyS1 = quantities[row.qtyFieldS1] ?? 0
        const qtyS2 = quantities[row.qtyFieldS2] ?? 0
        const limitS1 = limits[row.limitFieldS1] ?? 0
        const limitS2 = limits[row.limitFieldS2] ?? 0
        const activePrice = showSecondary ? row.secondaryPrice : row.localPrice
        const subtotalS1 = activePrice * qtyS1
        const subtotalS2 = activePrice * qtyS2

        const stripBg = row.isStrip ? 'bg-[rgb(255,203,48)] border-l-4 border-l-amber-500' : ''
        const labelBg = row.label ? 'bg-[rgb(222,222,222)] border-l-4 border-l-amber-500' : ''
        const rowBorder = idx < rows.length - 1 ? 'border-b border-gray-200' : ''

        return (
          <div
            key={`${row.qtyFieldS1}-${row.qtyFieldS2}`}
            className={`grid grid-cols-[1fr_2fr_3fr_4fr_2fr_3fr_2fr_1fr] items-center ${stripBg}  ${labelBg} ${rowBorder}`}
            role="row"
            aria-label={row.label}
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
                onChange={handleChange(row.qtyFieldS1)}
                className="w-40 h-12 text-center text-[30px] font-bold border-2 border-gray-400 rounded-lg
                           focus:border-blue-600 focus:ring-2 focus:ring-blue-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={`Cantidad ${row.label} Sello A`}
              />
            </div>

            {/* Modalidad (center) */}
            <div className="px-2 py-2 flex flex-col items-center justify-center">
              <span className={`text-[30px] font-extrabold ${row.isStrip ? 'text-[rgb(24,62,117)]' : 'text-gray-900'}`}>
                {row.label}
              </span>
            </div>

            {/* Precio */}
            <div className="px-2 py-2 text-center text-[25px] font-bold text-bg-[rgb(24,62,117)]">
              {activePrice.toFixed(2)}{currencySymbol}
            </div>

            {/* Cantidad Sello B */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS2}
                onChange={handleChange(row.qtyFieldS2)}
                className="w-40 h-12 text-center text-[30px] font-bold border-2 border-gray-400 rounded-lg
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
              {subtotalS2 > 0 ? `${subtotalS2.toFixed(2)}${currencySymbol}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
