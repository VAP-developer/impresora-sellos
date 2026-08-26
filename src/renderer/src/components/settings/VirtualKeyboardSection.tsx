/**
 * VirtualKeyboardSection.tsx
 *
 * Settings section for the virtual keyboard configuration.
 * Provides a toggle to enable/disable the virtual keyboard
 * and a language selector (visible only when enabled) to choose
 * between Spanish and English keyboard layouts.
 */

import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { AppLanguage } from '@renderer/stores/settings.store'

export function VirtualKeyboardSection(): JSX.Element {
  const { t } = useTranslation()
  const {
    virtualKeyboardEnabled,
    virtualKeyboardLanguage,
    setVirtualKeyboardEnabled,
    setVirtualKeyboardLanguage
  } = useSettingsStore()

  async function handleToggle(): Promise<void> {
    try {
      await setVirtualKeyboardEnabled(!virtualKeyboardEnabled)
    } catch {
      // Store handles error state internally
    }
  }

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value as AppLanguage
    setVirtualKeyboardLanguage(value)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id="virtual-keyboard-checkbox"
          type="checkbox"
          checked={virtualKeyboardEnabled}
          onChange={handleToggle}
          className="h-5 w-5 rounded border-gray-300 text-blue-600
                     focus:ring-2 focus:ring-blue-400 cursor-pointer"
          aria-describedby="virtual-keyboard-description"
        />
        <label
          htmlFor="virtual-keyboard-checkbox"
          className="text-sm font-medium text-gray-700 cursor-pointer select-none"
        >
          {t('settings.virtualKeyboardEnabled')}
        </label>
      </div>

      {virtualKeyboardEnabled && (
        <div className="ml-8">
          <label
            htmlFor="keyboard-language-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('settings.virtualKeyboardLanguage')}
          </label>
          <select
            id="keyboard-language-select"
            value={virtualKeyboardLanguage}
            onChange={handleLanguageChange}
            className="h-9 w-40 px-3 rounded border border-gray-300 text-sm text-gray-800
                       hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                       focus:border-blue-400"
          >
            <option value="es">{t('settings.keyboardSpanish')}</option>
            <option value="en">{t('settings.keyboardEnglish')}</option>
          </select>
        </div>
      )}
    </div>
  )
}
