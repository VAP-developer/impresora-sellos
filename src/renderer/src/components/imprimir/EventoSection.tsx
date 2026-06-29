/**
 * EventoSection.tsx
 *
 * Section for selecting the active event (0-7) and previewing the stamp models.
 * Replicates the "EVENTO" section from the legacy ImprimirView.vue.
 *
 * When the event is "BLOQUEADO" (rolls installed), the selector is disabled.
 * When "DESBLOQUEADO" (rolls removed), the user can switch events.
 *
 * Validates: Requirement 5 (Bloqueo de Evento)
 * Validates: Requirement 13.2 (support up to 8 events)
 * Validates: Requirement 13.3 (changing event updates models in Kiosko)
 */

import { useEffect, useState } from 'react'
import type { EventoData, SelloConfig, TicketConfig } from '@renderer/types/config'
import { getImageByName } from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventoSectionProps {
  /** Current sello configuration containing event data. */
  sello: SelloConfig
  /** Current ticket configuration (for bloqueado status). */
  ticket: TicketConfig
  /** Currently selected event index (0-7). */
  selectedEvento: number
  /** Callback when the user changes the selected event. */
  onEventoChange: (evento: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventoSection({
  sello,
  ticket,
  selectedEvento,
  onEventoChange
}: EventoSectionProps): JSX.Element {
  const bloqueado = ticket.bloqueado === 'BLOQUEADO'
  const eventos: EventoData[] = sello.eventos ?? []

  // Image URLs for the two models (loaded asynchronously)
  const [modelo1Url, setModelo1Url] = useState<string | null>(null)
  const [modelo2Url, setModelo2Url] = useState<string | null>(null)

  // Derive current event display data
  const currentEvento = eventos[selectedEvento] ?? {
    nevento: '',
    nferia: '',
    nlugar: '',
    motivoi: '',
    motivod: '',
    fecha: '',
    localidad: ''
  }

  // Load model images when the selected event changes
  useEffect(() => {
    let cancelled = false

    async function loadImages(): Promise<void> {
      const motivoi = currentEvento.motivoi
      const motivod = currentEvento.motivod

      if (motivoi) {
        try {
          const img = await getImageByName(motivoi)
          if (!cancelled) {
            setModelo1Url(img?.url ?? null)
          }
        } catch {
          if (!cancelled) setModelo1Url(null)
        }
      } else {
        if (!cancelled) setModelo1Url(null)
      }

      if (motivod) {
        try {
          const img = await getImageByName(motivod)
          if (!cancelled) {
            setModelo2Url(img?.url ?? null)
          }
        } catch {
          if (!cancelled) setModelo2Url(null)
        }
      } else {
        if (!cancelled) setModelo2Url(null)
      }
    }

    loadImages()

    return () => {
      cancelled = true
    }
  }, [currentEvento.motivoi, currentEvento.motivod])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 0 && value <= 7) {
      onEventoChange(value)
    }
  }

  return (
    <section aria-labelledby="evento-section-heading" className="mb-6">
      {/* Section header */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow">
        <h3 id="evento-section-heading" className="text-black font-bold m-0">
          EVENTO: {bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO'}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-4 p-4">
        {/* Event selector */}
        <div className="flex items-center gap-2">
          <div>
            <label
              htmlFor="evento-selector"
              className="block text-red-600 font-bold mb-1"
            >
              EVENTO
            </label>
            <select
              id="evento-selector"
              value={selectedEvento}
              onChange={handleChange}
              disabled={bloqueado}
              className={`w-[250px] text-red-600 text-lg border border-gray-300 rounded p-2
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${bloqueado ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label="Seleccionar evento activo"
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>
                  {eventos[i]?.nevento || `Evento ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
          {!bloqueado && (
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
        <p className="text-black text-2xl font-bold text-center">
          {currentEvento.nferia}
          {currentEvento.nferia && currentEvento.nlugar && <br />}
          {currentEvento.nlugar}
        </p>

        {/* Stamp model previews */}
        <div className="flex flex-row gap-8 flex-wrap justify-center">
          {/* Model 1 (left / printer 1) */}
          <div className="flex flex-col items-center">
            <p className="text-black text-xl font-bold text-center">
              {currentEvento.motivoi || 'Modelo 1'}
            </p>
            <div className="relative w-[350px] h-[160px] border border-gray-200 rounded overflow-hidden bg-gray-50">
              {modelo1Url ? (
                <img
                  src={modelo1Url}
                  alt={currentEvento.motivoi || 'Modelo izquierdo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Sin imagen
                </div>
              )}
              {/* Overlay with event date and locality */}
              <p className="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                &nbsp;&nbsp;&nbsp;{currentEvento.fecha}
                {currentEvento.fecha && currentEvento.localidad && <br />}
                {currentEvento.localidad}
              </p>
            </div>
          </div>

          {/* Model 2 (right / printer 2) */}
          <div className="flex flex-col items-center">
            <p className="text-black text-xl font-bold text-center">
              {currentEvento.motivod || 'Modelo 2'}
            </p>
            <div className="relative w-[350px] h-[160px] border border-gray-200 rounded overflow-hidden bg-gray-50">
              {modelo2Url ? (
                <img
                  src={modelo2Url}
                  alt={currentEvento.motivod || 'Modelo derecho'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Sin imagen
                </div>
              )}
              {/* Overlay with event date and locality */}
              <p className="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                &nbsp;&nbsp;&nbsp;{currentEvento.fecha}
                {currentEvento.fecha && currentEvento.localidad && <br />}
                {currentEvento.localidad}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
