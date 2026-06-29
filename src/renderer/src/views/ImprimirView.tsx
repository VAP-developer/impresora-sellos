import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@renderer/stores/config.store'
import type { EventoData, PreciosConfig, SelloConfig } from '@renderer/types/config'
import PerfilSection from '@renderer/components/imprimir/PerfilSection'
import EventoSection from '@renderer/components/imprimir/EventoSection'
import EventoEditor from '@renderer/components/imprimir/EventoEditor'
import PerfilesSection from '@renderer/components/imprimir/PerfilesSection'
import TarifaSection from '@renderer/components/imprimir/TarifaSection'

export default function ImprimirView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const updateImprimir = useConfigStore((s) => s.updateImprimir)
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Local state for profile selection (persisted on save via task 9.6)
  const [selectedPerfil, setSelectedPerfil] = useState<number>(
    config?.sello.elperfil ?? 6
  )

  // Local state for event selection (persisted on save via task 9.6)
  const [selectedEvento, setSelectedEvento] = useState<number>(
    config?.sello.elevento ?? 0
  )

  // Local editable copy of event data (synced from config on load)
  const [localEventos, setLocalEventos] = useState<EventoData[]>(() =>
    config?.sello.eventos ?? Array.from({ length: 8 }, () => ({
      nevento: '',
      nferia: '',
      nlugar: '',
      motivoi: '',
      motivod: '',
      fecha: '',
      localidad: ''
    }))
  )

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

  // Sync local eventos from config when it loads/changes externally
  useEffect(() => {
    if (config?.sello.eventos) {
      setLocalEventos(config.sello.eventos.map((e) => ({ ...e })))
    }
  }, [config?.sello.eventos])

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

  const handleEventoChange = useCallback((evento: number) => {
    setSelectedEvento(evento)
  }, [])

  const handleEventoDataChange = useCallback(
    (index: number, field: keyof EventoData, value: string) => {
      setLocalEventos((prev) => {
        const updated = prev.map((e) => ({ ...e }))
        if (updated[index]) {
          updated[index] = { ...updated[index], [field]: value }
        }
        return updated
      })
    },
    []
  )

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
   * Guardar + Activar: Persists the local state (profile, event, event data,
   * profile names, tariff prices) via IPC and navigates to Kiosko.
   * Replicates the legacy guardar() behavior from ImprimirView.vue.
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

      // Derive top-level sello fields from the currently active event
      const activeEvent = localEventos[selectedEvento]
      const activeModelo1 = activeEvent?.motivoi ?? ''
      const activeModelo2 = activeEvent?.motivod ?? ''

      // Build sello update payload
      const selloUpdate: Partial<SelloConfig> = {
        elperfil: selectedPerfil,
        elnperfil,
        elevento: selectedEvento,
        elnevento: activeEvent?.nevento ?? '',
        feria: activeEvent?.nferia ?? '',
        lugar: activeEvent?.nlugar ?? '',
        modelo1: activeModelo1,
        modelo2: activeModelo2,
        modo: config.sello.modo,
        nperfil1: localProfileNames[1],
        nperfil2: localProfileNames[2],
        nperfil3: localProfileNames[3],
        nperfil4: localProfileNames[4],
        nperfil5: localProfileNames[5],
        nperfil6: localProfileNames[6],
        eventos: localEventos
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
  }, [config, selectedPerfil, selectedEvento, localEventos, localProfileNames, localPrecios, updateImprimir, navigate])

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

      {/* Event section (uses local editable event data for live preview) */}
      <EventoSection
        sello={{ ...config.sello, eventos: localEventos }}
        ticket={config.ticket}
        selectedEvento={selectedEvento}
        onEventoChange={handleEventoChange}
      />

      {/* Event editor */}
      <EventoEditor
        eventos={localEventos}
        onEventoDataChange={handleEventoDataChange}
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
