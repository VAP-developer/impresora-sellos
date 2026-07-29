/**
 * TariffGroupSection.tsx
 *
 * Manages tariff groups within the Settings view.
 * Lists existing groups organized by year, with full CRUD support.
 * Supports differentiated tariff types (individual and strip) with
 * client-side validation and translated error messages.
 *
 * Requirements: 1.4, 2.4, 3.2, 3.4, 3.5, 3.6, 4.1-4.9
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTariffGroupsStore } from '@renderer/stores/tariff-groups.store'
import { CurrencySelector } from './CurrencySelector'
import { cn } from '../../lib/utils'
import type { TariffGroup, TariffGroupInput, TariffGroupUpdateInput } from '@renderer/lib/ipc-client'

// ─── Local Types (extend base types with differentiated tariff support) ────────

type TariffType = 'individual' | 'strip'

interface TariffFormRow {
  name: string
  price: string
  type: TariffType
  strip_count: string
}

interface FormState {
  year: string
  title: string
  currency: string
  tariffs: TariffFormRow[]
}

interface FormErrors {
  year?: string
  title?: string
  tariffs?: Record<number, { name?: string; price?: string; strip_count?: string }>
  general?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyIndividualRow(): TariffFormRow {
  return { name: '', price: '', type: 'individual', strip_count: '' }
}

function emptyStripRow(): TariffFormRow {
  return { name: '', price: '', type: 'strip', strip_count: '2' }
}

function groupToFormState(group: TariffGroup): FormState {
  return {
    year: String(group.year),
    title: group.title,
    currency: group.currency,
    tariffs: group.tariffs.map((t) => ({
      name: t.name,
      price: String(t.price),
      type: ((t as { type?: string }).type as TariffType) || 'individual',
      strip_count: String((t as { strip_count?: number }).strip_count || '')
    }))
  }
}

function initialFormState(): FormState {
  return {
    year: String(new Date().getFullYear()),
    title: '',
    currency: 'EUR',
    tariffs: [emptyIndividualRow(), emptyIndividualRow()]
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
      const tariffErrors: Record<number, { name?: string; price?: string; strip_count?: string }> = {}

      // Year
      const yearNum = Number(formData.year)
      if (!formData.year.trim() || isNaN(yearNum) || !Number.isInteger(yearNum)) {
        errs.year = t('validation.yearRequired')
      }

      // Title
      if (!formData.title.trim()) {
        errs.title = t('validation.titleRequired')
      }

      // Count individuals
      const individuals = formData.tariffs.filter((tr) => tr.type === 'individual')
      if (individuals.length < 2) {
        errs.general = t('validation.minTariffs')
      } else if (individuals.length > 20) {
        errs.general = t('validation.maxTariffs')
      }

      // Validate each tariff row
      formData.tariffs.forEach((row, i) => {
        const rowErr: { name?: string; price?: string; strip_count?: string } = {}

        // Name: 1-16 characters
        if (!row.name.trim()) {
          rowErr.name = t('validation.nameRequired')
        } else if (row.name.trim().length > 16) {
          rowErr.name = t('validation.nameTooLong')
        }

        // Price: > 0
        const price = Number(row.price)
        if (!row.price.trim() || isNaN(price) || !isFinite(price) || price <= 0) {
          rowErr.price = t('validation.pricePositive')
        }

        // Strip count validation for strip type
        if (row.type === 'strip') {
          const sc = Number(row.strip_count)
          if (isNaN(sc) || !Number.isInteger(sc) || sc < 2) {
            rowErr.strip_count = t('validation.stripCountMin')
          } else if (sc > individuals.length) {
            rowErr.strip_count = t('validation.stripCountMax')
          }
        }

        if (Object.keys(rowErr).length > 0) {
          tariffErrors[i] = rowErr
        }
      })

      if (Object.keys(tariffErrors).length > 0) {
        errs.tariffs = tariffErrors
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
    const result = await deleteGroup(id)
    if (!result.success) {
      // error is shown via store.error
    }
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
        price: Number(row.price),
        position: i + 1,
        type: row.type,
        strip_count: row.type === 'strip' ? Number(row.strip_count) : undefined
      }))

      if (mode === 'create') {
        const input: TariffGroupInput = {
          year: Number(form.year),
          title: form.title.trim(),
          currency: form.currency,
          tariffs: tariffs as TariffGroupInput['tariffs']
        }
        await createGroup(input)
      } else if (mode === 'edit' && editingGroup) {
        const input: TariffGroupUpdateInput = {
          year: Number(form.year),
          title: form.title.trim(),
          currency: form.currency,
          tariffs: tariffs as TariffGroupUpdateInput['tariffs']
        }
        await updateGroup(editingGroup.id, input)
      }

      setMode('list')
      setEditingGroup(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.saveFailed')
      // Check for duplicate year error
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

  function addTariffRow(type: TariffType): void {
    setForm((prev) => ({
      ...prev,
      tariffs: [...prev.tariffs, type === 'individual' ? emptyIndividualRow() : emptyStripRow()]
    }))
  }

  function removeTariffRow(index: number): void {
    setForm((prev) => ({
      ...prev,
      tariffs: prev.tariffs.filter((_, i) => i !== index)
    }))
  }

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
          const individualsCount = group.tariffs.filter(
            (tr) => ((tr as { type?: string }).type || 'individual') === 'individual'
          ).length
          const stripsCount = group.tariffs.filter(
            (tr) => (tr as { type?: string }).type === 'strip'
          ).length

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
                    ({group.currency})
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
                {individualsCount} {t('settings.individual').toLowerCase()}
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

  const individuals = form.tariffs.filter((tr) => tr.type === 'individual')
  const individualsCount = individuals.length

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

      {/* Year + Title + Currency */}
      <div className="grid grid-cols-3 gap-3">
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

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('settings.currency')}
          </label>
          <CurrencySelector
            value={form.currency}
            onChange={(val) => setForm((prev) => ({ ...prev, currency: val }))}
          />
        </div>
      </div>

      {/* Tariffs Table */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
          {t('settings.tariffGroups')} ({form.tariffs.length})
        </div>

        {form.tariffs.map((row, i) => {
          const rowErrors = errors.tariffs?.[i]
          return (
            <div
              key={i}
              className="flex items-start gap-2 p-2 border border-gray-100 rounded bg-gray-50"
            >
              {/* Type badge */}
              <span
                className={cn(
                  'mt-1.5 text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap',
                  row.type === 'individual'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                )}
              >
                {row.type === 'individual' ? t('settings.individual') : t('settings.strip')}
              </span>

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
                    rowErrors?.name
                      ? 'border-red-400'
                      : 'border-gray-300'
                  )}
                />
                {rowErrors?.name && (
                  <p className="text-xs text-red-600 mt-0.5">{rowErrors.name}</p>
                )}
              </div>

              {/* Price */}
              <div className="w-24">
                <input
                  type="number"
                  placeholder={t('settings.price')}
                  value={row.price}
                  onChange={(e) => updateTariffRow(i, 'price', e.target.value)}
                  step="0.01"
                  min="0.01"
                  aria-invalid={!!rowErrors?.price}
                  className={cn(
                    'h-8 w-full px-2 rounded border text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-blue-400',
                    rowErrors?.price
                      ? 'border-red-400'
                      : 'border-gray-300'
                  )}
                />
                {rowErrors?.price && (
                  <p className="text-xs text-red-600 mt-0.5">{rowErrors.price}</p>
                )}
              </div>

              {/* Strip count (only for strip type) */}
              {row.type === 'strip' && (
                <div className="w-20">
                  <input
                    type="number"
                    placeholder={t('settings.stripCount')}
                    value={row.strip_count}
                    onChange={(e) => updateTariffRow(i, 'strip_count', e.target.value)}
                    min={2}
                    max={individualsCount}
                    aria-invalid={!!rowErrors?.strip_count}
                    aria-label={t('settings.stripCount')}
                    className={cn(
                      'h-8 w-full px-2 rounded border text-sm',
                      'focus:outline-none focus:ring-1 focus:ring-blue-400',
                      rowErrors?.strip_count
                        ? 'border-red-400'
                        : 'border-gray-300'
                    )}
                  />
                  {rowErrors?.strip_count && (
                    <p className="text-xs text-red-600 mt-0.5">{rowErrors.strip_count}</p>
                  )}
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeTariffRow(i)}
                aria-label={t('settings.removeTariff')}
                className="mt-1 text-gray-400 hover:text-red-500 text-sm"
              >
                ✕
              </button>
            </div>
          )
        })}

        {/* Add buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => addTariffRow('individual')}
            disabled={individualsCount >= 20}
            className={cn(
              'text-xs px-2 py-1 rounded border border-dashed',
              'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            + {t('settings.addTariff')}
          </button>
          <button
            type="button"
            onClick={() => addTariffRow('strip')}
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
          disabled={saving}
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
