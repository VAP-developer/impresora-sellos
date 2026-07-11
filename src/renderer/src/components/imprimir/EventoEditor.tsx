/**
 * EventoEditor.tsx
 *
 * Editor for events organized by year.
 * Flow:
 * 1. User selects a year (or types a new one)
 * 2. Shows all events for that year + a "Crear nuevo" button
 * 3. If creating new: shows empty form, user fills it and saves
 * 4. If selecting existing: shows form with current data, user can edit or delete
 *
 * Events are persisted in the SQLite `eventos` table via IPC.
 * Includes the new `codigo` field.
 */

import { useCallback, useEffect, useState } from 'react'
import type { EventoRow, EventoInput } from '@renderer/lib/ipc-client'
import {
  getEventoYears,
  getEventosByYear,
  createEvento,
  updateEvento,
  deleteEvento,
  getImageByName
} from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventoEditorProps {
  /** Callback after an event is created/updated/deleted so parent can refresh. */
  onEventosChanged?: () => void
}

type EditorMode = 'idle' | 'creating' | 'editing'

const EMPTY_FORM: EventoInput = {
  year: new Date().getFullYear(),
  codigo: '',
  nevento: '',
  nferia: '',
  nlugar: '',
  motivoi: '',
  motivod: '',
  fecha: '',
  localidad: ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventoEditor({
  onEventosChanged
}: EventoEditorProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  // Year navigation
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [newYearInput, setNewYearInput] = useState('')

  // Events for the selected year
  const [eventosForYear, setEventosForYear] = useState<EventoRow[]>([])

  // Editor state
  const [mode, setMode] = useState<EditorMode>('idle')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<EventoInput>({ ...EMPTY_FORM })

  // Image previews
  const [motivoiUrl, setMotivoiUrl] = useState<string | null>(null)
  const [motivodUrl, setMotivodUrl] = useState<string | null>(null)

  // Status messages
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load years
  const loadYears = useCallback(async () => {
    const yrs = await getEventoYears()
    setYears(yrs)
  }, [])

  // Load events for selected year
  const loadEventos = useCallback(async () => {
    const eventos = await getEventosByYear(selectedYear)
    setEventosForYear(eventos)
  }, [selectedYear])

  useEffect(() => {
    if (expanded) {
      loadYears()
    }
  }, [expanded, loadYears])

  useEffect(() => {
    if (expanded && selectedYear) {
      loadEventos()
    }
  }, [expanded, selectedYear, loadEventos])

  // Load motif images when form changes
  useEffect(() => {
    if (mode === 'idle') {
      setMotivoiUrl(null)
      setMotivodUrl(null)
      return
    }
    let cancelled = false

    async function loadImages(): Promise<void> {
      if (form.motivoi) {
        try {
          const img = await getImageByName(form.motivoi)
          if (!cancelled) setMotivoiUrl(img?.url ?? null)
        } catch {
          if (!cancelled) setMotivoiUrl(null)
        }
      } else {
        if (!cancelled) setMotivoiUrl(null)
      }
      if (form.motivod) {
        try {
          const img = await getImageByName(form.motivod)
          if (!cancelled) setMotivodUrl(img?.url ?? null)
        } catch {
          if (!cancelled) setMotivodUrl(null)
        }
      } else {
        if (!cancelled) setMotivodUrl(null)
      }
    }
    loadImages()
    return () => { cancelled = true }
  }, [mode, form.motivoi, form.motivod])

  const handleToggle = (): void => {
    setExpanded((prev) => !prev)
    if (expanded) {
      // Closing - reset state
      setMode('idle')
      setEditingId(null)
      setMessage(null)
    }
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) {
      setSelectedYear(val)
      setMode('idle')
      setEditingId(null)
      setMessage(null)
    }
  }

  const handleAddYear = (): void => {
    const val = parseInt(newYearInput, 10)
    if (!isNaN(val) && val >= 2000 && val <= 2100) {
      setSelectedYear(val)
      if (!years.includes(val)) {
        setYears((prev) => [val, ...prev].sort((a, b) => b - a))
      }
      setNewYearInput('')
      setMode('idle')
      setMessage(null)
    }
  }

  const handleStartCreate = (): void => {
    setMode('creating')
    setEditingId(null)
    setForm({ ...EMPTY_FORM, year: selectedYear })
    setMessage(null)
  }

  const handleSelectEvento = (evento: EventoRow): void => {
    setMode('editing')
    setEditingId(evento.id)
    setForm({
      year: evento.year,
      codigo: evento.codigo,
      nevento: evento.nevento,
      nferia: evento.nferia,
      nlugar: evento.nlugar,
      motivoi: evento.motivoi,
      motivod: evento.motivod,
      fecha: evento.fecha,
      localidad: evento.localidad
    })
    setMessage(null)
  }

  const handleCancel = (): void => {
    setMode('idle')
    setEditingId(null)
    setMessage(null)
  }

  const handleFieldChange = (field: keyof EventoInput, value: string | number): void => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setMessage(null)
    try {
      if (mode === 'creating') {
        await createEvento(form)
        setMessage({ type: 'success', text: 'Evento creado correctamente' })
      } else if (mode === 'editing' && editingId !== null) {
        await updateEvento(editingId, form)
        setMessage({ type: 'success', text: 'Evento actualizado correctamente' })
      }
      setMode('idle')
      setEditingId(null)
      await loadYears()
      await loadEventos()
      onEventosChanged?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (editingId === null) return
    if (!confirm('¿Está seguro de que desea eliminar este evento?')) return

    setSaving(true)
    setMessage(null)
    try {
      await deleteEvento(editingId)
      setMessage({ type: 'success', text: 'Evento eliminado' })
      setMode('idle')
      setEditingId(null)
      await loadYears()
      await loadEventos()
      onEventosChanged?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  // Generate year options: existing years + ability to add new
  const yearOptions = years.length > 0
    ? years
    : [new Date().getFullYear()]

  return (
    <section aria-labelledby="evento-editor-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-eventos-editor"
          type="checkbox"
          checked={expanded}
          onChange={handleToggle}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="evento-editor-content"
        />
        <label
          htmlFor="toggle-eventos-editor"
          id="evento-editor-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          EDITAR EVENTOS
        </label>
      </div>

      {expanded && (
        <div
          id="evento-editor-content"
          className="p-4"
          role="region"
          aria-labelledby="evento-editor-heading"
        >
          {/* Year selector + add new year */}
          <div className="flex items-end gap-4 mb-4 flex-wrap">
            <div>
              <label htmlFor="editor-year-select" className="block text-sm font-bold text-gray-700 mb-1">
                Año
              </label>
              <select
                id="editor-year-select"
                value={selectedYear}
                onChange={handleYearChange}
                className="w-[120px] border border-gray-300 rounded p-2"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="editor-new-year" className="block text-sm text-gray-600 mb-1">
                  Añadir año
                </label>
                <input
                  id="editor-new-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  placeholder="2027"
                  className="w-[100px] border border-gray-300 rounded p-2"
                />
              </div>
              <button
                type="button"
                onClick={handleAddYear}
                disabled={!newYearInput}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-bold py-2 px-3 rounded"
              >
                +
              </button>
            </div>
          </div>

          {/* Events list for the selected year */}
          {mode === 'idle' && (
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-2">
                <h4 className="font-bold text-gray-700">
                  Eventos de {selectedYear} ({eventosForYear.length})
                </h4>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  + Crear nuevo
                </button>
              </div>

              {eventosForYear.length === 0 ? (
                <p className="text-gray-400 italic">No hay eventos para este año.</p>
              ) : (
                <div className="grid gap-2">
                  {eventosForYear.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleSelectEvento(ev)}
                      className="text-left w-full border border-gray-200 rounded p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <span className="font-bold text-blue-700">{ev.nevento || '(sin nombre)'}</span>
                      {ev.codigo && (
                        <span className="ml-2 text-xs font-mono bg-gray-100 px-1 rounded">{ev.codigo}</span>
                      )}
                      <span className="block text-sm text-gray-500">
                        {ev.nferia} — {ev.nlugar} — {ev.fecha}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status message */}
          {message && (
            <p className={`text-sm mb-3 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}

          {/* Create / Edit form */}
          {(mode === 'creating' || mode === 'editing') && (
            <div className="border border-gray-300 rounded p-4 bg-gray-50">
              <h4 className="font-bold text-lg mb-4">
                {mode === 'creating' ? 'Crear nuevo evento' : 'Editar evento'}
              </h4>

              <div className="grid gap-3 max-w-[500px]">
                {/* Codigo */}
                <div>
                  <label htmlFor="ev-codigo" className="block text-sm text-gray-600">
                    Código
                  </label>
                  <input
                    id="ev-codigo"
                    type="text"
                    value={form.codigo}
                    onChange={(e) => handleFieldChange('codigo', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    placeholder="Ej: FER-MAD-2026"
                  />
                </div>

                {/* Nombre evento */}
                <div>
                  <label htmlFor="ev-nevento" className="block text-sm text-gray-600">
                    Nombre del evento
                  </label>
                  <input
                    id="ev-nevento"
                    type="text"
                    value={form.nevento}
                    onChange={(e) => handleFieldChange('nevento', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-red-600 font-bold"
                    placeholder="Ej: Feria Madrid 2026"
                  />
                </div>

                {/* Feria ticket */}
                <div>
                  <label htmlFor="ev-nferia" className="block text-sm text-gray-600">
                    Feria (para ticket)
                  </label>
                  <input
                    id="ev-nferia"
                    type="text"
                    value={form.nferia}
                    onChange={(e) => handleFieldChange('nferia', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    placeholder="Ej: L Feria Nacional del Sello"
                  />
                </div>

                {/* Lugar ticket */}
                <div>
                  <label htmlFor="ev-nlugar" className="block text-sm text-gray-600">
                    Lugar (para ticket)
                  </label>
                  <input
                    id="ev-nlugar"
                    type="text"
                    value={form.nlugar}
                    onChange={(e) => handleFieldChange('nlugar', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    placeholder="Ej: Plaza Mayor - Madrid"
                  />
                </div>

                {/* Fecha etiqueta */}
                <div>
                  <label htmlFor="ev-fecha" className="block text-sm text-gray-600">
                    Fechas (para etiqueta)
                  </label>
                  <input
                    id="ev-fecha"
                    type="text"
                    value={form.fecha}
                    onChange={(e) => handleFieldChange('fecha', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    placeholder="Ej: 21-24 abril 2026"
                  />
                </div>

                {/* Localidad etiqueta */}
                <div>
                  <label htmlFor="ev-localidad" className="block text-sm text-gray-600">
                    Localidad (para etiqueta)
                  </label>
                  <input
                    id="ev-localidad"
                    type="text"
                    value={form.localidad}
                    onChange={(e) => handleFieldChange('localidad', e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    placeholder="Ej: Madrid"
                  />
                </div>

                {/* Motif images */}
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="ev-motivoi" className="block text-sm text-gray-600">
                      Motivo izquierda
                    </label>
                    <input
                      id="ev-motivoi"
                      type="text"
                      value={form.motivoi}
                      onChange={(e) => handleFieldChange('motivoi', e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 mb-2"
                    />
                    <div className="w-full h-[100px] border border-gray-200 rounded overflow-hidden bg-white">
                      {motivoiUrl ? (
                        <img src={motivoiUrl} alt="Motivo izquierda" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="ev-motivod" className="block text-sm text-gray-600">
                      Motivo derecha
                    </label>
                    <input
                      id="ev-motivod"
                      type="text"
                      value={form.motivod}
                      onChange={(e) => handleFieldChange('motivod', e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 mb-2"
                    />
                    <div className="w-full h-[100px] border border-gray-200 rounded overflow-hidden bg-white">
                      {motivodUrl ? (
                        <img src={motivodUrl} alt="Motivo derecha" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.nevento.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded"
                >
                  {saving ? 'Guardando...' : mode === 'creating' ? 'Crear evento' : 'Guardar cambios'}
                </button>
                {mode === 'editing' && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2 px-4 rounded"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
