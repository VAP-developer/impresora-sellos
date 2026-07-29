/**
 * LanguageSection.tsx
 *
 * Language selector component for switching between Español and English.
 * On change, immediately persists the selection and updates i18n runtime
 * language without requiring an app restart.
 */

import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { AppLanguage } from '@renderer/stores/settings.store'

export function LanguageSection(): JSX.Element {
  const { t } = useTranslation()
  const { language, setLanguage } = useSettingsStore()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value as AppLanguage
    setLanguage(value)
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="language-select"
        className="block text-sm font-medium text-gray-700"
      >
        {t('settings.language')}
      </label>

      <select
        id="language-select"
        value={language}
        onChange={handleChange}
        className="h-9 w-40 px-3 rounded border border-gray-300 text-sm text-gray-800 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </div>
  )
}
