/**
 * TariffTableSplit.tsx
 *
 * Tariff table split into two visual halves:
 * - Left half: quantities for Sello A (Modelo 1 / printer 1)
 * - Right half: quantities for Sello B (Modelo 2 / printer 2)
 *
 * Each half shows its own tariff rows with quantity inputs, limits, and subtotals.
 * The center column shows the tariff name and price (shared between both).
 */

import { useMemo } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import TariffRowSplit from './TariffRowSplit'

export default function TariffTableSplit(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const quantities = useKioskoStore((state) => state.quantities)
  const getLimits = useKioskoStore((state) => state.getLimits)

  const precios = config?.precios
  const tarifaA = precios?.tarifaA ?? 0
  const tarifaA2 = precios?.tarifaA2 ?? 0
  const tarifaB = precios?.tarifaB ?? 0
  const tarifaC = precios?.tarifaC ?? 0
  const tarifaTA = precios?.tarifaTA ?? 0
  const tarifaT4 = precios?.tarifaT4 ?? 0

  const limits = useMemo(() => {
    if (!config) {
      return {
        limiteAT1: 0, limiteAT2: 0, limite4T1: 0, limite4T2: 0,
        limiteAS1: 0, limiteAS2: 0, limiteA2S1: 0, limiteA2S2: 0,
        limiteBS1: 0, limiteBS2: 0, limiteCS1: 0, limiteCS2: 0
      }
    }
    return getLimits(config.precios, config.ticket, config.sello)
  }, [config, quantities, getLimits])

  return (
    <div className="flex gap-4" role="table" aria-label="Tabla de tarifas dividida por sello">
      {/* ─── SELLO A (Modelo 1) ─── */}
      <div className="flex-1 border border-blue-200 rounded-lg overflow-hidden">
        <div className="bg-[rgb(24,62,117)] text-white text-center py-1 text-sm font-bold">
          SELLO A — Modelo 1
        </div>

        {/* Header */}
        <div className="flex items-center text-center text-[10px] font-semibold text-gray-500 py-1 border-b border-gray-200 px-1">
          <div className="w-[20%]">Límite</div>
          <div className="w-[25%]">Cantidad</div>
          <div className="w-[35%]">Tarifa</div>
          <div className="w-[20%]">Subtotal</div>
        </div>

        {/* Tira A */}
        <TariffRowSplit
          label="Tira A×4"
          price={tarifaTA}
          qtyField="tarifaAT1"
          limitField="limiteAT1"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tira 4 Tarifas */}
        <TariffRowSplit
          label="Tira 4 Tar."
          price={tarifaT4}
          qtyField="tarifa4T1"
          limitField="limite4T1"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(24,62,117)] text-white"
          inputClassName="bg-[rgb(24,62,117)] text-white border-gray-500"
          highlighted
        />
        {/* Separator */}
        <div className="border-b border-gray-300 my-1" />
        {/* Tarifa A */}
        <TariffRowSplit
          label="Tarifa A"
          price={tarifaA}
          qtyField="tarifaAS1"
          limitField="limiteAS1"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(255,192,0)]"
        />
        {/* Tarifa A2 */}
        <TariffRowSplit
          label="Tarifa A2"
          price={tarifaA2}
          qtyField="tarifaA2S1"
          limitField="limiteA2S1"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tarifa B */}
        <TariffRowSplit
          label="Tarifa B"
          price={tarifaB}
          qtyField="tarifaBS1"
          limitField="limiteBS1"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tarifa C */}
        <TariffRowSplit
          label="Tarifa C"
          price={tarifaC}
          qtyField="tarifaCS1"
          limitField="limiteCS1"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
      </div>

      {/* ─── SELLO B (Modelo 2) ─── */}
      <div className="flex-1 border border-green-200 rounded-lg overflow-hidden">
        <div className="bg-green-700 text-white text-center py-1 text-sm font-bold">
          SELLO B — Modelo 2
        </div>

        {/* Header */}
        <div className="flex items-center text-center text-[10px] font-semibold text-gray-500 py-1 border-b border-gray-200 px-1">
          <div className="w-[20%]">Límite</div>
          <div className="w-[25%]">Cantidad</div>
          <div className="w-[35%]">Tarifa</div>
          <div className="w-[20%]">Subtotal</div>
        </div>

        {/* Tira A */}
        <TariffRowSplit
          label="Tira A×4"
          price={tarifaTA}
          qtyField="tarifaAT2"
          limitField="limiteAT2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tira 4 Tarifas */}
        <TariffRowSplit
          label="Tira 4 Tar."
          price={tarifaT4}
          qtyField="tarifa4T2"
          limitField="limite4T2"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(24,62,117)] text-white"
          inputClassName="bg-[rgb(24,62,117)] text-white border-gray-500"
          highlighted
        />
        {/* Separator */}
        <div className="border-b border-gray-300 my-1" />
        {/* Tarifa A */}
        <TariffRowSplit
          label="Tarifa A"
          price={tarifaA}
          qtyField="tarifaAS2"
          limitField="limiteAS2"
          quantities={quantities}
          limits={limits}
          className="bg-[rgb(255,192,0)]"
        />
        {/* Tarifa A2 */}
        <TariffRowSplit
          label="Tarifa A2"
          price={tarifaA2}
          qtyField="tarifaA2S2"
          limitField="limiteA2S2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tarifa B */}
        <TariffRowSplit
          label="Tarifa B"
          price={tarifaB}
          qtyField="tarifaBS2"
          limitField="limiteBS2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
        {/* Tarifa C */}
        <TariffRowSplit
          label="Tarifa C"
          price={tarifaC}
          qtyField="tarifaCS2"
          limitField="limiteCS2"
          quantities={quantities}
          limits={limits}
          className="bg-gray-50"
        />
      </div>
    </div>
  )
}
