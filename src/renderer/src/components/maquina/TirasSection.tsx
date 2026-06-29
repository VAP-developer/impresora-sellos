/**
 * TirasSection.tsx
 *
 * Collapsible section for editing special strip (tira especial) configuration.
 * Displays and allows editing of: prices for 1/2/3 special strips,
 * and enable/disable printing of special strips per model (TEmod1, TEmod2).
 *
 * Replicates the "TIRAS ESPECIALES" section from the legacy MaquinaView.vue.
 *
 * Validates: Requirement 12.2 (persisting ticket config changes including tiras especiales)
 */

import { useCallback, useEffect, useState } from 'react'
import type { TicketConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TirasSectionProps {
  /** Current ticket configuration containing T1especial, T2especial, T3especial, TEmod1, TEmod2. */
  ticket: TicketConfig
  /** Name of model 1 (left/printer1) for display. */
  nombreModelo1: string
  /** Name of model 2 (right/printer2) for display. */
  nombreModelo2: string
  /** Callback to update the local form state (not yet persisted). */
  onChange: (updated: Partial<TicketConfig>) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TirasSection({
  ticket,
  nombreModelo1,
  nombreModelo2,
  onChange
}: TirasSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  // Local form state derived from props
  const [t1especial, setT1especial] = useState(String(ticket.T1especial ?? 0))
  const [t2especial, setT2especial] = useState(String(ticket.T2especial ?? 0))
  const [t3especial, setT3especial] = useState(String(ticket.T3especial ?? 0))
  const [temod1, setTemod1] = useState(ticket.TEmod1 ?? 'N')
  const [temod2, setTemod2] = useState(ticket.TEmod2 ?? 'N')

  // Sync local state when prop changes (e.g. after external save/reload)
  useEffect(() => {
    setT1especial(String(ticket.T1especial ?? 0))
    setT2especial(String(ticket.T2especial ?? 0))
    setT3especial(String(ticket.T3especial ?? 0))
    setTemod1(ticket.TEmod1 ?? 'N')
    setTemod2(ticket.TEmod2 ?? 'N')
  }, [ticket])

  // Propagate changes to parent
  const propagate = useCallback(
    (partial: Partial<TicketConfig>) => {
      onChange(partial)
    },
    [onChange]
  )

  // ─── Field change handlers ─────────────────────────────────────────────────

  const handleT1especialChange = (value: string): void => {
    setT1especial(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      propagate({ T1especial: num })
    } else if (value === '' || value === '0') {
      propagate({ T1especial: 0 })
    }
  }

  const handleT2especialChange = (value: string): void => {
    setT2especial(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      propagate({ T2especial: num })
    } else if (value === '' || value === '0') {
      propagate({ T2especial: 0 })
    }
  }

  const handleT3especialChange = (value: string): void => {
    setT3especial(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      propagate({ T3especial: num })
    } else if (value === '' || value === '0') {
      propagate({ T3especial: 0 })
    }
  }

  const handleTemod1Change = (value: string): void => {
    const normalized = value.slice(0, 1).toUpperCase()
    setTemod1(normalized)
    propagate({ TEmod1: normalized })
  }

  const handleTemod2Change = (value: string): void => {
    const normalized = value.slice(0, 1).toUpperCase()
    setTemod2(normalized)
    propagate({ TEmod2: normalized })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="tiras-section-heading" className="mt-4">
      {/* Collapsible header */}
      <button
        type="button"
        id="tiras-section-heading"
        className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                   text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="tiras-section-content"
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
          TIRAS ESPECIALES {nombreModelo1 || 'Modelo 1'}: {temod1} / {nombreModelo2 || 'Modelo 2'}:{' '}
          {temod2}
        </h3>
      </button>

      {/* Content panel */}
      {!collapsed && (
        <div
          id="tiras-section-content"
          className="border border-gray-200 rounded-b p-4 bg-white"
          role="region"
          aria-label="Campos de configuración de tiras especiales"
        >
          <div className="flex gap-8">
            {/* ─── Left column: Prices ──────────────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="bg-gray-100 p-2 rounded shadow-sm">
                <h4 className="text-sm font-bold m-0">
                  (NO dejar en blanco) IMPORTE € DE VENTA para:
                </h4>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="tiras-t1especial" className="text-xs text-gray-600">
                  1 TIRA ESPECIAL (0 = ANULA LA TIRA)
                </label>
                <input
                  id="tiras-t1especial"
                  type="number"
                  value={t1especial}
                  onChange={(e) => handleT1especialChange(e.target.value)}
                  min={0}
                  step="0.01"
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="tiras-t2especial" className="text-xs text-gray-600">
                  2 TIRAS ESPECIALES (0 = ANULA LA TIRA)
                </label>
                <input
                  id="tiras-t2especial"
                  type="number"
                  value={t2especial}
                  onChange={(e) => handleT2especialChange(e.target.value)}
                  min={0}
                  step="0.01"
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="tiras-t3especial" className="text-xs text-gray-600">
                  3 TIRAS ESPECIALES (0 = ANULA LA TIRA)
                </label>
                <input
                  id="tiras-t3especial"
                  type="number"
                  value={t3especial}
                  onChange={(e) => handleT3especialChange(e.target.value)}
                  min={0}
                  step="0.01"
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
            </div>

            {/* ─── Right column: Enable/Disable per model ──────────────────── */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="bg-gray-100 p-2 rounded shadow-sm">
                <h4 className="text-sm font-bold m-0">IMPRIMIR TIRA ESPECIAL S/N</h4>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="tiras-temod1" className="text-xs text-gray-600">
                  MODELO 1: {nombreModelo1 || 'Modelo 1'}
                </label>
                <input
                  id="tiras-temod1"
                  type="text"
                  value={temod1}
                  onChange={(e) => handleTemod1Change(e.target.value)}
                  maxLength={1}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                  aria-describedby="tiras-temod1-desc"
                />
                <span id="tiras-temod1-desc" className="sr-only">
                  Introduce S para activar o N para desactivar tiras especiales en modelo 1
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="tiras-temod2" className="text-xs text-gray-600">
                  MODELO 2: {nombreModelo2 || 'Modelo 2'}
                </label>
                <input
                  id="tiras-temod2"
                  type="text"
                  value={temod2}
                  onChange={(e) => handleTemod2Change(e.target.value)}
                  maxLength={1}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                  aria-describedby="tiras-temod2-desc"
                />
                <span id="tiras-temod2-desc" className="sr-only">
                  Introduce S para activar o N para desactivar tiras especiales en modelo 2
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
