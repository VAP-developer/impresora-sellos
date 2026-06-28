import { Meteor } from 'meteor/meteor'

export interface OrderLine {
  event: string
  venue: string
  machine: string
  vendType: string
  productName: string
  transactionDate: string
  quantity: number
  quantitySet: number
  totalStamps: number
  currency: string
  value: number
  paymentStatus: string
  sesionId: number
  etiquetasRollo1: number
  etiquetasRollo2: number
  etiquetaMes: string
  titutoEvento: string
  feria: string
  Lugar: string
  fecha: string
  mes: number | string
  annio: string
  documento: string
}

export interface UseOrders {
  insertOrder(orders: OrderLine[]): Promise<void>
  downloadXLS(): Promise<string>
}

/**
 * Composable for order management. Wraps Meteor methods for inserting orders
 * and exporting order data as CSV (semicolon-separated for Excel compatibility).
 */
export function useOrders(): UseOrders {
  async function insertOrder(orders: OrderLine[]): Promise<void> {
    return new Promise((resolve, reject) => {
      Meteor.call('insertOrder', orders, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function downloadXLS(): Promise<string> {
    return new Promise((resolve, reject) => {
      Meteor.call('downloadXLS', (error: Error | null, result: string) => {
        if (error) reject(error)
        else resolve(result)
      })
    })
  }

  return {
    insertOrder,
    downloadXLS,
  }
}
