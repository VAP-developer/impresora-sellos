import { useCallback, useEffect, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import type { PreciosConfig, SelloConfig } from '@renderer/types/config'
import type { EventoRow } from '@renderer/lib/ipc-client'
import { getEventoById } from '@renderer/lib/ipc-client'
import EventoSection from '@renderer/components/imprimir/EventoSection'
import EventoEditor from '@renderer/components/imprimir/EventoEditor'
import { useKioskoStore } from '@renderer/stores/kiosko.store'

export default function ImprimirView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const updateImprimir = useConfigStore((s) => s.updateImprimir)
  const updateMaquina = useConfigStore((s) => s.updateMaquina)
  const resetKiosko = useKioskoStore((s) => s.reset)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Profile selection comes from config store (managed in Settings)
  const selectedPerfil = config?.sello.elperfil ?? 6

  // Selected event from the DB (new system)
  const [selectedEvento, setSelectedEvento] = useState<EventoRow | null>(null)

  // Key to force EventoSection to re-fetch after edits
  const [eventosRefreshKey, setEventosRefreshKey] = useState(0)

  // Profile names come from config store (managed in Settings)
  const localProfileNames: Record<number, string> = {
    1: config?.sello.nperfil1 ?? 'Filatelia',
    2: config?.sello.nperfil2 ?? 'Esporádicos',
    3: config?.sello.nperfil3 ?? 'SPDE',
    4: config?.sello.nperfil4 ?? '',
    5: config?.sello.nperfil5 ?? 'Abono/Envío',
    6: config?.sello.nperfil6 ?? 'FERIA'
  }



  // On mount, try to load the previously active event from config
  useEffect(() => {
    if (config?.sello.elevento && config.sello.elevento > 0) {
      // elevento now stores the DB event ID
      getEventoById(config.sello.elevento)
        .then((ev) => {
          if (ev) setSelectedEvento(ev)
        })
        .catch(() => { /* ignore - event may have been deleted */ })
    }
  }, [])







  const handleEventoChange = useCallback((evento: EventoRow | null) => {
    setSelectedEvento(evento)
  }, [])

  const handleEventosChanged = useCallback(() => {
    setEventosRefreshKey((k) => k + 1)
  }, [])







  /**
   * Guardar + Activar: Persists the local state (profile, event, profile names,
   * tariff prices) via IPC and navigates to Kiosko.
   * The selected event from the DB is mapped into the sello config for compatibility
   * with the rest of the system (printing, kiosko, etc.).
   */
  const handleSave = useCallback(async () => {
    if (!config) return

    setSaving(true)
    setSaveError(null)

    try {
      // Determine the active profile name
      const perfilNames: Record<number, string> = {
        1: localProfileNames[1],
        2: localProfileNames[2],
        3: localProfileNames[3],
        4: localProfileNames[4],
        5: localProfileNames[5],
        6: localProfileNames[6]
      }
      const elnperfil = perfilNames[selectedPerfil] ?? ''

      // Map selected DB event into sello fields for compatibility
      const ev = selectedEvento
      const activeModelo1 = ev?.motivoi ?? ''
      const activeModelo2 = ev?.motivod ?? ''

      // Build the eventos array for backward compatibility
      // The first slot contains the active event, rest remain from config
      const eventos = config.sello.eventos ? [...config.sello.eventos] : []
      if (ev) {
        eventos[0] = {
          nevento: ev.nevento,
          nferia: ev.nferia,
          nlugar: ev.nlugar,
          motivoi: ev.motivoi,
          motivod: ev.motivod,
          fecha: ev.fecha,
          localidad: ev.localidad,
          codigo: ev.codigo
        }
      }

      // Build sello update payload
      const selloUpdate: Partial<SelloConfig> = {
        elperfil: selectedPerfil,
        elnperfil,
        elevento: ev?.id ?? 0, // Now stores the DB event ID
        elnevento: ev?.nevento ?? '',
        feria: ev?.nferia ?? '',
        lugar: ev?.nlugar ?? '',
        modelo1: activeModelo1,
        modelo2: activeModelo2,
        modo: config.sello.modo,
        nperfil1: localProfileNames[1],
        nperfil2: localProfileNames[2],
        nperfil3: localProfileNames[3],
        nperfil4: localProfileNames[4],
        nperfil5: localProfileNames[5],
        nperfil6: localProfileNames[6],
        eventos
      }

      // Use precios from config (managed in Settings)
      const preciosUpdate: PreciosConfig = {
        tarifaA: config.precios.tarifaA,
        tarifaA2: config.precios.tarifaA2,
        tarifaB: config.precios.tarifaB,
        tarifaC: config.precios.tarifaC,
        tarifaTA: config.precios.tarifaTA,
        tarifaT4: config.precios.tarifaT4
      }

      await updateImprimir({ sello: selloUpdate, precios: preciosUpdate })

      // Si el evento cambió a uno distinto, resetear los rollos de etiqueta
      // para que el usuario reconfigure en la pestaña Máquina.
      const previousEventId = config.sello.elevento ?? 0
      const newEventId = ev?.id ?? 0
      if (newEventId !== previousEventId && newEventId > 0) {
        await updateMaquina({
          ticket: { rollo1: -1, rollo2: -1 },
          codigo: {}
        })
        // Resetear cantidades del kiosko para evitar datos del evento anterior
        resetKiosko()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar configuración'
      setSaveError(message)
      console.error('Error al guardar configuración:', err)
    } finally {
      setSaving(false)
    }
  }, [config, selectedPerfil, selectedEvento, localProfileNames, updateImprimir, updateMaquina, resetKiosko])

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Header - same format as MaquinaView */}
      <div className="flex flex-col items-center px-4 py-2">
        <h1 className="text-black text-[25px] font-bold text-center m-0">Eventos</h1>
        <p className="text-gray-500 text-[25px] font-bold text-center m-0">
          Creación de eventos
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500
                     focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {saveError && (
        <div className="mx-4 mb-2 p-2 bg-red-100 text-red-800 rounded text-center" role="alert">
          {saveError}
        </div>
      )}

      {/* Event section - select active event by year */}
      <EventoSection
        key={eventosRefreshKey}
        ticket={config.ticket}
        selectedEvento={selectedEvento}
        onEventoChange={handleEventoChange}
      />

      {/* Event editor - create/edit/delete events by year */}
      <EventoEditor
        onEventosChanged={handleEventosChanged}
      />
    </div>
  )
}
