/**
 * tariff-groups.store.ts
 *
 * Zustand store for tariff groups management.
 * Handles loading, creating, updating, and deleting tariff groups.
 * Used primarily by the ImprimirView for CRUD operations on tariff groups.
 */

import { create } from 'zustand'
import * as ipc from '@renderer/lib/ipc-client'
import type {
  TariffGroup,
  TariffGroupInput,
  TariffGroupUpdateInput
} from '@renderer/lib/ipc-client'

// ─── Store Interface ──────────────────────────────────────────────────────────

export interface TariffGroupsState {
  /** All loaded tariff groups (filtered by year or all) */
  groups: TariffGroup[]
  /** Available years with tariff groups (descending order) */
  years: number[]
  /** Currently selected year for filtering */
  selectedYear: number | null
  /** Currently selected group for detail/edit view */
  selectedGroup: TariffGroup | null
  /** Loading state for async operations */
  loading: boolean
  /** Last error message, null if no error */
  error: string | null

  // --- Actions ---

  /** Load available years from the backend */
  loadYears(): Promise<void>
  /** Load tariff groups for a specific year */
  loadByYear(year: number): Promise<void>
  /** Load all tariff groups regardless of year */
  loadAll(): Promise<void>
  /** Select a group (or deselect with null) */
  selectGroup(group: TariffGroup | null): void
  /** Create a new tariff group */
  createGroup(input: TariffGroupInput): Promise<TariffGroup>
  /** Update an existing tariff group */
  updateGroup(id: number, input: TariffGroupUpdateInput): Promise<TariffGroup | null>
  /** Delete a tariff group */
  deleteGroup(id: number): Promise<{ success: boolean; error?: string }>
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useTariffGroupsStore = create<TariffGroupsState>((set, get) => ({
  groups: [],
  years: [],
  selectedYear: null,
  selectedGroup: null,
  loading: false,
  error: null,

  loadYears: async () => {
    set({ loading: true, error: null })

    try {
      const years = await ipc.getTariffGroupYears()
      set({ years, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar los años'
      set({ error: message, loading: false })
    }
  },

  loadByYear: async (year: number) => {
    set({ loading: true, error: null, selectedYear: year })

    try {
      const groups = await ipc.getTariffGroupsByYear(year)
      set({ groups, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar grupos por año'
      set({ error: message, loading: false })
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null })

    try {
      const groups = await ipc.getAllTariffGroups()
      set({ groups, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar todos los grupos'
      set({ error: message, loading: false })
    }
  },

  selectGroup: (group: TariffGroup | null) => {
    set({ selectedGroup: group, error: null })
  },

  createGroup: async (input: TariffGroupInput) => {
    set({ loading: true, error: null })

    try {
      const created = await ipc.createTariffGroup(input)

      // Refresh the groups list and years after creation
      const { selectedYear } = get()
      const years = await ipc.getTariffGroupYears()
      const groups = selectedYear
        ? await ipc.getTariffGroupsByYear(selectedYear)
        : await ipc.getAllTariffGroups()

      set({ groups, years, loading: false })
      return created
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el grupo'
      set({ error: message, loading: false })
      throw err
    }
  },

  updateGroup: async (id: number, input: TariffGroupUpdateInput) => {
    set({ loading: true, error: null })

    try {
      const updated = await ipc.updateTariffGroup(id, input)

      // Refresh the groups list and years after update
      const { selectedYear } = get()
      const years = await ipc.getTariffGroupYears()
      const groups = selectedYear
        ? await ipc.getTariffGroupsByYear(selectedYear)
        : await ipc.getAllTariffGroups()

      set({
        groups,
        years,
        selectedGroup: updated,
        loading: false
      })
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar el grupo'
      set({ error: message, loading: false })
      throw err
    }
  },

  deleteGroup: async (id: number) => {
    set({ loading: true, error: null })

    try {
      const result = await ipc.deleteTariffGroup(id)

      if (result.success) {
        // Refresh the groups list and years after deletion
        const { selectedYear, selectedGroup } = get()
        const years = await ipc.getTariffGroupYears()
        const groups = selectedYear
          ? await ipc.getTariffGroupsByYear(selectedYear)
          : await ipc.getAllTariffGroups()

        set({
          groups,
          years,
          // Deselect if the deleted group was selected
          selectedGroup: selectedGroup?.id === id ? null : selectedGroup,
          loading: false
        })
      } else {
        set({ error: result.error || 'Error al eliminar el grupo', loading: false })
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el grupo'
      set({ error: message, loading: false })
      return { success: false, error: message }
    }
  }
}))
