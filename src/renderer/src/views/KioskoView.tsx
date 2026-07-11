/**
 * KioskoView.tsx
 *
 * Vista principal de venta. Layout dividido en dos mitades:
 * - Izquierda: Sello A (Modelo 1 / printer1) con su imagen y tabla de tarifas
 * - Derecha: Sello B (Modelo 2 / printer2) con su imagen y tabla de tarifas
 * - Abajo: Controles de impresión y contadores de rollos
 */

import StampModels from '@renderer/components/kiosko/StampModels'
import TariffTableSplit from '@renderer/components/kiosko/TariffTableSplit'
import CartControls from '@renderer/components/kiosko/CartControls'
import RollCounters from '@renderer/components/kiosko/RollCounters'

export default function KioskoView(): JSX.Element {
  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-auto">
      {/* Top: stamp model previews (just the two images, no printer selector) */}
      <StampModels />

      {/* Middle: tariff tables split by model */}
      <TariffTableSplit />

      {/* Bottom: cart controls (print buttons, total, etc.) */}
      <CartControls />

      {/* Footer: roll and ticket counters */}
      <RollCounters />
    </div>
  )
}
