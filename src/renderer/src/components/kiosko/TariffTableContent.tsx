/**
 * TariffTableContent.tsx
 *
 * Pure presentation component that renders the tariff table structure:
 *   - Header row with 4 columns (Cantidad A | Modalidad | Precio | Cantidad B)
 *   - Data rows with quantity inputs
 *   - Price toggle button in header
 *
 * This component is fully stateless and receives all data via props.
 * It is used by both the strip table and individual tariff table in the tabbed interface.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPrice } from '@renderer/lib/currencies'

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
  /** When true, the currency symbol is rendered before the price (€10 vs 10€) */
  symbolBefore?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTableContent({
  rows,
  quantities,
  setQuantity,
  limits,
  showSecondary,
  toggleSecondary,
  currencySymbol,
  symbolBefore = false
}: TariffTableContentProps): JSX.Element {
  const { t } = useTranslation()
  const handleChange = useCallback(
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(field, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity]
  )
// ─── fondo CABECERA ────────────────────────────────────────────────────────────────
  return (
    <div role="table" aria-label={t('kiosko.table.label')}>
      {/* ─── Header row ─── CABECERA GRANATE: 172,48,44  AZUL:24,62,117  GRIS: 112,128,129  border-b-2 border-blue-800 */}
      <div className="grid grid-cols-[1.2fr_3fr_4fr_3fr_1.2fr_2fr] bg-[rgb(112,128,129)] border-b-2 border-black">
        <div className="px-1 py-2 text-center text-xs font-bold text-white uppercase tracking-wide">
          {t('kiosko.table.limit')}
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          {t('kiosko.table.quantity')}
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          {t('kiosko.table.modality')}
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          {t('kiosko.table.quantity')}
        </div>
        <div className="px-1 py-2 text-center text-xs font-bold text-white uppercase tracking-wide">
          {t('kiosko.table.limit')}
        </div>
        <div className="px-2 py-2 text-center text-sm font-bold text-white uppercase tracking-wide">
          <button
            type="button"
            onClick={toggleSecondary}
            className="cursor-pointer text-yellow-300 hover:text-yellow-100 transition-colors font-bold"
            aria-label={t('kiosko.table.togglePriceAria', { mode: showSecondary ? t('kiosko.table.modeSecondary') : t('kiosko.table.modeLocal') })}
            title={t('kiosko.table.togglePriceTitle')}
          >
            {t('kiosko.table.price')} {showSecondary ? t('kiosko.table.priceSecondary') : t('kiosko.table.priceLocal')}
          </button>
        </div>
      </div>

      {/* ─── Data rows ─── */}
      {rows.map((row, idx) => {
        const qtyS1 = quantities[row.qtyFieldS1] ?? 0
        const qtyS2 = quantities[row.qtyFieldS2] ?? 0
        const limitS1 = limits[row.limitFieldS1] ?? 0
        const limitS2 = limits[row.limitFieldS2] ?? 0
        const activePrice = showSecondary ? row.secondaryPrice : row.localPrice
// ─── fondo TIRAS y TARIFAS ────────────────────────'border-b border-gray-200'────────────────────────────────────────
        const stripBg = row.isStrip ? 'bg-[rgb(234,190,63)] border-l-4 border-l-amber-500' : ''
        const labelBg = row.label ? 'bg-[rgb(222,222,222)] border-l-4 border-l-amber-500' : ''
        const rowBorder = idx < rows.length - 1 ? 'border-b-2 border-gray-100' : ''

        return (
          <div
            key={`${row.qtyFieldS1}-${row.qtyFieldS2}`}
            className={`grid grid-cols-[1.2fr_3fr_4fr_3fr_1.2fr_2fr] items-center ${stripBg}  ${labelBg} ${rowBorder}`}
            role="row"
            aria-label={row.label}
          >
            {/* Límite Sello A */}
            <div
              className="px-1 py-2 text-center text-sm font-bold text-[rgba(224, 28, 178, 1)]"
              aria-label={t('kiosko.table.limitAria', { label: row.label, model: 'A', value: limitS1 })}
            >
              {limitS1}
            </div>

            {/* Cantidad Sello A */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS1}
                onChange={handleChange(row.qtyFieldS1)}
                className="no-spinner w-40 h-12 text-center text-[30px] font-bold border-2 border-gray-400 rounded-lg
                           focus:border-blue-600 focus:ring-2 focus:ring-blue-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={t('kiosko.table.quantityAria', { label: row.label, model: 'A' })}
              />
            </div>

            {/* Modalidad (center) */}
            <div className="px-2 py-2 flex flex-col items-center justify-center">
              <span className={`text-[30px] font-extrabold ${row.isStrip ? 'text-[rgb(24,62,117)]' : 'text-gray-900'}`}>
                {row.label}
              </span>
            </div>

            {/* Cantidad Sello B */}
            <div className="px-2 py-2 flex justify-center">
              <input
                type="number"
                min="0"
                value={qtyS2}
                onChange={handleChange(row.qtyFieldS2)}
                className="no-spinner w-40 h-12 text-center text-[30px] font-bold border-2 border-gray-400 rounded-lg
                           focus:border-green-600 focus:ring-2 focus:ring-green-300 outline-none transition-colors
                           bg-white shadow-sm"
                aria-label={t('kiosko.table.quantityAria', { label: row.label, model: 'B' })}
              />
            </div>

            {/* Límite Sello B */}
            <div
              className="px-1 py-2 text-center text-sm font-bold text-[rgb(24,62,117)]"
              aria-label={t('kiosko.table.limitAria', { label: row.label, model: 'B', value: limitS2 })}
            >
              {limitS2}
            </div>

            {/* Precio */}
            <div className="px-2 py-2 text-center text-[25px] font-bold text-bg-[rgb(24,62,117)]">
              {formatPrice(activePrice, currencySymbol, symbolBefore)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
