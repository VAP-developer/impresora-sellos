/**
 * PrinterSelector.tsx
 *
 * Component that allows the user to select which physical printer is assigned
 * to each target role (printer1, printer2, ticket). Shows the current assignment,
 * a dropdown with discovered printers, and a busy/status indicator.
 *
 * Placed in the Kiosko view to enable quick switching if a printer is busy or unavailable.
 */

import { useCallback, useEffect, useState } from 'react'
import { usePrinterStore, type PrinterTarget } from '@renderer/stores/printer.store'

// ─── Status indicator colors ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-green-500',
  busy: 'bg-yellow-500 animate-pulse',
  error: 'bg-red-500',
  disconnected: 'bg-gray-400',
  paused: 'bg-blue-400'
}

const STATUS_LABELS: Record<string, string> = {
  ready: 'Lista',
  busy: 'En uso',
  error: 'Error',
  disconnected: 'Desconectada',
  paused: 'Pausada'
}

// ─── Single printer target row ────────────────────────────────────────────────

interface PrinterTargetRowProps {
  target: PrinterTarget
  label: string
}

function PrinterTargetRow({ target, label }: PrinterTargetRowProps): JSX.Element {
  const printers = usePrinterStore((s) => s.printers)
  const discovered = usePrinterStore((s) => s.discovered)
  const assignments = usePrinterStore((s) => s.assignments)
  const assign = usePrinterStore((s) => s.assign)
  const loading = usePrinterStore((s) => s.loading)

  // Find the current printer info for this target
  const currentPrinter = printers.find((p) => p.target === target)
  const currentUri = assignments[target] ?? currentPrinter?.uri ?? ''
  const status = currentPrinter?.status ?? 'disconnected'

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newUri = e.target.value
      if (newUri && newUri !== currentUri) {
        await assign(target, newUri)
      }
    },
    [target, currentUri, assign]
  )

  // Build options: current assignment + discovered printers (deduplicated)
  const options = discovered.filter((d) => d.accepting)
  const currentInList = options.some((d) => d.uri === currentUri)

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Status indicator dot */}
      <span
        className={`w-3 h-3 rounded-full shrink-0 ${STATUS_COLORS[status] ?? 'bg-gray-400'}`}
        title={STATUS_LABELS[status] ?? status}
        aria-label={`Estado: ${STATUS_LABELS[status] ?? status}`}
      />

      {/* Target label */}
      <span className="text-xs font-semibold text-gray-700 w-20 shrink-0">{label}</span>

      {/* Printer selector dropdown */}
      <select
        className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5
                   bg-white text-gray-800 truncate
                   focus:outline-none focus:ring-1 focus:ring-blue-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
        value={currentUri}
        onChange={handleChange}
        disabled={loading}
        aria-label={`Seleccionar impresora para ${label}`}
      >
        {/* Show current assignment even if not in discovered list */}
        {!currentInList && currentUri && (
          <option value={currentUri}>
            {currentPrinter?.name ?? currentUri}
          </option>
        )}
        {!currentUri && (
          <option value="">Sin asignar</option>
        )}
        {options.map((printer) => (
          <option key={printer.uri} value={printer.uri}>
            {printer.name} {printer.info ? `(${printer.info})` : ''}
          </option>
        ))}
      </select>

      {/* Busy indicator badge */}
      {status === 'busy' && (
        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium animate-pulse">
          EN USO
        </span>
      )}
      {status === 'error' && (
        <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium">
          ERROR
        </span>
      )}
    </div>
  )
}

// ─── Main PrinterSelector component ──────────────────────────────────────────

export default function PrinterSelector(): JSX.Element {
  const discover = usePrinterStore((s) => s.discover)
  const fetchStatus = usePrinterStore((s) => s.fetchStatus)
  const fetchAssignments = usePrinterStore((s) => s.fetchAssignments)
  const discovering = usePrinterStore((s) => s.discovering)
  const discovered = usePrinterStore((s) => s.discovered)
  const [expanded, setExpanded] = useState(false)

  // Fetch status and assignments on mount
  useEffect(() => {
    fetchStatus()
    fetchAssignments()
  }, [fetchStatus, fetchAssignments])

  // Poll printer status every 5 seconds when expanded
  useEffect(() => {
    if (!expanded) return undefined
    const interval = setInterval(() => {
      fetchStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [expanded, fetchStatus])

  const handleDiscover = useCallback(async () => {
    await discover()
  }, [discover])

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      if (!prev) {
        // Auto-discover when opening for the first time
        if (discovered.length === 0) {
          discover()
        }
      }
      return !prev
    })
  }, [discover, discovered.length])

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-2 w-full">
      {/* Header with toggle */}
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left cursor-pointer
                   hover:bg-gray-100 rounded px-1 py-0.5 transition-colors
                   focus:outline-none focus:ring-1 focus:ring-blue-400"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls="printer-selector-panel"
      >
        {/* Printer icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 text-gray-600"
          aria-hidden="true"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        <span className="text-xs font-bold text-gray-700 flex-1">
          Seleccionar Impresoras
        </span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable panel */}
      {expanded && (
        <div id="printer-selector-panel" className="mt-2 space-y-1" role="region" aria-label="Selector de impresoras">
          {/* Target rows */}
          <PrinterTargetRow target="printer1" label="Sellos Mod.1" />
          <PrinterTargetRow target="printer2" label="Sellos Mod.2" />
          <PrinterTargetRow target="ticket" label="Tickets" />

          {/* Discover button */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300
                         text-gray-700 rounded text-[11px] font-medium cursor-pointer
                         transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400
                         disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDiscover}
              disabled={discovering}
              aria-label="Buscar impresoras disponibles"
            >
              {discovering ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Buscando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Buscar impresoras
                </>
              )}
            </button>
          </div>

          {/* Count of discovered printers */}
          {discovered.length > 0 && (
            <p className="text-[10px] text-gray-500 text-center">
              {discovered.length} impresora{discovered.length !== 1 ? 's' : ''} encontrada{discovered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
