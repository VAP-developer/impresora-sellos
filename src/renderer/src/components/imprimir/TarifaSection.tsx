/**
 * TarifaSection.tsx
 *
 * Collapsible section for editing tariff prices and selecting tariff templates.
 * Replicates the "TARIFA VIGENTE" section from the legacy ImprimirView.vue.
 *
 * Supports three tariff templates that change the labels of the price fields:
 * - Estándar (A, A2, B, C) — default Spanish postal tariffs
 * - América (A, A2, B, D) — used for events with American destinations
 * - Andorra (A, B, C, D) — used for Andorra events
 *
 * Validates: Requirement 12.4 (tariff prices must be positive numeric values)
 * Validates: Requirement 13 (tariff configuration as part of Imprimir view)
 */

import { useState } from 'react'
import type { PreciosConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Available tariff template presets. */
export type TarifaTemplate = 'standard' | 'america' | 'andorra'

export interface TarifaSectionProps {
  /** Current prices configuration. */
  precios: PreciosConfig
  /** Callback when any price value changes. */
  onPreciosChange: (field: keyof PreciosConfig, value: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Label sets for each tariff template. Order: [A, A2/B, B/C, C/D]. */
const TARIFA_LABELS: Record<TarifaTemplate, [string, string, string, string]> = {
  standard: ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa C'],
  america: ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa D'],
  andorra: ['Tarifa A', 'Tarifa B', 'Tarifa C', 'Tarifa D']
}

/** Mapping from template label index to PreciosConfig field. */
const PRICE_FIELDS: (keyof PreciosConfig)[] = ['tarifaA', 'tarifaA2', 'tarifaB', 'tarifaC']

// ─── Component ────────────────────────────────────────────────────────────────

export default function TarifaSection({
  precios,
  onPreciosChange
}: TarifaSectionProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [template, setTemplate] = useState<TarifaTemplate>('standard')

  const labels = TARIFA_LABELS[template]

  const handleToggle = (): void => {
    setExpanded((prev) => !prev)
  }

  const handleTemplateChange = (newTemplate: TarifaTemplate): void => {
    setTemplate(newTemplate)
  }

  /**
   * Parse a price input value, returning 0 for invalid/negative inputs.
   * Allows empty string temporarily (user is typing) but normalizes on blur.
   */
  const handlePriceChange = (
    field: keyof PreciosConfig,
    rawValue: string
  ): void => {
    const parsed = parseFloat(rawValue)
    const value = isNaN(parsed) || parsed < 0 ? 0 : parsed
    onPreciosChange(field, value)
  }

  /** Get the display value for a price field. */
  const getPriceValue = (field: keyof PreciosConfig): string => {
    const value = precios[field]
    return value !== undefined && value !== null ? String(value) : '0'
  }

  return (
    <section aria-labelledby="tarifa-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-tarifas"
          type="checkbox"
          checked={expanded}
          onChange={handleToggle}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="tarifa-section-content"
        />
        <label
          htmlFor="toggle-tarifas"
          id="tarifa-section-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          TARIFA VIGENTE
        </label>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <div
          id="tarifa-section-content"
          className="p-4"
          role="region"
          aria-labelledby="tarifa-section-heading"
        >
          {/* Template selector (radio buttons) */}
          <fieldset className="flex items-center gap-4 mb-4">
            <legend className="font-bold text-sm">Plantilla de tarifas:</legend>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="tarifa-template"
                value="standard"
                checked={template === 'standard'}
                onChange={() => handleTemplateChange('standard')}
              />
              <span className="text-sm">Estándar (A-A2-B-C)</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="tarifa-template"
                value="america"
                checked={template === 'america'}
                onChange={() => handleTemplateChange('america')}
              />
              <span className="text-sm">América (A-A2-B-D)</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="tarifa-template"
                value="andorra"
                checked={template === 'andorra'}
                onChange={() => handleTemplateChange('andorra')}
              />
              <span className="text-sm">Andorra (A-B-C-D)</span>
            </label>
          </fieldset>

          {/* Individual tariff price inputs */}
          <div className="flex flex-col items-center gap-2">
            {PRICE_FIELDS.map((field, index) => (
              <div key={field} className="w-[250px]">
                <label
                  htmlFor={`tarifa-price-${field}`}
                  className="block text-sm text-gray-600"
                >
                  {labels[index]}
                </label>
                <input
                  id={`tarifa-price-${field}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={getPriceValue(field)}
                  onChange={(e) => handlePriceChange(field, e.target.value)}
                  className="w-full border border-gray-300 rounded p-2"
                  aria-label={`Precio ${labels[index]}`}
                />
              </div>
            ))}

            {/* Tira prices (always shown with fixed labels) */}
            <div className="flex gap-4 mt-2">
              <div className="w-[200px]">
                <label
                  htmlFor="tarifa-price-tarifaTA"
                  className="block text-sm text-gray-600"
                >
                  TIRA Tarifa A
                </label>
                <input
                  id="tarifa-price-tarifaTA"
                  type="number"
                  step="0.01"
                  min="0"
                  value={getPriceValue('tarifaTA')}
                  onChange={(e) => handlePriceChange('tarifaTA', e.target.value)}
                  className="w-full border border-gray-300 rounded p-2"
                  aria-label="Precio TIRA Tarifa A"
                />
              </div>
              <div className="w-[200px]">
                <label
                  htmlFor="tarifa-price-tarifaT4"
                  className="block text-sm text-gray-600"
                >
                  TIRA 4 Tarifas
                </label>
                <input
                  id="tarifa-price-tarifaT4"
                  type="number"
                  step="0.01"
                  min="0"
                  value={getPriceValue('tarifaT4')}
                  onChange={(e) => handlePriceChange('tarifaT4', e.target.value)}
                  className="w-full border border-gray-300 rounded p-2"
                  aria-label="Precio TIRA 4 Tarifas"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
