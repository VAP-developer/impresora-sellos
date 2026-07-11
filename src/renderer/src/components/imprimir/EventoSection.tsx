/**
 * EventoSection.tsx
 *
 * Section for selecting the active event organized by year.
 * The user first selects a year, then picks an event from that year's list.
 *
 * When the event is "BLOQUEADO" (rolls installed), the selector is disabled.
 * When "DESBLOQUEADO" (rolls removed), the user can switch events.
 */

import { useEffect, useState } from 'react'
import type { TicketConfig } from '@renderer/types/config'
import type { EventoRow } from '@renderer/lib/ipc-client'
import {
  getEventoYears,
  getEventosByYear,
  getImageByName
} from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventoSectionProps {
  /** Current ticket configuration (for bloqueado status). */
  ticket: TicketConfig
  /** Currently selected event (from the DB), or null if none selected. */
  selectedEvento: EventoRow | null
  /** Callback when the user changes the selected event. */
  onEventoChange: (evento: EventoRow | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventoSection({
  ticket,
  selectedEvento,
  onEventoChange
}: EventoSectionProps): JSX.Element {
  const bloqueado = ticket.bloqueado === 'BLOQUEADO'

  const [expanded, setExpanded] = useState(true)
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [eventosForYear, setEventosForYear] = useState<EventoRow[]>([])
  const [loading, setLoading] = useState(true)

  // Image URLs for the two models
  const [modelo1Url, setModelo1Url] = useState<string | null>(null)
  const [modelo2Url, setModelo2Url] = useState<string | null>(null)

  // Load available years on mount
  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const yrs = await getEventoYears()
        if (!cancelled) {
          setYears(yrs)
          // If there's a selected event, set the year to match it
          if (selectedEvento) {
            setSelectedYear(selectedEvento.year)
          } else if (yrs.length > 0) {
            setSelectedYear(yrs[0])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Load events when the selected year changes
  useEffect(() => {
    if (selectedYear === null) {
      setEventosForYear([])
      return
    }
    let cancelled = false
    async function load(): Promise<void> {
      const eventos = await getEventosByYear(selectedYear!)
      if (!cancelled) setEventosForYear(eventos)
    }
    load()
    return () => { cancelled = true }
  }, [selectedYear])

  // Load model images when the selected event changes
  useEffect(() => {
    if (!selectedEvento) {
      setModelo1Url(null)
      setModelo2Url(null)
      return
    }

    let cancelled = false
    async function loadImages(): Promise<void> {
      if (selectedEvento!.motivoi) {
        try {
          const img = await getImageByName(selectedEvento!.motivoi)
          if (!cancelled) setModelo1Url(img?.url ?? null)
        } catch {
          if (!cancelled) setModelo1Url(null)
        }
      } else {
        if (!cancelled) setModelo1Url(null)
      }

      if (selectedEvento!.motivod) {
        try {
          const img = await getImageByName(selectedEvento!.motivod)
          if (!cancelled) setModelo2Url(img?.url ?? null)
        } catch {
          if (!cancelled) setModelo2Url(null)
        }
      } else {
        if (!cancelled) setModelo2Url(null)
      }
    }
    loadImages()
    return () => { cancelled = true }
  }, [selectedEvento?.id, selectedEvento?.motivoi, selectedEvento?.motivod])

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      setSelectedYear(value)
      // Clear the event selection when year changes
      onEventoChange(null)
    }
  }

  const handleEventoChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const id = parseInt(e.target.value, 10)
    const evento = eventosForYear.find((ev) => ev.id === id) ?? null
    onEventoChange(evento)
  }

  if (loading) {
    return (
      <section className="mb-6">
        <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
          <input type="checkbox" checked={true} readOnly className="cursor-pointer" />
          <span className="text-black text-lg font-bold">EVENTO</span>
        </div>
        <p className="text-center text-gray-500 p-4">Cargando eventos...</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="evento-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-evento"
          type="checkbox"
          checked={expanded}
          onChange={() => setExpanded(!expanded)}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="evento-section-content"
        />
        <label
          htmlFor="toggle-evento"
          id="evento-section-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          EVENTO: {bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO'}
        </label>
      </div>

      {expanded && (
      <div id="evento-section-content" className="flex flex-col items-center gap-4 p-4">
        {/* Year and Event selectors */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {/* Year selector */}
          <div>
            <label
              htmlFor="evento-year-selector"
              className="block text-red-600 font-bold mb-1"
            >
              AÑO
            </label>
            <select
              id="evento-year-selector"
              value={selectedYear ?? ''}
              onChange={handleYearChange}
              disabled={bloqueado}
              className={`w-[120px] text-red-600 text-lg border border-gray-300 rounded p-2
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${bloqueado ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label="Seleccionar año del evento"
            >
              {years.length === 0 && (
                <option value="">Sin eventos</option>
              )}
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Event selector */}
          <div>
            <label
              htmlFor="evento-selector"
              className="block text-red-600 font-bold mb-1"
            >
              EVENTO
            </label>
            <select
              id="evento-selector"
              value={selectedEvento?.id ?? ''}
              onChange={handleEventoChange}
              disabled={bloqueado || eventosForYear.length === 0}
              className={`w-[300px] text-red-600 text-lg border border-gray-300 rounded p-2
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${bloqueado ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label="Seleccionar evento activo"
            >
              <option value="">-- Seleccionar evento --</option>
              {eventosForYear.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nevento || `Evento #${ev.id}`}
                </option>
              ))}
            </select>
          </div>

          {!bloqueado && selectedEvento && (
            <button
              type="button"
              className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              aria-label="Activar evento seleccionado"
            >
              ACTIVAR
            </button>
          )}
        </div>

        {/* Current event info */}
        {selectedEvento && (
          <>
            <p className="text-black text-2xl font-bold text-center">
              {selectedEvento.nferia}
              {selectedEvento.nferia && selectedEvento.nlugar && <br />}
              {selectedEvento.nlugar}
            </p>
            {selectedEvento.codigo && (
              <p className="text-gray-600 text-sm">
                Código: <span className="font-mono font-bold">{selectedEvento.codigo}</span>
              </p>
            )}

            {/* Stamp model previews */}
            <div className="flex flex-row gap-8 flex-wrap justify-center">
              {/* Model 1 (left / printer 1) */}
              <div className="flex flex-col items-center">
                <p className="text-black text-xl font-bold text-center">
                  {selectedEvento.motivoi || 'Modelo 1'}
                </p>
                <div className="relative w-[350px] h-[160px] border border-gray-200 rounded overflow-hidden bg-gray-50">
                  {modelo1Url ? (
                    <img
                      src={modelo1Url}
                      alt={selectedEvento.motivoi || 'Modelo izquierdo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Sin imagen
                    </div>
                  )}
                  <p className="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                    &nbsp;&nbsp;&nbsp;{selectedEvento.fecha}
                    {selectedEvento.fecha && selectedEvento.localidad && <br />}
                    {selectedEvento.localidad}
                  </p>
                </div>
              </div>

              {/* Model 2 (right / printer 2) */}
              <div className="flex flex-col items-center">
                <p className="text-black text-xl font-bold text-center">
                  {selectedEvento.motivod || 'Modelo 2'}
                </p>
                <div className="relative w-[350px] h-[160px] border border-gray-200 rounded overflow-hidden bg-gray-50">
                  {modelo2Url ? (
                    <img
                      src={modelo2Url}
                      alt={selectedEvento.motivod || 'Modelo derecho'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Sin imagen
                    </div>
                  )}
                  <p className="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                    &nbsp;&nbsp;&nbsp;{selectedEvento.fecha}
                    {selectedEvento.fecha && selectedEvento.localidad && <br />}
                    {selectedEvento.localidad}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {!selectedEvento && years.length > 0 && (
          <p className="text-gray-400 text-lg italic">Seleccione un evento para ver la previsualización</p>
        )}

        {years.length === 0 && (
          <p className="text-gray-400 text-lg italic">No hay eventos creados. Use la sección "Editar Eventos" para crear uno.</p>
        )}
      </div>
      )}
    </section>
  )
}
