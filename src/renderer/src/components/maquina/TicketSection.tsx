/**
 * TicketSection.tsx
 *
 * Collapsible section for editing ticket/receipt configuration.
 * Displays and allows editing of: feria, lugar, empresa, CIF, CP,
 * textos legales (l1, l2, l3), límites de importe, fecha/hora modes,
 * copia de ticket, y master ticket settings.
 *
 * Replicates the "TICKET" section from the legacy MaquinaView.vue.
 *
 * Validates: Requirement 12.2 (persisting ticket config changes)
 * Correctness Properties: 8 (ticket title per profile)
 */

import { useCallback, useEffect, useState } from 'react'
import type { TicketConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TicketSectionProps {
  /** Current ticket configuration loaded from the store. */
  ticket: TicketConfig
  /** Name of the active profile (e.g. "FERIA", "Filatelia"). */
  activeProfileName: string
  /** Active event's feria name (display-only, from sello config). */
  feriaDisplay: string
  /** Active event's lugar (display-only, from sello config). */
  lugarDisplay: string
  /** Callback to update the local form state (not yet persisted). */
  onChange: (updated: Partial<TicketConfig>) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketSection({
  ticket,
  activeProfileName,
  feriaDisplay,
  lugarDisplay,
  onChange
}: TicketSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  // Local form state derived from props
  const [eltitulo, setEltitulo] = useState(ticket.eltitulo ?? '')
  const [limiteImporte, setLimiteImporte] = useState(String(ticket.limiteImporte ?? ''))
  const [nuevoLimiteImporte, setNuevoLimiteImporte] = useState(
    String(ticket.NUEVOlimiteImporte ?? '')
  )
  const [empresa, setEmpresa] = useState(ticket.empresa)
  const [cif, setCif] = useState(ticket.cif)
  const [cp, setCp] = useState(ticket.cp)
  const [l1, setL1] = useState(ticket.l1)
  const [l2, setL2] = useState(ticket.l2)
  const [l3, setL3] = useState(ticket.l3)
  const [modoFecha, setModoFecha] = useState<'auto' | 'manual'>(
    ticket.fecha === 'auto' ? 'auto' : 'manual'
  )
  const [fechaManual, setFechaManual] = useState(ticket.fecha === 'auto' ? '' : ticket.fecha)
  const [modoHora, setModoHora] = useState<'auto' | 'manual'>(
    ticket.hora === 'auto' ? 'auto' : 'manual'
  )
  const [horaManual, setHoraManual] = useState(ticket.hora === 'auto' ? '' : ticket.hora)
  const [imprimeCopiaTicket, setImprimeCopiaTicket] = useState(ticket.ImprimeCopiaTicket ?? 'S')
  const [imprimeMasterTicket, setImprimeMasterTicket] = useState(
    ticket.ImprimeMasterTicket ?? 'N'
  )

  // Sync local state when prop changes (e.g. after external save/reload)
  useEffect(() => {
    setEltitulo(ticket.eltitulo ?? '')
    setLimiteImporte(String(ticket.limiteImporte ?? ''))
    setNuevoLimiteImporte(String(ticket.NUEVOlimiteImporte ?? ''))
    setEmpresa(ticket.empresa)
    setCif(ticket.cif)
    setCp(ticket.cp)
    setL1(ticket.l1)
    setL2(ticket.l2)
    setL3(ticket.l3)
    setModoFecha(ticket.fecha === 'auto' ? 'auto' : 'manual')
    setFechaManual(ticket.fecha === 'auto' ? '' : ticket.fecha)
    setModoHora(ticket.hora === 'auto' ? 'auto' : 'manual')
    setHoraManual(ticket.hora === 'auto' ? '' : ticket.hora)
    setImprimeCopiaTicket(ticket.ImprimeCopiaTicket ?? 'S')
    setImprimeMasterTicket(ticket.ImprimeMasterTicket ?? 'N')
  }, [ticket])

  // Derive display title based on active profile (same logic as legacy)
  const displayTitulo =
    activeProfileName === 'FERIA' ? eltitulo : activeProfileName
  const displayTituloCopia =
    activeProfileName === 'FERIA'
      ? ticket.tituloCopia || `COPIA ${eltitulo}`
      : `COPIA ${activeProfileName}`

  // Propagate changes to parent
  const propagate = useCallback(
    (partial: Partial<TicketConfig>) => {
      onChange(partial)
    },
    [onChange]
  )

  // ─── Field change handlers ─────────────────────────────────────────────────

  const handleEltituloChange = (value: string): void => {
    setEltitulo(value)
    propagate({ eltitulo: value })
  }

  const handleLimiteImporteChange = (value: string): void => {
    setLimiteImporte(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      propagate({ limiteImporte: num })
    }
  }

  const handleNuevoLimiteImporteChange = (value: string): void => {
    setNuevoLimiteImporte(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      propagate({ NUEVOlimiteImporte: num })
    }
  }

  const handleEmpresaChange = (value: string): void => {
    setEmpresa(value)
    propagate({ empresa: value })
  }

  const handleCifChange = (value: string): void => {
    setCif(value)
    propagate({ cif: value })
  }

  const handleCpChange = (value: string): void => {
    setCp(value)
    propagate({ cp: value })
  }

  const handleL1Change = (value: string): void => {
    setL1(value)
    propagate({ l1: value })
  }

  const handleL2Change = (value: string): void => {
    setL2(value)
    propagate({ l2: value })
  }

  const handleL3Change = (value: string): void => {
    setL3(value)
    propagate({ l3: value })
  }

  const handleModoFechaChange = (value: 'auto' | 'manual'): void => {
    setModoFecha(value)
    if (value === 'auto') {
      setFechaManual('')
      propagate({ fecha: 'auto' })
    } else {
      propagate({ fecha: fechaManual || 'auto' })
    }
  }

  const handleFechaManualChange = (value: string): void => {
    setFechaManual(value)
    propagate({ fecha: value || 'auto' })
  }

  const handleModoHoraChange = (value: 'auto' | 'manual'): void => {
    setModoHora(value)
    if (value === 'auto') {
      setHoraManual('')
      propagate({ hora: 'auto' })
    } else {
      propagate({ hora: horaManual || 'auto' })
    }
  }

  const handleHoraManualChange = (value: string): void => {
    setHoraManual(value)
    propagate({ hora: value || 'auto' })
  }

  const handleImprimeCopiaChange = (value: string): void => {
    const normalized = value.slice(0, 1).toUpperCase()
    setImprimeCopiaTicket(normalized)
    propagate({ ImprimeCopiaTicket: normalized })
  }

  const handleImprimeMasterChange = (value: string): void => {
    const normalized = value.slice(0, 1).toUpperCase()
    setImprimeMasterTicket(normalized)
    propagate({ ImprimeMasterTicket: normalized })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="ticket-section-heading" className="mt-4">
      {/* Collapsible header */}
      <button
        type="button"
        id="ticket-section-heading"
        className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                   text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="ticket-section-content"
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
          TICKET: {displayTitulo} - COPIA TICKET: {imprimeCopiaTicket} - MASTER TICKET:{' '}
          {imprimeMasterTicket}
        </h3>
      </button>

      {/* Content panel */}
      {!collapsed && (
        <div
          id="ticket-section-content"
          className="border border-gray-200 rounded-b p-4 bg-white"
          role="region"
          aria-label="Campos de configuración de ticket"
        >
          <div className="flex gap-8">
            {/* ─── Left column ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-2">
              {/* Cabecera Ticket */}
              <div className="bg-gray-100 p-2 rounded shadow-sm">
                <h4 className="text-sm font-bold m-0">Cabecera Ticket</h4>
              </div>
              <p className="text-xl font-bold text-center">
                {feriaDisplay}
                <br />
                {lugarDisplay}
              </p>

              {/* Empresa */}
              <div className="bg-gray-100 p-2 rounded shadow-sm">
                <h4 className="text-sm font-bold m-0">Empresa</h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-empresa" className="text-xs text-gray-600">
                  Empresa
                </label>
                <input
                  id="ticket-empresa"
                  type="text"
                  value={empresa}
                  onChange={(e) => handleEmpresaChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-cif" className="text-xs text-gray-600">
                  CIF
                </label>
                <input
                  id="ticket-cif"
                  type="text"
                  value={cif}
                  onChange={(e) => handleCifChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-cp" className="text-xs text-gray-600">
                  CP Población
                </label>
                <input
                  id="ticket-cp"
                  type="text"
                  value={cp}
                  onChange={(e) => handleCpChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>

              {/* Pié del Ticket */}
              <div className="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">Pié del Ticket</h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-l1" className="text-xs text-gray-600">
                  Detalle línea 1
                </label>
                <input
                  id="ticket-l1"
                  type="text"
                  value={l1}
                  onChange={(e) => handleL1Change(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-l2" className="text-xs text-gray-600">
                  Detalle línea 2
                </label>
                <input
                  id="ticket-l2"
                  type="text"
                  value={l2}
                  onChange={(e) => handleL2Change(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-l3" className="text-xs text-gray-600">
                  Detalle línea 3
                </label>
                <input
                  id="ticket-l3"
                  type="text"
                  value={l3}
                  onChange={(e) => handleL3Change(e.target.value)}
                  className="w-[400px] border-b border-gray-400 outline-none"
                />
              </div>
            </div>

            {/* ─── Right column ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-2">
              {/* Tipo de Documento */}
              <div className="bg-gray-100 p-2 rounded shadow-sm">
                <h4 className="text-sm font-bold m-0">Tipo de Documento</h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-eltitulo" className="text-xs text-gray-600">
                  Título ticket (Sólo Perfil FERIA)
                </label>
                <input
                  id="ticket-eltitulo"
                  type="text"
                  value={eltitulo}
                  onChange={(e) => handleEltituloChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-tituloCopia" className="text-xs text-gray-600">
                  Título ticket copia (Perfil Activo)
                </label>
                <input
                  id="ticket-tituloCopia"
                  type="text"
                  value={displayTituloCopia}
                  disabled
                  className="w-[400px] border-b border-gray-300 text-gray-500 outline-none bg-transparent"
                  aria-readonly="true"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-limiteImporte" className="text-xs text-gray-600">
                  Límite importe sólo FERIA
                </label>
                <input
                  id="ticket-limiteImporte"
                  type="text"
                  value={limiteImporte}
                  onChange={(e) => handleLimiteImporteChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-nuevoLimiteImporte" className="text-xs text-gray-600">
                  NUEVO Límite importe EXCEPTO FERIA
                </label>
                <input
                  id="ticket-nuevoLimiteImporte"
                  type="text"
                  value={nuevoLimiteImporte}
                  onChange={(e) => handleNuevoLimiteImporteChange(e.target.value)}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                />
              </div>

              {/* Modo Fecha Ticket */}
              <div className="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">Modo Fecha Ticket</h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-modoFecha" className="text-xs text-gray-600">
                  Fecha
                </label>
                <select
                  id="ticket-modoFecha"
                  value={modoFecha === 'auto' ? '1' : '2'}
                  onChange={(e) =>
                    handleModoFechaChange(e.target.value === '1' ? 'auto' : 'manual')
                  }
                  className="border-b border-gray-400 outline-none"
                >
                  <option value="1">Automático</option>
                  <option value="2">Manual</option>
                </select>
              </div>
              {modoFecha === 'manual' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="ticket-fechaManual" className="text-xs text-gray-600">
                    Fecha
                  </label>
                  <input
                    id="ticket-fechaManual"
                    type="text"
                    value={fechaManual}
                    onChange={(e) => handleFechaManualChange(e.target.value)}
                    className="w-[400px] border-b border-gray-400 outline-none"
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-modoHora" className="text-xs text-gray-600">
                  Hora
                </label>
                <select
                  id="ticket-modoHora"
                  value={modoHora === 'auto' ? '1' : '2'}
                  onChange={(e) =>
                    handleModoHoraChange(e.target.value === '1' ? 'auto' : 'manual')
                  }
                  className="border-b border-gray-400 outline-none"
                >
                  <option value="1">Automático</option>
                  <option value="2">Manual</option>
                </select>
              </div>
              {modoHora === 'manual' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="ticket-horaManual" className="text-xs text-gray-600">
                    Hora
                  </label>
                  <input
                    id="ticket-horaManual"
                    type="text"
                    value={horaManual}
                    onChange={(e) => handleHoraManualChange(e.target.value)}
                    className="w-[400px] border-b border-gray-400 outline-none"
                    placeholder="HH:MM"
                  />
                </div>
              )}

              {/* COPIA Ticket para CAJA */}
              <div className="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">COPIA Ticket para CAJA</h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-imprimeCopia" className="text-xs text-gray-600">
                  IMPRIMIR COPIA TICKET S/N
                </label>
                <input
                  id="ticket-imprimeCopia"
                  type="text"
                  value={imprimeCopiaTicket}
                  onChange={(e) => handleImprimeCopiaChange(e.target.value)}
                  maxLength={1}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                />
              </div>

              {/* MASTER TICKET */}
              <div className="bg-red-600 text-white p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">
                  IMPRIME SIEMPRE TICKET MASTER SET: VENDER 5 TIRAS DE 4 TARIFAS CADA VEZ
                </h4>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ticket-imprimeMaster" className="text-xs text-gray-600">
                  IMPRIMIR TICKET MASTER SET S/N
                </label>
                <input
                  id="ticket-imprimeMaster"
                  type="text"
                  value={imprimeMasterTicket}
                  onChange={(e) => handleImprimeMasterChange(e.target.value)}
                  maxLength={1}
                  className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
