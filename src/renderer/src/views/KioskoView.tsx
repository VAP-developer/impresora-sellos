/**
 * KioskoView.tsx
 *
 * Vista principal de venta. Compone los componentes de kiosko:
 * - StampModels: previsualizaciones de los dos modelos con controles de impresora
 * - TariffTable: tabla de tarifas con inputs de cantidad y límites
 * - CartControls: total de cesta, presupuesto, botones de acción (imprimir, perfiles, reset, error)
 * - RollCounters: contadores de stock de rollos y tickets al pie
 */

import StampModels from '@renderer/components/kiosko/StampModels'
import TariffTable from '@renderer/components/kiosko/TariffTable'
import CartControls from '@renderer/components/kiosko/CartControls'
import RollCounters from '@renderer/components/kiosko/RollCounters'

export default function KioskoView(): JSX.Element {
  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-auto">
      {/* Top: stamp model previews with printer controls */}
      <StampModels />

      {/* Middle: tariff table + cart controls side by side */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <TariffTable />
        </div>
        <CartControls />
      </div>

      {/* Bottom: roll and ticket counters */}
      <RollCounters />
    </div>
  )
}
