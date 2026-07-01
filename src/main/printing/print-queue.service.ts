/**
 * print-queue.service.ts
 *
 * Processes the persistent print queue with retry logic.
 *
 * Responsibilities:
 * - Enqueues generated PDFs (from pdf-generator.ts) into the print_queue table
 * - Processes pending jobs by sending them to the PrinterManager
 * - Retries failed jobs up to a configurable max attempts
 * - Respects printer paused state (skips paused targets)
 * - Provides queue status information
 * - Supports start/stop lifecycle for background processing
 *
 * Validates: Requirements 8.5, 8.6, 8.7, 18.2
 */

import {
  PrintQueueRepository,
  PrintJob,
  PrinterTarget
} from '../database/repositories/print-queue.repository'
import {
  PrinterManager,
  PrintOptions,
  STAMP_MEDIA,
  STAMP_ORIENTATION,
  TICKET_ORIENTATION,
  buildTicketMedia
} from './printer-manager'
import { GeneratedPdf } from './pdf-generator'

// ─── Configuration ────────────────────────────────────────────────────────────

/** Configuration options for the print queue service */
export interface PrintQueueServiceOptions {
  /** Maximum number of retry attempts before giving up on a job (default: 3) */
  maxAttempts?: number
  /** Delay in ms between processing cycles (default: 1000) */
  pollIntervalMs?: number
  /** Delay in ms before retrying a failed job (default: 2000) */
  retryDelayMs?: number
  /** Default ticket height in mm when not specified (default: 200) */
  defaultTicketHeightMm?: number
}

