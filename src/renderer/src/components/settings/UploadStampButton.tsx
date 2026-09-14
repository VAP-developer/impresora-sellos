/**
 * UploadStampButton — Lets the user upload their own stamp images (fondo + sello)
 * to the cloud, with a year field (2020-2100) and a name field.
 *
 * Security rules (also shown to the user in StampDatabaseSection):
 * - Exactly 2 files: one "*-fondo.jpg" and one "*-sello.png".
 * - Year between 2020 and 2100.
 * - The name field defines the stamp name in the database.
 * - If the name already exists for that year, the upload is blocked and the
 *   user is told to delete the existing stamp first before making changes.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface UploadStampButtonProps {
  disabled?: boolean
  onUploadComplete?: () => void
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

const MIN_YEAR = 2020
const MAX_YEAR = 2100

export function UploadStampButton({
  disabled,
  onUploadComplete
}: UploadStampButtonProps): JSX.Element {
  const { t } = useTranslation()
  const [year, setYear] = useState('')
  const [stampName, setStampName] = useState('')
  const [fondoPath, setFondoPath] = useState<string | null>(null)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  function fileName(path: string | null): string {
    if (!path) return ''
    return path.split(/[\\/]/).pop() ?? path
  }

  async function handlePickFiles(): Promise<void> {
    setFeedback(null)
    const res = await window.electronAPI.stamps.pickFiles()
    if (res.error) {
      setFondoPath(null)
      setLogoPath(null)
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFondoPath(res.fondoPath)
    setLogoPath(res.logoPath)
  }

  function validateBeforeUpload(): string | null {
    const trimmedName = stampName.trim()
    if (!/^\d{4}$/.test(year)) return t('stampDb.upload.errYear4')
    const y = Number(year)
    if (y < MIN_YEAR || y > MAX_YEAR) return t('stampDb.upload.errYearRange', { min: MIN_YEAR, max: MAX_YEAR })
    if (!trimmedName) return t('stampDb.upload.errName')
    if (/[\\/]/.test(trimmedName)) return t('stampDb.upload.errNameChars')
    if (!fondoPath || !logoPath) return t('stampDb.upload.errFiles')
    return null
  }

  async function handleUpload(): Promise<void> {
    if (uploading || disabled) return

    const validationError = validateBeforeUpload()
    if (validationError) {
      setFeedback({ type: 'error', message: validationError })
      return
    }

    const trimmedName = stampName.trim()

    // Duplicate check: overwriting an existing stamp is not allowed because it
    // can leave the local DB and the cloud in an inconsistent state. Instead we
    // block the upload and tell the user to delete the existing stamp first.
    try {
      const exists = await window.electronAPI.stamps.existsInYear({ year, stampName: trimmedName })
      if (exists) {
        setFeedback({
          type: 'error',
          message: t('stampDb.upload.duplicate', { name: trimmedName, year })
        })
        return
      }
    } catch {
      // If the check fails, continue; the server remains the source of truth.
    }

    setUploading(true)
    setFeedback(null)

    try {
      const res = await window.electronAPI.stamps.upload({
        year,
        stampName: trimmedName,
        fondoPath: fondoPath as string,
        logoPath: logoPath as string
      })

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: t('stampDb.upload.success', { name: trimmedName, year })
        })
        // Reset selection but keep year for convenience
        setStampName('')
        setFondoPath(null)
        setLogoPath(null)
        onUploadComplete?.()
      } else if (res.blocked || res.error === 'AUTH_FAILED') {
        setFeedback({ type: 'error', message: t('stampDb.upload.blocked') })
      } else {
        setFeedback({ type: 'error', message: res.error || t('stampDb.upload.unknownError') })
      }
    } catch {
      setFeedback({ type: 'error', message: t('stampDb.upload.connError') })
    } finally {
      setUploading(false)
    }
  }

  const isDisabled = uploading || disabled

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-700">{t('stampDb.upload.title')}</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">{t('stampDb.upload.year')}</span>
          <input
            type="number"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={t('stampDb.upload.yearPlaceholder')}
            disabled={isDisabled}
            className="rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">{t('stampDb.upload.name')}</span>
          <input
            type="text"
            value={stampName}
            onChange={(e) => setStampName(e.target.value)}
            placeholder={t('stampDb.upload.namePlaceholder')}
            disabled={isDisabled}
            className="rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePickFiles}
          disabled={isDisabled}
          className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 ${
            isDisabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {t('stampDb.upload.pickFiles')}
        </button>
        <span className="text-xs text-gray-500">
          {fondoPath && logoPath
            ? `${fileName(fondoPath)} + ${fileName(logoPath)}`
            : t('stampDb.upload.noFiles')}
        </span>
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={isDisabled}
        className={`inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
          isDisabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        {uploading ? (
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : null}
        {uploading ? t('stampDb.upload.uploading') : t('stampDb.upload.upload')}
      </button>

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
