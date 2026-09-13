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

import { useEffect, useState } from 'react'
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

/**
 * Parse a decimal string that may use comma or dot as separator.
 * Returns 0 for invalid/negative inputs.
 */
function parsePrice(rawValue: string): number {
  const normalized = rawValue.replace(',', '.')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) || parsed < 0 ? 0 : parsed
}

/**
 * Input de precio decimal.
 *
 * Usa type="text" + inputMode="decimal" para que el teclado virtual numérico
 * muestre la coma y para conservar valores intermedios como "12," mientras el
 * usuario escribe (un input type="number" descarta esos valores y vacía el
 * campo). Mantiene el texto crudo en estado local y normaliza al perder foco.
 */
interface PriceInputProps {
  id: string
  value: number | undefined
  onCommit: (value: number) => void
  className?: string
  ariaLabel: string
}

function PriceInput({ id, value, onCommit, className, ariaLabel }: PriceInputProps): JSX.Element {
  const numericValue = value ?? 0
  const [text, setText] = useState<string>(String(numericValue))
  const [editing, setEditing] = useState(false)

  // Sincronizar con el valor externo cuando no se está editando (ej. reset,
  // cambio de plantilla o carga de config).
  useEffect(() => {
    if (!editing) setText(String(numericValue))
  }, [numericValue, editing])

  const handleChange = (raw: string): void => {
    // Permitir sólo dígitos y un único separador decimal (coma o punto).
    const cleaned = raw.replace(/[^0-9.,]/g, '')
    setText(cleaned)
    onCommit(parsePrice(cleaned))
  }

  const handleBlur = (): void => {
    setEditing(false)
    const parsed = parsePrice(text)
    setText(String(parsed))
    onCommit(parsed)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={editing ? text : String(numericValue)}
      onFocus={() => setEditing(true)}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
      aria-label={ariaLabel}
    />
  )
}

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

  return (
    <section aria-labelledby="tarifa-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(234,190,63)] p-2 mb-2 rounded shadow flex items-center gap-2">
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
                <PriceInput
                  id={`tarifa-price-${field}`}
                  value={precios[field]}
                  onCommit={(v) => onPreciosChange(field, v)}
                  className="w-full border border-gray-300 rounded p-2"
                  ariaLabel={`Precio ${labels[index]}`}
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
                <PriceInput
                  id="tarifa-price-tarifaTA"
                  value={precios.tarifaTA}
                  onCommit={(v) => onPreciosChange('tarifaTA', v)}
                  className="w-full border border-gray-300 rounded p-2"
                  ariaLabel="Precio TIRA Tarifa A"
                />
              </div>
              <div className="w-[200px]">
                <label
                  htmlFor="tarifa-price-tarifaT4"
                  className="block text-sm text-gray-600"
                >
                  TIRA 4 Tarifas
                </label>
                <PriceInput
                  id="tarifa-price-tarifaT4"
                  value={precios.tarifaT4}
                  onCommit={(v) => onPreciosChange('tarifaT4', v)}
                  className="w-full border border-gray-300 rounded p-2"
                  ariaLabel="Precio TIRA 4 Tarifas"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
