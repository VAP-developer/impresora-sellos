/**
 * TariffTable.tsx
 *
 * Complete tariff table for the Kiosko view, replicating the legacy KioskoView.vue layout.
 * Displays all tariff rows in the exact order from the legacy:
 *   1. Tarifa A Tira 4 (strip of 4 stamps, tarifa A price)
 *   2. Tira de 4 Tarifas (strip with A+A2+B+C, highlighted/dark row)
 *   --- separator ---
 *   3. Tarifa A (individual, golden background)
 *   4. Tarifa A2 (individual)
 *   5. Tarifa B (individual)
 *   6. Tarifa C (individual)
 *
 * Each row shows: subtotal1, limit1, qty1 input, tariff name, price, qty2 input, limit2, subtotal2
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4
 * Correctness Properties: 1, 2
 */

import { useMemo } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import TariffRow from './TariffRow'

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTable(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const quantities = useKioskoStore((state) => state.quantities)
  const getLimits = useKioskoStore((state) => state.getLimits)

  // Extract prices from config, falling back to 0 if not loaded
  const precios = config?.precios
  const tarifaA = precios?.tarifaA ?? 0
  const tarifaA2 = precios?.tarifaA2 ?? 0
  const tarifaB = precios?.tarifaB ?? 0
  const tarifaC = precios?.tarifaC ?? 0
  const tarifaTA = precios?.tarifaTA ?? 0
  const tarifaT4 = precios?.tarifaT4 ?? 0

  // Compute limits using the store getter (depends on config + quantities)
  const limits = useMemo(() => {
    if (!config) {
      return {
        limiteAT1: 0,
        limiteAT2: 0,
        limite4T1: 0,
        limite4T2: 0,
        limiteAS1: 0,
        limiteAS2: 0,
        limiteA2S1: 0,
        limiteA2S2: 0,
        limiteBS1: 0,
        limiteBS2: 0,
        limiteCS1: 0,
        limiteCS2: 0
      }
    }
    return getLimits(config.precios, config.ticket, config.sello)
  }, [config, quantities, getLimits])

  return (
    <div className="flex justify-center pt-0" role="table" aria-label="Tabla de tarifas">
      <div className="w-full">
        {/* Header row */}
        <div
          className="flex items-center text-center text-sm font-semibold text-gray-600 py-2 border-b border-gray-300"
          role="row"
          aria-label="Encabezado tabla tarifas"
        >
          <div className="w-[5%]">Subtotal</div>
          <div className="w-[10%]">Límite</div>
          <div className="w-[15%]">Cantidad</div>
          <div className="w-[30%]">Modalidad</div>
          <div className="w-[10%]">Precio</div>
          <div className="w-[15%]">Cantidad</div>
          <div className="w-[10%]">Límite</div>
          <div className="w-[5%]">Subtotal</div>
        </div>

        {/* Row 1: Tarifa A Tira 4 */}
        <TariffRow
          label="Tarifa A Tira 4"
          price={tarifaTA}
          qtyField1="tarifaAT1"
          qtyField2="tarifaAT2"
          limitField1="limiteAT1"
          limitField2="limiteAT2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-100"
          inputClassName="bg-gray-200 border-gray-300 text-black"
        />

        {/* Row 2: Tira de 4 Tarifas (highlighted dark row) */}
        <TariffRow
          label="Tira de 4 Tarifas"
          price={tarifaT4}
          qtyField1="tarifa4T1"
          qtyField2="tarifa4T2"
          limitField1="limite4T1"
          limitField2="limite4T2"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(24,62,117)] text-white"
          inputClassName="bg-[rgb(24,62,117)] text-white border-gray-500"
          labelClassName="text-3xl font-semibold"
          highlighted
        />

        {/* Separator between tiras and individual tariffs */}
        <div className="border-b border-gray-300 my-2" role="separator" />

        {/* Row 3: Tarifa A (golden background) */}
        <TariffRow
          label="Tarifa A"
          price={tarifaA}
          qtyField1="tarifaAS1"
          qtyField2="tarifaAS2"
          limitField1="limiteAS1"
          limitField2="limiteAS2"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(255,192,0)]"
          inputClassName="border-gray-300 text-black"
        />

        {/* Row 4: Tarifa A2 */}
        <TariffRow
          label="Tarifa A2"
          price={tarifaA2}
          qtyField1="tarifaA2S1"
          qtyField2="tarifaA2S2"
          limitField1="limiteA2S1"
          limitField2="limiteA2S2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-100"
          inputClassName="bg-gray-200 border-gray-300 text-black"
        />

        {/* Row 5: Tarifa B */}
        <TariffRow
          label="Tarifa B"
          price={tarifaB}
          qtyField1="tarifaBS1"
          qtyField2="tarifaBS2"
          limitField1="limiteBS1"
          limitField2="limiteBS2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-100"
          inputClassName="bg-gray-200 border-gray-300 text-black"
        />

        {/* Row 6: Tarifa C */}
        <TariffRow
          label="Tarifa C"
          price={tarifaC}
          qtyField1="tarifaCS1"
          qtyField2="tarifaCS2"
          limitField1="limiteCS1"
          limitField2="limiteCS2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-100"
          inputClassName="bg-gray-200 border-gray-300 text-black"
        />
      </div>
    </div>
  )
}
