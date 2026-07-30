/**
 * TariffTable.tsx
 *
 * Wrapper component that renders a single table with:
 *   - Tab header (clickable to switch tables)
 *   - TariffTableContent (table body with rows)
 *
 * Applies conditional styling based on:
 *   - isActive: z-index and positioning for tab overlapping effect
 *   - isStrip: dark blue vs white background styling
 *
 * Implements ARIA attributes for accessibility.
 */

import TariffTableContent from './TariffTableContent'

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

interface TariffTableProps {
  title: string
  rows: TariffRowDef[]
  isActive: boolean
  isStrip: boolean
  isAnimating: boolean
  onTabClick: () => void
  onTransitionEnd?: () => void
  tabId: string // ID for the tab header (used by aria-labelledby)
  // Props for TariffTableContent
  quantities: Record<string, number>
  setQuantity: (field: string, value: number) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffTable({
  title,
  rows,
  isActive,
  isStrip,
  isAnimating,
  onTabClick,
  tabId,
  quantities,
  setQuantity,
  limits,
  showSecondary,
  toggleSecondary,
  currencySymbol,
  onTransitionEnd
}: TariffTableProps): JSX.Element {
  // ─── Event Handlers ───────────────────────────────────────────────────────

  const handleTabClick = (): void => {
    if (!isAnimating) {
      onTabClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isAnimating && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onTabClick()
    }
  }

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>): void => {
    // Only fire for the active table, not both
    // Check if this is the element that triggered the transition (not a child)
    if (e.currentTarget === e.target && isActive) {
      onTransitionEnd?.()
    }
  }

  // ─── Styling ──────────────────────────────────────────────────────────────

  // Tab header styling with rounded top corners
  const headerBgClass = isStrip
    ? 'bg-blue-900 text-white'
    : 'bg-white text-gray-900'

  const headerHoverClass = isActive
    ? 'hover:opacity-90'
    : 'hover:opacity-100'

  // Border styling for tab header
  const headerBorderClass = isStrip
    ? ''
    : 'border-t border-x border-gray-300'

  // Z-index and positioning for overlapping effect
  const positionClass = isActive ? 'relative z-20' : 'absolute inset-x-0 top-0 z-10'

  // Opacity for inactive tables (reduced to indicate background state)
  const opacityClass = isActive ? 'opacity-100' : 'opacity-80'

  // Pointer events
  const pointerClass = isActive ? '' : 'pointer-events-none'

  // Transform for slide effect (applied via inline style for precise values)
  const transform = isActive ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(4px)'

  // Shadow for depth perception
  const shadowClass = isActive ? 'shadow-lg' : 'shadow-none'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={`rounded-lg overflow-hidden transition-all duration-[400ms] ${positionClass} ${opacityClass} ${pointerClass} ${shadowClass}`}
      style={{ 
        transform,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* ─── Tab Header ─── */}
      <div
        id={tabId}
        className={`flex items-center justify-between px-6 cursor-pointer transition-opacity rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${headerBgClass} ${headerBorderClass} ${headerHoverClass}`}
        style={{ minHeight: '44px', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
        onClick={handleTabClick}
        onKeyDown={handleKeyDown}
        role="tab"
        aria-selected={isActive}
        aria-controls={`${tabId}-panel`}
        tabIndex={0}
        aria-label={`Tabla de ${title}`}
      >
        <h3 className="text-xl font-bold">{title}</h3>
        {isActive && (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* ─── Table Body ─── */}
      <div 
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={tabId}
        className={`bg-white ${isStrip ? '' : 'border-x border-b border-gray-300'}`}
      >
        <TariffTableContent
          rows={rows}
          quantities={quantities}
          setQuantity={setQuantity}
          limits={limits}
          showSecondary={showSecondary}
          toggleSecondary={toggleSecondary}
          currencySymbol={currencySymbol}
        />
      </div>
    </div>
  )
}
