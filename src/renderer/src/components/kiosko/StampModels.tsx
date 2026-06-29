/**
 * StampModels.tsx
 *
 * Displays the two stamp model previews (modelo1 = left/printer1, modelo2 = right/printer2)
 * with their background images and label code overlay.
 *
 * Replicates the top section of the legacy KioskoView.vue where the two modelo images
 * are shown with the event date, locality, and formatted label code superimposed.
 * Includes Pause/Resume printer buttons above modelo1 (matching legacy placement).
 *
 * The images are loaded from the database via IPC (getImageByName). If the image
 * is not found, a placeholder with the model name is shown instead.
 *
 * Validates: Requirements 8.6, 8.7, 14.3, 14.4 (printer pause/resume + image display)
 */

import { useCallback, useEffect, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { usePrinterStore } from '@renderer/stores/printer.store'
import { formatLabelCode } from '@renderer/lib/code-formatter'
import * as ipc from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelPreviewProps {
  /** Model name (motivo name from the active event) */
  modelName: string
  /** Label to show: "Modelo 1" or "Modelo 2" */
  label: string
  /** Event date text from the active event */
  fecha: string
  /** Locality text from the active event */
  localidad: string
  /** Formatted label code preview string */
  codePreview: string | null
}

// ─── Sub-component: Single Model Preview ──────────────────────────────────────

function ModelPreview({
  modelName,
  label,
  fecha,
  localidad,
  codePreview
}: ModelPreviewProps): JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadImage(): Promise<void> {
      if (!modelName) {
        setImageUrl(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await ipc.getImageByName(modelName)
        if (!cancelled) {
          setImageUrl(result?.url ?? null)
        }
      } catch {
        if (!cancelled) {
          setImageUrl(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadImage()
    return () => {
      cancelled = true
    }
  }, [modelName])

  return (
    <div className="flex flex-col items-center flex-1">
      <div className="relative mt-2">
        {/* Model image or placeholder */}
        {loading ? (
          <div className="w-[300px] h-[136px] bg-gray-200 animate-pulse rounded flex items-center justify-center">
            <span className="text-gray-400 text-sm">Cargando...</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-[300px] h-auto rounded shadow-sm"
          />
        ) : (
          <div className="w-[300px] h-[136px] bg-gray-300 rounded flex items-center justify-center border border-gray-400">
            <span className="text-gray-600 text-sm font-medium">{modelName || 'Sin modelo'}</span>
          </div>
        )}

        {/* Overlay: event date + locality + code preview */}
        <div className="mt-1 text-center">
          <p className="text-black text-sm font-bold leading-tight">
            {fecha}
          </p>
          <p className="text-black text-sm font-bold leading-tight">
            {localidad}
          </p>
          {codePreview && (
            <p className="text-black text-xs font-bold mt-1">
              {codePreview}
            </p>
          )}
        </div>
      </div>

      {/* Model name caption */}
      <p className="text-xs text-gray-500 mt-1 font-medium">
        {label}: {modelName || '—'}
      </p>
    </div>
  )
}

// ─── Sub-component: Printer Controls (Pause / Resume) ─────────────────────────

/**
 * PrinterControls renders Pause and Resume buttons for the printers.
 * Placed above Modelo 1 replicating the legacy KioskoView.vue layout.
 *
 * - "Pausar impresora" stops sending jobs without losing pending work.
 * - "Reanudar impresora" resends pending jobs accumulated during pause.
 *
 * Validates: Requirements 8.6, 8.7 (pause/resume printer functionality)
 */
function PrinterControls(): JSX.Element {
  const pause = usePrinterStore((state) => state.pause)
  const resume = usePrinterStore((state) => state.resume)
  const loading = usePrinterStore((state) => state.loading)
  const printers = usePrinterStore((state) => state.printers)

  // Determine if any printer is currently paused
  const anyPaused = printers.some((p) => p.status === 'paused')

  const handlePause = useCallback(async () => {
    try {
      await pause()
    } catch (err) {
      console.error('[PrinterControls] Error pausing printer:', err)
    }
  }, [pause])

  const handleResume = useCallback(async () => {
    try {
      await resume()
    } catch (err) {
      console.error('[PrinterControls] Error resuming printer:', err)
    }
  }, [resume])

  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600
                   text-white rounded text-sm font-medium cursor-pointer
                   transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Pausar impresora"
        disabled={loading}
        onClick={handlePause}
      >
        {/* Pause icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        Pausar impresora
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-700 hover:bg-blue-800
                   text-white rounded text-sm font-medium cursor-pointer
                   transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Reanudar impresora"
        disabled={loading || !anyPaused}
        onClick={handleResume}
      >
        {/* Play icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
        Reanudar impresora
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StampModels(): JSX.Element {
  const config = useConfigStore((state) => state.config)

  // Derive active event data from config
  const activeEvent = config?.sello?.eventos?.[config.sello.elevento ?? 0] ?? null

  const modelo1Name = activeEvent?.motivoi ?? config?.sello?.modelo1 ?? ''
  const modelo2Name = activeEvent?.motivod ?? config?.sello?.modelo2 ?? ''
  const fecha = activeEvent?.fecha ?? ''
  const localidad = activeEvent?.localidad ?? ''

  // Format the label code preview using the current config
  const codePreview = config?.codigo ? formatLabelCode(config.codigo) : null

  return (
    <div className="flex items-center justify-center bg-white rounded px-4 py-2">
      {/* Modelo 1 (left / printer 1) with printer controls above */}
      <div className="flex flex-col items-center flex-1">
        <PrinterControls />
        <ModelPreview
          modelName={modelo1Name}
          label="Modelo 1"
          fecha={fecha}
          localidad={localidad}
          codePreview={codePreview}
        />
      </div>

      {/* Modelo 2 (right / printer 2) */}
      <ModelPreview
        modelName={modelo2Name}
        label="Modelo 2"
        fecha={fecha}
        localidad={localidad}
        codePreview={codePreview}
      />
    </div>
  )
}
