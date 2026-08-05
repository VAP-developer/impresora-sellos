/**
 * CodigoEspecialSection.tsx
 *
 * Section for editing the "Código Especial" used by the Oficina button (red cart).
 * These codes (codigo_feria_1 and codigo_feria_2) are stored in the general
 * configuration and are used instead of the event codes when selling via Oficina.
 *
 * Format: {codigo_feria_1}-{codigo_feria_2} (e.g., "JC26-VAP")
 */

import { useCallback, useEffect, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'

export function CodigoEspecialSection(): JSX.Element {
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
      setMessage({ type: 'success', text: 'Código especial guardado' })
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }, [codigoFeria1, codigoFeria2, updateMaquina])

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Este código se usa al pulsar el botón de venta especial (carrito rojo tachado).
        Aparece en el sello y en el ticket en lugar del código del evento.
      </p>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor="settings-codigo-feria-1" className="text-xs text-gray-700 font-bold">
            Código Feria 1
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
          <span className="text-[10px] text-gray-500 mt-0.5">Max 4 caracteres</span>
        </div>

        <span className="text-2xl font-bold text-gray-600 pb-3">-</span>

        <div className="flex flex-col">
          <label htmlFor="settings-codigo-feria-2" className="text-xs text-gray-700 font-bold">
            Código Feria 2
          </label>
          <input
            id="settings-codigo-feria-2"
            type="text"
            value={codigoFeria2}
            onChange={(e) => setCodigoFeria2(e.target.value.slice(0, 3).toUpperCase())}
            maxLength={3}
            className="w-20 border border-gray-300 rounded p-2 font-mono text-lg text-red-600"
            placeholder="VAP"
          />
          <span className="text-[10px] text-gray-500 mt-0.5">Max 3 caracteres</span>
        </div>

        {(codigoFeria1 || codigoFeria2) && (
          <div className="flex flex-col pb-3">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className="font-mono text-lg font-bold">{codigoFeria1}-{codigoFeria2}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded ml-4 mb-3"
        >
          {saving ? 'Guardando...' : 'Guardar'}
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
