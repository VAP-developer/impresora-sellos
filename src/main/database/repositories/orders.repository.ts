import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Order Types (replican OrderLine del legacy) ===

export interface OrderLine {
  id?: number
  event: string
  venue: string
  machine: string
  vendType: string // "Tarifa A Tira 4" | "Tira de 4 Tarifas" | "Etiqueta individual"
  productName: string
  transactionDate: string
  quantity: number
  quantitySet: number // 1 para simple, 4 para tiras
  totalStamps: number // quantity * quantitySet
  currency: string
  value: number
  paymentStatus: string // Modo de impresion/perfil
  sesionId: number
  etiquetasRollo1: number
  etiquetasRollo2: number
  etiquetaMes: string
  tituloEvento: string
  feria: string
  lugar: string
  fecha: string
  mes: number | string
  annio: string
  documento: string
}

/** Raw row shape from SQLite (snake_case columns) */
interface OrderRow {
  id: number
  event: string
  venue: string | null
  machine: string | null
  vend_type: string
  product_name: string | null
  transaction_date: string
  quantity: number
  quantity_set: number
  total_stamps: number
  currency: string
  value: number
  payment_status: string | null
  sesion_id: number | null
  etiquetas_rollo1: number | null
  etiquetas_rollo2: number | null
  etiqueta_mes: string | null
  titulo_evento: string | null
  feria: string | null
  lugar: string | null
  fecha: string | null
  mes: string | null
  annio: string | null
  documento: string | null
  synced: number
  created_at: string
}

/**
 * Repository for the orders table.
 * Handles insertion of sale records and CSV export.
 */
export class OrdersRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Inserts one or more order lines in a single transaction.
   * Replicates the legacy Meteor `insertOrder` method.
   */
  insert(orders: OrderLine[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO orders (
        event, venue, machine, vend_type, product_name,
        transaction_date, quantity, quantity_set, total_stamps,
        currency, value, payment_status, sesion_id,
        etiquetas_rollo1, etiquetas_rollo2, etiqueta_mes,
        titulo_evento, feria, lugar, fecha, mes, annio, documento
      ) VALUES (
        @event, @venue, @machine, @vendType, @productName,
        @transactionDate, @quantity, @quantitySet, @totalStamps,
        @currency, @value, @paymentStatus, @sesionId,
        @etiquetasRollo1, @etiquetasRollo2, @etiquetaMes,
        @tituloEvento, @feria, @lugar, @fecha, @mes, @annio, @documento
      )
    `)

    const insertMany = this.db.transaction((items: OrderLine[]) => {
      for (const order of items) {
        stmt.run({
          event: order.event,
          venue: order.venue ?? null,
          machine: order.machine ?? null,
          vendType: order.vendType,
          productName: order.productName ?? null,
          transactionDate: order.transactionDate,
          quantity: order.quantity,
          quantitySet: order.quantitySet,
          totalStamps: order.totalStamps,
          currency: order.currency ?? 'EUR',
          value: order.value,
          paymentStatus: order.paymentStatus ?? null,
          sesionId: order.sesionId ?? null,
          etiquetasRollo1: order.etiquetasRollo1 ?? null,
          etiquetasRollo2: order.etiquetasRollo2 ?? null,
          etiquetaMes: order.etiquetaMes ?? null,
          tituloEvento: order.tituloEvento ?? null,
          feria: order.feria ?? null,
          lugar: order.lugar ?? null,
          fecha: order.fecha ?? null,
          mes: order.mes != null ? String(order.mes) : null,
          annio: order.annio ?? null,
          documento: order.documento ?? null
        })
      }
    })

    insertMany(orders)
  }

  /**
   * Returns all orders from the database ordered by creation time.
   */
  getAll(): OrderLine[] {
    const rows = this.db
      .prepare('SELECT * FROM orders ORDER BY id ASC')
      .all() as OrderRow[]

    return rows.map(this.rowToOrderLine)
  }

  /**
   * Exports all orders as a CSV string with semicolon delimiter.
   * Replicates the legacy Meteor `downloadXLS` method.
   * Includes a header row followed by all order records.
   */
  exportCSV(): string {
    const rows = this.db
      .prepare('SELECT * FROM orders ORDER BY id ASC')
      .all() as OrderRow[]

    if (rows.length === 0) {
      return ''
    }

    const delimiter = ';'

    // Use all column names except 'synced' (internal) — match legacy behavior
    const columns: (keyof OrderRow)[] = [
      'id',
      'event',
      'venue',
      'machine',
      'vend_type',
      'product_name',
      'transaction_date',
      'quantity',
      'quantity_set',
      'total_stamps',
      'currency',
      'value',
      'payment_status',
      'sesion_id',
      'etiquetas_rollo1',
      'etiquetas_rollo2',
      'etiqueta_mes',
      'titulo_evento',
      'feria',
      'lugar',
      'fecha',
      'mes',
      'annio',
      'documento',
      'created_at'
    ]

    const lines: string[] = []

    // Header row
    lines.push(columns.join(delimiter))

    // Data rows
    for (const row of rows) {
      const values = columns.map((col) => {
        const val = row[col]
        if (val == null) return ''
        const str = String(val)
        // Escape values containing the delimiter, quotes, or newlines
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      })
      lines.push(values.join(delimiter))
    }

    return lines.join('\n')
  }

  /**
   * Returns the count of orders in the database.
   */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }
    return row.cnt
  }

  /**
   * Converts a raw database row (snake_case) to an OrderLine (camelCase).
   */
  private rowToOrderLine(row: OrderRow): OrderLine {
    return {
      id: row.id,
      event: row.event,
      venue: row.venue ?? '',
      machine: row.machine ?? '',
      vendType: row.vend_type,
      productName: row.product_name ?? '',
      transactionDate: row.transaction_date,
      quantity: row.quantity,
      quantitySet: row.quantity_set,
      totalStamps: row.total_stamps,
      currency: row.currency,
      value: row.value,
      paymentStatus: row.payment_status ?? '',
      sesionId: row.sesion_id ?? 0,
      etiquetasRollo1: row.etiquetas_rollo1 ?? 0,
      etiquetasRollo2: row.etiquetas_rollo2 ?? 0,
      etiquetaMes: row.etiqueta_mes ?? '',
      tituloEvento: row.titulo_evento ?? '',
      feria: row.feria ?? '',
      lugar: row.lugar ?? '',
      fecha: row.fecha ?? '',
      mes: row.mes ?? '',
      annio: row.annio ?? '',
      documento: row.documento ?? ''
    }
  }
}
