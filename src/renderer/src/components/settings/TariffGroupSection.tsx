/**
 * TariffGroupSection.tsx
 *
 * Manages tariff groups within the Settings view.
 * Lists existing groups organized by year, with full CRUD support.
 * Supports dual-currency pricing (local + complementary), tariff descriptions,
 * and strip entities that reference specific tariffs via multi-select.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1-2.8, 3.1-3.9, 4.1-4.4, 7.1-7.6
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTariffGroupsStore } from '@renderer/stores/tariff-groups.store'
import { CurrencySelector, CURRENCIES } from './CurrencySelector'
import { TariffMultiSelect } from './TariffMultiSelect'
import { cn } from '../../lib/utils'
import type {
  TariffGroup,
  TariffGroupInput,
  TariffGroupUpdateInput
} from '@renderer/lib/ipc-client'

// ─── Local Types ──────────────────────────────────────────────────────────────

interface TariffFormRow {
  name: string
  description: string
  local_price: string
  secondary_price: string
}

interface StripFormRow {
  name: string
  local_price: string
  secondary_price: string
  selected_tariff_indices: number[]
}

interface FormState {
  year: string
  title: string
  local_currency: string
  complementary_currency: string
  tariffs: TariffFormRow[]
  strips: StripFormRow[]
}

interface TariffRowErrors {
  name?: string
  local_price?: string
  secondary_price?: string
}

interface StripRowErrors {
  name?: string
  local_price?: string
  secondary_price?: string
  tariff_selection?: string
}

interface FormErrors {
  year?: string
  title?: string
  local_currency?: string
  complementary_currency?: string
  tariffs?: Record<number, TariffRowErrors>
  strips?: Record<number, StripRowErrors>
  general?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert currency code to symbol (e.g., 'EUR' → '€', 'USD' → '$')
 */
function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code)
  return currency?.symbol ?? code
}

function emptyTariffRow(): TariffFormRow {
  return { name: '', description: '', local_price: '', secondary_price: '' }
}

function emptyStripRow(): StripFormRow {
  return { name: '', local_price: '', secondary_price: '', selected_tariff_indices: [] }
}

function groupToFormState(group: TariffGroup): FormState {
  // Map tariff IDs to indices for strip selections
  const tariffIdToIndex = new Map<number, number>()
  group.tariffs.forEach((t, i) => {
    if (t.id != null) {
      tariffIdToIndex.set(t.id, i)
    }
  })

  return {
    year: String(group.year),
    title: group.title,
    local_currency: group.local_currency,
    complementary_currency: group.complementary_currency,
    tariffs: group.tariffs.map((t) => ({
      name: t.name,
      description: t.description,
      local_price: String(t.local_price),
      secondary_price: String(t.secondary_price)
    })),
    strips: group.strips.map((s) => ({
      name: s.name,
      local_price: String(s.local_price),
      secondary_price: String(s.secondary_price),
      selected_tariff_indices: s.tariff_ids
        .map((id) => tariffIdToIndex.get(id))
        .filter((idx): idx is number => idx !== undefined)
    }))
  }
}

