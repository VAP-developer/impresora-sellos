/**
 * config.store.ts
 *
 * Zustand store for the application configuration.
 * Loads config from the main process via IPC on initialization,
 * subscribes to real-time config changes pushed from main,
 * and provides typed update methods that persist changes via IPC.
 */

import { create } from 'zustand'
import type {
  AppConfig,
  CodigoConfig,
  PreciosConfig,
  SelloConfig,
  TicketConfig
} from '@renderer/types/config'
import * as ipc from '@renderer/lib/ipc-client'

export interface ConfigState {
  /** The full application config. Null until loaded from main process. */
  config: AppConfig | null
  /** Whether the initial config load is in progress. */
  loading: boolean
  /** Error message if load or update failed. */
  error: string | null

  // --- Actions ---

  /** Load config from main process and subscribe to changes. */
  loadConfig: () => Promise<void>

  /** Update the "maquina" section (ticket + codigo). */
  updateMaquina: (data: {
    ticket: Partial<TicketConfig>
    codigo: Partial<CodigoConfig>
  }) => Promise<void>

  /** Update the "imprimir" section (sello + precios). */
  updateImprimir: (data: {
    sello: Partial<SelloConfig>
    precios: PreciosConfig
  }) => Promise<void>

  /** Increment the session (cliente) counter after a successful sale. */
  updateSesion: () => Promise<void>

  /** Decrement the session (cliente) counter on sale cancellation. */
  updateSesionError: () => Promise<void>

  /** Decrement rolls after a sale (sellos1, sellos2, tickets consumed). */
  updateRollos: (sellos1: number, sellos2: number, tickets: number) => Promise<void>

  /** Revert roll decrements on sale cancellation. */
  updateRollosRevert: (sellos1: number, sellos2: number, tickets: number) => Promise<void>

  /** Initialize default config (first run). */
  initConfig: () => Promise<void>
}

/** Unsubscribe handle for the config change listener. */
let unsubscribeOnChange: (() => void) | null = null

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  loadConfig: async () => {
    // Prevent duplicate loads
    if (get().loading) return

    set({ loading: true, error: null })

    try {
      const config = await ipc.getConfig()
      set({ config, loading: false })

      // Subscribe to config changes from main process (e.g. after another handler mutates config)
      if (unsubscribeOnChange) {
        unsubscribeOnChange()
      }
      unsubscribeOnChange = ipc.onConfigChange((updatedConfig) => {
        set({ config: updatedConfig })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load config'
      set({ error: message, loading: false })
    }
  },

  updateMaquina: async (data) => {
    set({ error: null })
    try {
      await ipc.updateMaquina(data)
      // Refresh config from main to get the canonical state
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update maquina config'
      set({ error: message })
      throw err
    }
  },

  updateImprimir: async (data) => {
    set({ error: null })
    try {
      await ipc.updateImprimir(data)
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update imprimir config'
      set({ error: message })
      throw err
    }
  },

  updateSesion: async () => {
    set({ error: null })
    try {
      await ipc.updateSesion()
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update session'
      set({ error: message })
      throw err
    }
  },

  updateSesionError: async () => {
    set({ error: null })
    try {
      await ipc.updateSesionError()
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revert session'
      set({ error: message })
      throw err
    }
  },

  updateRollos: async (sellos1, sellos2, tickets) => {
    set({ error: null })
    try {
      await ipc.updateRollos(sellos1, sellos2, tickets)
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update rollos'
      set({ error: message })
      throw err
    }
  },

  updateRollosRevert: async (sellos1, sellos2, tickets) => {
    set({ error: null })
    try {
      await ipc.updateRollosRevert(sellos1, sellos2, tickets)
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revert rollos'
      set({ error: message })
      throw err
    }
  },

  initConfig: async () => {
    set({ error: null })
    try {
      await ipc.initConfig()
      const config = await ipc.getConfig()
      set({ config })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize config'
      set({ error: message })
      throw err
    }
  }
}))
