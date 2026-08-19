/**
 * ImageConfig.tsx
 *
 * Configuration section for fair images management.
 * Displays a list of available fairs (year + name), a selector for the active fair,
 * and checkboxes for controlling print layers (fondo and sello).
 *
 * This component is intended to be embedded in the MaquinaView as an additional
 * configuration section, following the same collapsible pattern as other sections.
 *
 * Validates: Requirements 3.1, 3.4, 5.1, 5.2, 6.1
 */

import { useCallback, useEffect, useState } from 'react'
import { useImagesStore } from '@renderer/stores/images.store'
import { resyncImages } from '@renderer/lib/ipc-client'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageConfig(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const {
    fairList,
    activeFair,
    loading,
    error,
    loadFairList,
    selectFair
  } = useImagesStore()

  // Load fair list on mount
  useEffect(() => {
    loadFairList()
  }, [loadFairList])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleFairChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      if (!value) return

      // value format: "year/fairName"
      const [year, fairName] = value.split('/')
      if (year && fairName) {
        await selectFair(year, fairName)
      }
    },
    [selectFair]
  )

  const handleResync = useCallback(async () => {
    setSyncing(true)
    try {
      await resyncImages()
      await loadFairList()
    } catch (err) {
      console.error('[ImageConfig] Error resyncing images:', err)
    } finally {
      setSyncing(false)
    }
  }, [loadFairList])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeFairValue = activeFair ? `${activeFair.year}/${activeFair.fairName}` : ''

  const headerLabel = activeFair
    ? `${activeFair.year} — ${activeFair.fairName}`
    : 'Sin feria seleccionada'

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="images-section-heading" className="mt-4">
      {/* Collapsible header */}
      <button
        type="button"
        id="images-section-heading"
        className="w-full bg-[rgb(100,149,237)] p-2 rounded cursor-pointer flex items-center gap-2
                   text-left text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="images-section-content"
      >
        <input
          type="checkbox"
          checked={!collapsed}
          readOnly
          className="cursor-pointer"
          tabIndex={-1}
          aria-hidden="true"
        />
        <h3 className="text-base font-bold m-0">
          IMÁGENES FERIA: {headerLabel}
        </h3>
      </button>

      {/* Content panel */}
      {!collapsed && (
        <div
          id="images-section-content"
          className="border border-gray-200 rounded-b p-4 bg-white"
          role="region"
          aria-label="Configuración de imágenes de feria"
        >
          {/* Error message */}
          {error && (
            <div className="mb-3 p-2 bg-red-100 text-red-800 rounded text-sm" role="alert">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <p className="text-sm text-gray-500 mb-3">Cargando ferias...</p>
          )}

          {/* Fair selector */}
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <div className="flex flex-col">
              <label htmlFor="fair-selector" className="text-xs text-gray-600 mb-1">
                Feria activa
              </label>
              <select
                id="fair-selector"
                value={activeFairValue}
                onChange={handleFairChange}
                disabled={loading || fairList.length === 0}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
                aria-describedby="fair-selector-desc"
              >
                <option value="">— Seleccionar feria —</option>
                {fairList.map((fair) => (
                  <option key={`${fair.year}/${fair.fairName}`} value={`${fair.year}/${fair.fairName}`}>
                    {fair.year} — {fair.fairName}
                  </option>
                ))}
              </select>
              <span id="fair-selector-desc" className="sr-only">
                Selecciona la feria activa para cargar sus imágenes
              </span>
            </div>

            {fairList.length === 0 && !loading && (
              <p className="text-sm text-gray-400 italic">
                No hay ferias disponibles. Añade carpetas en bbdd-ferias/ y pulsa Resincronizar.
              </p>
            )}

            <button
              type="button"
              onClick={handleResync}
              disabled={syncing || loading}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium
                         hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400
                         disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Resincronizar imágenes de ferias"
            >
              {syncing ? 'Sincronizando...' : 'Resincronizar'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
