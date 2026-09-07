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

    console.log(
      `[Services] Printer assignments loaded: ${JSON.stringify(savedAssignments)}`
    )

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

  // Configure the stamp printers' driver DevMode (fire-and-forget).
  //
  // This performs BOTH the paper-size (55x25mm) and the cut-at-end setup in a
  // SINGLE operation via the Win32 DocumentProperties API. It must not be split
  // into two concurrent tasks: the previous design ran a raw-byte cut-mode edit
  // in parallel with the paper-size setup, which raced and corrupted the large
  // TD-4520TN DEVMODE (spooler reported success but nothing printed).
  configureStampPrinters().catch((err) => {
    console.warn('[Services] Failed to configure stamp printers:', err)
  })
}

/**
 * Stamp page size in millimetres.
 *
 * IMPORTANT: 55x55, NOT 55x25. The physical label is 55x25mm, but the page must
 * be 55x55mm because that's how stamp-renderer.ts builds the PDF
 * (STAMP_WIDTH_MM = 55, STAMP_HEIGHT_MM = 55, LABEL_HEIGHT_MM = 25 — the
 * content sits in the top 25mm strip, which is the part the printer marks).
 * Verified on paper: with 55x25 the content comes out cut in half.
 */
const STAMP_PAGE_WIDTH_MM = 55
const STAMP_PAGE_HEIGHT_MM = 55

/**
 * Resolves a resource script path across dev and packaged layouts.
 * Returns an empty string if the script cannot be found.
 */
function findResourceScript(scriptName: string): string {
  const { existsSync } = require('fs')
  const { join } = require('path')

  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, scriptName))
  }
  candidates.push(join(__dirname, '..', 'resources', scriptName))
  candidates.push(join(__dirname, '..', '..', 'resources', scriptName))

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return ''
}

/**
 * Returns the printer names assigned to the stamp targets (printer1, printer2).
 * Decodes the win:// URIs into plain Windows printer names.
 */
function getStampPrinterNames(): string[] {
  let savedAssignments: Record<string, string> = {}
  try {
    const assignmentsRepo = new PrinterAssignmentsRepository()
    savedAssignments = assignmentsRepo.getAll()
  } catch {
    return []
  }

  return [savedAssignments.printer1, savedAssignments.printer2]
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => decodeURIComponent(uri.replace('win://', '')))
}

/**
 * Ensures the assigned stamp printers (printer1, printer2) use the 55x55mm
 * stamp page size expected by the PDF generator.
 *
 * Uses set-stamp-paper-size.ps1, which applies the size through
 * Set-PrintConfiguration (the PrintTicket) — the configuration the driver
 * actually uses. Earlier versions poked bytes into the per-user DevMode in the
 * registry, which was unreliable: SumatraPDF honoured it inconsistently and the
 * driver's effective size stayed at the TD-4520TN factory default of 4"x6", so
 * jobs were silently discarded (the spooler reported success, nothing printed).
 *
 * Cutting is not configured here: the app already controls cut groups by
 * generating one PDF per group (see label-grouping.ts), so the driver only needs
 * to cut at the end of each job.
 *
 * Runs printers sequentially. Idempotent — safe to call on every startup.
 */
async function configureStampPrinters(): Promise<void> {
  const scriptPath = findResourceScript('set-stamp-paper-size.ps1')
  if (!scriptPath) {
    console.log('[Services] set-stamp-paper-size.ps1 not found, skipping')
    return
  }

  const stampPrinters = getStampPrinterNames()
  if (stampPrinters.length === 0) return

  const { exec: nodeExec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(nodeExec)

  for (const printerName of stampPrinters) {
    const escaped = printerName.replace(/"/g, '`"')
    const cmd =
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" ` +
      `-PrinterName "${escaped}" ` +
      `-WidthMm ${STAMP_PAGE_WIDTH_MM} ` +
      `-HeightMm ${STAMP_PAGE_HEIGHT_MM}`
    try {
      const { stdout, stderr } = (await execAsync(cmd, { timeout: 10000 })) as {
        stdout: string
        stderr: string
      }
      const out = String(stdout ?? '').trim().replace(/\s*\n\s*/g, ' | ')
      console.log(`[Services] Configured stamp printer "${printerName}": ${out}`)
      const errOut = String(stderr ?? '').trim()
      if (errOut) console.warn(`[Services] Config stderr for "${printerName}": ${errOut}`)
    } catch (err) {
      console.warn(`[Services] Failed to configure stamp printer ${printerName}:`, err)
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
