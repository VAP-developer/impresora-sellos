/**
 * SettingsView.tsx
 *
 * Main Settings view with clearly differentiated sections:
 * 1. Profile Mode — select active sales profile (1-6)
 * 2. Edit Profiles — edit profile names
 * 3. Tariff Groups — manage tariff groups by year
 * 4. Cut Number — configure label grouping size
 * 5. Language — switch between Español and English
 *
 * Each section is wrapped in a collapsible box matching the pattern
 * used in other views (MaquinaView, ImprimirView).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 13.1, 13.4
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useConfigStore } from '@renderer/stores/config.store'
import type { SelloConfig } from '@renderer/types/config'
import PerfilSection from '@renderer/components/imprimir/PerfilSection'
import PerfilesSection from '@renderer/components/imprimir/PerfilesSection'
import PrinterSection from '@renderer/components/imprimir/PrinterSection'
import { TariffGroupSection } from '@renderer/components/settings/TariffGroupSection'
import { CutNumberSection } from '@renderer/components/settings/CutNumberSection'
import { LanguageSection } from '@renderer/components/settings/LanguageSection'

export default function SettingsView(): JSX.Element {
  const { t } = useTranslation()
  const { loadSettings } = useSettingsStore()
  const config = useConfigStore((s) => s.config)
  const updateImprimir = useConfigStore((s) => s.updateImprimir)

  const [tariffOpen, setTariffOpen] = useState(false)
  const [cutOpen, setCutOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  // Local state for profile selection
  const [selectedPerfil, setSelectedPerfil] = useState<number>(
    config?.sello.elperfil ?? 6
  )

  // Local editable profile names (only nperfil4 is actually editable)
  const [localProfileNames, setLocalProfileNames] = useState<Record<number, string>>(() => ({
    1: config?.sello.nperfil1 ?? 'Filatelia',
    2: config?.sello.nperfil2 ?? 'Esporádicos',
    3: config?.sello.nperfil3 ?? 'SPDE',
    4: config?.sello.nperfil4 ?? '',
    5: config?.sello.nperfil5 ?? 'Abono/Envío',
    6: config?.sello.nperfil6 ?? 'FERIA'
  }))

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Sync local profile names from config when it loads/changes externally
  useEffect(() => {
    if (config?.sello) {
      setSelectedPerfil(config.sello.elperfil ?? 6)
      setLocalProfileNames({
        1: config.sello.nperfil1 ?? 'Filatelia',
        2: config.sello.nperfil2 ?? 'Esporádicos',
        3: config.sello.nperfil3 ?? 'SPDE',
        4: config.sello.nperfil4 ?? '',
        5: config.sello.nperfil5 ?? 'Abono/Envío',
        6: config.sello.nperfil6 ?? 'FERIA'
      })
    }
  }, [config?.sello.elperfil, config?.sello.nperfil1, config?.sello.nperfil2, config?.sello.nperfil3, config?.sello.nperfil4, config?.sello.nperfil5, config?.sello.nperfil6])

  const handlePerfilChange = useCallback(async (perfil: number) => {
    setSelectedPerfil(perfil)
    if (!config) return
    // Persist profile selection immediately
    const perfilNames: Record<number, string> = localProfileNames
    const elnperfil = perfilNames[perfil] ?? ''
    const selloUpdate: Partial<SelloConfig> = {
      elperfil: perfil,
      elnperfil
    }
    await updateImprimir({ sello: selloUpdate, precios: config.precios })
  }, [config, localProfileNames, updateImprimir])

  const handleProfileNameChange = useCallback(
    (profileIndex: number, value: string) => {
      setLocalProfileNames((prev) => ({ ...prev, [profileIndex]: value }))
    },
    []
  )

  const handleSaveProfiles = useCallback(async () => {
    if (!config) return
    const selloUpdate: Partial<SelloConfig> = {
      nperfil1: localProfileNames[1],
      nperfil2: localProfileNames[2],
      nperfil3: localProfileNames[3],
      nperfil4: localProfileNames[4],
      nperfil5: localProfileNames[5],
      nperfil6: localProfileNames[6]
    }
    await updateImprimir({ sello: selloUpdate, precios: config.precios })
  }, [config, localProfileNames, updateImprimir])

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

          {/* Section: Profile Mode */}
          {config && (
            <PerfilSection
              sello={config.sello}
              selectedPerfil={selectedPerfil}
              onPerfilChange={handlePerfilChange}
            />
          )}

          {/* Section: Edit Profiles */}
          {config && (
            <PerfilesSection
              sello={{
                ...config.sello,
                nperfil1: localProfileNames[1],
                nperfil2: localProfileNames[2],
                nperfil3: localProfileNames[3],
                nperfil4: localProfileNames[4],
                nperfil5: localProfileNames[5],
                nperfil6: localProfileNames[6]
              }}
              onProfileNameChange={handleProfileNameChange}
              onSave={handleSaveProfiles}
            />
          )}

          {/* Section: Printer Management */}
          <PrinterSection />

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
