/**
 * TariffGroupEditor.tsx
 *
 * Form component for creating and editing tariff groups.
 * Features:
 * - Fields: year, title, currency
 * - Editable list of tariffs: name (max 16 chars), price (> 0), position (up/down arrows)
 * - Add tariff button (max 10) and remove tariff button (min 2)
 * - Frontend validation before submit with inline error messages
 * - Create mode: empty form
 * - Edit mode: form pre-filled with selected group data
 * - Cancel and Save buttons
 *
 * Uses the tariff-groups Zustand store for createGroup and updateGroup actions.
 */

import { useState, useCallback } from 'react'
import { useTariffGroupsStore } from '@renderer/stores/tariff-groups.store'
import type { TariffGroup, TariffGroupInput, TariffGroupUpdateInput } from '@renderer/lib/ipc-client'

// ─── Constants ────────────────────────────────────────────────────────────────

const TARIFF_GROUP_ERRORS = {
  EMPTY_TITLE: 'El título es obligatorio',
  EMPTY_CURRENCY: 'El tipo de moneda es obligatorio',
  MIN_TARIFFS: 'Se requieren al menos 2 tarifas',
  MAX_TARIFFS: 'El máximo permitido es 10 tarifas',
  EMPTY_TARIFF_NAME: 'El nombre de la tarifa es obligatorio',
  TARIFF_NAME_TOO_LONG: 'El nombre no puede exceder 16 caracteres',
  INVALID_PRICE: 'El precio debe ser un número positivo'
} as const

const MIN_TARIFFS = 2
const MAX_TARIFFS = 10
const MAX_TARIFF_NAME_LENGTH = 16

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TariffGroupEditorProps {
  /** Group to edit (null for create mode) */
  group?: TariffGroup | null
  /** Callback after successful save */
  onSave?: () => void
  /** Callback to close the editor */
  onCancel?: () => void
}

interface TariffFormRow {
  name: string
  price: string
}

