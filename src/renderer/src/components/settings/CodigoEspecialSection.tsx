/**
 * CodigoEspecialSection.tsx
 *
 * Section for editing the "Código Especial" used by the Oficina button (red cart).
 * These codes (codigo_feria_1 and codigo_feria_2) are stored in the general
 * configuration and are used instead of the event codes when selling via Oficina.
 *
 * Format: {codigo_feria_1}-{mes}{codigo_feria_2} (e.g., "ABCD-8EF")
 * The month char is prepended automatically from the pestaña Máquina config.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { useConfigStore } from '@renderer/stores/config.store'
import { formatMes } from '@renderer/lib/code-formatter'

export function CodigoEspecialSection(): JSX.Element {
  const { t } = useTranslation()
  const { config, updateMaquina } = useConfigStore()

  const [codigoFeria1, setCodigoFeria1] = useState('')
  const [codigoFeria2, setCodigoFeria2] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sync from config
  useEffect(() => {
    if (config) {
      setCodigoFeria1(config.codigo.codigo_feria_1 ?? '')
      setCodigoFeria2(config.codigo.codigo_feria_2 ?? '')
    }
  }, [config])

  // Clear message after 3s
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      await updateMaquina({
        ticket: {},
        codigo: {
          codigo_feria_1: codigoFeria1,
          codigo_feria_2: codigoFeria2
        }
      })
      setMessage({ type: 'success', text: t('settings.codigoEspecial.saved') })
    } catch {
      setMessage({ type: 'error', text: t('settings.codigoEspecial.saveError') })
    } finally {
      setSaving(false)
    }
  }, [codigoFeria1, codigoFeria2, updateMaquina, t])

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        {t('settings.codigoEspecial.description')}
      </p>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor="settings-codigo-feria-1" className="text-xs text-gray-700 font-bold">
            {t('settings.codigoEspecial.officeCodeLabel')}
          </label>
          <input
            id="settings-codigo-feria-1"
            type="text"
            value={codigoFeria1}
            onChange={(e) => setCodigoFeria1(e.target.value.slice(0, 4).toUpperCase())}
            maxLength={4}
            className="w-24 border border-gray-300 rounded p-2 font-mono text-lg text-red-600"
            placeholder="JC26"
          />
          <span className="text-[10px] text-gray-500 mt-0.5">{t('settings.codigoEspecial.officeCodeHint')}</span>
        </div>

        <span className="text-2xl font-bold text-gray-600 pb-3">-</span>

        <div className="flex flex-col">
          <label htmlFor="settings-codigo-feria-2" className="text-xs text-gray-700 font-bold">
            {t('settings.codigoEspecial.countryCodeLabel')}
          </label>
          <input
            id="settings-codigo-feria-2"
            type="text"
            value={codigoFeria2}
            onChange={(e) => setCodigoFeria2(e.target.value.slice(0, 2).toUpperCase())}
            maxLength={2}
            className="w-20 border border-gray-300 rounded p-2 font-mono text-lg text-red-600"
            placeholder="EF"
          />
          <span className="text-[10px] text-gray-500 mt-0.5">{t('settings.codigoEspecial.countryCodeHint')}</span>
        </div>

        {(codigoFeria1 || codigoFeria2) && (
          <div className="flex flex-col pb-3">
            <span className="text-xs text-gray-500">{t('settings.codigoEspecial.preview')}</span>
            <span className="font-mono text-lg font-bold">{codigoFeria1}-{formatMes(config?.codigo.mes ?? 0)}{codigoFeria2}</span>
            <span className="text-[10px] text-gray-400 mt-0.5">
              <Trans i18nKey="settings.codigoEspecial.previewExample" components={{ em: <em /> }} />
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded ml-4 mb-3"
        >
          {saving ? t('settings.codigoEspecial.saving') : t('settings.codigoEspecial.save')}
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
