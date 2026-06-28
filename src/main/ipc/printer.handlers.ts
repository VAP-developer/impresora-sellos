import { handleIpc } from './handlers'
import { PrintQueueRepository } from '../database/repositories/print-queue.repository'

// === Printer Types (matching preload interface) ===

export interface PrinterInfo {
  id: string
  name: string
  target: 'printer1' | 'printer2' | 'ticket'
  status: 'ready' | 'busy' | 'error' | 'disconnected' | 'paused'
  uri: string
}

export interface PrintJobInfo {
  id: number
  orderId?: number
  printerTarget: 'printer1' | 'printer2' | 'ticket'
  pdfType: string
  status: 'pending' | 'printing' | 'completed' | 'error'
  filePath?: string
  attempts: number
  errorMessage?: string
}

/**
 * Registers IPC handlers for printer management.
 *
 * Channels:
 * - printer:getStatus — Returns status of connected printers (PrinterInfo[])
 * - printer:print — Executes printing (generates PDFs + sends to printers)
 * - printer:pause — Pauses the printer (stops sending jobs)
 * - printer:resume — Resumes the printer (resends pending jobs)
 * - printer:getQueue — Returns the current print queue (PrintJob[])
 *
 * NOTE: The actual printing module (printer-manager.ts, pdf-generator.ts,
 * print-queue.service.ts) is not yet implemented (Task 12).
 * These handlers use stub/placeholder implementations that return sensible defaults.
 */
export function registerPrinterHandlers(): void {
  const queueRepo = new PrintQueueRepository()

  /**
   * Returns the status of connected printers.
   * TODO: Integrate with printer-manager.ts (Task 12) to detect real printers
   * via CUPS (Linux) or IPP (Windows) and return their actual status.
   */
  handleIpc('printer:getStatus', (): PrinterInfo[] => {
    // TODO: Replace with actual printer discovery from printer-manager.ts (Task 12)
    // This should use avahi-browse (Linux) or IPP scanning (Windows) to find printers
    return []
  })

  /**
   * Executes printing: generates PDFs and sends them to the appropriate printers.
   * Takes config, quantities, and profile as arguments.
   * TODO: Integrate with pdf-generator.ts (Task 11) and print-queue.service.ts (Task 12)
   * to generate actual PDFs and send them to printers.
   */
  handleIpc('printer:print', (_config: unknown, _quantities: unknown, _profile: unknown): void => {
    // TODO: Implement actual printing logic (Tasks 11 & 12):
    // 1. Generate PDFs using pdf-generator.ts (stamp labels + tickets)
    // 2. Enqueue jobs in print_queue table via PrintQueueRepository
    // 3. Send PDFs to printers via printer-manager.ts
    // 4. Update job status as they complete
    console.log('[Printer] print called — stub (printing module not yet implemented)')
  })

  /**
   * Pauses the printer (stops sending new jobs to the physical printer).
   * TODO: Integrate with printer-manager.ts (Task 12) to call cupsdisable (Linux)
   * or equivalent IPP pause command (Windows).
   */
  handleIpc('printer:pause', (): void => {
    // TODO: Replace with actual printer pause via printer-manager.ts (Task 12)
    // Should call cupsdisable on Linux or IPP Pause-Printer on Windows
    console.log('[Printer] pause called — stub (printing module not yet implemented)')
  })

  /**
   * Resumes the printer (resends pending jobs).
   * TODO: Integrate with printer-manager.ts (Task 12) to call cupsenable (Linux)
   * or equivalent IPP resume command (Windows), then re-process pending queue.
   */
  handleIpc('printer:resume', (): void => {
    // TODO: Replace with actual printer resume via printer-manager.ts (Task 12)
    // Should call cupsenable on Linux or IPP Resume-Printer on Windows
    // Then retry all pending/error jobs via print-queue.service.ts
    console.log('[Printer] resume called — stub (printing module not yet implemented)')
  })

  /**
   * Returns the current print queue from the database.
   * This handler already uses the real PrintQueueRepository since the
   * queue table exists. Returns jobs mapped to the PrintJobInfo interface.
   */
  handleIpc('printer:getQueue', (): PrintJobInfo[] => {
    const jobs = queueRepo.getAll()
    return jobs.map((job) => ({
      id: job.id,
      orderId: job.orderId ?? undefined,
      printerTarget: job.printerTarget,
      pdfType: job.pdfType,
      status: job.status,
      filePath: job.filePath ?? undefined,
      attempts: job.attempts,
      errorMessage: job.errorMessage ?? undefined
    }))
  })
}
