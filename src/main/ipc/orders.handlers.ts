import { handleIpc } from './handlers'
import { OrdersRepository, OrderLine } from '../database/repositories/orders.repository'

/**
 * Registers IPC handlers for order management.
 *
 * Channels:
 * - orders:insert — Inserts one or more order lines (transactional)
 * - orders:downloadCSV — Exports all orders as semicolon-delimited CSV
 */
export function registerOrdersHandlers(): void {
  const repo = new OrdersRepository()

  handleIpc('orders:insert', (orders: unknown) => {
    repo.insert(orders as OrderLine[])
  })

  handleIpc('orders:downloadCSV', () => {
    return repo.exportCSV()
  })
}