function initialFormState(): FormState {
  return {
    year: String(new Date().getFullYear()),
    title: '',
    local_currency: 'EUR',
    complementary_currency: 'EUR',
    tariffs: [emptyTariffRow(), emptyTariffRow()],
    strips: []
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TariffGroupSection(): JSX.Element {
  const { t } = useTranslation()
  const { groups, loading, error, loadAll, loadYears, createGroup, updateGroup, deleteGroup } =
    useTariffGroupsStore()

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingGroup, setEditingGroup] = useState<TariffGroup | null>(null)
  const [form, setForm] = useState<FormState>(initialFormState())
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // Load groups on mount
  useEffect(() => {
    loadAll()
    loadYears()
  }, [loadAll, loadYears])

  // ─── Validation ───────────────────────────────────────────────────────────

  const validate = useCallback(
    (formData: FormState): FormErrors => {
      const errs: FormErrors = {}
      const tariffErrors: Record<number, TariffRowErrors> = {}
      const stripErrors: Record<number, StripRowErrors> = {}

      // Year
      const yearNum = Number(formData.year)
      if (!formData.year.trim() || isNaN(yearNum) || !Number.isInteger(yearNum)) {
        errs.year = t('validation.yearRequired')
      }

      // Title
      if (!formData.title.trim()) {
        errs.title = t('validation.titleRequired')
      }

      // Currencies
      if (!formData.local_currency.trim()) {
        errs.local_currency = t('validation.localCurrencyRequired')
      }
      if (!formData.complementary_currency.trim()) {
        errs.complementary_currency = t('validation.complementaryCurrencyRequired')
      }

      // Individual tariff cardinality [2, 20]
      if (formData.tariffs.length < 2) {
        errs.general = t('validation.minTariffs')
      } else if (formData.tariffs.length > 20) {
        errs.general = t('validation.maxTariffs')
      }

      // Validate each tariff row
      formData.tariffs.forEach((row, i) => {
        const rowErr: TariffRowErrors = {}

        if (!row.name.trim()) {
          rowErr.name = t('validation.nameRequired')
        } else if (row.name.trim().length > 16) {
          rowErr.name = t('validation.nameTooLong')
        }

        const localPrice = Number(row.local_price)
        if (!row.local_price.trim() || isNaN(localPrice) || !isFinite(localPrice) || localPrice <= 0) {
          rowErr.local_price = t('validation.localPricePositive')
        }

        const secondaryPrice = Number(row.secondary_price)
        if (row.secondary_price.trim() && (isNaN(secondaryPrice) || !isFinite(secondaryPrice) || secondaryPrice < 0)) {
          rowErr.secondary_price = t('validation.secondaryPricePositive')
        }

        if (Object.keys(rowErr).length > 0) {
          tariffErrors[i] = rowErr
        }
      })

      // Validate each strip row
      formData.strips.forEach((row, i) => {
        const rowErr: StripRowErrors = {}

        if (!row.name.trim()) {
          rowErr.name = t('validation.nameRequired')
        } else if (row.name.trim().length > 16) {
          rowErr.name = t('validation.nameTooLong')
        }

        const localPrice = Number(row.local_price)
        if (!row.local_price.trim() || isNaN(localPrice) || !isFinite(localPrice) || localPrice <= 0) {
          rowErr.local_price = t('validation.localPricePositive')
        }

        const secondaryPrice2 = Number(row.secondary_price)
        if (row.secondary_price.trim() && (isNaN(secondaryPrice2) || !isFinite(secondaryPrice2) || secondaryPrice2 < 0)) {
          rowErr.secondary_price = t('validation.secondaryPricePositive')
        }

        if (row.selected_tariff_indices.length < 2) {
          rowErr.tariff_selection = t('validation.stripMinTariffs')
        }

        if (Object.keys(rowErr).length > 0) {
          stripErrors[i] = rowErr
        }
      })

      if (Object.keys(tariffErrors).length > 0) {
        errs.tariffs = tariffErrors
      }
      if (Object.keys(stripErrors).length > 0) {
        errs.strips = stripErrors
      }

      return errs
    },
    [t]
  )

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleCreate(): void {
    setForm(initialFormState())
    setErrors({})
    setMode('create')
  }

  function handleEdit(group: TariffGroup): void {
    setEditingGroup(group)
    setForm(groupToFormState(group))
    setErrors({})
    setMode('edit')
  }

  function handleCancelForm(): void {
    setMode('list')
    setEditingGroup(null)
    setErrors({})
  }

  async function handleDelete(id: number): Promise<void> {
    await deleteGroup(id)
    setConfirmDeleteId(null)
  }

  async function handleSave(): Promise<void> {
    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const tariffs = form.tariffs.map((row, i) => ({
        name: row.name.trim(),
        description: row.description.trim(),
        local_price: Number(row.local_price),
        secondary_price: row.secondary_price.trim() ? Number(row.secondary_price) : 0,
        position: i + 1
      }))

      const strips = form.strips.map((row, i) => ({
        name: row.name.trim(),
        local_price: Number(row.local_price),
        secondary_price: row.secondary_price.trim() ? Number(row.secondary_price) : 0,
        position: i + 1,
        tariff_ids: row.selected_tariff_indices.map((idx) => idx + 1) // position-based (1-indexed)
      }))

      if (mode === 'create') {
        const input: TariffGroupInput = {
          year: Number(form.year),
          title: form.title.trim(),
          local_currency: form.local_currency,
          complementary_currency: form.complementary_currency,
          tariffs,
          strips
        }
        await createGroup(input)
      } else if (mode === 'edit' && editingGroup) {
        const input: TariffGroupUpdateInput = {
          year: Number(form.year),
          title: form.title.trim(),
          local_currency: form.local_currency,
          complementary_currency: form.complementary_currency,
          tariffs,
          strips
        }
        await updateGroup(editingGroup.id, input)
      }

      setMode('list')
      setEditingGroup(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.saveFailed')
      if (message.includes('año') || message.includes('year') || message.includes('DUPLICATE_YEAR')) {
        setErrors({ year: t('validation.yearDuplicate') })
      } else {
        setErrors({ general: message })
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Form Helpers ─────────────────────────────────────────────────────────

  function updateTariffRow(index: number, field: keyof TariffFormRow, value: string): void {
    setForm((prev) => {
      const tariffs = [...prev.tariffs]
      tariffs[index] = { ...tariffs[index], [field]: value }
      return { ...prev, tariffs }
    })
  }

  function addTariffRow(): void {
    setForm((prev) => ({
      ...prev,
      tariffs: [...prev.tariffs, emptyTariffRow()]
    }))
  }

  function removeTariffRow(index: number): void {
    setForm((prev) => {
      const tariffs = prev.tariffs.filter((_, i) => i !== index)
      // Update strip selections: remove the deleted index and shift higher indices down
      const strips = prev.strips.map((strip) => ({
        ...strip,
        selected_tariff_indices: strip.selected_tariff_indices
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i))
      }))
      return { ...prev, tariffs, strips }
    })
  }

  function updateStripRow(index: number, field: keyof Omit<StripFormRow, 'selected_tariff_indices'>, value: string): void {
    setForm((prev) => {
      const strips = [...prev.strips]
      strips[index] = { ...strips[index], [field]: value }
      return { ...prev, strips }
    })
  }

  function updateStripTariffSelection(index: number, indices: number[]): void {
    setForm((prev) => {
      const strips = [...prev.strips]
      strips[index] = { ...strips[index], selected_tariff_indices: indices }
      return { ...prev, strips }
    })
  }

  function addStripRow(): void {
    setForm((prev) => ({
      ...prev,
      strips: [...prev.strips, emptyStripRow()]
    }))
  }

  function removeStripRow(index: number): void {
    setForm((prev) => ({
      ...prev,
      strips: prev.strips.filter((_, i) => i !== index)
    }))
  }

  // Check if save should be disabled (any strip with < 2 tariffs selected)
  const hasInvalidStrips = form.strips.some((s) => s.selected_tariff_indices.length < 2)

  // ─── Organize groups by year ──────────────────────────────────────────────

  const groupsByYear: Record<number, TariffGroup> = {}
  groups.forEach((g) => {
    groupsByYear[g.year] = g
  })

  const sortedYears = Object.keys(groupsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  // ─── Render: List Mode ────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-800">
            {t('settings.tariffGroups')}
          </h3>
          <button
            type="button"
            onClick={handleCreate}
            className={cn(
              'h-8 px-3 rounded text-sm font-medium',
              'bg-blue-600 text-white hover:bg-blue-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-400'
            )}
          >
            {t('settings.createGroup')}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {loading && <p className="text-sm text-gray-500">...</p>}

        {!loading && sortedYears.length === 0 && (
          <p className="text-sm text-gray-500 italic">{t('settings.noGroups')}</p>
        )}

        {sortedYears.map((year) => {
          const group = groupsByYear[year]
          const tariffsCount = group.tariffs.length
          const stripsCount = group.strips.length

          return (
            <div
              key={group.id}
              className="border border-gray-200 rounded-md p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-800">
                    {group.year}
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    {group.title}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    ({getCurrencySymbol(group.local_currency)} / {getCurrencySymbol(group.complementary_currency)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(group)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {t('settings.editGroup')}
                  </button>
                  {confirmDeleteId === group.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-red-600">
                        {t('settings.confirmDelete')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(group.id)}
                        className="text-xs text-red-700 font-bold hover:text-red-900"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(group.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      {t('settings.deleteGroup')}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {tariffsCount} {t('settings.individual').toLowerCase()}
                {stripsCount > 0 && (
                  <span>
                    {' · '}
                    {stripsCount} {t('settings.strip').toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Render: Create / Edit Form ───────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-gray-800">
        {mode === 'create' ? t('settings.createGroup') : t('settings.editGroup')}
      </h3>

      {errors.general && (
        <p className="text-sm text-red-600" role="alert">
          {errors.general}
        </p>
      )}

      {/* Year + Title */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tg-year" className="block text-xs font-medium text-gray-600 mb-1">
            {t('settings.year')}
          </label>
          <input
            id="tg-year"
            type="number"
            value={form.year}
            onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
            aria-invalid={!!errors.year}
            className={cn(
              'h-9 w-full px-3 rounded border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
              errors.year
                ? 'border-red-500 text-red-900'
                : 'border-gray-300 text-gray-800 hover:border-gray-400'
            )}
          />
          {errors.year && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.year}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tg-title" className="block text-xs font-medium text-gray-600 mb-1">
            {t('settings.groupTitle')}
          </label>
          <input
            id="tg-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            aria-invalid={!!errors.title}
            className={cn(
              'h-9 w-full px-3 rounded border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
              errors.title
                ? 'border-red-500 text-red-900'
                : 'border-gray-300 text-gray-800 hover:border-gray-400'
            )}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.title}
            </p>
          )}
        </div>
      </div>

      {/* Dual Currency Selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('settings.localCurrency')}
          </label>
          <CurrencySelector
            value={form.local_currency}
            onChange={(val) => setForm((prev) => ({ ...prev, local_currency: val }))}
          />
          {errors.local_currency && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.local_currency}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('settings.complementaryCurrency')}
          </label>
          <CurrencySelector
            value={form.complementary_currency}
            onChange={(val) => setForm((prev) => ({ ...prev, complementary_currency: val }))}
          />
          {errors.complementary_currency && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.complementary_currency}
            </p>
          )}
        </div>
      </div>

      {/* ─── TariffListPanel: Individual Tariffs ─────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
            {t('settings.individual')} ({form.tariffs.length})
          </div>
          <div className="text-xs text-gray-400">
            {getCurrencySymbol(form.local_currency)} / {getCurrencySymbol(form.complementary_currency)}
          </div>
        </div>

        {form.tariffs.map((row, i) => {
          const rowErrors = errors.tariffs?.[i]
          return (
            <div
              key={i}
              className="flex items-start gap-2 p-2 border border-blue-100 rounded bg-blue-50/30"
            >
              {/* Name */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder={t('settings.name')}
                  value={row.name}
                  onChange={(e) => updateTariffRow(i, 'name', e.target.value)}
                  maxLength={16}
                  aria-invalid={!!rowErrors?.name}
                  className={cn(
                    'h-8 w-full px-2 rounded border text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-blue-400',
                    rowErrors?.name ? 'border-red-400' : 'border-gray-300'
                  )}
                />
                {rowErrors?.name && (
                  <p className="text-xs text-red-600 mt-0.5">{rowErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder={t('settings.description')}
                  value={row.description}
                  onChange={(e) => updateTariffRow(i, 'description', e.target.value)}
                  className={cn(
                    'h-8 w-full px-2 rounded border text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-blue-400',
                    'border-gray-300'
                  )}
                />
              </div>

              {/* Local Price */}
              <div className="w-24">
                <input
                  type="number"
                  placeholder={t('settings.localPrice')}
                  value={row.local_price}
                  onChange={(e) => updateTariffRow(i, 'local_price', e.target.value)}
                  step="0.01"
                  min="0.01"
                  aria-invalid={!!rowErrors?.local_price}
                  className={cn(
                    'h-8 w-full px-2 rounded border text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-blue-400',
                    rowErrors?.local_price ? 'border-red-400' : 'border-gray-300'
                  )}
                />
                {rowErrors?.local_price && (
                  <p className="text-xs text-red-600 mt-0.5">{rowErrors.local_price}</p>
                )}
              </div>

              {/* Secondary Price */}
              <div className="w-24">
                <input
                  type="number"
                  placeholder={t('settings.secondaryPrice')}
                  value={row.secondary_price}
                  onChange={(e) => updateTariffRow(i, 'secondary_price', e.target.value)}
                  step="0.01"
                  min="0"
                  aria-invalid={!!rowErrors?.secondary_price}
                  className={cn(
                    'h-8 w-full px-2 rounded border text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-blue-400',
                    rowErrors?.secondary_price ? 'border-red-400' : 'border-gray-300'
                  )}
                />
                {rowErrors?.secondary_price && (
                  <p className="text-xs text-red-600 mt-0.5">{rowErrors.secondary_price}</p>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeTariffRow(i)}
                disabled={form.tariffs.length <= 2}
                aria-label={t('settings.removeTariff')}
                className={cn(
                  'mt-1 text-gray-400 hover:text-red-500 text-sm',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
              >
                ✕
              </button>
            </div>
          )
        })}

        {/* Add tariff button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={addTariffRow}
            disabled={form.tariffs.length >= 20}
            className={cn(
              'text-xs px-2 py-1 rounded border border-dashed',
              'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            + {t('settings.addTariff')}
          </button>
        </div>
      </div>

      {/* ─── StripListPanel: Strips ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
            {t('settings.strips')} ({form.strips.length})
          </div>
          <div className="text-xs text-gray-400">
            {getCurrencySymbol(form.local_currency)} / {getCurrencySymbol(form.complementary_currency)}
          </div>
        </div>

        {form.strips.map((row, i) => {
          const rowErrors = errors.strips?.[i]
          return (
            <div
              key={i}
              className="p-2 border border-purple-100 rounded bg-purple-50/30 space-y-2"
            >
              <div className="flex items-start gap-2">
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder={t('settings.name')}
                    value={row.name}
                    onChange={(e) => updateStripRow(i, 'name', e.target.value)}
                    maxLength={16}
                    aria-invalid={!!rowErrors?.name}
                    className={cn(
                      'h-8 w-full px-2 rounded border text-sm',
                      'focus:outline-none focus:ring-1 focus:ring-blue-400',
                      rowErrors?.name ? 'border-red-400' : 'border-gray-300'
                    )}
                  />
                  {rowErrors?.name && (
                    <p className="text-xs text-red-600 mt-0.5">{rowErrors.name}</p>
                  )}
                </div>

                {/* Local Price */}
                <div className="w-24">
                  <input
                    type="number"
                    placeholder={t('settings.localPrice')}
                    value={row.local_price}
                    onChange={(e) => updateStripRow(i, 'local_price', e.target.value)}
                    step="0.01"
                    min="0.01"
                    aria-invalid={!!rowErrors?.local_price}
                    className={cn(
                      'h-8 w-full px-2 rounded border text-sm',
                      'focus:outline-none focus:ring-1 focus:ring-blue-400',
                      rowErrors?.local_price ? 'border-red-400' : 'border-gray-300'
                    )}
                  />
                  {rowErrors?.local_price && (
                    <p className="text-xs text-red-600 mt-0.5">{rowErrors.local_price}</p>
                  )}
                </div>

                {/* Secondary Price */}
                <div className="w-24">
                  <input
                    type="number"
                    placeholder={t('settings.secondaryPrice')}
                    value={row.secondary_price}
                    onChange={(e) => updateStripRow(i, 'secondary_price', e.target.value)}
                    step="0.01"
                    min="0"
                    aria-invalid={!!rowErrors?.secondary_price}
                    className={cn(
                      'h-8 w-full px-2 rounded border text-sm',
                      'focus:outline-none focus:ring-1 focus:ring-blue-400',
                      rowErrors?.secondary_price ? 'border-red-400' : 'border-gray-300'
                    )}
                  />
                  {rowErrors?.secondary_price && (
                    <p className="text-xs text-red-600 mt-0.5">{rowErrors.secondary_price}</p>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeStripRow(i)}
                  aria-label={t('settings.removeTariff')}
                  className="mt-1 text-gray-400 hover:text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Tariff multi-select */}
              <TariffMultiSelect
                tariffs={form.tariffs}
                selectedIndices={row.selected_tariff_indices}
                onChange={(indices) => updateStripTariffSelection(i, indices)}
              />
            </div>
          )
        })}

        {/* Add strip button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={addStripRow}
            className={cn(
              'text-xs px-2 py-1 rounded border border-dashed',
              'border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600'
            )}
          >
            + {t('settings.addStrip')}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasInvalidStrips}
          className={cn(
            'h-9 px-4 rounded text-sm font-medium',
            'bg-blue-600 text-white hover:bg-blue-700',
            'focus:outline-none focus:ring-2 focus:ring-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {t('settings.save')}
        </button>
        <button
          type="button"
          onClick={handleCancelForm}
          className={cn(
            'h-9 px-4 rounded text-sm font-medium',
            'border border-gray-300 text-gray-700 hover:bg-gray-50',
            'focus:outline-none focus:ring-2 focus:ring-blue-400'
          )}
        >
          {t('settings.cancel')}
        </button>
      </div>
    </div>
  )
}
