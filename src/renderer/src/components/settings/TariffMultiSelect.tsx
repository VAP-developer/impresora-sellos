/**
 * TariffMultiSelect.tsx
 *
 * Checkbox-based multi-select component for choosing individual tariffs
 * to include in a strip. Displays all available tariffs by name with
 * checkboxes, and shows a validation warning when fewer than 2 are selected.
 *
 * Requirements: 3.2, 7.2, 7.5
 */

import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TariffOption {
  name: string
  description: string
  local_price: string
  secondary_price: string
}

interface TariffMultiSelectProps {
  tariffs: TariffOption[]
  selectedIndices: number[]
  onChange: (indices: number[]) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TariffMultiSelect({
  tariffs,
  selectedIndices,
  onChange
}: TariffMultiSelectProps): JSX.Element {
  const { t } = useTranslation()

  const hasError = selectedIndices.length < 2

  function handleToggle(index: number): void {
    if (selectedIndices.includes(index)) {
      onChange(selectedIndices.filter((i) => i !== index))
    } else {
      onChange([...selectedIndices, index].sort((a, b) => a - b))
    }
  }

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-gray-600">
        {t('settings.selectTariffs')}
      </span>
      <div
        className={cn(
          'border rounded p-2 max-h-32 overflow-y-auto space-y-1',
          hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        )}
        role="group"
        aria-label={t('settings.selectTariffs')}
      >
        {tariffs.length === 0 && (
          <p className="text-xs text-gray-400 italic">{t('validation.minTariffs')}</p>
        )}
        {tariffs.map((tariff, index) => {
          const checked = selectedIndices.includes(index)
          const label = tariff.name.trim() || `#${index + 1}`
          return (
            <label
              key={index}
              className={cn(
                'flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer text-sm',
                'hover:bg-gray-100',
                checked && 'bg-blue-50'
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(index)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="truncate text-gray-700">{label}</span>
            </label>
          )
        })}
      </div>
      {hasError && (
        <p className="text-xs text-red-600" role="alert">
          {t('settings.stripTariffWarning')}
        </p>
      )}
    </div>
  )
}
