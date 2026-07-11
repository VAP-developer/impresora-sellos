/**
 * RollosSection.tsx
 *
 * Section for managing roll stock in the machine configuration view.
 * Displays current roll stock (existencias), allows removing/installing rolls,
 * manages ticket counter, and shows the BLOQUEADO/DESBLOQUEADO indicator.
 *
 * Replicates the "ROLLOS ETIQUETAS EN MÁQUINA" section from the legacy MaquinaView.vue.
 *
 * Validates: Requirements 4 (roll management), 5 (event blocking)
 * Correctness Properties: 5 (roll decrement), 6 (event blocking)
 */

import { useCallback, useEffect, useState } from 'react'
import type { TicketConfig } from '@renderer/types/config'
import type { OrderLine } from '@renderer/types/order'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RollosSectionProps {
  /** Current ticket configuration containing rollo1, rollo2, tickets, limiteTickets. */
  ticket: TicketConfig
  /** Name of model 1 (left/printer1) for display. */
  nombreModelo1: string
  /** Name of model 2 (right/printer2) for display. */
  nombreModelo2: string
  /** Callback to update the local form state for ticket fields (not yet persisted). */
  onChange: (updated: Partial<TicketConfig>) => void
  /** Callback to insert an audit order line (e.g. QUITAR/COLOCAR ROLLO). */
  onInsertOrder: (order: OrderLine) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a blank OrderLine for roll audit events. */
function createRollAuditOrder(event: string): OrderLine {
  return {
    event,
    venue: ' ',
    machine: ' ',
    vendType: ' ',
    productName: ' ',
    transactionDate: new Date().toISOString(),
    quantity: 0,
    quantitySet: 0,
    totalStamps: 0,
    currency: ' ',
    value: 0,
    paymentStatus: ' ',
    sesionId: 0,
    etiquetasRollo1: 0,
    etiquetasRollo2: 0,
    etiquetaMes: ' ',
    tituloEvento: ' ',
    feria: ' ',
    lugar: ' ',
    fecha: ' ',
    mes: ' ',
    annio: ' ',
    documento: ' '
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RollosSection({
  ticket,
  nombreModelo1,
  nombreModelo2,
  onChange,
  onInsertOrder
}: RollosSectionProps): JSX.Element {
  // ─── Local state ──────────────────────────────────────────────────────────

  // Ticket counter
  const [limiteTickets, setLimiteTickets] = useState(String(ticket.limiteTickets ?? 450))
  const [tickets, setTickets] = useState(String(ticket.tickets ?? 0))

  // Roll stock values
  const [rollo1, setRollo1] = useState(ticket.rollo1 ?? 0)
  const [rollo2, setRollo2] = useState(ticket.rollo2 ?? 0)

  // Installation fields for roll 1
  const [cantidad1, setCantidad1] = useState(0)
  const [desechadas1, setDesechadas1] = useState(0)

  // Installation fields for roll 2
  const [cantidad2, setCantidad2] = useState(0)
  const [desechadas2, setDesechadas2] = useState(0)

  // ─── Sync state from props ────────────────────────────────────────────────

  useEffect(() => {
    setLimiteTickets(String(ticket.limiteTickets ?? 450))
    setTickets(String(ticket.tickets ?? 0))
    setRollo1(ticket.rollo1 ?? 0)
    setRollo2(ticket.rollo2 ?? 0)
  }, [ticket])

  // ─── Derived state ────────────────────────────────────────────────────────

  const isRollo1Installed = rollo1 !== -1
  const isRollo2Installed = rollo2 !== -1
  const isBlocked = isRollo1Installed || isRollo2Installed

  // ─── Propagation helpers ──────────────────────────────────────────────────

  const propagate = useCallback(
    (partial: Partial<TicketConfig>) => {
      onChange(partial)
    },
    [onChange]
  )

  // ─── Handlers: Tickets ────────────────────────────────────────────────────

  const handleLimiteTicketsChange = (value: string): void => {
    setLimiteTickets(value)
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      propagate({ limiteTickets: num })
    }
  }

  const handleTicketsChange = (value: string): void => {
    setTickets(value)
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      propagate({ tickets: num })
    }
  }

  const handleResetTickets = (): void => {
    const limite = parseInt(limiteTickets, 10) || 450
    setTickets(String(limite))
    propagate({ tickets: limite })
  }

  // ─── Handlers: Roll stock (existencias) ───────────────────────────────────

  const handleRollo1Change = (value: string): void => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setRollo1(num)
      propagate({ rollo1: num })
    }
  }

  const handleRollo2Change = (value: string): void => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setRollo2(num)
      propagate({ rollo2: num })
    }
  }

  // ─── Handlers: Remove roll ────────────────────────────────────────────────

  const handleQuitarRollo1 = async (): Promise<void> => {
    const order = createRollAuditOrder('QUITAR ROLLO 1')
    try {
      await onInsertOrder(order)
    } catch (err) {
      console.error('Error registering roll 1 removal:', err)
    }
    setRollo1(-1)
    propagate({ rollo1: -1 })
  }

  const handleQuitarRollo2 = async (): Promise<void> => {
    const order = createRollAuditOrder('QUITAR ROLLO 2')
    try {
      await onInsertOrder(order)
    } catch (err) {
      console.error('Error registering roll 2 removal:', err)
    }
    setRollo2(-1)
    propagate({ rollo2: -1 })
  }

  // ─── Handlers: Install roll ───────────────────────────────────────────────

  const handleColocarRollo1 = async (): Promise<void> => {
    const order = createRollAuditOrder('COLOCAR ROLLO 1')
    try {
      await onInsertOrder(order)
    } catch (err) {
      console.error('Error registering roll 1 placement:', err)
    }
    const newValue = (cantidad1 || 0) - (desechadas1 || 0)
    setRollo1(newValue)
    propagate({ rollo1: newValue })
    // Reset installation fields
    setCantidad1(0)
    setDesechadas1(0)
  }

  const handleColocarRollo2 = async (): Promise<void> => {
    const order = createRollAuditOrder('COLOCAR ROLLO 2')
    try {
      await onInsertOrder(order)
    } catch (err) {
      console.error('Error registering roll 2 placement:', err)
    }
    const newValue = (cantidad2 || 0) - (desechadas2 || 0)
    setRollo2(newValue)
    propagate({ rollo2: newValue })
    // Reset installation fields
    setCantidad2(0)
    setDesechadas2(0)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const [collapsed, setCollapsed] = useState(false)

  return (
    <section aria-labelledby="rollos-section-heading" className="mt-4">
      {/* Collapsible header */}
      <button
        type="button"
        id="rollos-section-heading"
        className="w-full bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2
                   text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="rollos-section-content"
      >
        <input
          type="checkbox"
          checked={!collapsed}
          readOnly
          className="cursor-pointer"
          tabIndex={-1}
          aria-hidden="true"
        />
        <h3 className="text-base font-bold m-0">ROLLOS ETIQUETAS EN MÁQUINA</h3>
      </button>

      {!collapsed && (
      <div id="rollos-section-content">
      {/* ─── Tickets counter ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div className="bg-gray-100 p-2 rounded shadow-sm">
          <h4 className="text-sm font-bold m-0">Máximo Nº de Tickets</h4>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <label htmlFor="rollos-limiteTickets" className="text-xs text-gray-600">
            Cantidad por Rollo
          </label>
          <input
            id="rollos-limiteTickets"
            type="text"
            value={limiteTickets}
            onChange={(e) => handleLimiteTicketsChange(e.target.value)}
            className="w-[400px] border-b border-gray-400 text-red-600 outline-none"
          />
        </div>
        <div className="bg-[rgb(51,102,153)] rounded p-4 mt-2 flex flex-col items-center">
          <label htmlFor="rollos-tickets" className="text-xs text-white">
            Rollo Tickets
          </label>
          <input
            id="rollos-tickets"
            type="text"
            value={tickets}
            onChange={(e) => handleTicketsChange(e.target.value)}
            className="w-32 text-center text-white bg-transparent border-b border-white outline-none"
          />
          <button
            type="button"
            className="mt-2 bg-white text-black px-3 py-1 rounded text-sm hover:bg-gray-100"
            onClick={handleResetTickets}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-8 mt-4">
        {/* ── Rollo 1 ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          {isRollo1Installed && (
            <div>
              <div className="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">
                  Motivo {nombreModelo1 || 'Modelo 1'}
                </h4>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <label htmlFor="rollos-rollo1" className="text-xs text-gray-600">
                  Existencias
                </label>
                <input
                  id="rollos-rollo1"
                  type="text"
                  value={String(rollo1)}
                  onChange={(e) => handleRollo1Change(e.target.value)}
                  className="w-[400px] border-b border-gray-400 text-xl outline-none"
                />
              </div>
              <button
                type="button"
                className="mt-2 bg-[rgb(153,38,0)] text-white px-4 py-2 rounded font-semibold
                           hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={handleQuitarRollo1}
              >
                CONFIRMAR ROLLO QUITADO
              </button>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="w-8" />

        {/* ── Rollo 2 ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          {isRollo2Installed && (
            <div>
              <div className="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h4 className="text-sm font-bold m-0">
                  Motivo {nombreModelo2 || 'Modelo 2'}
                </h4>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <label htmlFor="rollos-rollo2" className="text-xs text-gray-600">
                  Existencias
                </label>
                <input
                  id="rollos-rollo2"
                  type="text"
                  value={String(rollo2)}
                  onChange={(e) => handleRollo2Change(e.target.value)}
                  className="w-[400px] border-b border-gray-400 text-xl outline-none"
                />
              </div>
              <button
                type="button"
                className="mt-2 bg-[rgb(153,38,0)] text-white px-4 py-2 rounded font-semibold
                           hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={handleQuitarRollo2}
              >
                CONFIRMAR ROLLO QUITADO
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── INSTALAR ROLLOS ETIQUETAS ───────────────────────────────────── */}
      <div className="bg-[rgb(51,102,153)] text-white p-2 rounded mt-4">
        <h3 className="text-base font-bold m-0">INSTALAR ROLLOS ETIQUETAS</h3>
      </div>

      <div className="flex justify-center gap-8 mt-4">
        {/* ── Install Rollo 1 ─────────────────────────────────────────────── */}
        {!isRollo1Installed && (
          <div className="flex flex-col items-center">
            <div className="bg-gray-100 p-2 rounded shadow-sm">
              <h4 className="text-sm font-bold m-0">
                Colocar rollo {nombreModelo1 || 'Modelo 1'}
              </h4>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <label htmlFor="rollos-cantidad1" className="text-xs text-gray-600">
                Etiquetas en rollo
              </label>
              <input
                id="rollos-cantidad1"
                type="number"
                value={cantidad1}
                onChange={(e) => setCantidad1(parseInt(e.target.value, 10) || 0)}
                className="w-[400px] border-b border-gray-400 outline-none"
                min={0}
              />
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <label htmlFor="rollos-desechadas1" className="text-xs text-gray-600">
                Desechadas en la instalación
              </label>
              <input
                id="rollos-desechadas1"
                type="number"
                value={desechadas1}
                onChange={(e) => setDesechadas1(parseInt(e.target.value, 10) || 0)}
                className="w-[400px] border-b border-gray-400 outline-none"
                min={0}
              />
            </div>
            <button
              type="button"
              className="mt-2 bg-gray-400 text-white px-4 py-2 rounded font-semibold
                         hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={handleColocarRollo1}
            >
              CONFIRMAR COLOCACIÓN ROLLO
            </button>
          </div>
        )}

        <div className="w-8" />

        {/* ── Install Rollo 2 ─────────────────────────────────────────────── */}
        {!isRollo2Installed && (
          <div className="flex flex-col items-center">
            <div className="bg-gray-100 p-2 rounded shadow-sm">
              <h4 className="text-sm font-bold m-0">
                Colocar rollo {nombreModelo2 || 'Modelo 2'}
              </h4>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <label htmlFor="rollos-cantidad2" className="text-xs text-gray-600">
                Etiquetas en rollo
              </label>
              <input
                id="rollos-cantidad2"
                type="number"
                value={cantidad2}
                onChange={(e) => setCantidad2(parseInt(e.target.value, 10) || 0)}
                className="w-[400px] border-b border-gray-400 outline-none"
                min={0}
              />
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <label htmlFor="rollos-desechadas2" className="text-xs text-gray-600">
                Desechadas en la instalación
              </label>
              <input
                id="rollos-desechadas2"
                type="number"
                value={desechadas2}
                onChange={(e) => setDesechadas2(parseInt(e.target.value, 10) || 0)}
                className="w-[400px] border-b border-gray-400 outline-none"
                min={0}
              />
            </div>
            <button
              type="button"
              className="mt-2 bg-gray-400 text-white px-4 py-2 rounded font-semibold
                         hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={handleColocarRollo2}
            >
              CONFIRMAR COLOCACIÓN ROLLO
            </button>
          </div>
        )}
      </div>

      {/* ─── BLOQUEADO / DESBLOQUEADO indicator ──────────────────────────── */}
      <div className="flex justify-center mt-4">
        {!isBlocked ? (
          <div
            className="bg-[rgb(0,153,51)] rounded px-4 py-2"
            role="status"
            aria-live="polite"
          >
            <span className="text-white text-xl font-bold">DESBLOQUEADO</span>
          </div>
        ) : (
          <div
            className="bg-[rgb(153,38,0)] rounded px-4 py-2"
            role="status"
            aria-live="polite"
          >
            <span className="text-white text-xl font-bold">BLOQUEADO</span>
          </div>
        )}
      </div>
      </div>
      )}
    </section>
  )
}
