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
  loading: boolean
  error: string | null

  // Actions
  loadSettings(): Promise<void>
  setCutNumber(value: number): Promise<void>
  setLanguage(value: AppLanguage): Promise<void>
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
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })

    try {
      const [cutNumber, language] = await Promise.all([
        getAPI().config.getCutNumber(),
        getAPI().config.getLanguage()
      ])

      const validLanguage: AppLanguage = language === 'en' ? 'en' : 'es'

      set({ cutNumber, language: validLanguage, loading: false })

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
  }
}))
