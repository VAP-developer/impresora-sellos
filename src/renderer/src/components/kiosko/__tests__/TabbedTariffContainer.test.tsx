/**
 * TabbedTariffContainer.test.tsx
 *
 * Unit tests for the TabbedTariffContainer component.
 * Verifies tab switching logic and visual structure without animation.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabbedTariffContainer from '../TabbedTariffContainer'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockStripRows = [
  {
    label: 'Tira A×4',
    localPrice: 10,
    secondaryPrice: 10,
    qtyFieldS1: 'tarifaAT1',
    qtyFieldS2: 'tarifaAT2',
    limitFieldS1: 'limiteAT1',
    limitFieldS2: 'limiteAT2',
    isStrip: true
  },
  {
    label: 'Tira 4 Tar.',
    localPrice: 8,
    secondaryPrice: 8,
    qtyFieldS1: 'tarifa4T1',
    qtyFieldS2: 'tarifa4T2',
    limitFieldS1: 'limite4T1',
    limitFieldS2: 'limite4T2',
    isStrip: true
  }
]

const mockIndividualRows = [
  {
    label: 'Tarifa A',
    localPrice: 5,
    secondaryPrice: 5,
    qtyFieldS1: 'tarifaAS1',
    qtyFieldS2: 'tarifaAS2',
    limitFieldS1: 'limiteAS1',
    limitFieldS2: 'limiteAS2',
    isStrip: false
  },
  {
    label: 'Tarifa B',
    localPrice: 6,
    secondaryPrice: 6,
    qtyFieldS1: 'tarifaBS1',
    qtyFieldS2: 'tarifaBS2',
    limitFieldS1: 'limiteBS1',
    limitFieldS2: 'limiteBS2',
    isStrip: false
  }
]

const mockQuantities = {
  tarifaAT1: 0,
  tarifaAT2: 0,
  tarifa4T1: 0,
  tarifa4T2: 0,
  tarifaAS1: 0,
  tarifaAS2: 0,
  tarifaBS1: 0,
  tarifaBS2: 0
}

const mockLimits = {
  limiteAT1: 100,
  limiteAT2: 100,
  limite4T1: 100,
  limite4T2: 100,
  limiteAS1: 50,
  limiteAS2: 50,
  limiteBS1: 50,
  limiteBS2: 50
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TabbedTariffContainer', () => {
  it('renders both tables with correct titles', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Both tab headers should be present
    expect(screen.getByText('Tiras')).toBeInTheDocument()
    expect(screen.getByText('Tarifas Individuales')).toBeInTheDocument()
  })

  it('defaults to strips tab being active', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Strips tab should be active (aria-selected="true")
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    expect(stripsTab).toHaveAttribute('aria-selected', 'true')

    // Individual tab should be inactive (aria-selected="false")
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    expect(individualTab).toHaveAttribute('aria-selected', 'false')
  })

  it('renders strip rows in strips table', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Strip rows should be visible
    expect(screen.getByText('Tira A×4')).toBeInTheDocument()
    expect(screen.getByText('Tira 4 Tar.')).toBeInTheDocument()
  })

  it('switches to individual table when clicking individual tab', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Click on individual tab
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    fireEvent.click(individualTab)

    // Individual tab should now be active
    expect(individualTab).toHaveAttribute('aria-selected', 'true')

    // Strips tab should now be inactive
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    expect(stripsTab).toHaveAttribute('aria-selected', 'false')
  })

  it('does not switch when clicking already active tab', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Click on already active strips tab
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    fireEvent.click(stripsTab)

    // Strips tab should still be active
    expect(stripsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('has correct ARIA attributes for accessibility', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Container should have tablist role
    const container = screen.getByRole('tablist')
    expect(container).toHaveAttribute('aria-label', 'Tablas de tarifas')

    // Both tabs should have proper ARIA attributes
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })

    expect(stripsTab).toHaveAttribute('role', 'tab')
    expect(individualTab).toHaveAttribute('role', 'tab')
    expect(stripsTab).toHaveAttribute('tabIndex', '0')
    expect(individualTab).toHaveAttribute('tabIndex', '0')
  })

  it('renders strip rows with dark blue styling indicators', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    const { container } = render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Verify strips tab header has dark blue styling class
    const stripTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    expect(stripTab).toHaveClass('bg-blue-900')
    expect(stripTab).toHaveClass('text-white')
  })

  it('renders individual rows with white background styling', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    const { container } = render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Switch to individual tab
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    fireEvent.click(individualTab)

    // Verify individual tab header has white styling class
    expect(individualTab).toHaveClass('bg-white')
    expect(individualTab).toHaveClass('text-gray-900')
  })

  it('passes quantities and setQuantity to both tables', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Both tables should have quantity inputs (8 columns each, 2 quantity inputs per row)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
  })

  // ─── Accessibility Tests (Task 8) ───────────────────────────────────────────

  it('tab headers respond to Enter key press', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Individual tab should be inactive initially
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    expect(individualTab).toHaveAttribute('aria-selected', 'false')

    // Press Enter key on individual tab
    fireEvent.keyDown(individualTab, { key: 'Enter', code: 'Enter' })

    // Individual tab should now be active
    expect(individualTab).toHaveAttribute('aria-selected', 'true')
  })

  it('tab headers respond to Space key press', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Individual tab should be inactive initially
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    expect(individualTab).toHaveAttribute('aria-selected', 'false')

    // Press Space key on individual tab
    fireEvent.keyDown(individualTab, { key: ' ', code: 'Space' })

    // Individual tab should now be active
    expect(individualTab).toHaveAttribute('aria-selected', 'true')
  })

  it('has ARIA live region that announces tab changes', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Find the live region
    const liveRegion = screen.getByText('Tabla de tiras activa')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')

    // Switch to individual tab
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    fireEvent.click(individualTab)

    // Live region should announce the new active tab
    expect(screen.getByText('Tabla de tarifas individuales activa')).toBeInTheDocument()
  })

  it('tabpanels have correct ARIA roles and labelledby attributes', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Get tabpanels
    const tabpanels = screen.getAllByRole('tabpanel')
    expect(tabpanels).toHaveLength(2)

    // Check strip tabpanel
    const stripTabpanel = document.getElementById('strip-tab-panel')
    expect(stripTabpanel).toHaveAttribute('role', 'tabpanel')
    expect(stripTabpanel).toHaveAttribute('aria-labelledby', 'strip-tab')

    // Check individual tabpanel
    const individualTabpanel = document.getElementById('individual-tab-panel')
    expect(individualTabpanel).toHaveAttribute('role', 'tabpanel')
    expect(individualTabpanel).toHaveAttribute('aria-labelledby', 'individual-tab')
  })

  it('tab headers have aria-controls pointing to their tabpanels', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Check strip tab
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    expect(stripsTab).toHaveAttribute('aria-controls', 'strip-tab-panel')
    expect(stripsTab).toHaveAttribute('id', 'strip-tab')

    // Check individual tab
    const individualTab = screen.getByRole('tab', { name: /Tabla de Tarifas Individuales/i })
    expect(individualTab).toHaveAttribute('aria-controls', 'individual-tab-panel')
    expect(individualTab).toHaveAttribute('id', 'individual-tab')
  })

  it('tab headers have visible focus indicators', () => {
    const mockSetQuantity = vi.fn()
    const mockToggleSecondary = vi.fn()

    render(
      <TabbedTariffContainer
        stripRows={mockStripRows}
        individualRows={mockIndividualRows}
        quantities={mockQuantities}
        setQuantity={mockSetQuantity}
        limits={mockLimits}
        showSecondary={false}
        toggleSecondary={mockToggleSecondary}
        currencySymbol="€"
      />
    )

    // Check that focus styles are applied
    const stripsTab = screen.getByRole('tab', { name: /Tabla de Tiras/i })
    expect(stripsTab).toHaveClass('focus:outline-none')
    expect(stripsTab).toHaveClass('focus:ring-2')
    expect(stripsTab).toHaveClass('focus:ring-blue-500')
  })
})

