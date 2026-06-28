/**
 * orders.store.ts
 *
 * Zustand store for order (sales) management.
 * Provides actions to insert order lines (after a sale) and export orders as CSV.
 * Maintains a local cache of recent orders for display and error-reversal reference.
 */

import { create } from 'zustand'
import type { OrderLine } from '@renderer/types/order'
import * as ipc from '@renderer/lib/ipc-client'

export interface OrdersState {
  /** Whether an order operation is in progress. */
  loading: boolean
  /** Error message from the last failed operation. */
  error: string | null
  /** The last batch of order lines inserted (for reference during error reversal). */
  lastInserted: OrderLine[]

  // --- Actions ---

  /** Insert order lines after a successful sale. */
  insertOrders: (orders: OrderLine[]) => Promise<void>

  /** Export all orders as CSV. Returns the file path of the generated CSV. */
  downloadCSV: () => Promise<string>

  /** Clear the last inserted orders reference. */
  clearLastInserted: () => void

  /** Clear any error state. */
  clearError: () => void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  loading: false,
  error: null,
  lastInserted: [],

  insertOrders: async (orders) => {
    set({ loading: true, error: null })
    try {
      await ipc.insertOrders(orders)
      set({ lastInserted: orders, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to insert orders'
      set({ error: message, loading: false })
      throw err
    }
  },

  downloadCSV: async () => {
    set({ loading: true, error: null })
    try {
      const filePath = await ipc.downloadCSV()
      set({ loading: false })
      return filePath
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export CSV'
      set({ error: message, loading: false })
      throw err
    }
  },

  clearLastInserted: () => {
    set({ lastInserted: [] })
  },

  clearError: () => {
    set({ error: null })
  }
}))
