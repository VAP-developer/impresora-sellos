import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Print Queue Types ===

export type PrinterTarget = 'printer1' | 'printer2' | 'ticket'
export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'error'

export interface PrintJob {
  id: number
  orderId: number | null
  printerTarget: PrinterTarget
  pdfType: string
  status: PrintJobStatus
  filePath: string | null
  attempts: number
  errorMessage: string | null
  createdAt: string
}

/** Input for creating a new print job (id and createdAt are auto-generated) */
export interface CreatePrintJob {
  orderId?: number | null
  printerTarget: PrinterTarget
  pdfType: string
  filePath?: string | null
}

/** Raw row shape from SQLite (snake_case columns) */
interface PrintQueueRow {
  id: number
  order_id: number | null
  printer_target: string
  pdf_type: string
  status: string
  file_path: string | null
  attempts: number
  error_message: string | null
  created_at: string
}

/**
 * Repository for the print_queue table.
 * Manages print jobs with status tracking, retries, and queue processing.
 * This is a new capability — the legacy system had no print persistence.
 */
export class PrintQueueRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Inserts a new print job into the queue with status 'pending'.
   * Returns the ID of the newly created job.
   */
  insert(job: CreatePrintJob): number {
    const result = this.db
      .prepare(
        `INSERT INTO print_queue (order_id, printer_target, pdf_type, file_path)
         VALUES (@orderId, @printerTarget, @pdfType, @filePath)`
      )
      .run({
        orderId: job.orderId ?? null,
        printerTarget: job.printerTarget,
        pdfType: job.pdfType,
        filePath: job.filePath ?? null
      })

    return result.lastInsertRowid as number
  }

  /**
   * Inserts multiple print jobs in a single transaction.
   * Returns the IDs of all inserted jobs.
   */
  insertMany(jobs: CreatePrintJob[]): number[] {
    const ids: number[] = []

    const stmt = this.db.prepare(
      `INSERT INTO print_queue (order_id, printer_target, pdf_type, file_path)
       VALUES (@orderId, @printerTarget, @pdfType, @filePath)`
    )

    const insertAll = this.db.transaction((items: CreatePrintJob[]) => {
      for (const job of items) {
        const result = stmt.run({
          orderId: job.orderId ?? null,
          printerTarget: job.printerTarget,
          pdfType: job.pdfType,
          filePath: job.filePath ?? null
        })
        ids.push(result.lastInsertRowid as number)
      }
    })

    insertAll(jobs)
    return ids
  }

  /**
   * Retrieves a print job by its ID.
   * Returns null if not found.
   */
  getById(id: number): PrintJob | null {
    const row = this.db
      .prepare('SELECT * FROM print_queue WHERE id = ?')
      .get(id) as PrintQueueRow | undefined

    if (!row) {
      return null
    }

    return this.rowToPrintJob(row)
  }

  /**
   * Returns all print jobs ordered by creation time (oldest first).
   */
  getAll(): PrintJob[] {
    const rows = this.db
      .prepare('SELECT * FROM print_queue ORDER BY id ASC')
      .all() as PrintQueueRow[]

    return rows.map(this.rowToPrintJob)
  }

  /**
   * Returns all pending print jobs (status = 'pending') ordered by creation time.
   * These are the jobs waiting to be sent to a printer.
   */
  getPending(): PrintJob[] {
    const rows = this.db
      .prepare("SELECT * FROM print_queue WHERE status = 'pending' ORDER BY id ASC")
      .all() as PrintQueueRow[]

    return rows.map(this.rowToPrintJob)
  }

  /**
   * Returns all pending jobs for a specific printer target.
   */
  getPendingByTarget(target: PrinterTarget): PrintJob[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM print_queue WHERE status = 'pending' AND printer_target = ? ORDER BY id ASC"
      )
      .all(target) as PrintQueueRow[]

    return rows.map(this.rowToPrintJob)
  }

  /**
   * Returns all jobs for a specific order, useful for tracking print progress of a sale.
   */
  getByOrderId(orderId: number): PrintJob[] {
    const rows = this.db
      .prepare('SELECT * FROM print_queue WHERE order_id = ? ORDER BY id ASC')
      .all(orderId) as PrintQueueRow[]

    return rows.map(this.rowToPrintJob)
  }

  /**
   * Updates a job's status to 'printing'.
   * Called when the job is being sent to the printer.
   */
  markPrinting(id: number): void {
    this.db
      .prepare("UPDATE print_queue SET status = 'printing' WHERE id = ?")
      .run(id)
  }

  /**
   * Updates a job's status to 'completed'.
   * Called when the printer confirms successful printing.
   */
  markCompleted(id: number): void {
    this.db
      .prepare("UPDATE print_queue SET status = 'completed' WHERE id = ?")
      .run(id)
  }

  /**
   * Updates a job's status to 'error' with an error message and increments attempts.
   * Called when printing fails. The job can be retried later.
   */
  markError(id: number, errorMessage: string): void {
    this.db
      .prepare(
        `UPDATE print_queue
         SET status = 'error', error_message = ?, attempts = attempts + 1
         WHERE id = ?`
      )
      .run(errorMessage, id)
  }

  /**
   * Resets a job back to 'pending' status for retry.
   * Clears the error message but preserves the attempt count.
   */
  retry(id: number): void {
    this.db
      .prepare(
        `UPDATE print_queue
         SET status = 'pending', error_message = NULL
         WHERE id = ?`
      )
      .run(id)
  }

  /**
   * Resets all error jobs back to pending for a given printer target.
   * Useful when resuming a paused/errored printer.
   */
  retryAllByTarget(target: PrinterTarget): void {
    this.db
      .prepare(
        `UPDATE print_queue
         SET status = 'pending', error_message = NULL
         WHERE status = 'error' AND printer_target = ?`
      )
      .run(target)
  }

  /**
   * Deletes completed jobs older than the given number of days.
   * Helps keep the queue table from growing indefinitely.
   */
  purgeCompleted(olderThanDays: number = 7): number {
    const result = this.db
      .prepare(
        `DELETE FROM print_queue
         WHERE status = 'completed'
         AND created_at < datetime('now', '-' || ? || ' days')`
      )
      .run(olderThanDays)

    return result.changes
  }

  /**
   * Returns the count of jobs grouped by status.
   */
  countByStatus(): Record<PrintJobStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) as cnt FROM print_queue GROUP BY status')
      .all() as Array<{ status: string; cnt: number }>

    const counts: Record<PrintJobStatus, number> = {
      pending: 0,
      printing: 0,
      completed: 0,
      error: 0
    }

    for (const row of rows) {
      counts[row.status as PrintJobStatus] = row.cnt
    }

    return counts
  }

  /**
   * Returns the total number of jobs in the queue.
   */
  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM print_queue')
      .get() as { cnt: number }
    return row.cnt
  }

  /**
   * Converts a raw database row (snake_case) to a PrintJob (camelCase).
   */
  private rowToPrintJob(row: PrintQueueRow): PrintJob {
    return {
      id: row.id,
      orderId: row.order_id,
      printerTarget: row.printer_target as PrinterTarget,
      pdfType: row.pdf_type,
      status: row.status as PrintJobStatus,
      filePath: row.file_path,
      attempts: row.attempts,
      errorMessage: row.error_message,
      createdAt: row.created_at
    }
  }
}
