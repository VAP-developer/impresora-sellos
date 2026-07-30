/**
 * TabbedTariffContainer.tsx
 *
 * Orchestrator component that manages the tabbed interface for tariff tables.
 * Renders both strip and individual tariff tables with overlapping visual design.
 *
 * Features:
 *   - Tab switching logic with state management
 *   - Animation state to prevent rapid tab switching
 *   - Timeout fallback for transitionEnd (500ms)
 *   - ARIA tablist semantics for accessibility
 *   - Default active tab: strips
 */

import { useState, useEffect, useRef } from 'react'
import TariffTable from './TariffTable'

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
}

interface TabbedTariffContainerProps {
  stripRows: TariffRowDef[]
  individualRows: TariffRowDef[]
  quantities: Record<string, number>
  setQuantity: (field: string, value: number) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
  isDynamic?: boolean
}

type TabType = 'strips' | 'individual'

// ─── Component ────────────────────────────────────────────────────────────────

export default function TabbedTariffContainer({
  stripRows,
  individualRows,
  quantities,
  setQuantity,
  limits,
  showSecondary,
  toggleSecondary,
  currencySymbol,
  isDynamic = false
}: TabbedTariffContainerProps): JSX.Element {
  // ─── State ────────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabType>('strips')
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleTabClick = (tab: TabType): void => {
    // Prevent switching if already active or currently animating
    if (tab === activeTab || isAnimating) {
      return
    }

    setIsAnimating(true)
    setActiveTab(tab)

    // Timeout fallback: clear isAnimating after 500ms if transitionEnd doesn't fire
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsAnimating(false)
    }, 500)
  }

  const handleTransitionEnd = (): void => {
    // Clear timeout since transitionEnd fired successfully
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsAnimating(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="relative"
      role="tablist"
      aria-label="Tablas de tarifas"
    >
      {/* ─── Strip Table ─── */}
      <TariffTable
        tabId="strip-tab"
        title="Tiras"
        rows={stripRows}
        isActive={activeTab === 'strips'}
        isStrip={true}
        isAnimating={isAnimating}
        onTabClick={() => handleTabClick('strips')}
        onTransitionEnd={handleTransitionEnd}
        quantities={quantities}
        setQuantity={setQuantity}
        limits={limits}
        showSecondary={showSecondary}
        toggleSecondary={toggleSecondary}
        currencySymbol={currencySymbol}
      />

      {/* ─── Individual Tariff Table ─── */}
      <TariffTable
        tabId="individual-tab"
        title="Tarifas Individuales"
        rows={individualRows}
        isActive={activeTab === 'individual'}
        isStrip={false}
        isAnimating={isAnimating}
        onTabClick={() => handleTabClick('individual')}
        onTransitionEnd={handleTransitionEnd}
        quantities={quantities}
        setQuantity={setQuantity}
        limits={limits}
        showSecondary={showSecondary}
        toggleSecondary={toggleSecondary}
        currencySymbol={currencySymbol}
      />

      {/* ─── Hidden transition listener ─── */}
      {/* This div listens for transition end on the active table */}
      <div
        className="sr-only"
        onTransitionEnd={handleTransitionEnd}
        aria-live="polite"
        aria-atomic="true"
      >
        {activeTab === 'strips' ? 'Tabla de tiras activa' : 'Tabla de tarifas individuales activa'}
      </div>
    </div>
  )
}
