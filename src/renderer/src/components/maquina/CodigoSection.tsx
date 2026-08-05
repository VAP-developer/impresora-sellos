/**
 * CodigoSection.tsx
 *
 * Collapsible section for editing the label code configuration (CÓDIGO ETIQUETA).
 * Displays only: ID Cliente (session counter) and ID Producto.
 *
 * Validates: Requirement 12.1 (persisting código config changes)
 */

import { useCallback, useEffect, useState } from 'react'
import type { CodigoConfig } from '@renderer/types/config'

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
  const [producto] = useState(String(codigo.producto))

  // Sync local state when prop changes (e.g. after external save/reload)
  useEffect(() => {
    setCliente(String(codigo.cliente))
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

  const handleResetCliente = (resetValue: number): void => {
    setCliente(String(resetValue))
    propagate({ cliente: resetValue })
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
          CÓDIGO ETIQUETA: Cliente - Producto
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
              <button
                type="button"
                className="mt-1 bg-gray-200 text-xs px-2 py-1 rounded hover:bg-gray-300
                           focus:outline-none focus:ring-2 focus:ring-gray-400"
                onClick={() => handleResetCliente(1)}
              >
                Reset al inicio del año ATM NACIONAL=1
              </button>
              <button
                type="button"
                className="mt-1 bg-gray-200 text-xs px-2 py-1 rounded hover:bg-gray-300
                           focus:outline-none focus:ring-2 focus:ring-gray-400"
                onClick={() => handleResetCliente(5001)}
              >
                Reset al inicio del año i7 Mojave=5001
              </button>
            </div>

            {/* ID Producto (read-only) */}
            <div className="flex flex-col">
              <label htmlFor="codigo-producto" className="text-xs text-gray-600">
                ID Producto
              </label>
              <input
                id="codigo-producto"
                type="text"
                value={producto}
                disabled
                className="w-16 border-b border-gray-300 text-gray-500 outline-none bg-transparent"
                aria-readonly="true"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
