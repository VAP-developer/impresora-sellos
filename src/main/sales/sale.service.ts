/**
 * sale.service.ts
 *
 * Implements the complete sale flow as an atomic SQLite transaction.
 * When executeSale() is called, it:
 *   1. Increments config.codigo.cliente (session ID)
 *   2. Decrements rollos based on stamps consumed per model
 *   3. Inserts OrderLine records into the orders table
 *
 * If any step fails, the entire transaction is rolled back.
 *
 * Validates: Requirements 3.2, 4.1, 4.2, 4.3, 11.1, 11.2, 11.3
 */

import Database from 'better-sqlite3'
import { getDatabase } from '../database/connection'
import type { AppConfig } from '../database/repositories/config.repository'
import type { OrderLine } from '../database/repositories/orders.repository'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Kiosko quantities (matching the renderer type) */
export interface KioskoQuantities {
  tarifaAS1: number
  tarifaA2S1: number
  tarifaBS1: number
  tarifaCS1: number
  tarifaAT1: number
  tarifa4T1: number
  tarifaAS2: number
  tarifaA2S2: number
  tarifaBS2: number
  tarifaCS2: number
  tarifaAT2: number
  tarifa4T2: number
}

/** Result of a successful sale execution */
export interface SaleResult {
  success: true
  sesionId: number
  sellos1: number
  sellos2: number
  tickets: number
  orders: OrderLine[]
  /** Total number of PDFs generated (stamps + tickets), undefined if PDF generation not yet run */
  pdfCount?: number
  /** Number of stamp PDFs generated */
  stampCount?: number
  /** Number of ticket PDFs generated */
  ticketCount?: number
  /** Error message if PDF generation failed (sale data still committed) */
  pdfError?: string
  /** IDs of jobs created in the print queue */
  printJobIds?: number[]
}

/** Result of a failed sale execution */
export interface SaleError {
  success: false
  error: string
}

export type SaleOutcome = SaleResult | SaleError

// ─── Cancel Sale Types ────────────────────────────────────────────────────────

/** Input data for cancelling the last sale */
export interface CancelSaleInput {
  /** Number of stamps consumed from rollo1 in the sale being cancelled */
  sellos1: number
  /** Number of stamps consumed from rollo2 in the sale being cancelled */
  sellos2: number
  /** Number of tickets consumed in the sale being cancelled */
  tickets: number
}

/** Result of a successful sale cancellation */
export interface CancelSaleResult {
  success: true
  /** The session ID after decrementing (the reverted value) */
  sesionId: number
}

/** Result of a failed sale cancellation */
export interface CancelSaleError {
  success: false
  error: string
}

export type CancelSaleOutcome = CancelSaleResult | CancelSaleError

// ─── Roll Consumption Calculations ───────────────────────────────────────────

/**
 * Calculate stamps consumed from roll 1 (modelo 1 / left printer).
 * Simple stamps count 1 each; tiras (strips) count 4 each.
 */
export function calcSellos1(q: KioskoQuantities): number {
  return (
    q.tarifaAS1 +
    q.tarifaA2S1 +
    q.tarifaBS1 +
    q.tarifaCS1 +
    q.tarifaAT1 * 4 +
    q.tarifa4T1 * 4
  )
}

/**
 * Calculate stamps consumed from roll 2 (modelo 2 / right printer).
 * Simple stamps count 1 each; tiras (strips) count 4 each.
 */
export function calcSellos2(q: KioskoQuantities): number {
  return (
    q.tarifaAS2 +
    q.tarifaA2S2 +
    q.tarifaBS2 +
    q.tarifaCS2 +
    q.tarifaAT2 * 4 +
    q.tarifa4T2 * 4
  )
}

/**
 * Calculate tickets consumed.
 * Each tira uses 1 ticket, plus 2 for ticket principal + copy.
 */
export function calcTicketsUsed(q: KioskoQuantities): number {
  const totalTiras = q.tarifaAT1 + q.tarifa4T1 + q.tarifaAT2 + q.tarifa4T2
  return totalTiras + 2
}

// ─── Order Generation ─────────────────────────────────────────────────────────

/**
 * Generates OrderLine records from the quantities and config.
 * Creates one OrderLine per tariff/model combination with quantity > 0.
 */
