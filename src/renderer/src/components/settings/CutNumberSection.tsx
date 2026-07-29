/**
 * CutNumberSection.tsx
 *
 * Numeric input component for configuring the cut number (2-16).
 * Includes client-side validation with translated error messages
 * and a save button that persists the value via the settings store.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { cn } from '../../lib/utils'

export function CutNumberSection(): JSX.Element {
  const { t } = useTranslation()
  const { cutNumber, setCutNumber } = useSettingsStore()

  const [inputValue, setInputValue] = useState<string>(String(cutNumber))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sync local input when store value changes (e.g., after load)
  useEffect(() => {
    setInputValue(String(cutNumber))
    setError(null)
  }, [cutNumber])

  function validate(value: string): string | null {
    const num = Number(value)

    if (value.trim() === '' || isNaN(num) || !Number.isInteger(num)) {
      return t('validation.cutNumberMin')
    }

    if (num < 2) {
      return t('validation.cutNumberMin')
    }

    if (num > 16) {
      return t('validation.cutNumberMax')
    }

    return null
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value
    setInputValue(value)
    setError(validate(value))
  }

  async function handleSave(): Promise<void> {
    const validationError = validate(inputValue)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      await setCutNumber(Number(inputValue))
    } catch {
      // Store handles error state internally
    } finally {
      setSaving(false)
    }
  }

  const isValid = error === null && inputValue.trim() !== ''
  const hasChanged = Number(inputValue) !== cutNumber

  return (
    <div className="space-y-3">
      <label
        htmlFor="cut-number-input"
        className="block text-sm font-medium text-gray-700"
      >
        {t('settings.cutNumber')}
      </label>

      <div className="flex items-start gap-3">
        <div className="flex flex-col">
          <input
            id="cut-number-input"
            type="number"
            min={2}
            max={16}
            step={1}
            value={inputValue}
            onChange={handleChange}
            aria-invalid={!!error}
            aria-describedby={error ? 'cut-number-error' : undefined}
            className={cn(
              'h-9 w-24 px-3 rounded border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
              error
                ? 'border-red-500 text-red-900'
                : 'border-gray-300 text-gray-800 hover:border-gray-400'
            )}
          />
          {error && (
            <p
              id="cut-number-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || !hasChanged || saving}
          className={cn(
            'h-9 px-4 rounded text-sm font-medium',
            'focus:outline-none focus:ring-2 focus:ring-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {t('settings.save')}
        </button>
      </div>
    </div>
  )
}
