/**
 * DynamicTariffTable.tsx
 *
 * Dynamic tariff panel using tabbed interface.
 * Splits strips and individual tariffs into separate tables.
 *
 * Left = Sello A (Modelo 1), Right = Sello B (Modelo 2).
 * Strips are shown in one tab, individual tariffs in another.
 * A toggle on the price lets the user switch between local and secondary (complementary) price.
 *
 * Replaces TariffTableSplit when an active tariff group is present.
 */

import { useMemo, useCallback } from 'react'
import { useKioskoStore, buildQuantityKey } from '@renderer/stores/kiosko.store'
import { useConfigStore } from '@renderer/stores/config.store'
import { calcDynamicLimits } from '@renderer/lib/tariff-calc'
import type { DynamicQuantities, DynamicLimits } from '@renderer/lib/tariff-calc'
import type { Tariff, Strip } from '@renderer/lib/ipc-client'
import TabbedTariffContainer from './TabbedTariffContainer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TariffRowDef {
  label: string
  localPrice: number
  secondaryPrice: number
  qtyFieldS1: string
  qtyFieldS2: string
  limitFieldS1: string
  limitFieldS2: string
  isStrip: boolean
  tariffId?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DynamicTariffTable(): JSX.Element {
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const activeEvento = useKioskoStore((state) => state.activeEvento)
  const quantities = useKioskoStore((state) => state.quantities)
  const setQuantity = useKioskoStore((state) => state.setQuantity)
  const config = useConfigStore((state) => state.config)

  // Toggle: read from store (syncs with CartControls for printing)
  const showSecondary = useKioskoStore((state) => state.useSecondaryPrice)
  const setUseSecondaryPrice = useKioskoStore((state) => state.setUseSecondaryPrice)

  // Separate strips and individual tariffs, sorted by position
  // FILTER based on selected IDs from activeEvento
  const strips = useMemo(() => {
    if (!activeTariffGroup) return []
    const allStrips = [...(activeTariffGroup.strips ?? [])].sort((a, b) => a.position - b.position)
    
    // If evento has selected strip IDs, filter to only those
    if (activeEvento && activeEvento.selected_strip_ids && activeEvento.selected_strip_ids.length > 0) {
      const selectedIds = new Set(activeEvento.selected_strip_ids)
      return allStrips.filter(s => s.id && selectedIds.has(s.id))
    }
    
    return allStrips
  }, [activeTariffGroup, activeEvento])

  const tariffs = useMemo(() => {
    if (!activeTariffGroup) return []
    const allTariffs = [...(activeTariffGroup.tariffs ?? [])].sort((a, b) => a.position - b.position)
    
    // If evento has selected tariff IDs, filter to only those
    if (activeEvento && activeEvento.selected_tariff_ids && activeEvento.selected_tariff_ids.length > 0) {
      const selectedIds = new Set(activeEvento.selected_tariff_ids)
      return allTariffs.filter(t => t.id && selectedIds.has(t.id))
    }
    
    return allTariffs
  }, [activeTariffGroup, activeEvento])

  // Merged list: strips first, then individual tariffs
  // Add _isStrip flag during construction
  const allRows = useMemo(() => {
    const result: Array<(Tariff | Strip) & { _isStrip: boolean }> = []
    for (const s of strips) {
      result.push({ ...s, _isStrip: true })
    }
    for (const t of tariffs) {
      result.push({ ...t, _isStrip: false })
    }
    return result
  }, [strips, tariffs])

  // Compute dynamic limits for all tariff/model combinations
  const limits = useMemo(() => {
    if (!activeTariffGroup || !config) return {}
    // Use filtered tariffs and strips for limit calculation
    const filteredTariffs = tariffs
    const filteredStrips = strips
    const allTariffs = [...filteredTariffs, ...filteredStrips]
    return calcDynamicLimits(quantities, allTariffs, config.ticket, config.sello, showSecondary)
  }, [tariffs, strips, quantities, config, showSecondary])

  const localCurrency = activeTariffGroup?.local_currency ?? 'EUR'
  const secondaryCurrency = activeTariffGroup?.complementary_currency ?? 'EUR'
  const activeCurrency = showSecondary ? secondaryCurrency : localCurrency

  // Convert currency code to symbol
  const currencySymbol = useMemo(() => {
    const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' }
    return symbols[activeCurrency] ?? activeCurrency
  }, [activeCurrency])

  const togglePrice = useCallback(() => {
    setUseSecondaryPrice(!showSecondary)
  }, [showSecondary, setUseSecondaryPrice])

  // Transform dynamic rows into TariffRowDef format for TabbedTariffContainer
  const rowDefs = useMemo((): TariffRowDef[] => {
    return allRows.map(row => {
      const tariffId = row.id!
      const key1 = buildQuantityKey(tariffId, 1)
      const key2 = buildQuantityKey(tariffId, 2)
      
      return {
        label: row.name,
        localPrice: row.local_price,
        secondaryPrice: row.secondary_price,
        qtyFieldS1: key1,
        qtyFieldS2: key2,
        limitFieldS1: key1, // Limits use same keys as quantities
        limitFieldS2: key2,
        isStrip: row._isStrip,
        tariffId: tariffId
      }
    })
  }, [allRows])

  // Split rows into strips and individual tariffs based on _isStrip flag
  const stripRows = useMemo(() => rowDefs.filter(r => r.isStrip), [rowDefs])
  const individualRows = useMemo(() => rowDefs.filter(r => !r.isStrip), [rowDefs])

  // Convert quantities to Record<string, number> format for TabbedTariffContainer
  const quantitiesRecord = useMemo(() => {
    const record: Record<string, number> = {}
    for (const key in quantities) {
      record[key] = (quantities as DynamicQuantities)[key] ?? 0
    }
    return record
  }, [quantities])

  // Convert limits to Record<string, number> format for TabbedTariffContainer
  const limitsRecord = useMemo(() => {
    const record: Record<string, number> = {}
    for (const key in limits) {
      record[key] = (limits as DynamicLimits)[key] ?? 0
    }
    return record
  }, [limits])

  // Adapter function to match TabbedTariffContainer's setQuantity signature
  const handleSetQuantity = useCallback((field: string, value: number) => {
    // Parse tariffId and model from the dynamic quantity key (format: "tariff_<tariffId>_s<model>")
    const parts = field.split('_')
    if (parts.length === 3 && parts[0] === 'tariff') {
      const tariffId = parseInt(parts[1], 10)
      const modelStr = parts[2] // "s1" or "s2"
      const model = parseInt(modelStr.substring(1), 10) as 1 | 2
      if (!isNaN(tariffId) && (model === 1 || model === 2)) {
        setQuantity(tariffId, model, value)
      }
    }
  }, [setQuantity])

  if (!activeTariffGroup) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 text-sm" role="alert">
        El evento no tiene tarifas configuradas
      </div>
    )
  }

  return (
    <TabbedTariffContainer
      stripRows={stripRows}
      individualRows={individualRows}
      quantities={quantitiesRecord}
      setQuantity={handleSetQuantity}
      limits={limitsRecord}
      showSecondary={showSecondary}
      toggleSecondary={togglePrice}
      currencySymbol={currencySymbol}
      isDynamic={true}
    />
  )
}