export function generateOrderLines(
  config: AppConfig,
  quantities: KioskoQuantities,
  profile: string,
  sesionId: number
): OrderLine[] {
  const orders: OrderLine[] = []
  const now = new Date().toISOString()
  const { precios, ticket, codigo, sello } = config

  const evento = sello.eventos[sello.elevento] ?? sello.eventos[0]
  const eventName = evento?.nevento ?? sello.elnevento ?? ''
  const feria = evento?.nferia ?? sello.feria ?? ''
  const lugar = evento?.nlugar ?? sello.lugar ?? ''
  const fecha = evento?.fecha ?? ''

  const sellos1 = calcSellos1(quantities)
  const sellos2 = calcSellos2(quantities)

  // Base fields shared across all order lines
  const base = {
    event: eventName,
    venue: lugar,
    machine: codigo.maquina,
    transactionDate: now,
    currency: 'EUR',
    paymentStatus: profile,
    sesionId,
    etiquetasRollo1: sellos1,
    etiquetasRollo2: sellos2,
    etiquetaMes: String(codigo.mes),
    tituloEvento: eventName,
    feria,
    lugar,
    fecha,
    mes: codigo.mes,
    annio: codigo.annio,
    documento: ''
  }

  // Helper to add an order line
  const addLine = (
    vendType: string,
    productName: string,
    quantity: number,
    quantitySet: number,
    price: number
  ): void => {
    if (quantity <= 0) return
    orders.push({
      ...base,
      vendType,
      productName,
      quantity,
      quantitySet,
      totalStamps: quantity * quantitySet,
      value: quantity * price
    })
  }

  // Modelo 1 (printer1) - Simple stamps
  addLine('Tarifa A', 'Sello Modelo 1', quantities.tarifaAS1, 1, precios.tarifaA)
  addLine('Tarifa A2', 'Sello Modelo 1', quantities.tarifaA2S1, 1, precios.tarifaA2)
  addLine('Tarifa B', 'Sello Modelo 1', quantities.tarifaBS1, 1, precios.tarifaB)
  addLine('Tarifa C', 'Sello Modelo 1', quantities.tarifaCS1, 1, precios.tarifaC)

  // Modelo 1 - Tiras
  addLine('Tarifa A Tira 4', 'Tira Modelo 1', quantities.tarifaAT1, 4, precios.tarifaTA ?? 0)
  addLine('Tira de 4 Tarifas', 'Tira Modelo 1', quantities.tarifa4T1, 4, precios.tarifaT4 ?? 0)

  // Modelo 2 (printer2) - Simple stamps
  addLine('Tarifa A', 'Sello Modelo 2', quantities.tarifaAS2, 1, precios.tarifaA)
  addLine('Tarifa A2', 'Sello Modelo 2', quantities.tarifaA2S2, 1, precios.tarifaA2)
  addLine('Tarifa B', 'Sello Modelo 2', quantities.tarifaBS2, 1, precios.tarifaB)
  addLine('Tarifa C', 'Sello Modelo 2', quantities.tarifaCS2, 1, precios.tarifaC)

  // Modelo 2 - Tiras
  addLine('Tarifa A Tira 4', 'Tira Modelo 2', quantities.tarifaAT2, 4, precios.tarifaTA ?? 0)
  addLine('Tira de 4 Tarifas', 'Tira Modelo 2', quantities.tarifa4T2, 4, precios.tarifaT4 ?? 0)

  return orders
}

// ─── Atomic Sale Execution ────────────────────────────────────────────────────

/**
 * Executes the complete sale flow as an atomic SQLite transaction.
 *
 * Steps:
 * 1. Validate inputs (stock, limits)
 * 2. Increment config.codigo.cliente
 * 3. Decrement rollos based on quantities
 * 4. Generate and insert OrderLine records
 *
 * If any step throws, all changes are automatically rolled back
 * by better-sqlite3's transaction() wrapper.
 *
 * @param config - Current application config
 * @param quantities - Kiosko quantities to sell
 * @param profile - Active profile name (e.g., "FERIA", "Filatelia")
 * @param db - Optional database instance (for testing)
 */
