/**
 * TariffGroupSection.tsx
 *
 * Section for managing tariff groups organized by year.
 * Provides:
 * - Year selector (descending order)
 * - List of groups for the selected year showing title, currency, tariff count
 * - Detail view when a group is selected (all tariffs with name, price, position)
 * - CRUD action buttons: create, edit, delete
 * - Delete confirmation dialog
 * - Error display (e.g., group in use)
 *
 * Uses the tariff-groups Zustand store for state management.
 */

import { useEffect, useState } from 'react'
import { useTariffGroupsStore } from '@renderer/stores/tariff-groups.store'
import type { TariffGroup } from '@renderer/lib/ipc-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TariffGroupSectionProps {
  /** Callback when user wants to create a new group */
  onCreateGroup?: () => void
  /** Callback when user wants to edit the selected group */
  onEditGroup?: (group: TariffGroup) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TariffGroupSection({
  onCreateGroup,
  onEditGroup
}: TariffGroupSectionProps): JSX.Element {
  const {
    groups,
    years,
    selectedYear,
    selectedGroup,
    loading,
    error,
    loadYears,
    loadByYear,
    selectGroup,
    deleteGroup
  } = useTariffGroupsStore()

  const [expanded, setExpanded] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Load years on mount
  useEffect(() => {
    loadYears()
  }, [loadYears])

  // Auto-select the first year when years are loaded
  useEffect(() => {
    if (years.length > 0 && selectedYear === null) {
      loadByYear(years[0])
    }
  }, [years, selectedYear, loadByYear])

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      selectGroup(null)
      setDeleteError(null)
      loadByYear(value)
    }
  }

  const handleSelectGroup = (group: TariffGroup): void => {
    selectGroup(group)
    setDeleteError(null)
  }

  const handleDeselectGroup = (): void => {
    selectGroup(null)
    setDeleteError(null)
  }

  const handleCreateClick = (): void => {
    onCreateGroup?.()
  }

  const handleEditClick = (): void => {
    if (selectedGroup) {
      onEditGroup?.(selectedGroup)
    }
  }

  const handleDeleteClick = (): void => {
    setShowDeleteDialog(true)
    setDeleteError(null)
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!selectedGroup) return

    const result = await deleteGroup(selectedGroup.id)
    if (result.success) {
      setShowDeleteDialog(false)
      setDeleteError(null)
    } else {
      setDeleteError(result.error || 'Error al eliminar el grupo')
    }
  }

  const handleCancelDelete = (): void => {
    setShowDeleteDialog(false)
    setDeleteError(null)
  }

  return (
    <section aria-labelledby="tariff-groups-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-tariff-groups"
          type="checkbox"
          checked={expanded}
          onChange={() => setExpanded(!expanded)}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="tariff-groups-section-content"
        />
        <label
          htmlFor="toggle-tariff-groups"
          id="tariff-groups-section-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          GRUPOS DE TARIFAS
        </label>
      </div>

      {expanded && (
        <div
          id="tariff-groups-section-content"
          className="p-4"
          role="region"
          aria-labelledby="tariff-groups-section-heading"
        >
          {/* Error display */}
          {error && (
            <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}

          {/* Year selector + action buttons */}
          <div className="flex items-end gap-4 mb-4 flex-wrap">
            <div>
              <label
                htmlFor="tariff-group-year-selector"
                className="block text-sm font-bold text-gray-700 mb-1"
              >
                Año
              </label>
              <select
                id="tariff-group-year-selector"
                value={selectedYear ?? ''}
                onChange={handleYearChange}
                disabled={loading}
                className="w-[120px] border border-gray-300 rounded p-2"
                aria-label="Seleccionar año de grupos de tarifas"
              >
                {years.length === 0 && <option value="">Sin grupos</option>}
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateClick}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-2 px-3 rounded text-sm"
                aria-label="Crear nuevo grupo de tarifas"
              >
                + Crear grupo
              </button>
              {selectedGroup && (
                <>
                  <button
                    type="button"
                    onClick={handleEditClick}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-3 rounded text-sm"
                    aria-label="Editar grupo seleccionado"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2 px-3 rounded text-sm"
                    aria-label="Eliminar grupo seleccionado"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Loading indicator */}
          {loading && (
            <p className="text-center text-gray-500 p-4">Cargando grupos...</p>
          )}

          {/* Groups list */}
          {!loading && groups.length === 0 && (
            <p className="text-gray-400 italic">
              No hay grupos de tarifas para este año.
            </p>
          )}

          {!loading && groups.length > 0 && (
            <div className="grid gap-2 mb-4">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className={`text-left w-full border rounded p-3 transition-colors ${
                    selectedGroup?.id === group.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                  aria-pressed={selectedGroup?.id === group.id}
                >
                  <span className="font-bold text-blue-700">{group.title}</span>
                  <span className="ml-2 text-xs font-mono bg-gray-100 px-1 rounded">
                    {group.currency}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({group.tariffs.length} tarifas)
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Group detail view */}
          {selectedGroup && (
            <div className="border border-gray-300 rounded p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg text-gray-800">
                  {selectedGroup.title}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({selectedGroup.currency})
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={handleDeselectGroup}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                  aria-label="Cerrar detalle del grupo"
                >
                  ✕
                </button>
              </div>

              {/* Tariffs table */}
              <table className="w-full text-sm" aria-label="Tarifas del grupo seleccionado">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 px-2 text-gray-600">#</th>
                    <th className="text-left py-1 px-2 text-gray-600">Nombre</th>
                    <th className="text-right py-1 px-2 text-gray-600">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.tariffs.map((tariff) => (
                    <tr key={tariff.position} className="border-b border-gray-100">
                      <td className="py-1 px-2 text-gray-400">{tariff.position}</td>
                      <td className="py-1 px-2 font-medium">{tariff.name}</td>
                      <td className="py-1 px-2 text-right font-mono">
                        {tariff.price.toFixed(2)} {selectedGroup.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Delete confirmation dialog */}
          {showDeleteDialog && selectedGroup && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
            >
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 id="delete-dialog-title" className="text-lg font-bold mb-2">
                  Confirmar eliminación
                </h3>
                <p className="text-gray-600 mb-4">
                  ¿Está seguro de que desea eliminar el grupo{' '}
                  <span className="font-bold">&quot;{selectedGroup.title}&quot;</span>?
                  Esta acción no se puede deshacer.
                </p>

                {/* Delete error (e.g., group in use by events) */}
                {deleteError && (
                  <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded p-2">
                    {deleteError}
                  </p>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2 px-4 rounded"
                  >
                    {loading ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
