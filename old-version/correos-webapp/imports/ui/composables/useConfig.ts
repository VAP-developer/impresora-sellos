import { ref, onUnmounted } from 'vue'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Config } from '../../api/config/collection'

export interface ConfigDocument {
  _id: string
  ticket: {
    feria: string
    lugar: string
    fecha: string
    hora: string
    titulo: string
    tituloCopia: string
    rollo1: number
    rollo2: number
    tickets: number
    limiteTickets: number
    limiteImporte: number
    NUEVOlimiteImporte?: number
    empresa: string
    cif: string
    cp: string
    l1: string
    l2: string
    l3: string
    T1especial?: string
    T2especial?: string
    T3especial?: string
    TEmod1?: string
    TEmod2?: string
    ImprimeCopiaTicket?: string
    ImprimeMasterTicket?: string
  }
  codigo: {
    modo: string
    mes: number | string
    annio: string
    pais: string
    maquina: string
    cliente: number
    producto: number
  }
  sello: {
    fecha: string
    evento: string
    modelo1: string
    modelo2: string
    modo: number
    elperfil?: number
    elnperfil?: string
    elnevento?: string
    elevento?: number
    feria?: string
    lugar?: string
    PERFILlimiteImporte?: number
    [key: string]: any
  }
  precios: {
    tarifaA: number
    tarifaA2: number
    tarifaB: number
    tarifaC: number
    tarifaTA?: number
    tarifaT4?: number
  }
}

export interface UseConfig {
  config: import('vue').Ref<ConfigDocument | null>
  isReady: import('vue').Ref<boolean>
  updateMaquina(config: Partial<ConfigDocument>): Promise<void>
  updateImprimir(config: Partial<ConfigDocument>): Promise<void>
  updateSesion(): Promise<void>
  updateSesionError(): Promise<void>
  updateRollos(sellos1: number, sellos2: number, tickets: number): Promise<void>
  updateRollosRevert(rollo1: number, rollo2: number, tickets: number): Promise<void>
  initConfig(): Promise<void>
}

/**
 * Composable for reactive access to the `config` collection.
 * Uses Meteor's Tracker.autorun directly for reactivity.
 */
export function useConfig(): UseConfig {
  const isReady = ref(false)
  const config = ref<ConfigDocument | null>(null)

  // Subscribe and reactively track config document
  const computation = Tracker.autorun(() => {
    const handle = Meteor.subscribe('config')
    isReady.value = handle.ready()

    if (handle.ready()) {
      config.value = (Config.findOne() as ConfigDocument | undefined) ?? null
    }
  })

  // Cleanup on component unmount
  onUnmounted(() => {
    computation.stop()
  })

  async function updateMaquina(configData: Partial<ConfigDocument>): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateMaquinaConfig', configData, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function updateImprimir(configData: Partial<ConfigDocument>): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateImprimirConfig', configData, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function updateSesion(): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateSesion', (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function updateSesionError(): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateSesionerror', (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function updateRollos(sellos1: number, sellos2: number, tickets: number): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateRollos', sellos1, sellos2, tickets, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function updateRollosRevert(rollo1: number, rollo2: number, tickets: number): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('updateRollosAnterror', rollo1, rollo2, tickets, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function initConfig(): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('initConfig', (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  return {
    config,
    isReady,
    updateMaquina,
    updateImprimir,
    updateSesion,
    updateSesionError,
    updateRollos,
    updateRollosRevert,
    initConfig,
  }
}
