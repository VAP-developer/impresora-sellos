/**
 * MaquinaView.tsx
 *
 * Machine configuration view: Código de Etiqueta, Ticket, Rollos, Tiras Especiales.
 * Provides a "Guardar" (Save) button that persists all changes to the main process
 * via IPC (config:updateMaquina channel).
 *
 * Replicates the legacy MaquinaView.vue behavior:
 * - All fields are edited locally in form state
 * - Pressing "Guardar" collects ticket + codigo partials and persists them
 * - Roll operations (quitar/colocar) also insert audit order lines immediately
 *
 * Validates: Requirements 12.1, 12.2, 12.3
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@renderer/stores/config.store'
import * as ipc from '@renderer/lib/ipc-client'
import { downloadCSV } from '@renderer/lib/ipc-client'
import type { CodigoConfig, TicketConfig } from '@renderer/types/config'
import type { OrderLine } from '@renderer/types/order'
import CodigoSection from '@renderer/components/maquina/CodigoSection'
import TicketSection from '@renderer/components/maquina/TicketSection'
import RollosSection from '@renderer/components/maquina/RollosSection'
import TirasSection from '@renderer/components/maquina/TirasSection'
import ImageConfig from '@renderer/components/images/ImageConfig'

export default function MaquinaView(): JSX.Element {
  const navigate = useNavigate()
  const { config, loading, error: storeError, loadConfig, updateMaquina } = useConfigStore()

  // Local form state for pending changes (not yet persisted)
  const [ticketChanges, setTicketChanges] = useState<Partial<TicketConfig>>({})
  const [codigoChanges, setCodigoChanges] = useState<Partial<CodigoConfig>>({})

  // Save operation state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Export operation state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Load config on mount if not already loaded
  useEffect(() => {
    if (!config && !loading) {
      loadConfig()
    }
  }, [config, loading, loadConfig])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (!saveSuccess) return undefined
    const timer = setTimeout(() => setSaveSuccess(false), 3000)
    return () => clearTimeout(timer)
  }, [saveSuccess])

  // Derived values from config
  const ticket = config?.ticket
  const codigo = config?.codigo
  const sello = config?.sello

  // Active event's model names for display
  const nombreModelo1 = useMemo(() => {
    if (!sello) return ''
    const evIdx = sello.elevento ?? 0
    const evento = sello.eventos?.[evIdx]
    return evento?.motivoi ?? sello.modelo1 ?? ''
  }, [sello])

  const nombreModelo2 = useMemo(() => {
    if (!sello) return ''
    const evIdx = sello.elevento ?? 0
    const evento = sello.eventos?.[evIdx]
    return evento?.motivod ?? sello.modelo2 ?? ''
  }, [sello])

  // Active profile name
  const activeProfileName = useMemo(() => {
    return sello?.elnperfil ?? 'FERIA'
  }, [sello])

  // Active event's feria and lugar for ticket header display
  const feriaDisplay = useMemo(() => {
    return sello?.feria ?? config?.ticket?.feria ?? ''
  }, [sello, config])

  const lugarDisplay = useMemo(() => {
    return sello?.lugar ?? config?.ticket?.lugar ?? ''
  }, [sello, config])

  // Merged ticket config (original + local changes) for passing to children
  const mergedTicket = useMemo((): TicketConfig | undefined => {
    if (!ticket) return undefined
    return { ...ticket, ...ticketChanges }
  }, [ticket, ticketChanges])

  // Merged codigo config for passing to children
  const mergedCodigo = useMemo((): CodigoConfig | undefined => {
    if (!codigo) return undefined
    return { ...codigo, ...codigoChanges }
  }, [codigo, codigoChanges])

  // ─── Callbacks for child sections ──────────────────────────────────────────

  const handleCodigoChange = useCallback((updated: Partial<CodigoConfig>) => {
    setCodigoChanges((prev) => ({ ...prev, ...updated }))
  }, [])

  const handleTicketChange = useCallback((updated: Partial<TicketConfig>) => {
    setTicketChanges((prev) => ({ ...prev, ...updated }))
  }, [])

  const handleInsertOrder = useCallback(async (order: OrderLine): Promise<void> => {
    await ipc.insertOrders([order])
  }, [])

  // ─── Save handler ─────────────────────────────────────────────────────────

  const handleGuardar = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await updateMaquina({
        ticket: ticketChanges,
        codigo: codigoChanges
      })

      // Reset local changes since they are now persisted
      setTicketChanges({})
      setCodigoChanges({})
      setSaveSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la configuración'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }, [ticketChanges, codigoChanges, updateMaquina])

  // ─── Export XLS handler ───────────────────────────────────────────────────

  const handleExportXLS = useCallback(async () => {
    setExportError(null)
    setExporting(true)
    try {
      const fileContent = await downloadCSV()
      if (fileContent) {
        const nameFile = 'reporte-ATM.csv'
        const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nameFile
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[MaquinaView] Error exporting CSV:', err)
      setExportError('Error al exportar. Inténtelo de nuevo.')
    } finally {
      setExporting(false)
    }
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-black text-[25px] font-bold text-center m-0">Máquina</h1>
        <button
          type="button"
          className="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500
                     focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          onClick={handleGuardar}
          disabled={saving || loading || !config}
          aria-label="Guardar configuración de máquina"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <p className="text-gray-500 text-[25px] font-bold text-center m-0">
          Configuración de código, ticket y rollos
        </p>
      </div>

      {/* Save feedback messages */}
      {saveSuccess && (
        <div
          className="mx-4 mb-2 p-2 bg-green-100 text-green-800 rounded text-center"
          role="status"
          aria-live="polite"
        >
          Configuración guardada correctamente
        </div>
      )}
      {saveError && (
        <div
          className="mx-4 mb-2 p-2 bg-red-100 text-red-800 rounded text-center"
          role="alert"
        >
          {saveError}
        </div>
      )}
      {storeError && (
        <div
          className="mx-4 mb-2 p-2 bg-red-100 text-red-800 rounded text-center"
          role="alert"
        >
          Error al cargar: {storeError}
        </div>
      )}

      {/* Main form area */}
      {(loading || !config) ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      ) : (
      <div className="flex justify-center mt-4">
        <div className="w-full max-w-7xl px-4">
          {/* Section 1: CÓDIGO ETIQUETA */}
          {mergedCodigo && (
            <CodigoSection codigo={mergedCodigo} onChange={handleCodigoChange} />
          )}

          {/* Section 2: TICKET */}
          {mergedTicket && (
            <TicketSection
              ticket={mergedTicket}
              activeProfileName={activeProfileName}
              feriaDisplay={feriaDisplay}
              lugarDisplay={lugarDisplay}
              onChange={handleTicketChange}
            />
          )}

          {/* Section 3: ROLLOS */}
          {mergedTicket && (
            <RollosSection
              ticket={mergedTicket}
              nombreModelo1={nombreModelo1}
              nombreModelo2={nombreModelo2}
              onChange={handleTicketChange}
              onInsertOrder={handleInsertOrder}
            />
          )}

          {/* Section 4: TIRAS ESPECIALES */}
          {mergedTicket && (
            <TirasSection
              ticket={mergedTicket}
              nombreModelo1={nombreModelo1}
              nombreModelo2={nombreModelo2}
              onChange={handleTicketChange}
            />
          )}

          {/* Section 5: IMÁGENES FERIA */}
          <ImageConfig />

          {/* Footer buttons */}
          <div className="flex justify-center items-center gap-4 mt-6 mb-4">
            <button
              type="button"
              className="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500
                         focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>

            <button
              type="button"
              className="bg-[#212F5D] text-white px-4 py-2 rounded font-semibold hover:bg-[#2d3f7a]
                         focus:outline-none focus:ring-2 focus:ring-[#212F5D] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExportXLS}
              disabled={exporting}
              aria-label="Exportar informe XLS"
            >
              {exporting ? 'Exportando...' : 'Exportar XLS'}
            </button>
            <button
              type="button"
              className="bg-gray-200 text-black px-4 py-2 rounded font-semibold hover:bg-gray-300
                         focus:outline-none focus:ring-2 focus:ring-gray-300"
              onClick={() => navigate('/home')}
            >
              Cancelar
            </button>
          </div>

          {/* Export error message */}
          {exportError && (
            <div
              className="mx-4 mb-4 p-2 bg-red-100 text-red-800 rounded text-center"
              role="alert"
            >
              {exportError}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
