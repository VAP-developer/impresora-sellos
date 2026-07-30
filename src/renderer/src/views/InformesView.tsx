import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadCSV } from '../lib/ipc-client'

/**
 * InformesView — Reports screen with CSV export functionality.
 *
 * Provides export functionality for order reports.
 */
export default function InformesView(): JSX.Element {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExportCSV = useCallback(async () => {
    setExportError(null)
    setExporting(true)
    try {
      const fileContent = await downloadCSV()
      if (fileContent) {
        const nameFile = 'reporte-ATM.csv'
        const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nameFile
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[InformesView] Error exporting CSV:', err)
      setExportError('Error al exportar. Inténtelo de nuevo.')
    } finally {
      setExporting(false)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-8 gap-8">
      <h1 className="text-3xl font-bold text-[#212F5D]">{t('nav.reports').toUpperCase()}</h1>

      {/* Export CSV button */}
      <button
        className="flex flex-col justify-center items-center cursor-pointer bg-white border-2 border-gray-300 p-8 rounded-lg hover:bg-gray-50 hover:border-[#212F5D] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        aria-label="Exportar informe CSV"
        onClick={handleExportCSV}
        disabled={exporting}
      >
        <ExportIcon />
        <span className="text-lg text-gray-700 mt-4 font-bold">
          {exporting ? 'EXPORTANDO...' : 'EXPORTAR CSV'}
        </span>
      </button>

      {/* Export error message */}
      {exportError && (
        <p className="text-red-500 text-sm" role="alert">
          {exportError}
        </p>
      )}

      <p className="text-gray-600 text-center max-w-md">
        Exporta todos los registros de órdenes en formato CSV para su análisis en hojas de cálculo.
      </p>
    </div>
  )
}

/* ─── Inline SVG Icon ─────────────────────────────────────────────────── */

function ExportIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-32 h-32 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Document with arrow — represents export/download */}
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 18 15 15" />
    </svg>
  )
}
