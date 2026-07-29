/**
 * CurrencySelector.tsx
 *
 * Dropdown component for selecting a currency from a predefined list.
 * Uses Radix UI Select for accessible, keyboard-navigable selection
 * with no free-text input allowed.
 */

import * as Select from '@radix-ui/react-select'
import { cn } from '../../lib/utils'

// ─── Currency definitions ─────────────────────────────────────────────────────

export interface CurrencyDef {
  code: string
  symbol: string
  label: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', symbol: '€', label: 'EUR €' },
  { code: 'USD', symbol: '$', label: 'USD $' },
  { code: 'GBP', symbol: '£', label: 'GBP £' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF Fr' },
  { code: 'JPY', symbol: '¥', label: 'JPY ¥' },
  { code: 'CNY', symbol: '¥', label: 'CNY ¥' },
  { code: 'MXN', symbol: '$', label: 'MXN $' },
  { code: 'ARS', symbol: '$', label: 'ARS $' },
  { code: 'COP', symbol: '$', label: 'COP $' },
  { code: 'BRL', symbol: 'R$', label: 'BRL R$' }
]

// ─── Component ────────────────────────────────────────────────────────────────

interface CurrencySelectorProps {
  value: string
  onChange: (value: string) => void
}

export function CurrencySelector({ value, onChange }: CurrencySelectorProps): JSX.Element {
  return (
    <Select.Root value={value} onValueChange={onChange}>
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
            'z-50',
            'animate-in fade-in-0 zoom-in-95'
          )}
          position="popper"
          sideOffset={4}
        >
          <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white cursor-default">
            <ChevronUpIcon />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
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
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white cursor-default">
            <ChevronDownIcon />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
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
