/**
 * images.store.ts
 *
 * Zustand store for fair images state management.
 * Handles fair list loading, fair selection, and print layer toggles.
 *
 * - printFondo is volatile (defaults to false, resets on app restart) — Req 8.2
 * - printSello is persisted in SQLite config via IPC — Req 8.3
 * - activeFair is persisted in SQLite config so user's last selection is remembered
 */

import { create } from 'zustand'
import * as ipc from '@renderer/lib/ipc-client'

export interface ImagesState {
  /** List of available fairs synced from bbdd-ferias/ */
  fairList: Array<{ year: string; fairName: string }>
  /** Currently selected fair */
  activeFair: { year: string; fairName: string } | null
  /** Background image of the active fair (Data URI or null) */
  fondoImage: string | null
  /** Stamp image of the active fair (Data URI or null) */
  selloImage: string | null
  /** Checkbox: print background image — volatile, default false */
  printFondo: boolean
  /** Checkbox: print stamp image — persisted in config */
  printSello: boolean
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null

  // --- Actions ---

  /** Load the list of available fairs from main process and restore persisted state from config */
  loadFairList: () => Promise<void>
  /** Select a fair and load its images */
  selectFair: (year: string, fairName: string) => Promise<void>
  /** Toggle printFondo (volatile, not persisted) */
  setPrintFondo: (value: boolean) => void
  /** Toggle printSello (persisted via IPC) */
  setPrintSello: (value: boolean) => Promise<void>
}

export const useImagesStore = create<ImagesState>((set, get) => ({
  fairList: [],
  activeFair: null,
  fondoImage: null,
  selloImage: null,
  printFondo: false,
  printSello: false,
  loading: false,
  error: null,

  loadFairList: async () => {
    if (get().loading) return

    set({ loading: true, error: null })

    try {
      const [fairList, imagenesConfig] = await Promise.all([
        ipc.getFairList(),
        ipc.getImagenesConfig()
      ])

      // Restore persisted state from config
      const updates: Partial<ImagesState> = {
        fairList,
        printSello: imagenesConfig.printSello,
        loading: false
      }

      set(updates)

      // If there was a persisted activeFair, restore it and load its images
      if (imagenesConfig.activeFair) {
        const { year, fairName } = imagenesConfig.activeFair
        // Only restore if the fair still exists in the synced list
        const fairExists = fairList.some(
          (f) => f.year === year && f.fairName === fairName
        )
        if (fairExists) {
          const images = await ipc.getFairImages(year, fairName)
          set({
            activeFair: { year, fairName },
            fondoImage: images.fondo,
            selloImage: images.sello
          })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fair list'
      set({ error: message, loading: false })
    }
  },

  selectFair: async (year: string, fairName: string) => {
    set({ loading: true, error: null })

    try {
      const images = await ipc.getFairImages(year, fairName)
      set({
        activeFair: { year, fairName },
        fondoImage: images.fondo,
        selloImage: images.sello,
        loading: false
      })

      // Persist activeFair to config
      const { printSello } = get()
      await ipc.updateImagenesConfig({ printSello, activeFair: { year, fairName } })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fair images'
      set({ error: message, loading: false })
    }
  },

  setPrintFondo: (value: boolean) => {
    set({ printFondo: value })
  },

  setPrintSello: async (value: boolean) => {
    set({ printSello: value })

    // Persist printSello to config via IPC
    const { activeFair } = get()
    await ipc.updateImagenesConfig({ printSello: value, activeFair })
  }
}))
