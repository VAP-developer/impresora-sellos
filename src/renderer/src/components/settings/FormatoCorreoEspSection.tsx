/**
 * FormatoCorreoEspSection.tsx
 *
 * Checkbox component for enabling the "Formato Correo ESP".
 * When enabled:
 *   - Labels (etiquetas) print a simplified format showing only the tariff name.
 *   - Tickets keep the same layout but their title is prefixed with "ESP".
 */

import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'

export function FormatoCorreoEspSection(): JSX.Element {
  const { t } = useTranslation()
  const { formatoCorreoEsp, setFormatoCorreoEsp } = useSettingsStore()

  async function handleToggle(): Promise<void> {
    try {
      await setFormatoCorreoEsp(!formatoCorreoEsp)
    } catch {
      // Store handles error state internally
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id="formato-correo-esp-checkbox"
          type="checkbox"
          checked={formatoCorreoEsp}
          onChange={handleToggle}
          className="h-5 w-5 rounded border-gray-300 text-blue-600
                     focus:ring-2 focus:ring-blue-400 cursor-pointer"
          aria-describedby="formato-correo-esp-description"
        />
        <label
          htmlFor="formato-correo-esp-checkbox"
          className="text-sm font-medium text-gray-700 cursor-pointer select-none"
        >
          {t('formatoEsp.enable')}
        </label>
      </div>

      <p
        id="formato-correo-esp-description"
        className="text-xs text-gray-500 ml-8"
      >
        {t('formatoEsp.description')}
      </p>
    </div>
  )
}
