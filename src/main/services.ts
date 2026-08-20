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

import { PrinterManager, DEFAULT_THERMAL_CONFIG } from './printing/printer-manager'
import type { PrinterAssignments } from './printing/printer-manager'
import { PrintQueueService } from './printing/print-queue.service'
import { PrinterAssignmentsRepository } from './database/repositories/printer-assignments.repository'
import { DpiCache, WmiDpiDetector } from './printing/dpi-detector'
import { WindowsBackend, defaultWindowsExecutor } from './printing/windows-backend'

// ─── Singleton instances ──────────────────────────────────────────────────────

let printerManager: PrinterManager | null = null
let printQueueService: PrintQueueService | null = null

/**
 * Returns the singleton PrinterManager instance.
 * Creates it on first access (lazy initialization).
 * Loads persisted printer assignments from the database.
 * Applies thermal printer config for stamp printers (printer1, printer2).
 */
export function getPrinterManager(): PrinterManager {
  if (!printerManager) {
    // Load persisted assignments from database
    let savedAssignments: Record<string, string> = {}
    try {
      const assignmentsRepo = new PrinterAssignmentsRepository()
      savedAssignments = assignmentsRepo.getAll()
    } catch (err) {
      console.warn('[Services] Failed to load printer assignments:', err)
    }

    // Build PrinterAssignments with thermal config for stamp printers.
    // printer1 and printer2 are always Brother TD-4100N thermal label printers
    // connected via win:// on Windows. Thermal config fixes:
    // - 180° rotation (paper feeds from bottom)
    // - Explicit paper size (55x25mm)
    // - Force single copy (prevents double printing)
    const assignments: PrinterAssignments | undefined =
      Object.keys(savedAssignments).length > 0
        ? {
            ...savedAssignments,
            thermalConfig: {
              printer1: DEFAULT_THERMAL_CONFIG,
              printer2: DEFAULT_THERMAL_CONFIG,
            }
          }
        : undefined

    // Create DPI infrastructure: cache stores detected DPIs, detector queries WMI
    const dpiCache = new DpiCache()
    const dpiDetector = new WmiDpiDetector(defaultWindowsExecutor)

    // Create WindowsBackend with DPI cache so print jobs use detected resolution
    const backend = new WindowsBackend(defaultWindowsExecutor, dpiCache)

    // Create PrinterManager with all dependencies
    printerManager = new PrinterManager(backend, assignments, dpiDetector, dpiCache)

    // Trigger initial DPI detection for all assigned printers (fire-and-forget)
    if (assignments) {
      printerManager.setAssignments(assignments)
    }
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

  // Configure stamp printers for "cut at end" mode (fire-and-forget).
  // The application controls cut groups by generating separate PDFs,
  // so the driver only needs to cut when each job ends.
  configureCutAtEnd().catch((err) => {
    console.warn('[Services] Failed to configure cut-at-end mode:', err)
  })
}

/**
 * Configures all assigned stamp printers (printer1, printer2) to use
 * "Cut at End" mode only. This disables "Cut Every N" in the Brother driver
 * so that the app's PDF grouping (via groupLabels/cutNumber) controls cutting.
 *
 * Modifies the per-user DevMode in HKCU registry directly because:
 * - DocumentProperties API resets private DEVMODE fields
 * - SetPrinter level 9 doesn't reliably propagate to per-user defaults
 * - SumatraPDF reads from per-user defaults when creating print jobs
 *
 * This is idempotent — safe to call on every startup.
 */
async function configureCutAtEnd(): Promise<void> {
  const { existsSync } = require('fs')
  const { join } = require('path')

  // Find the configure script
  let scriptPath = ''
  const scriptName = 'configure-cut-at-end.ps1'

  if (process.resourcesPath) {
    const packaged = join(process.resourcesPath, scriptName)
    if (existsSync(packaged)) scriptPath = packaged
  }
  if (!scriptPath) {
    const devPath = join(__dirname, '..', 'resources', scriptName)
    if (existsSync(devPath)) scriptPath = devPath
  }
  if (!scriptPath) {
    const devPath2 = join(__dirname, '..', '..', 'resources', scriptName)
    if (existsSync(devPath2)) scriptPath = devPath2
  }

  if (!scriptPath) {
    console.log('[Services] configure-cut-at-end.ps1 not found, skipping')
    return
  }

  // Get assigned stamp printers
  let savedAssignments: Record<string, string> = {}
  try {
    const assignmentsRepo = new PrinterAssignmentsRepository()
    savedAssignments = assignmentsRepo.getAll()
  } catch {
    return
  }

  const stampPrinters = [savedAssignments.printer1, savedAssignments.printer2].filter(Boolean)
  if (stampPrinters.length === 0) return

  const { exec: nodeExec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(nodeExec)

  for (const uri of stampPrinters) {
    // Decode win://PrinterName to plain printer name
    const printerName = decodeURIComponent(uri.replace('win://', ''))
    const escaped = printerName.replace(/"/g, '`"')
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escaped}"`
    try {
      await execAsync(cmd, { timeout: 10000 })
      console.log(`[Services] Configured cut-at-end for: ${printerName}`)
    } catch (err) {
      console.warn(`[Services] Failed to configure cut-at-end for ${printerName}:`, err)
    }
  }
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