interface ValidationErrors {
  title?: string
  currency?: string
  tariffs?: string
  tariffNames?: Record<number, string>
  tariffPrices?: Record<number, string>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffGroupEditor({
  group,
  onSave,
  onCancel
}: TariffGroupEditorProps): JSX.Element {
  const { createGroup, updateGroup } = useTariffGroupsStore()

  const isEditMode = !!group

  // Form state
  const [year, setYear] = useState<number>(group?.year ?? new Date().getFullYear())
  const [title, setTitle] = useState<string>(group?.title ?? '')
  const [currency, setCurrency] = useState<string>(group?.currency ?? '')
  const [tariffs, setTariffs] = useState<TariffFormRow[]>(
    group?.tariffs.map((t) => ({ name: t.name, price: String(t.price) })) ??
      [
        { name: '', price: '' },
        { name: '', price: '' }
      ]
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ─── Validation ───────────────────────────────────────────────────────────

  const validate = useCallback((): ValidationErrors => {
    const errs: ValidationErrors = {}

    if (!title.trim()) {
      errs.title = TARIFF_GROUP_ERRORS.EMPTY_TITLE
    }

    if (!currency.trim()) {
      errs.currency = TARIFF_GROUP_ERRORS.EMPTY_CURRENCY
    }

    if (tariffs.length < MIN_TARIFFS) {
      errs.tariffs = TARIFF_GROUP_ERRORS.MIN_TARIFFS
    } else if (tariffs.length > MAX_TARIFFS) {
      errs.tariffs = TARIFF_GROUP_ERRORS.MAX_TARIFFS
    }

    const nameErrors: Record<number, string> = {}
    const priceErrors: Record<number, string> = {}

    tariffs.forEach((t, i) => {
      if (!t.name.trim()) {
        nameErrors[i] = TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME
      } else if (t.name.trim().length > MAX_TARIFF_NAME_LENGTH) {
        nameErrors[i] = TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG
      }

      const priceNum = parseFloat(t.price)
      if (!t.price.trim() || isNaN(priceNum) || priceNum <= 0) {
        priceErrors[i] = TARIFF_GROUP_ERRORS.INVALID_PRICE
      }
    })

    if (Object.keys(nameErrors).length > 0) {
      errs.tariffNames = nameErrors
    }
    if (Object.keys(priceErrors).length > 0) {
      errs.tariffPrices = priceErrors
    }

    return errs
  }, [title, currency, tariffs])

  // ─── Tariff List Actions ──────────────────────────────────────────────────

  const handleAddTariff = (): void => {
    if (tariffs.length >= MAX_TARIFFS) return
    setTariffs([...tariffs, { name: '', price: '' }])
  }

  const handleRemoveTariff = (index: number): void => {
    if (tariffs.length <= MIN_TARIFFS) return
    setTariffs(tariffs.filter((_, i) => i !== index))
  }

  const handleTariffNameChange = (index: number, value: string): void => {
    const updated = [...tariffs]
    updated[index] = { ...updated[index], name: value }
    setTariffs(updated)
  }

  const handleTariffPriceChange = (index: number, value: string): void => {
    const updated = [...tariffs]
    updated[index] = { ...updated[index], price: value }
    setTariffs(updated)
  }

  const handleMoveTariffUp = (index: number): void => {
    if (index === 0) return
    const updated = [...tariffs]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setTariffs(updated)
  }

  const handleMoveTariffDown = (index: number): void => {
    if (index === tariffs.length - 1) return
    const updated = [...tariffs]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    setTariffs(updated)
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async (): Promise<void> => {
    setSubmitError(null)
    const validationErrors = validate()
    setErrors(validationErrors)

    const hasErrors =
      validationErrors.title ||
      validationErrors.currency ||
      validationErrors.tariffs ||
      (validationErrors.tariffNames && Object.keys(validationErrors.tariffNames).length > 0) ||
      (validationErrors.tariffPrices && Object.keys(validationErrors.tariffPrices).length > 0)

    if (hasErrors) return

    setSaving(true)

    try {
      const tariffInputs = tariffs.map((t, i) => ({
        name: t.name.trim(),
        price: parseFloat(t.price),
        position: i + 1
      }))

      if (isEditMode && group) {
        const input: TariffGroupUpdateInput = {
          year,
          title: title.trim(),
          currency: currency.trim(),
          tariffs: tariffInputs
        }
        await updateGroup(group.id, input)
      } else {
        const input: TariffGroupInput = {
          year,
          title: title.trim(),
          currency: currency.trim(),
          tariffs: tariffInputs
        }
        await createGroup(input)
      }

      onSave?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el grupo'
      setSubmitError(msg)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="border border-gray-300 rounded p-4 bg-gray-50">
      <h4 className="font-bold text-lg mb-4">
        {isEditMode ? 'Editar grupo de tarifas' : 'Crear nuevo grupo de tarifas'}
      </h4>

      {/* Submit error from backend */}
      {submitError && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded p-2">
          {submitError}
        </p>
      )}

      <div className="grid gap-3 max-w-[600px]">
        {/* Year field */}
        <div>
          <label htmlFor="tg-year" className="block text-sm font-bold text-gray-700 mb-1">
            Año
          </label>
          <input
            id="tg-year"
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
            className="w-[120px] border border-gray-300 rounded p-2"
          />
        </div>

        {/* Title field */}
        <div>
          <label htmlFor="tg-title" className="block text-sm font-bold text-gray-700 mb-1">
            Título
          </label>
          <input
            id="tg-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full border rounded p-2 ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Ej: Tarifas Madrid 2026"
          />
          {errors.title && (
            <p className="text-red-600 text-xs mt-1">{errors.title}</p>
          )}
        </div>

        {/* Currency field */}
        <div>
          <label htmlFor="tg-currency" className="block text-sm font-bold text-gray-700 mb-1">
            Tipo de moneda
          </label>
          <input
            id="tg-currency"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`w-[200px] border rounded p-2 ${errors.currency ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Ej: EUR"
          />
          {errors.currency && (
            <p className="text-red-600 text-xs mt-1">{errors.currency}</p>
          )}
        </div>

        {/* Tariffs list */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <label className="block text-sm font-bold text-gray-700">
              Tarifas ({tariffs.length}/{MAX_TARIFFS})
            </label>
            <button
              type="button"
              onClick={handleAddTariff}
              disabled={tariffs.length >= MAX_TARIFFS}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-1 px-2 rounded text-xs"
              aria-label="Añadir tarifa"
            >
              + Añadir
            </button>
          </div>

          {errors.tariffs && (
            <p className="text-red-600 text-xs mb-2">{errors.tariffs}</p>
          )}

          <div className="space-y-2">
            {tariffs.map((tariff, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 border border-gray-200 rounded bg-white"
              >
                {/* Position indicator */}
                <span className="text-gray-400 text-sm font-mono mt-2 w-6 text-center">
                  {index + 1}
                </span>

                {/* Tariff name */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={tariff.name}
                    onChange={(e) => handleTariffNameChange(index, e.target.value)}
                    maxLength={MAX_TARIFF_NAME_LENGTH}
                    className={`w-full border rounded p-1.5 text-sm ${
                      errors.tariffNames?.[index] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Nombre tarifa"
                    aria-label={`Nombre de tarifa ${index + 1}`}
                  />
                  {errors.tariffNames?.[index] && (
                    <p className="text-red-600 text-xs mt-0.5">{errors.tariffNames[index]}</p>
                  )}
                </div>

                {/* Tariff price */}
                <div className="w-[120px]">
                  <input
                    type="number"
                    value={tariff.price}
                    onChange={(e) => handleTariffPriceChange(index, e.target.value)}
                    step="0.01"
                    min="0.01"
                    className={`w-full border rounded p-1.5 text-sm ${
                      errors.tariffPrices?.[index] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Precio"
                    aria-label={`Precio de tarifa ${index + 1}`}
                  />
                  {errors.tariffPrices?.[index] && (
                    <p className="text-red-600 text-xs mt-0.5">{errors.tariffPrices[index]}</p>
                  )}
                </div>

                {/* Move up/down buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMoveTariffUp(index)}
                    disabled={index === 0}
                    className="text-gray-500 hover:text-blue-600 disabled:text-gray-300 text-sm px-1"
                    aria-label={`Mover tarifa ${index + 1} arriba`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveTariffDown(index)}
                    disabled={index === tariffs.length - 1}
                    className="text-gray-500 hover:text-blue-600 disabled:text-gray-300 text-sm px-1"
                    aria-label={`Mover tarifa ${index + 1} abajo`}
                  >
                    ▼
                  </button>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveTariff(index)}
                  disabled={tariffs.length <= MIN_TARIFFS}
                  className="text-red-500 hover:text-red-700 disabled:text-gray-300 font-bold text-sm px-1 mt-1"
                  aria-label={`Eliminar tarifa ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded"
        >
          {saving ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear grupo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
