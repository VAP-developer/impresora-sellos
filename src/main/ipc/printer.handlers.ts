/**
 * printer.handlers.ts
 *
 * IPC handlers for printer management.
 * Uses the shared PrinterManager and PrintQueueService singletons from services.ts.
 *
 * Validates: Requirements 8.5 (retry), 8.6 (pause), 8.7 (resume)
 */

import { handleIpc } from './handlers'
import { getPrinterManager, getPrintQueueService } from '../services'
import { PrintQueueRepository } from '../database/repositories/print-queue.repository'
import { PrinterAssignmentsRepository } from '../database/repositories/printer-assignments.repository'
import type { PrinterTarget, DiscoveredPrinter } from '../printing/printer-manager'

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
 * - printer:print — Stub (printing is triggered via sale:execute flow)
 * - printer:pause — Pauses all printers (stops sending jobs)
 * - printer:resume — Resumes all printers (retries error jobs)
 * - printer:getQueue — Returns the current print queue (PrintJob[])
 */
export function registerPrinterHandlers(): void {
  const queueRepo = new PrintQueueRepository()

  /**
   * Returns the status of connected printers.
   * Uses the real PrinterManager to query assigned printers.
   */
  handleIpc('printer:getStatus', async (): Promise<PrinterInfo[]> => {
    const printerManager = getPrinterManager()
    const statuses = await printerManager.getStatus()
    return statuses.map((info) => ({
      id: info.id,
      name: info.name,
      target: info.target,
      status: info.status,
      uri: info.uri
    }))
  })

  /**
   * Printing is triggered via the sale:execute flow.
   * This handler remains as a no-op for backward compatibility.
   */
  handleIpc(
    'printer:print',
    (_config: unknown, _quantities: unknown, _profile: unknown): void => {
      // Printing is now handled by the sale flow:
      // sale:execute → generateSalePdfs → printQueueService.enqueue → background processing
      console.log(
        '[Printer] print called — printing is handled via sale:execute flow'
      )
    }
  )

  /**
   * Pauses all printers — stops sending new jobs to physical printers.
   * Jobs remain in the queue and will be processed when resumed.
   * Validates: Req 8.6
   */
  handleIpc('printer:pause', async (): Promise<void> => {
    const printerManager = getPrinterManager()
    await printerManager.pauseAll()
    console.log('[Printer] All printers paused')
  })

  /**
   * Resumes all printers — resends pending and retries error jobs.
   * Validates: Req 8.7
   */
  handleIpc('printer:resume', async (): Promise<void> => {
    const printerManager = getPrinterManager()
    await printerManager.resumeAll()

    // Retry error jobs for all targets that were just resumed
    const queueService = getPrintQueueService()
    const targets: PrinterTarget[] = ['printer1', 'printer2', 'ticket']
    for (const target of targets) {
      queueService.retryErrorsByTarget(target)
    }

    console.log('[Printer] All printers resumed, error jobs retried')
  })

  /**
   * Returns the current print queue from the database.
   * Maps jobs to the PrintJobInfo interface for the renderer.
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

  /**
   * Discovers available printers on the network/system.
   * Returns a list of DiscoveredPrinter objects with name, URI, and accepting state.
   */
  handleIpc('printer:discover', async (): Promise<DiscoveredPrinter[]> => {
    const printerManager = getPrinterManager()
    return printerManager.discover()
  })

  /**
   * Reassigns a printer target to a different printer URI.
   * Used to switch which physical printer handles a given role (printer1, printer2, ticket).
   * Persists the assignment to the database so it survives app restarts.
   *
   * @param target - The role to reassign ('printer1' | 'printer2' | 'ticket')
   * @param uri - The new printer URI (from discovery results)
   */
  handleIpc(
    'printer:assign',
    async (target: unknown, uri: unknown): Promise<{ success: boolean; error?: string }> => {
      const typedTarget = target as PrinterTarget
      const typedUri = uri as string

      if (!['printer1', 'printer2', 'ticket'].includes(typedTarget)) {
        return { success: false, error: `Invalid target: ${typedTarget}` }
      }
      if (!typedUri || typeof typedUri !== 'string') {
        return { success: false, error: 'Invalid printer URI' }
      }

      const printerManager = getPrinterManager()
      printerManager.setAssignments({ [typedTarget]: typedUri })

      // Persist assignment to database
      try {
        const assignmentsRepo = new PrinterAssignmentsRepository()
        assignmentsRepo.set(typedTarget, typedUri)
      } catch (err) {
        console.warn('[Printer] Failed to persist assignment:', err)
      }

      console.log(`[Printer] Reassigned ${typedTarget} → ${typedUri}`)
      return { success: true }
    }
  )

  /**
   * Returns the current printer assignments (target → URI mapping).
   */
  handleIpc(
    'printer:getAssignments',
    (): Record<string, string | undefined> => {
      const printerManager = getPrinterManager()
      return printerManager.getAssignments()
    }
  )
}
