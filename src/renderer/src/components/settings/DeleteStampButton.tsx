/**
 * DeleteStampButton — Lets the user delete an existing stamp from the cloud.
 * Deletion is a two-step selection: first pick a year (only years that have
 * stamps are shown), then pick the stamp within that year. Requires
 * confirmation and triggers a refresh on completion.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [stamps, setStamps] = useState<StampOption[]>([])
  const [selectedYear, setSelectedYear] = useState('')
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

  // Distinct years that have at least one stamp, sorted descending (newest first).
  const years = useMemo(() => {
    const unique = Array.from(new Set(stamps.map((s) => s.year)))
    return unique.sort((a, b) => b.localeCompare(a))
  }, [stamps])

  // Stamps for the currently selected year, sorted by name.
  const stampsForYear = useMemo(() => {
    if (!selectedYear) return []
    return stamps
      .filter((s) => s.year === selectedYear)
      .sort((a, b) => a.stampName.localeCompare(b.stampName))
  }, [stamps, selectedYear])

  function handleYearChange(year: string): void {
    setSelectedYear(year)
    setSelectedId('')
    setFeedback(null)
  }

  async function handleDelete(): Promise<void> {
    if (deleting || disabled || !selectedId) return

    const selected = stamps.find((s) => s.stampId === selectedId)
    if (!selected) return

    const confirmed = window.confirm(
      t('stampDb.delete.confirm', { name: selected.stampName, year: selected.year })
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
          message: t('stampDb.delete.success', { name: selected.stampName })
        })
        setSelectedId('')
        onDeleteComplete?.()
        loadStamps()
      } else if (res.blocked || res.error === 'AUTH_FAILED') {
        setFeedback({ type: 'error', message: t('stampDb.delete.blocked') })
      } else {
        setFeedback({ type: 'error', message: res.error || t('stampDb.delete.unknownError') })
      }
    } catch {
      setFeedback({ type: 'error', message: t('stampDb.delete.connError') })
    } finally {
      setDeleting(false)
    }
  }

  const isDisabled = deleting || disabled
  const noStamps = stamps.length === 0

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-700">{t('stampDb.delete.title')}</p>

      {noStamps ? (
        <p className="text-xs text-gray-500">{t('stampDb.delete.noStamps')}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">{t('stampDb.delete.year')}</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                disabled={isDisabled}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
              >
                <option value="">{t('stampDb.delete.selectYear')}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">{t('stampDb.delete.stamp')}</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={isDisabled || !selectedYear}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
              >
                <option value="">
                  {selectedYear ? t('stampDb.delete.selectStamp') : t('stampDb.delete.pickYearFirst')}
                </option>
                {stampsForYear.map((s) => (
                  <option key={s.stampId} value={s.stampId}>
                    {s.stampName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDisabled || !selectedId}
            className={`inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isDisabled || !selectedId ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {deleting ? t('stampDb.delete.deleting') : t('stampDb.delete.delete')}
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