const DEFAULT_OPTIONS: Required<PrintQueueServiceOptions> = {
  maxAttempts: 3,
  pollIntervalMs: 1000,
  retryDelayMs: 2000,
  defaultTicketHeightMm: 200
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Service that manages the print queue lifecycle.
 *
 * Flow:
 * 1. `enqueue()` persists PDFs to the queue table and stores buffers in memory
 * 2. `processQueue()` (or the background loop) picks up pending jobs and sends them
 * 3. Successful jobs are marked completed; failed ones are retried up to maxAttempts
 * 4. Jobs exceeding maxAttempts stay in 'error' state for manual intervention
 */
export class PrintQueueService {
  private repository: PrintQueueRepository
  private printerManager: PrinterManager
  private options: Required<PrintQueueServiceOptions>

  /** In-memory buffer cache for jobs awaiting printing (jobId → PDF buffer) */
  private bufferCache: Map<number, Buffer> = new Map()

  /** Whether the background processing loop is running */
  private running = false

  /** Timer reference for the polling interval */
  private pollTimer: ReturnType<typeof setTimeout> | null = null

  /** Flag to indicate a processing cycle is in progress (prevents overlap) */
  private processing = false

  constructor(
    printerManager: PrinterManager,
    repository?: PrintQueueRepository,
    options?: PrintQueueServiceOptions
  ) {
    this.printerManager = printerManager
    this.repository = repository ?? new PrintQueueRepository()
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // ─── Enqueue ──────────────────────────────────────────────────────────────

  /**
   * Enqueues a batch of generated PDFs into the print queue.
   * Persists job metadata to the database and caches PDF buffers in memory.
   *
   * @param pdfs - Array of GeneratedPdf from the pdf-generator
   * @param orderId - Optional order ID to associate with these jobs
   * @returns Array of created job IDs
   */
  enqueue(pdfs: GeneratedPdf[], orderId?: number): number[] {
    const jobIds: number[] = []

    for (const pdf of pdfs) {
      const id = this.repository.insert({
        orderId: orderId ?? null,
        printerTarget: pdf.target as PrinterTarget,
        pdfType: pdf.pdfType,
        filePath: null
      })
      this.bufferCache.set(id, pdf.buffer)
      jobIds.push(id)
    }

    return jobIds
  }

  // ─── Processing ───────────────────────────────────────────────────────────

  /**
   * Processes all pending jobs in the queue.
   * Sends each job to its target printer via PrinterManager.
   * Jobs for paused printers are skipped until the printer is resumed.
   *
   * @returns Number of jobs successfully processed in this cycle
   */
  async processQueue(): Promise<number> {
    if (this.processing) {
      return 0
    }

    this.processing = true
    let processed = 0

    try {
      const pendingJobs = this.repository.getPending()

      for (const job of pendingJobs) {
        // Skip jobs for paused printers
        if (this.printerManager.isPaused(job.printerTarget as PrinterTarget)) {
          continue
        }

        // Skip jobs that have exceeded max attempts
        if (job.attempts >= this.options.maxAttempts) {
          continue
        }

        const success = await this.processJob(job)
        if (success) {
          processed++
        }
      }
    } finally {
      this.processing = false
    }

    return processed
  }

  /**
   * Processes a single print job: sends the PDF buffer to the printer.
   *
   * @param job - The print job to process
   * @returns true if the job completed successfully
   */
  private async processJob(job: PrintJob): Promise<boolean> {
    const buffer = this.bufferCache.get(job.id)
    if (!buffer) {
      // No buffer in cache — mark as error (PDF was lost, likely after restart)
      this.repository.markError(job.id, 'PDF buffer not found in cache (possible restart)')
      return false
    }

    // Mark as printing
    this.repository.markPrinting(job.id)

    try {
      const options = this.buildPrintOptions(job)
      const result = await this.printerManager.print(
        job.printerTarget as PrinterTarget,
        buffer,
        options
      )

      if (result.success) {
        this.repository.markCompleted(job.id)
        this.bufferCache.delete(job.id)
        return true
      } else {
        this.repository.markError(job.id, result.error ?? 'Unknown printer error')
        await this.scheduleRetry(job)
        return false
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.repository.markError(job.id, errorMessage)
      await this.scheduleRetry(job)
      return false
    }
  }

  /**
   * Builds the appropriate PrintOptions for a given job based on its type.
   * Stamps use DC55x25 media with landscape orientation.
   * Tickets use variable-height custom media with portrait orientation.
   */
  private buildPrintOptions(job: PrintJob): PrintOptions {
    if (job.printerTarget === 'ticket') {
      return {
        media: buildTicketMedia(this.options.defaultTicketHeightMm),
        orientation: TICKET_ORIENTATION,
        jobName: `${job.pdfType}_${job.id}`
      }
    }

    // Stamp printers (printer1, printer2)
    return {
      media: STAMP_MEDIA,
      orientation: STAMP_ORIENTATION,
      jobName: `${job.pdfType}_${job.id}`
    }
  }

  /**
   * Schedules a retry for a failed job if it hasn't exceeded maxAttempts.
   * The retry resets the job to 'pending' after a delay.
   */
  private async scheduleRetry(job: PrintJob): Promise<void> {
    // Attempt count was already incremented by markError
    const updatedJob = this.repository.getById(job.id)
    if (!updatedJob) return

    if (updatedJob.attempts < this.options.maxAttempts) {
      // Wait before retrying
      await this.delay(this.options.retryDelayMs)
      this.repository.retry(job.id)
    }
    // If maxAttempts reached, leave in 'error' state for manual intervention
  }

  // ─── Background Processing Loop ──────────────────────────────────────────

  /**
   * Starts the background processing loop.
   * The loop polls the queue at regular intervals and processes pending jobs.
   */
  start(): void {
    if (this.running) return
    this.running = true
    this.schedulePoll()
  }

  /**
   * Stops the background processing loop.
   * Does not cancel jobs currently being processed.
   */
  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  /**
   * Returns whether the service is currently running.
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Schedules the next poll cycle.
   */
  private schedulePoll(): void {
    if (!this.running) return

    this.pollTimer = setTimeout(async () => {
      await this.processQueue()
      this.schedulePoll()
    }, this.options.pollIntervalMs)
  }

  // ─── Queue Management ─────────────────────────────────────────────────────

  /**
   * Retries all error jobs for a specific printer target.
   * Useful when resuming a printer that was offline/paused.
   *
   * @param target - The printer target whose errors to retry
   */
  retryErrorsByTarget(target: PrinterTarget): void {
    this.repository.retryAllByTarget(target)
  }

  /**
   * Returns the current queue status summary.
   */
  getStatus(): { pending: number; printing: number; completed: number; error: number } {
    return this.repository.countByStatus()
  }

  /**
   * Returns all jobs in the queue.
   */
  getQueue(): PrintJob[] {
    return this.repository.getAll()
  }

  /**
   * Returns pending jobs for a specific printer target.
   */
  getPendingByTarget(target: PrinterTarget): PrintJob[] {
    return this.repository.getPendingByTarget(target)
  }

  /**
   * Purges completed jobs older than the specified number of days.
   * @param olderThanDays - Number of days threshold (default: 7)
   * @returns Number of jobs purged
   */
  purgeCompleted(olderThanDays?: number): number {
    return this.repository.purgeCompleted(olderThanDays)
  }

  /**
   * Clears the in-memory buffer cache.
   * Should only be called when stopping the service or during cleanup.
   */
  clearBufferCache(): void {
    this.bufferCache.clear()
  }

  /**
   * Returns the number of buffers currently cached in memory.
   * Useful for diagnostics and testing.
   */
  getBufferCacheSize(): number {
    return this.bufferCache.size
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
