/**
 * TariffRowSplit.tsx
 *
 * A single tariff row for one model (used in the split layout).
 * Shows: limit | quantity input | tariff name + price | subtotal
 */

import { useCallback } from 'react'
import type { KioskoQuantities, KioskoLimits } from '@renderer/lib/tariff-calc'
import { useKioskoStore } from '@renderer/stores/kiosko.store'

export interface TariffRowSplitProps {
  label: string
  price: number
  qtyField: keyof KioskoQuantities
  limitField: keyof KioskoLimits
  quantities: KioskoQuantities
  limits: KioskoLimits
  className?: string
  inputClassName?: string
  highlighted?: boolean
}

export default function TariffRowSplit({
  label,
  price,
  qtyField,
  limitField,
  quantities,
  limits,
  className = 'bg-gray-50',
  inputClassName = 'border-gray-300 text-black',
  highlighted = false
}: TariffRowSplitProps): JSX.Element {
  const setQuantity = useKioskoStore((state) => state.setQuantity)

  const qty = quantities[qtyField]
  const limit = limits[limitField]
  const subtotal = price * qty

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(qtyField, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity, qtyField]
  )

  const textSize = highlighted ? 'text-xl' : 'text-base'

  return (
    <div
      className={`flex items-center text-center py-1.5 px-1 ${className}`}
      role="row"
      aria-label={`${label} - ${price.toFixed(2)}€`}
    >
      {/* Límite */}
      <div className="w-[20%] text-sm font-medium" aria-label={`Límite: ${limit}`}>
        {limit}
      </div>

      {/* Cantidad input */}
      <div className="w-[25%]">
        <input
          type="number"
          min="0"
          value={qty}
          onChange={handleChange}
          className={`w-14 text-center border rounded py-0.5 ${textSize} ${inputClassName}`}
          aria-label={`Cantidad ${label}`}
        />
      </div>

      {/* Tarifa + precio */}
      <div className="w-[35%] text-sm">
        <span className={`font-semibold ${highlighted ? 'text-base' : ''}`}>{label}</span>
        <br />
        <span className="text-xs opacity-80">{price.toFixed(2)}€</span>
      </div>

      {/* Subtotal */}
      <div className="w-[20%] text-xs font-medium" aria-label={`Subtotal: ${subtotal.toFixed(2)}€`}>
        {subtotal > 0 ? `${subtotal.toFixed(2)}€` : '—'}
      </div>
    </div>
  )
}
