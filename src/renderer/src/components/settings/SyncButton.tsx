/**
 * SyncButton — "Sincronizar con la nube" button with loading/error/success states.
 * Supports disabled state with tooltip for offline reason.
 *
 * Requirements: 5.4, 5.5, 5.6, 4.7
 */

import { useState, useEffect, useRef } from 'react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from '@renderer/components/ui/tooltip'

interface SyncButtonProps {
  disabled?: boolean
  offlineReason?: string
  onSyncComplete?: () => void
}

interface SyncResult {
  type: 'success' | 'error'
  message: string
}

export function SyncButton({ disabled, offlineReason, onSyncComplete }: SyncButtonProps): JSX.Element {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [])

  function scheduleDismiss(): void {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setResult(null), 5000)
  }

  async function handleSync(): Promise<void> {
    if (syncing || disabled) return

    setSyncing(true)
    setResult(null)

    try {
      const res = await window.electronAPI.stamps.sync()

      if (res.ok) {
        setResult({
          type: 'success',
          message: `\u2713 Sincronización completada: ${res.added} añadidos, ${res.removed} eliminados (${res.total} total)`
        })
        onSyncComplete?.()
      } else if (res.blocked) {
        setResult({
          type: 'error',
          message: 'Aplicación bloqueada. Contacte con soporte.'
        })
      } else {
        setResult({
          type: 'error',
          message: res.error || 'Error desconocido durante la sincronización.'
        })
      }
    } catch {
      setResult({
        type: 'error',
        message: 'Error de conexión. Compruebe su acceso a internet.'
      })
    } finally {
      setSyncing(false)
      scheduleDismiss()
    }
  }

  const isDisabled = syncing || disabled

  const buttonElement = (
    <button
      type="button"
      onClick={handleSync}
      disabled={isDisabled}
      className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isDisabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {syncing ? (
        /* Spinner icon */
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
      ) : (
        /* Cloud sync icon */
        <svg
          className="h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.32-2.475A3.75 3.75 0 0118 15.75H6.75z"
          />
        </svg>
      )}
      {syncing ? 'Sincronizando...' : 'Sincronizar con la nube'}
    </button>
  )

  return (
    <div className="space-y-2">
      {disabled && offlineReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">{buttonElement}</span>
            </TooltipTrigger>
            <TooltipContent>{offlineReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        buttonElement
      )}

      {result && (
        <p
          className={`text-sm font-medium ${
            result.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
