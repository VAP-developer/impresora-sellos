import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@renderer/stores/config.store'
import type { PreciosConfig, SelloConfig } from '@renderer/types/config'
import type { EventoRow } from '@renderer/lib/ipc-client'
import { getEventoById } from '@renderer/lib/ipc-client'
import PerfilSection from '@renderer/components/imprimir/PerfilSection'
import EventoSection from '@renderer/components/imprimir/EventoSection'
import EventoEditor from '@renderer/components/imprimir/EventoEditor'
import PerfilesSection from '@renderer/components/imprimir/PerfilesSection'
import TarifaSection from '@renderer/components/imprimir/TarifaSection'
import PrinterSection from '@renderer/components/imprimir/PrinterSection'

export default function ImprimirView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const updateImprimir = useConfigStore((s) => s.updateImprimir)
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Local state for profile selection
  const [selectedPerfil, setSelectedPerfil] = useState<number>(
    config?.sello.elperfil ?? 6
  )

  // Selected event from the DB (new system)
  const [selectedEvento, setSelectedEvento] = useState<EventoRow | null>(null)

  // Key to force EventoSection to re-fetch after edits
  const [eventosRefreshKey, setEventosRefreshKey] = useState(0)

  // Local editable profile names (only nperfil4 is actually editable)
  const [localProfileNames, setLocalProfileNames] = useState<Record<number, string>>(() => ({
    1: config?.sello.nperfil1 ?? 'Filatelia',
    2: config?.sello.nperfil2 ?? 'Esporádicos',
    3: config?.sello.nperfil3 ?? 'SPDE',
    4: config?.sello.nperfil4 ?? '',
    5: config?.sello.nperfil5 ?? 'Abono/Envío',
    6: config?.sello.nperfil6 ?? 'FERIA'
  }))

  // Local editable prices
  const [localPrecios, setLocalPrecios] = useState<PreciosConfig>(() => ({
    tarifaA: config?.precios.tarifaA ?? 0,
    tarifaA2: config?.precios.tarifaA2 ?? 0,
    tarifaB: config?.precios.tarifaB ?? 0,
    tarifaC: config?.precios.tarifaC ?? 0,
    tarifaTA: config?.precios.tarifaTA ?? 0,
    tarifaT4: config?.precios.tarifaT4 ?? 0
  }))

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

  // Sync local profile names from config when it loads/changes externally
  useEffect(() => {
    if (config?.sello) {
      setLocalProfileNames({
        1: config.sello.nperfil1 ?? 'Filatelia',
        2: config.sello.nperfil2 ?? 'Esporádicos',
        3: config.sello.nperfil3 ?? 'SPDE',
        4: config.sello.nperfil4 ?? '',
        5: config.sello.nperfil5 ?? 'Abono/Envío',
        6: config.sello.nperfil6 ?? 'FERIA'
      })
    }
  }, [config?.sello.nperfil1, config?.sello.nperfil2, config?.sello.nperfil3, config?.sello.nperfil4, config?.sello.nperfil5, config?.sello.nperfil6])

  // Sync local precios from config when it loads/changes externally
  useEffect(() => {
    if (config?.precios) {
      setLocalPrecios({
        tarifaA: config.precios.tarifaA ?? 0,
        tarifaA2: config.precios.tarifaA2 ?? 0,
        tarifaB: config.precios.tarifaB ?? 0,
        tarifaC: config.precios.tarifaC ?? 0,
        tarifaTA: config.precios.tarifaTA ?? 0,
        tarifaT4: config.precios.tarifaT4 ?? 0
      })
    }
  }, [config?.precios.tarifaA, config?.precios.tarifaA2, config?.precios.tarifaB, config?.precios.tarifaC, config?.precios.tarifaTA, config?.precios.tarifaT4])

  const handlePerfilChange = useCallback((perfil: number) => {
    setSelectedPerfil(perfil)
  }, [])

  const handleEventoChange = useCallback((evento: EventoRow | null) => {
    setSelectedEvento(evento)
  }, [])

  const handleEventosChanged = useCallback(() => {
    setEventosRefreshKey((k) => k + 1)
  }, [])

  const handleProfileNameChange = useCallback(
    (profileIndex: number, value: string) => {
      setLocalProfileNames((prev) => ({ ...prev, [profileIndex]: value }))
    },
    []
  )

  const handlePreciosChange = useCallback(
    (field: keyof PreciosConfig, value: number) => {
      setLocalPrecios((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

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

      // Build precios payload
      const preciosUpdate: PreciosConfig = {
        tarifaA: localPrecios.tarifaA,
        tarifaA2: localPrecios.tarifaA2,
        tarifaB: localPrecios.tarifaB,
        tarifaC: localPrecios.tarifaC,
        tarifaTA: localPrecios.tarifaTA,
        tarifaT4: localPrecios.tarifaT4
      }

      await updateImprimir({ sello: selloUpdate, precios: preciosUpdate })

      // Navigate to Kiosko (main working view) after successful save
      navigate('/kiosko')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar configuración'
      setSaveError(message)
      console.error('Error al guardar configuración:', err)
    } finally {
      setSaving(false)
    }
  }, [config, selectedPerfil, selectedEvento, localProfileNames, localPrecios, updateImprimir, navigate])

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <p className="text-black text-2xl font-bold text-center">CONFIGURACIÓN</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded"
        >
          {saving ? 'Guardando...' : 'GUARDAR e ir al KIOSKO'}
        </button>
        {saveError && (
          <p className="text-red-600 text-sm">{saveError}</p>
        )}
        <p className="text-gray-500 text-2xl font-bold text-center">
          PERFIL - EVENTOS - TARIFAS
        </p>
      </div>

      {/* Profile section */}
      <PerfilSection
        sello={config.sello}
        selectedPerfil={selectedPerfil}
        onPerfilChange={handlePerfilChange}
      />

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

      {/* Profiles name editor (collapsible) */}
      <PerfilesSection
        sello={{
          ...config.sello,
          nperfil1: localProfileNames[1],
          nperfil2: localProfileNames[2],
          nperfil3: localProfileNames[3],
          nperfil4: localProfileNames[4],
          nperfil5: localProfileNames[5],
          nperfil6: localProfileNames[6]
        }}
        onProfileNameChange={handleProfileNameChange}
      />

      {/* Tariff prices editor (collapsible) */}
      <TarifaSection
        precios={localPrecios}
        onPreciosChange={handlePreciosChange}
      />

      {/* Printer management section */}
      <PrinterSection />

      {/* Footer buttons */}
      <div className="flex justify-center gap-4 p-4">
        <button
          onClick={() => navigate('/home')}
          className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded"
        >
          {saving ? 'Guardando...' : 'GUARDAR + ACTIVAR'}
        </button>
      </div>
    </div>
  )
}
