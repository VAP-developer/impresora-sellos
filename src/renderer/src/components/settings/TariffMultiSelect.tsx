/**
 * TariffMultiSelect.tsx
 *
 * Multi-select component for choosing individual tariffs to include in a strip.
 * Allows selecting each tariff up to 4 times, with a count selector.
 * Shows a validation warning when fewer than 2 total stamps are selected.
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

export interface TariffSelection {
  index: number
  count: number // 1-9
}

interface TariffMultiSelectProps {
  tariffs: TariffOption[]
  selectedIndices: number[] // For backwards compatibility, convert to/from TariffSelection[]
  onChange: (indices: number[]) => void // For backwards compatibility, receives flattened array
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TariffMultiSelect({
  tariffs,
  selectedIndices,
  onChange
}: TariffMultiSelectProps): JSX.Element {
  const { t } = useTranslation()

  // Convert flat array to selection map: index -> count
  // e.g., [0, 0, 1, 2] -> { 0: 2, 1: 1, 2: 1 }
  const selectionMap = new Map<number, number>()
  selectedIndices.forEach((idx) => {
    selectionMap.set(idx, (selectionMap.get(idx) || 0) + 1)
  })

  const totalCount = selectedIndices.length
  const hasError = totalCount < 2

  function handleCountChange(index: number, count: number): void {
    const newMap = new Map(selectionMap)
    if (count === 0) {
      newMap.delete(index)
    } else {
      newMap.set(index, Math.min(9, Math.max(1, count)))
    }

    // Convert map back to flat array
    const newIndices: number[] = []
    newMap.forEach((cnt, idx) => {
      for (let i = 0; i < cnt; i++) {
        newIndices.push(idx)
      }
    })
    onChange(newIndices.sort((a, b) => a - b))
  }

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-gray-600">
        {t('settings.selectTariffs')} ({totalCount} {t('settings.stamps')})
      </span>
      <div
        className={cn(
          'border rounded p-2 max-h-40 overflow-y-auto space-y-1',
          hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        )}
        role="group"
        aria-label={t('settings.selectTariffs')}
      >
        {tariffs.length === 0 && (
          <p className="text-xs text-gray-400 italic">{t('validation.minTariffs')}</p>
        )}
        {tariffs.map((tariff, index) => {
          const count = selectionMap.get(index) || 0
          const label = tariff.name.trim() || `#${index + 1}`
          return (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1 rounded text-sm',
                'hover:bg-gray-50',
                count > 0 && 'bg-blue-50'
              )}
            >
              <span className="truncate text-gray-700 flex-1 min-w-0">{label}</span>
              <div className="flex items-center gap-0.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleCountChange(index, count === n ? 0 : n)}
                    className={cn(
                      'w-6 h-6 rounded text-xs font-medium',
                      'border transition-colors',
                      count === n
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                    )}
                    aria-label={`${label} - ${n} ${t('settings.times')}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
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
