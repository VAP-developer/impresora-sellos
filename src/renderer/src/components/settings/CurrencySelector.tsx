/**
 * CurrencySelector.tsx
 *
 * Dropdown component for selecting a currency from a predefined list,
 * plus a "Personalizada" (custom) option that lets the user type any symbol.
 * Uses Radix UI Select for accessible, keyboard-navigable selection.
 */

import { useState, useEffect } from 'react'
import * as Select from '@radix-ui/react-select'
import { cn } from '../../lib/utils'
import {
  CURRENCIES,
  CUSTOM_CURRENCY_CODE,
  isCustomCurrency,
  getCustomSymbol,
  buildCustomCurrencyValue
} from '@renderer/lib/currencies'
import type { CurrencyDef } from '@renderer/lib/currencies'

// Re-export for backward compatibility
export type { CurrencyDef }
export { CURRENCIES }

// ─── Component ────────────────────────────────────────────────────────────────

interface CurrencySelectorProps {
  /** Current value — either a predefined code (EUR, USD...) or "CUSTOM:symbol" */
  value: string
  onChange: (value: string) => void
}

export function CurrencySelector({ value, onChange }: CurrencySelectorProps): JSX.Element {
  // Determine if the current value is a custom currency
  const isCustom = isCustomCurrency(value)
  const [customSymbol, setCustomSymbol] = useState(() => (isCustom ? getCustomSymbol(value) : ''))

  // Sync local state when external value changes
  useEffect(() => {
    if (isCustomCurrency(value)) {
      setCustomSymbol(getCustomSymbol(value))
    }
  }, [value])

  // The select value is either the predefined code or "CUSTOM" sentinel
  const selectValue = isCustom ? CUSTOM_CURRENCY_CODE : value

  const handleSelectChange = (val: string): void => {
    if (val === CUSTOM_CURRENCY_CODE) {
      // Switch to custom mode — emit with current custom symbol (or empty)
      onChange(buildCustomCurrencyValue(customSymbol))
    } else {
      onChange(val)
    }
  }

  const handleCustomSymbolChange = (symbol: string): void => {
    // Limit to 4 characters max
    const trimmed = symbol.slice(0, 4)
    setCustomSymbol(trimmed)
    onChange(buildCustomCurrencyValue(trimmed))
  }

  return (
    <div className="flex items-center gap-2">
      <Select.Root value={selectValue} onValueChange={handleSelectChange}>
        <Select.Trigger
          className={cn(
            'inline-flex items-center justify-between gap-2',
            'h-9 px-3 rounded border border-gray-300 bg-white',
            'text-sm text-gray-800',
            'hover:border-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'min-w-[120px]'
          )}
          aria-label="Seleccionar moneda"
        >
          <Select.Value placeholder="Moneda" />
          <Select.Icon>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={cn(
              'overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg',
              'z-50 max-h-[300px]',
              'animate-in fade-in-0 zoom-in-95'
            )}
            position="popper"
            sideOffset={4}
          >
            <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white cursor-default">
              <ChevronUpIcon />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1 max-h-[280px] overflow-y-auto">
              {CURRENCIES.map((currency) => (
                <Select.Item
                  key={currency.code}
                  value={currency.code}
                  className={cn(
                    'relative flex items-center px-8 py-1.5 rounded-sm',
                    'text-sm text-gray-800 select-none',
                    'data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900',
                    'data-[highlighted]:outline-none',
                    'cursor-pointer'
                  )}
                >
                  <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                    <CheckIcon />
                  </Select.ItemIndicator>
                  <Select.ItemText>{currency.label}</Select.ItemText>
                </Select.Item>
              ))}

              {/* Separator */}
              <Select.Separator className="h-px my-1 bg-gray-200" />

              {/* Custom option */}
              <Select.Item
                value={CUSTOM_CURRENCY_CODE}
                className={cn(
                  'relative flex items-center px-8 py-1.5 rounded-sm',
                  'text-sm text-gray-800 select-none italic',
                  'data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900',
                  'data-[highlighted]:outline-none',
                  'cursor-pointer'
                )}
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText>Personalizada...</Select.ItemText>
              </Select.Item>
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white cursor-default">
              <ChevronDownIcon />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {/* Custom symbol input — shown only when CUSTOM is selected */}
      {isCustom && (
        <input
          type="text"
          value={customSymbol}
          onChange={(e) => handleCustomSymbolChange(e.target.value)}
          placeholder="Símbolo"
          maxLength={4}
          className={cn(
            'h-9 w-16 px-2 rounded border border-gray-300 bg-white',
            'text-sm text-center font-medium text-gray-800',
            'hover:border-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400'
          )}
          aria-label="Símbolo de moneda personalizado"
        />
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  )
}

function ChevronUpIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 7.5L6 4.5L3 7.5" />
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6L5 9L10 3" />
    </svg>
  )
}