export function executeSale(
  config: AppConfig,
  quantities: KioskoQuantities,
  profile: string,
  db?: Database.Database
): SaleOutcome {
  const database = db ?? getDatabase()

  const sellos1 = calcSellos1(quantities)
  const sellos2 = calcSellos2(quantities)
  const ticketsUsed = calcTicketsUsed(quantities)

  // Pre-transaction validation
  if (sellos1 === 0 && sellos2 === 0) {
    return { success: false, error: 'La cesta está vacía' }
  }

  if (config.ticket.rollo1 >= 0 && sellos1 > config.ticket.rollo1) {
    return { success: false, error: 'No hay suficientes sellos en rollo 1' }
  }

  if (config.ticket.rollo2 >= 0 && sellos2 > config.ticket.rollo2) {
    return { success: false, error: 'No hay suficientes sellos en rollo 2' }
  }

  if (ticketsUsed > config.ticket.tickets) {
    return { success: false, error: 'No hay suficientes tickets' }
  }

  if (config.codigo.cliente > 9999) {
    return { success: false, error: 'Límite de ID Cliente alcanzado (>9999)' }
  }

  // Execute the atomic transaction
  const transaction = database.transaction(() => {
    // Step 1: Read current config from DB (ensures consistency)
    const row = database.prepare('SELECT data FROM config WHERE id = 1').get() as
      | { data: string }
      | undefined

    if (!row) {
      throw new Error('Config not initialized')
    }

    const currentConfig: AppConfig = JSON.parse(row.data)

    // Step 2: Increment session (codigo.cliente)
    const newSesionId = currentConfig.codigo.cliente + 1
    currentConfig.codigo.cliente = newSesionId

    // Step 3: Decrement rollos
    currentConfig.ticket.rollo1 -= sellos1
    currentConfig.ticket.rollo2 -= sellos2
    currentConfig.ticket.tickets -= ticketsUsed

    // Step 4: Persist updated config
    database
      .prepare('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)')
      .run(JSON.stringify(currentConfig))

    // Step 5: Generate order lines
    const orders = generateOrderLines(config, quantities, profile, newSesionId)

    // Step 6: Insert order lines
    const insertStmt = database.prepare(`
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

    for (const order of orders) {
      insertStmt.run({
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

    return { sesionId: newSesionId, orders }
  })

  try {
    const result = transaction()
    return {
      success: true,
      sesionId: result.sesionId,
      sellos1,
      sellos2,
      tickets: ticketsUsed,
      orders: result.orders
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Error en transacción de venta: ${message}` }
  }
}


// ─── Atomic Sale Cancellation ─────────────────────────────────────────────────

/**
 * Cancels (reverts) the last sale as an atomic SQLite transaction.
 *
 * Steps:
 * 1. Validate that there is a sale to revert (sellos1 or sellos2 > 0)
 * 2. Decrement config.codigo.cliente by 1
 * 3. Restore rollo1, rollo2, and tickets by the amounts consumed in the cancelled sale
 * 4. Insert an audit OrderLine record with event="ELIMINAR ANTERIOR"
 *
 * If any step throws, all changes are automatically rolled back
 * by better-sqlite3's transaction() wrapper.
 *
 * Validates: Requirements 3.3, 4.4, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2
 *
 * @param input - The consumption data from the last sale to revert
 * @param db - Optional database instance (for testing)
 */
export function cancelSale(
  input: CancelSaleInput,
  db?: Database.Database
): CancelSaleOutcome {
  const database = db ?? getDatabase()

  const { sellos1, sellos2, tickets } = input

  // Pre-transaction validation: there must be a previous sale to revert
  if (sellos1 <= 0 && sellos2 <= 0) {
    return { success: false, error: 'No hay venta anterior para anular' }
  }

  // Execute the atomic transaction
  const transaction = database.transaction(() => {
    // Step 1: Read current config from DB (ensures consistency)
    const row = database.prepare('SELECT data FROM config WHERE id = 1').get() as
      | { data: string }
      | undefined

    if (!row) {
      throw new Error('Config not initialized')
    }

    const currentConfig: AppConfig = JSON.parse(row.data)

    // Step 2: Decrement session (codigo.cliente) — revert the increment
    const revertedSesionId = currentConfig.codigo.cliente - 1
    currentConfig.codigo.cliente = revertedSesionId

    // Step 3: Restore rollos and tickets
    currentConfig.ticket.rollo1 += sellos1
    currentConfig.ticket.rollo2 += sellos2
    currentConfig.ticket.tickets += tickets

    // Step 4: Persist updated config
    database
      .prepare('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)')
      .run(JSON.stringify(currentConfig))

    // Step 5: Insert audit order record with event="ELIMINAR ANTERIOR"
    const now = new Date().toISOString()
    const insertStmt = database.prepare(`
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

    insertStmt.run({
      event: 'ELIMINAR ANTERIOR',
      venue: ' ',
      machine: 'error de impresión',
      vendType: ' ',
      productName: ' ',
      transactionDate: now,
      quantity: 0,
      quantitySet: 0,
      totalStamps: 0,
      currency: ' ',
      value: 0,
      paymentStatus: 'Error',
      sesionId: revertedSesionId,
      etiquetasRollo1: 0,
      etiquetasRollo2: 0,
      etiquetaMes: ' ',
      tituloEvento: 'Error',
      feria: ' ',
      lugar: ' ',
      fecha: 'Error',
      mes: 'Error',
      annio: 'Error',
      documento: 'Error'
    })

    return { sesionId: revertedSesionId }
  })

  try {
    const result = transaction()
    return {
      success: true,
      sesionId: result.sesionId
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Error en transacción de anulación: ${message}` }
  }
}
