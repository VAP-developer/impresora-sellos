/**
 * RollCounters.tsx
 *
 * Footer component for the Kiosko view displaying roll stock counters.
 * Shows remaining etiquetas for rollo1 (left model), rollo2 (right model),
 * and remaining tickets, along with the amounts consumed in the current
 * basket selection (labeled "Venta") and used tickets (labeled "Utilizados").
 *
 * Replicates the footer section from the legacy KioskoView.vue:
 *   - Left:   remainingRollo1 "nombreModelo1" (Venta: usedRollo1)
 *   - Center: Tickets: remainingTickets (Utilizados: usedTickets)
 *   - Right:  remainingRollo2 "nombreModelo2" (Venta: usedRollo2)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6
 * Correctness Properties: 5 (roll decrement tracking)
 */

import { useMemo } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'

// ─── Component ────────────────────────────────────────────────────────────────

export default function RollCounters(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const getUsedRollo1 = useKioskoStore((state) => state.getUsedRollo1)
  const getUsedRollo2 = useKioskoStore((state) => state.getUsedRollo2)
  const getUsedTickets = useKioskoStore((state) => state.getUsedTickets)
  const getRemainingRollo1 = useKioskoStore((state) => state.getRemainingRollo1)
  const getRemainingRollo2 = useKioskoStore((state) => state.getRemainingRollo2)
  const getRemainingTickets = useKioskoStore((state) => state.getRemainingTickets)
  const quantities = useKioskoStore((state) => state.quantities)

  const ticket = config?.ticket
  const sello = config?.sello

  // Model names from the active event
  const nombreModelo1 = useMemo(() => {
    if (!sello) return ''
    const idx = sello.elevento ?? 0
    const evento = sello.eventos?.[idx]
    return evento?.motivoi ?? ''
  }, [sello])

  const nombreModelo2 = useMemo(() => {
    if (!sello) return ''
    const idx = sello.elevento ?? 0
    const evento = sello.eventos?.[idx]
    return evento?.motivod ?? ''
  }, [sello])

  // Computed stock values (depend on quantities for "used" amounts)
  const usedRollo1 = useMemo(() => getUsedRollo1(), [quantities, getUsedRollo1])
  const usedRollo2 = useMemo(() => getUsedRollo2(), [quantities, getUsedRollo2])
  const usedTickets = useMemo(() => getUsedTickets(), [quantities, getUsedTickets])

  const remainingRollo1 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo1(ticket)
  }, [ticket, quantities, getRemainingRollo1])

  const remainingRollo2 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo2(ticket)
  }, [ticket, quantities, getRemainingRollo2])

  const remainingTickets = useMemo(() => {
    if (!ticket) return 0
    return getRemainingTickets(ticket)
  }, [ticket, quantities, getRemainingTickets])

  // Determine if a roll is removed (value -1 means not installed)
  const rollo1Installed = (ticket?.rollo1 ?? 0) !== -1
  const rollo2Installed = (ticket?.rollo2 ?? 0) !== -1

  return (
    <div
      className="flex justify-center items-center pt-2"
      role="region"
      aria-label="Contadores de rollos"
    >
      {/* Roll 1 (left / modelo1) */}
      <div
        className="flex-1 text-center text-[rgb(24,62,117)] text-lg"
        aria-label={`Rollo 1: ${rollo1Installed ? remainingRollo1 + ' etiquetas restantes' : 'no instalado'}`}
      >
        {rollo1Installed ? (
          <>
            <span className="font-bold">{remainingRollo1}</span>
            {' "'}
            <span className="font-medium">{nombreModelo1}</span>
            {'" '}
            <span className="text-sm">(Venta: {usedRollo1})</span>
          </>
        ) : (
          <span className="text-gray-400 italic">Rollo 1 no instalado</span>
        )}
      </div>

      {/* Tickets (center) */}
      <div
        className="flex-1 text-center text-[rgb(24,62,117)]"
        aria-label={`Tickets: ${remainingTickets} restantes, ${usedTickets} utilizados`}
      >
        <span>Tickets: </span>
        <span className="font-bold">{remainingTickets}</span>
        <span className="text-sm"> (Utilizados: {usedTickets})</span>
      </div>

      {/* Roll 2 (right / modelo2) */}
      <div
        className="flex-1 text-center text-[rgb(24,62,117)] text-lg"
        aria-label={`Rollo 2: ${rollo2Installed ? remainingRollo2 + ' etiquetas restantes' : 'no instalado'}`}
      >
        {rollo2Installed ? (
          <>
            <span className="font-bold">{remainingRollo2}</span>
            {' "'}
            <span className="font-medium">{nombreModelo2}</span>
            {'" '}
            <span className="text-sm">(Venta: {usedRollo2})</span>
          </>
        ) : (
          <span className="text-gray-400 italic">Rollo 2 no instalado</span>
        )}
      </div>
    </div>
  )
}
