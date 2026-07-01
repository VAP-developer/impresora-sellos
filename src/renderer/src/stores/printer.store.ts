/**
 * printer.store.ts
 *
 * Zustand store for printer state management.
 * Tracks connected printers, their statuses, the print queue,
 * discovered printers, current assignments, and provides actions
 * for printing, pausing, resuming, discovering, and reassigning.
 */

import { create } from 'zustand'
import type { PrinterInfo, PrintJob } from '@renderer/types/printer'
import type { AppConfig } from '@renderer/types/config'
import type { KioskoQuantities } from '@renderer/stores/kiosko.store'
import * as ipc from '@renderer/lib/ipc-client'
import type { DiscoveredPrinter } from '@renderer/lib/ipc-client'

export type PrinterTarget = 'printer1' | 'printer2' | 'ticket'

export interface PrinterState {
  /** List of detected printers and their current status. */
  printers: PrinterInfo[]
  /** Current print queue (pending/printing/error jobs). */
  queue: PrintJob[]
  /** Discovered printers available on the network/system. */
  discovered: DiscoveredPrinter[]
  /** Current printer assignments (target → URI). */
  assignments: Record<string, string | undefined>
  /** Whether a printer operation is in progress. */
  loading: boolean
  /** Whether a print job is currently being sent. */
  printing: boolean
  /** Whether printer discovery is in progress. */
  discovering: boolean
  /** Error message from the last failed operation. */
  error: string | null

  // --- Actions ---

  /** Fetch current printer statuses from main process. */
  fetchStatus: () => Promise<void>

  /** Fetch the current print queue from main process. */
  fetchQueue: () => Promise<void>

  /** Send a print job: generates PDFs and routes them to printers. */
  print: (config: AppConfig, quantities: KioskoQuantities, profile: string) => Promise<void>

  /** Pause all printers (stops sending jobs without losing pending work). */
  pause: () => Promise<void>

  /** Resume all printers (resends pending jobs). */
  resume: () => Promise<void>

  /** Discover available printers on the network/system. */
  discover: () => Promise<void>

  /** Assign a discovered printer to a target role. */
  assign: (target: PrinterTarget, uri: string) => Promise<boolean>

  /** Fetch current printer assignments. */
  fetchAssignments: () => Promise<void>

  /** Clear any error state. */
  clearError: () => void
}

export const usePrinterStore = create<PrinterState>((set) => ({
  printers: [],
  queue: [],
  discovered: [],
  assignments: {},
  loading: false,
  printing: false,
  discovering: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const printers = await ipc.getPrinterStatus()
      set({ printers, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch printer status'
      set({ error: message, loading: false })
    }
  },

  fetchQueue: async () => {
    set({ loading: true, error: null })
    try {
      const queue = await ipc.getPrintQueue()
      set({ queue, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch print queue'
      set({ error: message, loading: false })
    }
  },

  print: async (config, quantities, profile) => {
    set({ printing: true, error: null })
    try {
      await ipc.print(config, quantities, profile)
      // Refresh queue after printing to reflect new jobs
      const queue = await ipc.getPrintQueue()
      set({ queue, printing: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to print'
      set({ error: message, printing: false })
      throw err
    }
  },

  pause: async () => {
    set({ loading: true, error: null })
    try {
      await ipc.pausePrinter()
      // Refresh status to reflect paused state
      const printers = await ipc.getPrinterStatus()
      set({ printers, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause printer'
      set({ error: message, loading: false })
      throw err
    }
  },

  resume: async () => {
    set({ loading: true, error: null })
    try {
      await ipc.resumePrinter()
      // Refresh status and queue after resuming
      const [printers, queue] = await Promise.all([
        ipc.getPrinterStatus(),
        ipc.getPrintQueue()
      ])
      set({ printers, queue, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume printer'
      set({ error: message, loading: false })
      throw err
    }
  },

  discover: async () => {
    set({ discovering: true, error: null })
    try {
      const discovered = await ipc.discoverPrinters()
      set({ discovered, discovering: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover printers'
      set({ error: message, discovering: false })
    }
  },

  assign: async (target, uri) => {
    set({ loading: true, error: null })
    try {
      const result = await ipc.assignPrinter(target, uri)
      if (!result.success) {
        set({ error: result.error ?? 'Failed to assign printer', loading: false })
        return false
      }
      // Refresh assignments and status after reassignment
      const [assignments, printers] = await Promise.all([
        ipc.getPrinterAssignments(),
        ipc.getPrinterStatus()
      ])
      set({ assignments, printers, loading: false })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign printer'
      set({ error: message, loading: false })
      return false
    }
  },

  fetchAssignments: async () => {
    try {
      const assignments = await ipc.getPrinterAssignments()
      set({ assignments })
    } catch (err) {
      console.error('[PrinterStore] Failed to fetch assignments:', err)
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
