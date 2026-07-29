/**
 * SettingsView.tsx
 *
 * Main Settings view with three clearly differentiated sections:
 * 1. Tariff Groups — manage tariff groups by year
 * 2. Cut Number — configure label grouping size
 * 3. Language — switch between Español and English
 *
 * Loads current settings from the store on mount and uses
 * react-i18next for all static text.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { TariffGroupSection } from '@renderer/components/settings/TariffGroupSection'
import { CutNumberSection } from '@renderer/components/settings/CutNumberSection'
import { LanguageSection } from '@renderer/components/settings/LanguageSection'

export default function SettingsView(): JSX.Element {
  const { t } = useTranslation()
  const { loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="flex flex-col min-h-full px-6 py-8 max-w-4xl mx-auto space-y-8">
      {/* Page title */}
      <h1 className="text-2xl font-semibold text-gray-900">
        {t('settings.title')}
      </h1>

      {/* Section 1: Tariff Groups */}
      <section
        aria-labelledby="settings-tariff-groups-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <TariffGroupSection />
      </section>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Section 2: Cut Number */}
      <section
        aria-labelledby="settings-cut-number-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <CutNumberSection />
      </section>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Section 3: Language */}
      <section
        aria-labelledby="settings-language-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <LanguageSection />
      </section>
    </div>
  )
}
