/**
 * PrinterControls.tsx
 *
 * Pause/Resume buttons for printers.
 * Moved from KioskoView to ImprimirView for better UX separation.
 */

import { useCallback } from 'react'
import { usePrinterStore } from '@renderer/stores/printer.store'

export default function PrinterControls(): JSX.Element {
  const pause = usePrinterStore((state) => state.pause)
  const resume = usePrinterStore((state) => state.resume)
  const loading = usePrinterStore((state) => state.loading)
  const printers = usePrinterStore((state) => state.printers)

  const anyPaused = (printers ?? []).some((p) => p.status === 'paused')

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
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600
                   text-white rounded font-medium cursor-pointer
                   transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Pausar impresora"
        disabled={loading}
        onClick={handlePause}
      >
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
        Pausar
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 px-4 py-2 bg-blue-700 hover:bg-blue-800
                   text-white rounded font-medium cursor-pointer
                   transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Reanudar impresora"
        disabled={loading || !anyPaused}
        onClick={handleResume}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
        Reanudar
      </button>
    </div>
  )
}
