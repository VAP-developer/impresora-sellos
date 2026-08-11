/**
 * KioskoView.tsx
 *
 * Vista principal de venta. Layout dividido en dos mitades:
 * - Izquierda: Sello A (Modelo 1 / printer1) con su imagen y tabla de tarifas
 * - Derecha: Sello B (Modelo 2 / printer2) con su imagen y tabla de tarifas
 * - Abajo: Controles de impresión y contadores de rollos
 *
 * Dynamically loads the tariff group associated with the active event.
 * Falls back to static TariffTableSplit when no dynamic group is active.
 */

import { useEffect, useMemo } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import { getEventoById, getTariffGroupById } from '@renderer/lib/ipc-client'
import StampModelSingle from '@renderer/components/kiosko/StampModelSingle'
import TariffTableSplit from '@renderer/components/kiosko/TariffTableSplit'
import DynamicTariffTable from '@renderer/components/kiosko/DynamicTariffTable'
import CartControls from '@renderer/components/kiosko/CartControls'

export default function KioskoView(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const setActiveTariffGroup = useKioskoStore((state) => state.setActiveTariffGroup)
  const setActiveEvento = useKioskoStore((state) => state.setActiveEvento)
  const getRemainingRollo1 = useKioskoStore((state) => state.getRemainingRollo1)
  const getRemainingRollo2 = useKioskoStore((state) => state.getRemainingRollo2)
  const quantities = useKioskoStore((state) => state.quantities)

  const ticket = config?.ticket

  // Roll remaining values for display next to stamps
  const remainingRollo1 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo1(ticket)
  }, [ticket, quantities, getRemainingRollo1])

  const remainingRollo2 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo2(ticket)
  }, [ticket, quantities, getRemainingRollo2])

  const rollo1Installed = (ticket?.rollo1 ?? 0) !== -1
  const rollo2Installed = (ticket?.rollo2 ?? 0) !== -1

  // Load the tariff group from the active event when the view mounts
  // or when the active event changes (config.sello.elevento)
  const activeEventId = config?.sello.elevento ?? 0

  useEffect(() => {
    let cancelled = false

    async function loadTariffGroup(): Promise<void> {
      if (!activeEventId || activeEventId <= 0) {
        setActiveTariffGroup(null)
        setActiveEvento(null)
        return
      }

      try {
        const evento = await getEventoById(activeEventId)
        if (cancelled) return

        if (!evento || !evento.tariff_group_id) {
          setActiveTariffGroup(null)
          setActiveEvento(null)
          return
        }

        const group = await getTariffGroupById(evento.tariff_group_id)
        if (cancelled) return

        setActiveTariffGroup(group)
        setActiveEvento(evento)
      } catch {
        // If loading fails, fall back to no dynamic group
        if (!cancelled) {
          setActiveTariffGroup(null)
          setActiveEvento(null)
        }
      }
    }

    loadTariffGroup()

    return () => {
      cancelled = true
    }
  }, [activeEventId, setActiveTariffGroup, setActiveEvento])

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-auto">
      {/* Top: Roll1 counter | Sello A | Cart Controls | Sello B | Roll2 counter */}
      <div className="flex items-center justify-center gap-4 bg-white rounded px-8 py-3">
        {/* Roll 1 remaining - left of Sello A */}
        <div className="flex flex-col items-center justify-center min-w-[50px]">
          <span className="text-xs text-gray-500 font-medium">Rollo</span>
          <span className={`text-2xl font-bold ${rollo1Installed ? 'text-[rgb(24,62,117)]' : 'text-gray-400'}`}>
            {rollo1Installed ? remainingRollo1 : 0}
          </span>
        </div>

        <StampModelSingle model="A" />
        <CartControls />
        <StampModelSingle model="B" />

        {/* Roll 2 remaining - right of Sello B */}
        <div className="flex flex-col items-center justify-center min-w-[50px]">
          <span className="text-xs text-gray-500 font-medium">Rollo</span>
          <span className={`text-2xl font-bold ${rollo2Installed ? 'text-[rgb(24,62,117)]' : 'text-gray-400'}`}>
            {rollo2Installed ? remainingRollo2 : 0}
          </span>
        </div>
      </div>

      {/* Middle: tariff tables - dynamic when group is active, static otherwise */}
      {activeTariffGroup ? <DynamicTariffTable /> : <TariffTableSplit />}
    </div>
  )
}
