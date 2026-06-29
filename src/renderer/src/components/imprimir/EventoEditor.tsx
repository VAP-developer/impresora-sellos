/**
 * EventoEditor.tsx
 *
 * Editor for the selected event's data (one of 8 events, indices 0-7).
 * Replicates the "EDITAR EVENTOS" section from the legacy ImprimirView.vue.
 *
 * Allows the user to select an event to edit via radio buttons, then shows
 * a form with fields: nombre, feria, lugar, fecha, localidad, motivo izquierda,
 * motivo derecha. Includes image previews for both motifs.
 *
 * Validates: Requirement 13.2 (support up to 8 events with editable data)
 * Validates: Requirement 13.3 (changing event updates models in Kiosko)
 */

import { useEffect, useState } from 'react'
import type { EventoData } from '@renderer/types/config'
import { getImageByName } from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventoEditorProps {
  /** Array of 8 events (indices 0-7). */
  eventos: EventoData[]
  /** Callback when an event's data is modified. */
  onEventoDataChange: (index: number, field: keyof EventoData, value: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventoEditor({
  eventos,
  onEventoDataChange
}: EventoEditorProps): JSX.Element {
  // Which event is currently being edited (-1 = none)
  const [editingEvent, setEditingEvent] = useState<number>(-1)

  // Image preview URLs for the event being edited
  const [motivoiUrl, setMotivoiUrl] = useState<string | null>(null)
  const [motivodUrl, setMotivodUrl] = useState<string | null>(null)

  const currentEvento = editingEvent >= 0 && editingEvent <= 7 ? eventos[editingEvent] : null

  // Load motif images when the editing event or its motif names change
  useEffect(() => {
    if (!currentEvento) {
      setMotivoiUrl(null)
      setMotivodUrl(null)
      return
    }

    let cancelled = false

    async function loadImages(): Promise<void> {
      if (!currentEvento) return

      // Load left motif
      if (currentEvento.motivoi) {
        try {
          const img = await getImageByName(currentEvento.motivoi)
          if (!cancelled) setMotivoiUrl(img?.url ?? null)
        } catch {
          if (!cancelled) setMotivoiUrl(null)
        }
      } else {
        if (!cancelled) setMotivoiUrl(null)
      }

      // Load right motif
      if (currentEvento.motivod) {
        try {
          const img = await getImageByName(currentEvento.motivod)
          if (!cancelled) setMotivodUrl(img?.url ?? null)
        } catch {
          if (!cancelled) setMotivodUrl(null)
        }
      } else {
        if (!cancelled) setMotivodUrl(null)
      }
    }

    loadImages()

    return () => {
      cancelled = true
    }
  }, [editingEvent, currentEvento?.motivoi, currentEvento?.motivod])

  const handleFieldChange = (field: keyof EventoData, value: string): void => {
    if (editingEvent >= 0 && editingEvent <= 7) {
      onEventoDataChange(editingEvent, field, value)
    }
  }

  return (
    <section aria-labelledby="evento-editor-heading" className="mb-6">
      {/* Section header */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow">
        <h3 id="evento-editor-heading" className="text-black font-bold m-0">
          EDITAR EVENTOS
        </h3>
      </div>

      {/* Radio buttons to select which event to edit */}
      <div className="flex flex-wrap gap-2 items-center mb-4 p-2">
        <span className="font-bold">SELECCIONE:</span>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="editing-event"
            checked={editingEvent === -1}
            onChange={() => setEditingEvent(-1)}
            aria-label="No editar ningún evento"
          />
          <span className="text-sm">Ninguno</span>
        </label>
        {Array.from({ length: 8 }, (_, i) => (
          <label key={i} className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="editing-event"
              checked={editingEvent === i}
              onChange={() => setEditingEvent(i)}
              aria-label={`Editar evento ${i + 1}`}
            />
            <span className="text-sm">
              {eventos[i]?.nevento || `Evento ${i + 1}`}
            </span>
          </label>
        ))}
      </div>

      {/* Event editing form (visible only when an event is selected) */}
      {currentEvento && editingEvent >= 0 && (
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Event name */}
          <div className="w-[250px]">
            <label
              htmlFor="evento-editor-nombre"
              className="block text-sm text-gray-600"
            >
              Evento {editingEvent + 1}
            </label>
            <input
              id="evento-editor-nombre"
              type="text"
              value={currentEvento.nevento}
              onChange={(e) => handleFieldChange('nevento', e.target.value)}
              className="w-full text-red-600 text-2xl font-bold text-center border border-gray-300 rounded p-2"
              aria-label={`Nombre del evento ${editingEvent + 1}`}
            />
          </div>

          {/* Feria name (for ticket) */}
          <div className="w-[250px]">
            <label
              htmlFor="evento-editor-feria"
              className="block text-sm text-gray-600"
            >
              Feria Ticket
            </label>
            <input
              id="evento-editor-feria"
              type="text"
              value={currentEvento.nferia}
              onChange={(e) => handleFieldChange('nferia', e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>

          {/* Lugar (for ticket) */}
          <div className="w-[250px]">
            <label
              htmlFor="evento-editor-lugar"
              className="block text-sm text-gray-600"
            >
              Lugar Ticket
            </label>
            <input
              id="evento-editor-lugar"
              type="text"
              value={currentEvento.nlugar}
              onChange={(e) => handleFieldChange('nlugar', e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>

          {/* Fecha (for stamp label) */}
          <div className="w-[250px]">
            <label
              htmlFor="evento-editor-fecha"
              className="block text-sm text-gray-600"
            >
              Fechas Etiqueta
            </label>
            <input
              id="evento-editor-fecha"
              type="text"
              value={currentEvento.fecha}
              onChange={(e) => handleFieldChange('fecha', e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>

          {/* Localidad (for stamp label) */}
          <div className="w-[250px]">
            <label
              htmlFor="evento-editor-localidad"
              className="block text-sm text-gray-600"
            >
              Localidad Etiqueta
            </label>
            <input
              id="evento-editor-localidad"
              type="text"
              value={currentEvento.localidad}
              onChange={(e) => handleFieldChange('localidad', e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>

          {/* Motif images (left and right) */}
          <div className="flex gap-4 flex-wrap justify-center">
            {/* Left motif (modelo 1 / printer 1) */}
            <div className="w-[300px]">
              <label
                htmlFor="evento-editor-motivoi"
                className="block text-sm text-gray-600"
              >
                Motivo izquierda
              </label>
              <input
                id="evento-editor-motivoi"
                type="text"
                value={currentEvento.motivoi}
                onChange={(e) => handleFieldChange('motivoi', e.target.value)}
                className="w-full border border-gray-300 rounded p-2 mb-2"
              />
              <div className="w-[300px] h-[140px] border border-gray-200 rounded overflow-hidden bg-gray-50">
                {motivoiUrl ? (
                  <img
                    src={motivoiUrl}
                    alt={`Motivo izquierda: ${currentEvento.motivoi}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>
            </div>

            {/* Right motif (modelo 2 / printer 2) */}
            <div className="w-[300px]">
              <label
                htmlFor="evento-editor-motivod"
                className="block text-sm text-gray-600"
              >
                Motivo derecha
              </label>
              <input
                id="evento-editor-motivod"
                type="text"
                value={currentEvento.motivod}
                onChange={(e) => handleFieldChange('motivod', e.target.value)}
                className="w-full border border-gray-300 rounded p-2 mb-2"
              />
              <div className="w-[300px] h-[140px] border border-gray-200 rounded overflow-hidden bg-gray-50">
                {motivodUrl ? (
                  <img
                    src={motivodUrl}
                    alt={`Motivo derecha: ${currentEvento.motivod}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
