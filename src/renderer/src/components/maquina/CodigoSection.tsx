/**
 * CodigoSection.tsx
 *
 * Collapsible section for editing the label code configuration (CÓDIGO ETIQUETA).
 * Displays and allows editing of: modo, mes, país, año, máquina (código evento),
 * cliente (ID sesión), and producto.
 *
 * Replicates the "CÓDIGO ETIQUETA" section from the legacy MaquinaView.vue.
 *
 * Validates: Requirement 12.1 (persisting código config changes)
 * Correctness Properties: 3 (label code format)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CodigoConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodigoSectionProps {
  /** Current código configuration loaded from the store. */
  codigo: CodigoConfig
  /** Callback to update the local form state (not yet persisted). */
  onChange: (updated: Partial<CodigoConfig>) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Options for the month (mes) select. 0 = Auto, 1-9 numeric, 10=O, 11=N, 12=D */
const MES_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Auto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: 'O' },
  { value: 11, label: 'N' },
  { value: 12, label: 'D' }
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function CodigoSection({ codigo, onChange }: CodigoSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  // Local form state derived from props
  const [modo, setModo] = useState(codigo.modo)
  const [mes, setMes] = useState(codigo.mes)
  const [pais, setPais] = useState(codigo.pais)
  const [modoAnnio, setModoAnnio] = useState<'auto' | 'manual'>(
    codigo.annio === 'auto' ? 'auto' : 'manual'
  )
  const [annioManual, setAnnioManual] = useState(
    codigo.annio === 'auto' ? '' : codigo.annio
  )
  const [maquina, setMaquina] = useState(codigo.maquina)
  const [cliente, setCliente] = useState(String(codigo.cliente))
  const [producto] = useState(String(codigo.producto))

  // Sync local state when prop changes (e.g. after external save/reload)
  useEffect(() => {
    setModo(codigo.modo)
    setMes(codigo.mes)
    setPais(codigo.pais)
    setModoAnnio(codigo.annio === 'auto' ? 'auto' : 'manual')
    setAnnioManual(codigo.annio === 'auto' ? '' : codigo.annio)
    setMaquina(codigo.maquina)
    setCliente(String(codigo.cliente))
  }, [codigo])

  // Display string for the collapsed header
  const displayMes = useMemo(() => {
    if (mes === 0) return 'Automático'
    const opt = MES_OPTIONS.find((o) => o.value === mes)
    return opt?.label ?? String(mes)
  }, [mes])

  // Propagate changes to parent whenever a field updates
  const propagate = useCallback(
    (partial: Partial<CodigoConfig>) => {
      onChange(partial)
    },
    [onChange]
  )

  // ─── Field change handlers ─────────────────────────────────────────────────

  const handleModoChange = (value: string): void => {
    // Max 1 character
    const trimmed = value.slice(0, 1).toUpperCase()
    setModo(trimmed)
    propagate({ modo: trimmed })
  }

  const handleMesChange = (value: string): void => {
    const numValue = parseInt(value, 10)
    setMes(numValue)
    propagate({ mes: numValue })
  }

  const handlePaisChange = (value: string): void => {
    // Max 2 characters, uppercase
    const trimmed = value.slice(0, 2).toUpperCase()
    setPais(trimmed)
    propagate({ pais: trimmed })
  }

  const handleModoAnnioChange = (value: 'auto' | 'manual'): void => {
    setModoAnnio(value)
    if (value === 'auto') {
      setAnnioManual('')
      propagate({ annio: 'auto' })
    } else {
      propagate({ annio: annioManual || 'auto' })
    }
  }

  const handleAnnioManualChange = (value: string): void => {
    // Accept only numbers 0-99
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      setAnnioManual('')
      propagate({ annio: 'auto' })
    } else {
      const clamped = Math.max(0, Math.min(99, num))
      const strVal = String(clamped)
      setAnnioManual(strVal)
      propagate({ annio: strVal })
    }
  }

  const handleMaquinaChange = (value: string): void => {
    // Max 4 characters (legacy: "Código Evento", minlength=4, maxlength=4)
    const trimmed = value.slice(0, 4).toUpperCase()
    setMaquina(trimmed)
    propagate({ maquina: trimmed })
  }

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
          CÓDIGO ETIQUETA: {displayMes}-{maquina}
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
          <div className="flex flex-wrap items-start gap-4">
            {/* Modo */}
            <div className="flex flex-col">
              <label htmlFor="codigo-modo" className="text-xs text-gray-600">
                Modo
              </label>
              <input
                id="codigo-modo"
                type="text"
                value={modo}
                onChange={(e) => handleModoChange(e.target.value)}
                maxLength={1}
                className="w-12 border-b border-gray-400 focus:border-blue-500 outline-none text-center"
                aria-describedby="codigo-modo-desc"
              />
              <span id="codigo-modo-desc" className="sr-only">
                Modo del código de etiqueta (1 carácter, ej: P, F)
              </span>
            </div>

            {/* Mes */}
            <div className="flex flex-col">
              <label htmlFor="codigo-mes" className="text-xs text-gray-600">
                Mes
              </label>
              <select
                id="codigo-mes"
                value={mes}
                onChange={(e) => handleMesChange(e.target.value)}
                className="border-b border-gray-400 text-red-600 outline-none"
              >
                {MES_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* País */}
            <div className="flex flex-col">
              <label htmlFor="codigo-pais" className="text-xs text-gray-600">
                País
              </label>
              <input
                id="codigo-pais"
                type="text"
                value={pais}
                onChange={(e) => handlePaisChange(e.target.value)}
                maxLength={2}
                className="w-12 border-b border-gray-400 focus:border-blue-500 outline-none text-center"
              />
            </div>

            {/* Año */}
            <div className="flex flex-col">
              <label htmlFor="codigo-annio-mode" className="text-xs text-gray-600">
                Año
              </label>
              <select
                id="codigo-annio-mode"
                value={modoAnnio === 'auto' ? '1' : '2'}
                onChange={(e) =>
                  handleModoAnnioChange(e.target.value === '1' ? 'auto' : 'manual')
                }
                className="border-b border-gray-400 outline-none"
              >
                <option value="1">Auto</option>
                <option value="2">Manual</option>
              </select>
              {modoAnnio === 'manual' && (
                <input
                  id="codigo-annio-manual"
                  type="number"
                  value={annioManual}
                  onChange={(e) => handleAnnioManualChange(e.target.value)}
                  min={0}
                  max={99}
                  className="w-16 mt-1 border-b border-gray-400 outline-none"
                  placeholder="Año"
                  aria-label="Año manual (2 dígitos)"
                />
              )}
            </div>

            {/* Código Evento (máquina) */}
            <div className="flex flex-col">
              <label htmlFor="codigo-maquina" className="text-xs text-gray-600">
                Código Evento
              </label>
              <input
                id="codigo-maquina"
                type="text"
                value={maquina}
                onChange={(e) => handleMaquinaChange(e.target.value)}
                minLength={4}
                maxLength={4}
                className="w-20 border-b border-gray-400 text-red-600 focus:border-blue-500 outline-none"
              />
              <p className="mt-1 bg-[rgb(255,124,56)] text-white text-xs px-2 py-1 rounded">
                (MD--) (FI--): NO imprime LOGO ni TICKET por TIRA
              </p>
              <p className="mt-1 bg-[rgb(255,124,56)] text-white text-xs px-2 py-1 rounded">
                (FI--): NO imprime FECHA ni EVENTO en las ETIQUETAS
              </p>
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
