/**
 * DynamicTariffRow.tsx
 *
 * A single row for a dynamic tariff within one stamp model column.
 * Shows: limit | quantity input | tariff name + price (with currency) | subtotal
 *
 * Connects to the kiosko store via setQuantity(tariffId, model, value).
 */

import { useCallback } from 'react'
import { useKioskoStore, buildQuantityKey } from '@renderer/stores/kiosko.store'
import type { Tariff } from '@renderer/lib/ipc-client'
import type { DynamicLimits, DynamicQuantities } from '@renderer/lib/tariff-calc'

export interface DynamicTariffRowProps {
  tariff: Tariff
  model: 1 | 2
  currency: string
  quantities: DynamicQuantities
  limits: DynamicLimits
}

export default function DynamicTariffRow({
  tariff,
  model,
  currency,
  quantities,
  limits
}: DynamicTariffRowProps): JSX.Element {
  const setQuantity = useKioskoStore((state) => state.setQuantity)

  const tariffId = tariff.id!
  const key = buildQuantityKey(tariffId, model)
  const qty = quantities[key] ?? 0
  const limit = limits[key] ?? 0
  const subtotal = tariff.price * qty

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.valueAsNumber
      setQuantity(tariffId, model, Number.isNaN(val) ? 0 : val)
    },
    [setQuantity, tariffId, model]
  )

  return (
    <div
      className="flex items-center text-center py-1.5 px-1 bg-gray-50"
      role="row"
      aria-label={`${tariff.name} - ${tariff.price.toFixed(2)} ${currency}`}
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
          max={limit}
          value={qty}
          onChange={handleChange}
          className="w-14 text-center border border-gray-300 text-black rounded py-0.5 text-base"
          aria-label={`Cantidad ${tariff.name} Sello ${model === 1 ? 'A' : 'B'}`}
        />
      </div>

      {/* Tarifa + precio con moneda */}
      <div className="w-[35%] text-sm">
        <span className="font-semibold">{tariff.name}</span>
        <br />
        <span className="text-xs opacity-80">
          {tariff.price.toFixed(2)} {currency}
        </span>
      </div>

      {/* Subtotal */}
      <div
        className="w-[20%] text-xs font-medium"
        aria-label={`Subtotal: ${subtotal.toFixed(2)} ${currency}`}
      >
        {subtotal > 0 ? `${subtotal.toFixed(2)} ${currency}` : '—'}
      </div>
    </div>
  )
}
