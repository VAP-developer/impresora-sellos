import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadCSV } from '../lib/ipc-client'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../components/ui/tooltip'

/**
 * HomeView — Main menu screen replicating the legacy HomeView.vue layout.
 *
 * Provides navigation to:
 * - /imprimir (Configuración: perfil, evento, tarifas)
 * - /maquina (Máquina: código etiqueta, ticket, rollos)
 *
 * Also provides an export CSV button (replicating legacy "exportarXLS")
 * that triggers a file download of all order records.
 */
export default function HomeView(): JSX.Element {
  const navigate = useNavigate()
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
      console.error('[HomeView] Error exporting CSV:', err)
      setExportError('Error al exportar. Inténtelo de nuevo.')
    } finally {
      setExporting(false)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col items-center justify-center min-h-full px-4 py-8 gap-8">
        {/* Section headers */}
        <div className="flex w-full max-w-3xl justify-between items-center">
          <h2 className="text-xl font-normal text-[#212F5D] text-center flex-1">CONFIGURACIÓN</h2>
          <div className="flex-1" />
          <h2 className="text-xl font-normal text-[#212F5D] text-center flex-1">MÁQUINA</h2>
        </div>

        {/* Navigation buttons row */}
        <div className="flex w-full max-w-3xl justify-center items-center gap-4">
          {/* Imprimir (Configuración) button */}
          <button
            className="flex-[2] flex justify-center items-center cursor-pointer bg-transparent border-none p-4 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Configuración de impresión"
            onClick={() => navigate('/imprimir')}
          >
            <ConfigIcon />
          </button>

          {/* App version/changelog tooltip (replicating legacy) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-gray-500 cursor-help text-sm select-none">app</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="w-72 whitespace-pre-line">
              {'----------------------------------\n'}
              {'MEJORAS\n'}
              {'----------------------------------\n'}
              {'Electron + React + SQLite\n'}
              {'TICKET por cada TIRA\n'}
              {'N. TICKETS: NO resta con Perfiles= ESPORÁDICOS y ABONO\n'}
              {'LÍMITE IMPORTE: Perfil FERIA\n'}
              {'NUEVO LÍMITE IMPORTE: Resto de PERFILES\n'}
              {'LONGITUD TICKETS: El CORTE se ajusta según conceptos\n'}
              {'BASES DE DATOS: Perfiles - Eventos\n'}
              {'BLOQUEO DE EVENTO: Hasta quitar rollos\n'}
              {'ANULACIÓN VENTA: casos de error de impresión\n'}
              {'KIOSCO ACCESOS DIRECTOS: Cesta - Filatelia - Protocolo\n'}
              {'SIMULACIONES: Texto y Códigos actuales en ETIQUETAS\n'}
              {'MENSAJES de AYUDA\n'}
              {'-------------------------------------------\n'}
              {'v2.0 (Electron/React/SQLite)\n'}
              {'------------------------------------------'}
            </TooltipContent>
          </Tooltip>

          {/* Export CSV button (replicating legacy XLS export) */}
          <button
            className="flex-1 flex flex-col justify-center items-center cursor-pointer bg-transparent border-none p-4 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Exportar informe CSV"
            onClick={handleExportCSV}
            disabled={exporting}
          >
            <ExportIcon />
            <span className="text-xs text-gray-500 mt-1 font-bold">
              {exporting ? 'EXPORTANDO...' : 'EXPORTAR CSV'}
            </span>
          </button>

          {/* Info tooltip for export instructions (replicating legacy) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-gray-500 cursor-help text-sm select-none">i</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="w-64 whitespace-pre-line">
              {'----------------------------------\n'}
              {'INFORME: EXPORTAR CSV\n'}
              {'----------------------------------\n'}
              {'1 - Pulsar botón EXPORTAR CSV\n'}
              {'2 - Se descarga fichero reporte-ATM.csv\n'}
              {'3 - Abrir con Excel o Numbers\n'}
              {'----------------------------------\n'}
              {'Los acentos y formatos de columnas se mantienen\n'}
              {'----------------------------------'}
            </TooltipContent>
          </Tooltip>

          {/* Maquina button */}
          <button
            className="flex-[2] flex justify-center items-center cursor-pointer bg-transparent border-none p-4 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Configuración de máquina"
            onClick={() => navigate('/maquina')}
          >
            <MaquinaIcon />
          </button>
        </div>

        {/* Export error message */}
        {exportError && (
          <p className="text-red-500 text-sm" role="alert">
            {exportError}
          </p>
        )}

        {/* Description labels */}
        <div className="flex w-full max-w-3xl justify-between items-start">
          <p className="text-gray-500 text-sm font-bold text-center flex-1">
            PERFIL
            <br />
            EVENTO
            <br />
            TARIFAS
          </p>
          <p className="text-gray-500 text-sm font-bold text-center flex-1">
            INFORME
            <br />
            VENTAS
          </p>
          <p className="text-gray-500 text-sm font-bold text-center flex-1">
            CÓDIGO ETIQUETA
            <br />
            TICKET
            <br />
            ROLLOS
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}

/* ─── Inline SVG Icons (large, matching legacy icon sizing) ─────────────── */

function ExportIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-[#212F5D]"
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

function ConfigIcon(): JSX.Element {
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
      {/* Printer with settings gear — represents print configuration */}
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
      {/* Small gear overlay */}
      <circle cx="19" cy="5" r="2" strokeWidth={1} />
      <path d="M19 3v-1M19 8v-1M21 5h1M16 5h1" strokeWidth={0.8} />
    </svg>
  )
}

function MaquinaIcon(): JSX.Element {
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
      {/* Machine/chip icon — represents machine configuration */}
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  )
}
