/**
 * CodigoSection.tsx
 *
 * Collapsible section for editing the label code configuration (CÓDIGO ETIQUETA).
 * Displays: Mes (auto or manual) and ID Cliente.
 *
 * Mes char mapping (1-indexed month):
 *   Enero=1, Febrero=2, Marzo=3, Abril=4, Mayo=5, Junio=6,
 *   Julio=7, Agosto=8, Septiembre=9, Octubre=O, Noviembre=N, Diciembre=D
 *
 * The config field `mes` uses: 0 = auto (current month), 1-12 = manual selection.
 *
 * Validates: Requirement 12.1 (persisting código config changes)
 */

import { useCallback, useEffect, useState } from 'react'
import type { CodigoConfig } from '@renderer/types/config'

// ─── Month char mapping (1-indexed) ──────────────────────────────────────────

const MONTH_CHARS: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'O',
  11: 'N',
  12: 'D'
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getCurrentMonth1Based(): number {
  return new Date().getMonth() + 1 // 1-12
}

function getMonthChar(month1Based: number): string {
  return MONTH_CHARS[month1Based] ?? '?'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodigoSectionProps {
  /** Current código configuration loaded from the store. */
  codigo: CodigoConfig
  /** Callback to update the local form state (not yet persisted). */
  onChange: (updated: Partial<CodigoConfig>) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CodigoSection({ codigo, onChange }: CodigoSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  // Local form state
  const [cliente, setCliente] = useState(String(codigo.cliente))
  // mes=0 means auto, 1-12 means manual
  const [mesConfig, setMesConfig] = useState(codigo.mes)

  const isAuto = mesConfig === 0
  const displayedMonth = isAuto ? getCurrentMonth1Based() : mesConfig
  const displayedChar = getMonthChar(displayedMonth)

  // Sync local state when prop changes (e.g. after external save/reload)
  useEffect(() => {
    setCliente(String(codigo.cliente))
    setMesConfig(codigo.mes)
  }, [codigo])

  // Propagate changes to parent
  const propagate = useCallback(
    (partial: Partial<CodigoConfig>) => {
      onChange(partial)
    },
    [onChange]
  )

  // ─── Field change handlers ─────────────────────────────────────────────────

  const handleClienteChange = (value: string): void => {
    setCliente(value)
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      propagate({ cliente: num })
    }
  }

  const handleToggleMesAuto = (): void => {
    if (isAuto) {
      // Switch to manual, default to current month
      const current = getCurrentMonth1Based()
      setMesConfig(current)
      propagate({ mes: current })
    } else {
      // Switch back to auto
      setMesConfig(0)
      propagate({ mes: 0 })
    }
  }

  const handleMesManualChange = (value: string): void => {
    const num = parseInt(value, 10)
    if (num >= 1 && num <= 12) {
      setMesConfig(num)
      propagate({ mes: num })
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="codigo-section-heading">
      {/* Collapsible header */}
      <button
        type="button"
        id="codigo-section-heading"
        className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                   text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="codigo-section-content"
      >
        <input
          type="checkbox"
          checked={!collapsed}
          readOnly
          className="cursor-pointer"
          tabIndex={-1}
          aria-hidden="true"
        />
        <h3 className="text-base font-bold m-0">
          CÓDIGO ETIQUETA: Mes - Cliente
        </h3>
      </button>

      {/* Content panel */}
      {!collapsed && (
        <div
          id="codigo-section-content"
          className="border border-gray-200 rounded-b p-4 bg-white"
          role="region"
          aria-label="Campos de código de etiqueta"
        >
          <div className="flex flex-wrap items-start gap-6">
            {/* Mes */}
            <div className="flex flex-col">
              <label htmlFor="codigo-mes" className="text-xs text-gray-600">
                Mes {isAuto ? '(automático)' : '(manual)'}
              </label>
              <div className="flex items-center gap-2">
                {isAuto ? (
                  <input
                    id="codigo-mes"
                    type="text"
                    value={displayedChar}
                    disabled
                    className="w-12 border-b border-gray-300 text-gray-700 outline-none bg-transparent text-center font-bold"
                    aria-readonly="true"
                  />
                ) : (
                  <select
                    id="codigo-mes"
                    value={String(mesConfig)}
                    onChange={(e) => handleMesManualChange(e.target.value)}
                    className="w-32 border-b border-gray-400 text-red-600 focus:border-blue-500 outline-none bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m)}>
                        {MONTH_CHARS[m]} - {MONTH_NAMES[m - 1]}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="bg-gray-200 text-xs px-2 py-1 rounded hover:bg-gray-300
                             focus:outline-none focus:ring-2 focus:ring-gray-400"
                  onClick={handleToggleMesAuto}
                  aria-label={isAuto ? 'Cambiar a mes manual' : 'Volver a mes automático'}
                >
                  {isAuto ? 'Manual' : 'Auto'}
                </button>
              </div>
            </div>

            {/* ID Cliente */}
            <div className="flex flex-col">
              <label htmlFor="codigo-cliente" className="text-xs text-gray-600">
                ID Cliente
              </label>
              <input
                id="codigo-cliente"
                type="text"
                value={cliente}
                onChange={(e) => handleClienteChange(e.target.value)}
                className="w-24 border-b border-gray-400 text-red-600 focus:border-blue-500 outline-none"
                aria-describedby="codigo-cliente-desc"
              />
              <span id="codigo-cliente-desc" className="sr-only">
                Identificador incremental de sesión (0-9999)
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
