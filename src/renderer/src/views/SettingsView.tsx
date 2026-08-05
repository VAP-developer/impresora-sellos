/**
 * SettingsView.tsx
 *
 * Main Settings view with clearly differentiated sections:
 * 1. Tariff Groups — manage tariff groups by year
 * 2. Cut Number — configure label grouping size
 * 3. Language — switch between Español and English
 *
 * Each section is wrapped in a collapsible box matching the pattern
 * used in other views (MaquinaView, ImprimirView).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 13.1, 13.4
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import PrinterSection from '@renderer/components/imprimir/PrinterSection'
import { TariffGroupSection } from '@renderer/components/settings/TariffGroupSection'
import { CutNumberSection } from '@renderer/components/settings/CutNumberSection'
import { LanguageSection } from '@renderer/components/settings/LanguageSection'
import { CodigoEspecialSection } from '@renderer/components/settings/CodigoEspecialSection'

export default function SettingsView(): JSX.Element {
  const { t } = useTranslation()
  const { loadSettings } = useSettingsStore()

  const [tariffOpen, setTariffOpen] = useState(false)
  const [cutOpen, setCutOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [codigoOpen, setCodigoOpen] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-black text-[25px] font-bold text-center m-0">
          {t('settings.title')}
        </h1>
      </div>

      <div className="flex justify-center mt-4">
        <div className="w-full max-w-4xl px-4 space-y-4">

          {/* Section: Printer Management */}
          <PrinterSection />

          {/* Section: Código Especial (Oficina) */}
          <div>
            <button
              type="button"
              className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                         text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onClick={() => setCodigoOpen(!codigoOpen)}
              aria-expanded={codigoOpen}
              aria-controls="settings-codigo-especial-content"
            >
              <input
                type="checkbox"
                checked={codigoOpen}
                readOnly
                className="cursor-pointer"
                tabIndex={-1}
                aria-hidden="true"
              />
              <h3 className="text-lg font-bold m-0">
                CÓDIGO ESPECIAL (OFICINA)
              </h3>
            </button>
            {codigoOpen && (
              <div
                id="settings-codigo-especial-content"
                className="border border-gray-200 rounded-b p-4 bg-white"
                role="region"
                aria-label="Código Especial"
              >
                <CodigoEspecialSection />
              </div>
            )}
          </div>

          {/* Section 1: Tariff Groups */}
          <div>
            <button
              type="button"
              className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                         text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onClick={() => setTariffOpen(!tariffOpen)}
              aria-expanded={tariffOpen}
              aria-controls="settings-tariff-content"
            >
              <input
                type="checkbox"
                checked={tariffOpen}
                readOnly
                className="cursor-pointer"
                tabIndex={-1}
                aria-hidden="true"
              />
              <h3 className="text-lg font-bold m-0">
                {t('settings.tariffGroups').toUpperCase()}
              </h3>
            </button>
            {tariffOpen && (
              <div
                id="settings-tariff-content"
                className="border border-gray-200 rounded-b p-4 bg-white"
                role="region"
                aria-label={t('settings.tariffGroups')}
              >
                <TariffGroupSection />
              </div>
            )}
          </div>

          {/* Section 2: Cut Number */}
          <div>
            <button
              type="button"
              className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                         text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onClick={() => setCutOpen(!cutOpen)}
              aria-expanded={cutOpen}
              aria-controls="settings-cut-content"
            >
              <input
                type="checkbox"
                checked={cutOpen}
                readOnly
                className="cursor-pointer"
                tabIndex={-1}
                aria-hidden="true"
              />
              <h3 className="text-lg font-bold m-0">
                {t('settings.cutNumber').toUpperCase()}
              </h3>
            </button>
            {cutOpen && (
              <div
                id="settings-cut-content"
                className="border border-gray-200 rounded-b p-4 bg-white"
                role="region"
                aria-label={t('settings.cutNumber')}
              >
                <CutNumberSection />
              </div>
            )}
          </div>

          {/* Section 3: Language */}
          <div>
            <button
              type="button"
              className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                         text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onClick={() => setLangOpen(!langOpen)}
              aria-expanded={langOpen}
              aria-controls="settings-lang-content"
            >
              <input
                type="checkbox"
                checked={langOpen}
                readOnly
                className="cursor-pointer"
                tabIndex={-1}
                aria-hidden="true"
              />
              <h3 className="text-lg font-bold m-0">
                {t('settings.language').toUpperCase()}
              </h3>
            </button>
            {langOpen && (
              <div
                id="settings-lang-content"
                className="border border-gray-200 rounded-b p-4 bg-white"
                role="region"
                aria-label={t('settings.language')}
              >
                <LanguageSection />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
