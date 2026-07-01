/**
 * services.ts
 *
 * Service registry for the main process.
 * Creates and exports singleton instances of PrinterManager and PrintQueueService.
 * Provides lifecycle methods to start/stop background processing.
 *
 * Validates: Requirements 8.5 (retry on error), 8.6 (pause stops sending),
 * 8.7 (resume resends), 18.2 (persist before sending)
 */

import { createPrinterManager, PrinterManager } from './printing/printer-manager'
import { PrintQueueService } from './printing/print-queue.service'

// ─── Singleton instances ──────────────────────────────────────────────────────

let printerManager: PrinterManager | null = null
let printQueueService: PrintQueueService | null = null

/**
 * Returns the singleton PrinterManager instance.
 * Creates it on first access (lazy initialization).
 */
export function getPrinterManager(): PrinterManager {
  if (!printerManager) {
    printerManager = createPrinterManager()
  }
  return printerManager
}

/**
 * Returns the singleton PrintQueueService instance.
 * Creates it on first access (lazy initialization).
 */
export function getPrintQueueService(): PrintQueueService {
  if (!printQueueService) {
    printQueueService = new PrintQueueService(getPrinterManager())
  }
  return printQueueService
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Initializes all services and starts background processing.
 * Call this after database initialization and handler registration.
 */
export function initServices(): void {
  const queue = getPrintQueueService()
  queue.start()
  console.log('[Services] Print queue background processing started')
}

/**
 * Stops all background services gracefully.
 * Call this on app quit (will-quit event).
 */
export function shutdownServices(): void {
  if (printQueueService) {
    printQueueService.stop()
    printQueueService.clearBufferCache()
    console.log('[Services] Print queue stopped')
  }
}

/**
 * Resets singleton instances (for testing purposes only).
 */
export function resetServices(): void {
  if (printQueueService) {
    printQueueService.stop()
    printQueueService.clearBufferCache()
  }
  printerManager = null
  printQueueService = null
}

/**
 * Injects custom instances (for testing purposes only).
 * Allows tests to provide mocked services.
 */
export function setServices(
  manager: PrinterManager | null,
  queue: PrintQueueService | null
): void {
  printerManager = manager
  printQueueService = queue
}
