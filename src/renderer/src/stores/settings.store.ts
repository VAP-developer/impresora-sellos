/**
 * settings.store.ts
 *
 * Zustand store for application-wide settings: cut number and language.
 * Communicates with the main process via the preload bridge (window.electronAPI.config).
 * On language change, also updates i18next runtime language.
 */

import { create } from 'zustand'
import i18n from '@renderer/i18n/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppLanguage = 'es' | 'en'

export interface SettingsState {
  cutNumber: number
  language: AppLanguage
  printRotation180: boolean
  loading: boolean
  error: string | null

  // Actions
  loadSettings(): Promise<void>
  setCutNumber(value: number): Promise<void>
  setLanguage(value: AppLanguage): Promise<void>
  setPrintRotation(value: boolean): Promise<void>
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAPI() {
  const api = window.electronAPI
  if (!api) {
    throw new Error(
      'electronAPI is not available. Make sure the app is running inside Electron.'
    )
  }
  return api
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>((set) => ({
  cutNumber: 4,
  language: 'es',
  printRotation180: false,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })

    try {
      const [cutNumber, language, printRotation180] = await Promise.all([
        getAPI().config.getCutNumber(),
        getAPI().config.getLanguage(),
        getAPI().config.getPrintRotation()
      ])

      const validLanguage: AppLanguage = language === 'en' ? 'en' : 'es'

      set({ cutNumber, language: validLanguage, printRotation180: !!printRotation180, loading: false })

      // Sync i18n with the persisted language
      await i18n.changeLanguage(validLanguage)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings'
      set({ error: message, loading: false })
    }
  },

  setCutNumber: async (value: number) => {
    set({ error: null })

    try {
      await getAPI().config.setCutNumber(value)
      set({ cutNumber: value })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set cut number'
      set({ error: message })
      throw err
    }
  },

  setLanguage: async (value: AppLanguage) => {
    set({ error: null })

    try {
      await getAPI().config.setLanguage(value)
      set({ language: value })
      await i18n.changeLanguage(value)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set language'
      set({ error: message })
      throw err
    }
  },

  setPrintRotation: async (value: boolean) => {
    set({ error: null })

    try {
      await getAPI().config.setPrintRotation(value)
      set({ printRotation180: value })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set print rotation'
      set({ error: message })
      throw err
    }
  }
}))
