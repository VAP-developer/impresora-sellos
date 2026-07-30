/**
 * TariffTableSplit.tsx
 *
 * Static tariff panel using tabbed interface.
 * Splits strips and individual tariffs into separate tables.
 *
 * Left = Sello A (Modelo 1), Right = Sello B (Modelo 2).
 * Tiras (strips) are shown in one tab, individual tariffs in another.
 * A toggle on the price lets the user switch between local and secondary price.
 */

import { useMemo, useCallback } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { KioskoQuantities, KioskoLimits } from '@renderer/lib/tariff-calc'
import TabbedTariffContainer from './TabbedTariffContainer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TariffRowDef {
  label: string
  localPrice: number
  secondaryPrice: number
  qtyFieldS1: keyof KioskoQuantities
  qtyFieldS2: keyof KioskoQuantities
  limitFieldS1: keyof KioskoLimits
  limitFieldS2: keyof KioskoLimits
  isStrip: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTableSplit(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const rawQuantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const getLimits = useKioskoStore((state) => state.getLimits)

  const quantities = rawQuantities as unknown as KioskoQuantities

  // Toggle: read from store (syncs with CartControls for printing)
  const showSecondary = useKioskoStore((state) => state.useSecondaryPrice)
  const setUseSecondaryPrice = useKioskoStore((state) => state.setUseSecondaryPrice)

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

  // Row definitions — strips first, then individual
  const rows: TariffRowDef[] = useMemo(() => [
    // ─── Tiras (strips) ───
    {
      label: 'Tira A×4',
      localPrice: tarifaTA,
      secondaryPrice: tarifaTA, // strips don't have secondary in static mode
      qtyFieldS1: 'tarifaAT1',
      qtyFieldS2: 'tarifaAT2',
      limitFieldS1: 'limiteAT1',
      limitFieldS2: 'limiteAT2',
      isStrip: true
    },
    {
      label: 'Tira 4 Tar.',
      localPrice: tarifaT4,
      secondaryPrice: tarifaT4,
      qtyFieldS1: 'tarifa4T1',
      qtyFieldS2: 'tarifa4T2',
      limitFieldS1: 'limite4T1',
      limitFieldS2: 'limite4T2',
      isStrip: true
    },
    // ─── Individual tariffs ───
    {
      label: 'Tarifa A',
      localPrice: tarifaA,
      secondaryPrice: tarifaA,
      qtyFieldS1: 'tarifaAS1',
      qtyFieldS2: 'tarifaAS2',
      limitFieldS1: 'limiteAS1',
      limitFieldS2: 'limiteAS2',
      isStrip: false
    },
    {
      label: 'Tarifa A2',
      localPrice: tarifaA2,
      secondaryPrice: tarifaA2,
      qtyFieldS1: 'tarifaA2S1',
      qtyFieldS2: 'tarifaA2S2',
      limitFieldS1: 'limiteA2S1',
      limitFieldS2: 'limiteA2S2',
      isStrip: false
    },
    {
      label: 'Tarifa B',
      localPrice: tarifaB,
      secondaryPrice: tarifaB,
      qtyFieldS1: 'tarifaBS1',
      qtyFieldS2: 'tarifaBS2',
      limitFieldS1: 'limiteBS1',
      limitFieldS2: 'limiteBS2',
      isStrip: false
    },
    {
      label: 'Tarifa C',
      localPrice: tarifaC,
      secondaryPrice: tarifaC,
      qtyFieldS1: 'tarifaCS1',
      qtyFieldS2: 'tarifaCS2',
      limitFieldS1: 'limiteCS1',
      limitFieldS2: 'limiteCS2',
      isStrip: false
    }
  ], [tarifaTA, tarifaT4, tarifaA, tarifaA2, tarifaB, tarifaC])

  const togglePrice = useCallback(() => {
    setUseSecondaryPrice(!showSecondary)
  }, [showSecondary, setUseSecondaryPrice])

  // Split rows into strips and individual tariffs
  const stripRows = useMemo(() => rows.filter(r => r.isStrip), [rows])
  const individualRows = useMemo(() => rows.filter(r => !r.isStrip), [rows])

  // Convert quantities to Record<string, number> format for TabbedTariffContainer
  const quantitiesRecord = useMemo(() => {
    const record: Record<string, number> = {}
    for (const key in quantities) {
      record[key] = quantities[key as keyof KioskoQuantities]
    }
    return record
  }, [quantities])

  // Convert limits to Record<string, number> format for TabbedTariffContainer
  const limitsRecord = useMemo(() => {
    const record: Record<string, number> = {}
    for (const key in limits) {
      record[key] = limits[key as keyof KioskoLimits]
    }
    return record
  }, [limits])

  // Adapter function to match TabbedTariffContainer's setQuantity signature
  const handleSetQuantity = useCallback((field: string, value: number) => {
    setQuantity(field as keyof KioskoQuantities, value)
  }, [setQuantity])

  return (
    <TabbedTariffContainer
      stripRows={stripRows}
      individualRows={individualRows}
      quantities={quantitiesRecord}
      setQuantity={handleSetQuantity}
      limits={limitsRecord}
      showSecondary={showSecondary}
      toggleSecondary={togglePrice}
      currencySymbol="€"
      isDynamic={false}
    />
  )
}
