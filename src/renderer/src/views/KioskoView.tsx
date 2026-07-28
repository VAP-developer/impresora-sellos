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

import { useEffect } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import { getEventoById, getTariffGroupById } from '@renderer/lib/ipc-client'
import StampModels from '@renderer/components/kiosko/StampModels'
import TariffTableSplit from '@renderer/components/kiosko/TariffTableSplit'
import DynamicTariffTable from '@renderer/components/kiosko/DynamicTariffTable'
import CartControls from '@renderer/components/kiosko/CartControls'
import RollCounters from '@renderer/components/kiosko/RollCounters'

export default function KioskoView(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const setActiveTariffGroup = useKioskoStore((state) => state.setActiveTariffGroup)

  // Load the tariff group from the active event when the view mounts
  // or when the active event changes (config.sello.elevento)
  const activeEventId = config?.sello.elevento ?? 0

  useEffect(() => {
    let cancelled = false

    async function loadTariffGroup(): Promise<void> {
      if (!activeEventId || activeEventId <= 0) {
        setActiveTariffGroup(null)
        return
      }

      try {
        const evento = await getEventoById(activeEventId)
        if (cancelled) return

        if (!evento || !evento.tariff_group_id) {
          setActiveTariffGroup(null)
          return
        }

        const group = await getTariffGroupById(evento.tariff_group_id)
        if (cancelled) return

        setActiveTariffGroup(group)
      } catch {
        // If loading fails, fall back to no dynamic group
        if (!cancelled) {
          setActiveTariffGroup(null)
        }
      }
    }

    loadTariffGroup()

    return () => {
      cancelled = true
    }
  }, [activeEventId, setActiveTariffGroup])

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-auto">
      {/* Top: stamp model previews (just the two images, no printer selector) */}
      <StampModels />

      {/* Middle: tariff tables - dynamic when group is active, static otherwise */}
      {activeTariffGroup ? <DynamicTariffTable /> : <TariffTableSplit />}

      {/* Bottom: cart controls (print buttons, total, etc.) */}
      <CartControls />

      {/* Footer: roll and ticket counters */}
      <RollCounters />
    </div>
  )
}
