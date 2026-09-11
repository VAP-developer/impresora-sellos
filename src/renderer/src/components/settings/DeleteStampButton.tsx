/**
 * DeleteStampButton — Lets the user delete an existing stamp from the cloud.
 * Shows a dropdown of the stamps currently in the local database, requires
 * confirmation, and triggers a refresh on completion.
 */

import { useState, useEffect, useCallback } from 'react'

interface DeleteStampButtonProps {
  disabled?: boolean
  onDeleteComplete?: () => void
}

interface StampOption {
  stampId: string
  year: string
  stampName: string
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

export function DeleteStampButton({
  disabled,
  onDeleteComplete
}: DeleteStampButtonProps): JSX.Element {
  const [stamps, setStamps] = useState<StampOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const loadStamps = useCallback(async (): Promise<void> => {
    try {
      const all = await window.electronAPI.stamps.getAll()
      setStamps(all.map((s) => ({ stampId: s.stampId, year: s.year, stampName: s.stampName })))
    } catch {
      setStamps([])
    }
  }, [])

  useEffect(() => {
    loadStamps()
  }, [loadStamps])

  async function handleDelete(): Promise<void> {
    if (deleting || disabled || !selectedId) return

    const selected = stamps.find((s) => s.stampId === selectedId)
    if (!selected) return

    const confirmed = window.confirm(
      `¿Seguro que desea borrar el sello "${selected.stampName}" (${selected.year})?\n\nEsta acción elimina las imágenes de la nube y no se puede deshacer.`
    )
    if (!confirmed) return

    setDeleting(true)
    setFeedback(null)

    try {
      const res = await window.electronAPI.stamps.delete({
        year: selected.year,
        stampName: selected.stampName
      })

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `\u2713 Sello "${selected.stampName}" borrado`
        })
        setSelectedId('')
        onDeleteComplete?.()
        loadStamps()
      } else if (res.blocked || res.error === 'AUTH_FAILED') {
        setFeedback({ type: 'error', message: 'Aplicación bloqueada. Contacte con soporte.' })
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error desconocido durante el borrado.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión. Compruebe su acceso a internet.' })
    } finally {
      setDeleting(false)
    }
  }

  const isDisabled = deleting || disabled
  const noStamps = stamps.length === 0

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-700">Borrar un sello</p>

      {noStamps ? (
        <p className="text-xs text-gray-500">No hay sellos para borrar.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isDisabled}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
          >
            <option value="">Seleccione un sello...</option>
            {stamps.map((s) => (
              <option key={s.stampId} value={s.stampId}>
                {s.year} — {s.stampName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDisabled || !selectedId}
            className={`inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isDisabled || !selectedId ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {deleting ? 'Borrando...' : 'Borrar sello'}
          </button>
        </div>
      )}

      {feedback && (
        <p
          className={`text-sm font-medium ${
            feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
