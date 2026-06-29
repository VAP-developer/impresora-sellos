/**
 * TariffRow.tsx
 *
 * A single row in the tariff table displaying:
 * - Subtotal and limit for modelo 1 (left side)
 * - Quantity input for modelo 1
 * - Tariff name (center)
 * - Price (center)
 * - Quantity input for modelo 2
 * - Limit and subtotal for modelo 2 (right side)
 *
 * Replicates the symmetric row structure from the legacy KioskoView.vue.
 * Each row corresponds to one tariff type (e.g., Tarifa A, Tarifa B, Tira 4, etc.)
 *
 * Validates: Requirements 1.1, 1.6, 2.3 (real-time display of limits and subtotals)
 */

import { useCallback } from 'react'
import type { KioskoQuantities, KioskoLimits } from '@renderer/lib/tariff-calc'
import { useKioskoStore } from '@renderer/stores/kiosko.store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TariffRowProps {
  /** Display name of the tariff (e.g., "Tarifa A", "Tira de 4 Tarifas") */
  label: string
  /** Price per unit for this tariff */
  price: number
  /** Key in KioskoQuantities for modelo 1 quantity */
  qtyField1: keyof KioskoQuantities
  /** Key in KioskoQuantities for modelo 2 quantity */
  qtyField2: keyof KioskoQuantities
  /** Key in KioskoLimits for modelo 1 limit */
  limitField1: keyof KioskoLimits
  /** Key in KioskoLimits for modelo 2 limit */
  limitField2: keyof KioskoLimits
  /** Current quantities from the store */
  quantities: KioskoQuantities
  /** Current limits computed from the store */
  limits: KioskoLimits
  /** Optional CSS classes for the row background */
  className?: string
  /** Optional CSS classes for the input elements */
  inputClassName?: string
  /** Optional CSS classes for the label text */
  labelClassName?: string
  /** Whether this is a "highlighted" row (larger text, like Tira 4 Tarifas) */
  highlighted?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffRow({
  label,
  price,
  qtyField1,
  qtyField2,
  limitField1,
  limitField2,
  quantities,
  limits,
  className = 'bg-gray-100',
  inputClassName = 'bg-gray-200 border-gray-300 text-black',
  labelClassName = 'text-2xl font-semibold',
  highlighted = false
}: TariffRowProps): JSX.Element {
  const setQuantity = useKioskoStore((state) => state.setQuantity)

  const qty1 = quantities[qtyField1]
  const qty2 = quantities[qtyField2]
  const limit1 = limits[limitField1]
  const limit2 = limits[limitField2]
  const subtotal1 = price * qty1
  const subtotal2 = price * qty2

  const handleChange1 = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(qtyField1, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity, qtyField1]
  )

  const handleChange2 = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(qtyField2, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity, qtyField2]
  )

  const textSizeClass = highlighted ? 'text-3xl' : 'text-base'

  return (
    <div
      className={`flex items-center text-center py-2 ${className}`}
      role="row"
      aria-label={`Fila tarifa ${label}`}
    >
      {/* Subtotal modelo 1 */}
      <div className="w-[5%] text-xs" aria-label={`Subtotal modelo 1: ${subtotal1.toFixed(2)}€`}>
        {subtotal1.toFixed(2)} €
      </div>

      {/* Límite modelo 1 */}
      <div className="w-[10%]" aria-label={`Límite modelo 1: ${limit1}`}>
        {limit1}
      </div>

      {/* Cantidad input modelo 1 */}
      <div className="w-[15%]">
        <input
          type="number"
          min="0"
          value={qty1}
          onChange={handleChange1}
          className={`w-16 text-center border rounded ${textSizeClass} ${inputClassName}`}
          aria-label={`Cantidad ${label} modelo 1`}
        />
      </div>

      {/* Nombre de la tarifa */}
      <div className={`w-[30%] ${labelClassName}`}>{label}</div>

      {/* Precio */}
      <div className="w-[10%]">{price.toFixed(2)}€</div>

      {/* Cantidad input modelo 2 */}
      <div className="w-[15%]">
        <input
          type="number"
          min="0"
          value={qty2}
          onChange={handleChange2}
          className={`w-16 text-center border rounded ${textSizeClass} ${inputClassName}`}
          aria-label={`Cantidad ${label} modelo 2`}
        />
      </div>

      {/* Límite modelo 2 */}
      <div className="w-[10%]" aria-label={`Límite modelo 2: ${limit2}`}>
        {limit2}
      </div>

      {/* Subtotal modelo 2 */}
      <div className="w-[5%] text-xs" aria-label={`Subtotal modelo 2: ${subtotal2.toFixed(2)}€`}>
        {subtotal2.toFixed(2)} €
      </div>
    </div>
  )
}
