/**
 * printer-manager.ts
 *
 * Provides an abstract PrinterBackend interface and a PrinterManager that delegates
 * to the appropriate platform-specific backend (CUPS on Linux, IPP on Windows).
 *
 * The PrinterManager handles:
 * - Auto-detection of the current OS and selection of the correct backend
 * - Sending PDF buffers to the correct printer with appropriate media options
 * - Querying printer status (ready, busy, error, paused, disconnected)
 * - Pausing and resuming printers
 * - Discovering available printers on the network/system
 *
 * Validates: Requirements 8 (print routing), 9 (abstraction layer)
 * Correctness Property: 9 (deterministic routing based on target)
 */

import { platform } from 'os'
import { CupsBackend } from './cups-backend'
import { IppBackend } from './ipp-backend'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Target printer assignment */
export type PrinterTarget = 'printer1' | 'printer2' | 'ticket'

/** Printer status values */
export type PrinterStatus = 'ready' | 'busy' | 'error' | 'disconnected' | 'paused'

/** Information about a discovered/configured printer */
export interface PrinterInfo {
  /** Unique identifier for the printer */
  id: string
  /** Human-readable printer name */
  name: string
  /** Assigned target role */
  target: PrinterTarget
  /** Current status */
  status: PrinterStatus
  /** Connection URI (IPP URI or CUPS queue name) */
  uri: string
}

/** Options for a print job sent to a printer */
export interface PrintOptions {
  /** Media size (e.g. "DC55x25" for stamps, "Custom.78x{height}mm" for tickets) */
  media: string
  /** Orientation value (6 = landscape for stamps, 3 = portrait for tickets) */
  orientation: number
  /** Number of copies (default 1) */
  copies?: number
  /** Job name for identification in the queue */
  jobName?: string
}

/** Result from submitting a print job */
export interface PrintResult {
  /** Whether the job was accepted by the printer/spooler */
  success: boolean
  /** Job ID assigned by the printing system (if available) */
  jobId?: string
  /** Error message if success is false */
  error?: string
}

/** A discovered printer (before being assigned a target role) */
export interface DiscoveredPrinter {
  /** Printer name as reported by the system */
  name: string
  /** Connection URI */
  uri: string
  /** Whether the printer is currently accepting jobs */
  accepting: boolean
  /** Additional info (model, location, etc.) */
  info?: string
}

// ─── Abstract Backend Interface ───────────────────────────────────────────────

/**
 * Abstract interface for platform-specific printer backends.
 *
 * Implementations:
 * - CupsBackend (Linux/Ubuntu): Uses `lp`, `lpstat`, `cupsdisable`, `cupsenable`
 * - IppBackend (Windows): Uses IPP protocol over HTTP directly
 *
 * Each backend must implement all methods to provide a uniform API
 * regardless of the underlying printing system.
 */
export interface PrinterBackend {
  /**
   * Sends a PDF buffer to a printer for printing.
   *
   * @param printerUri - The URI or queue name of the target printer
   * @param pdfBuffer - The PDF content as a Buffer
   * @param options - Print options (media, orientation, copies)
   * @returns Result indicating success/failure and job ID
   */
  print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult>

  /**
   * Queries the current status of a specific printer.
   *
   * @param printerUri - The URI or queue name of the printer
   * @returns Current status of the printer
   */
  getStatus(printerUri: string): Promise<PrinterStatus>

  /**
   * Pauses a printer, stopping it from processing new jobs.
   * Existing jobs in the queue are preserved.
   *
   * @param printerUri - The URI or queue name of the printer
   * @returns true if pause was successful
   */
  pause(printerUri: string): Promise<boolean>

  /**
   * Resumes a previously paused printer, allowing it to process queued jobs.
   *
   * @param printerUri - The URI or queue name of the printer
   * @returns true if resume was successful
   */
  resume(printerUri: string): Promise<boolean>

  /**
   * Discovers printers available on the system/network.
   * On Linux: uses avahi-browse or lpstat to find CUPS printers.
   * On Windows: scans for IPP printers via network discovery.
   *
   * @returns Array of discovered printers
   */
  discover(): Promise<DiscoveredPrinter[]>

  /**
   * Cancels a specific print job by its ID.
   *
   * @param printerUri - The URI or queue name of the printer
   * @param jobId - The job ID to cancel
   * @returns true if cancellation was successful
   */
  cancelJob(printerUri: string, jobId: string): Promise<boolean>
}

// ─── Printer Configuration ────────────────────────────────────────────────────

/** Mapping of target roles to printer URIs */
export interface PrinterAssignments {
  printer1?: string // URI for stamp printer 1 (model 1 / left)
  printer2?: string // URI for stamp printer 2 (model 2 / right)
  ticket?: string // URI for ticket printer
}

// ─── Stamp/Ticket media constants ─────────────────────────────────────────────

/** Media size for stamp labels: 55mm x 25mm */
export const STAMP_MEDIA = 'DC55x25'

/** Orientation for stamps: landscape (value 6 per IPP spec) */
export const STAMP_ORIENTATION = 6

/** Orientation for tickets: portrait (value 3 per IPP spec) */
export const TICKET_ORIENTATION = 3

/**
 * Builds the custom media string for a ticket of variable height.
 * Format: Custom.78x{height}mm
 */
export function buildTicketMedia(heightMm: number): string {
  return `Custom.78x${Math.ceil(heightMm)}mm`
}

// ─── PrinterManager ───────────────────────────────────────────────────────────

/**
 * High-level printer manager that wraps a platform-specific backend.
 *
 * Responsibilities:
 * - Maintains the printer-to-target assignments
 * - Routes print jobs to the correct printer based on target
 * - Provides a unified API for the IPC handlers and print-queue service
 * - Auto-detects the platform backend on initialization
 */
export class PrinterManager {
  private backend: PrinterBackend
  private assignments: PrinterAssignments
  private paused: Set<PrinterTarget>

  constructor(backend: PrinterBackend, assignments?: PrinterAssignments) {
    this.backend = backend
    this.assignments = assignments ?? {}
    this.paused = new Set()
  }

  /**
   * Returns the active backend instance.
   */
  getBackend(): PrinterBackend {
    return this.backend
  }

  /**
   * Updates the printer assignments (target → URI mapping).
   */
  setAssignments(assignments: PrinterAssignments): void {
    this.assignments = { ...this.assignments, ...assignments }
  }

  /**
   * Gets the current printer assignments.
   */
  getAssignments(): PrinterAssignments {
    return { ...this.assignments }
  }

  /**
   * Gets the URI for a given printer target.
   * Returns undefined if not assigned.
   */
  getUriForTarget(target: PrinterTarget): string | undefined {
    return this.assignments[target]
  }

  /**
   * Sends a PDF to the printer assigned to the given target.
   *
   * @param target - Which printer role to send to (printer1, printer2, ticket)
   * @param pdfBuffer - The PDF content
   * @param options - Print options (media, orientation, etc.)
   * @returns PrintResult indicating success or failure
   */
  async print(target: PrinterTarget, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    const uri = this.assignments[target]
    if (!uri) {
      return {
        success: false,
        error: `No printer assigned for target "${target}"`
      }
    }

    if (this.paused.has(target)) {
      return {
        success: false,
        error: `Printer "${target}" is paused`
      }
    }

    return this.backend.print(uri, pdfBuffer, options)
  }

  /**
   * Sends a stamp PDF to the appropriate printer.
   * Automatically applies stamp media and orientation settings.
   *
   * @param target - printer1 or printer2
   * @param pdfBuffer - The stamp PDF content
   * @param jobName - Optional job name for identification
   */
  async printStamp(
    target: 'printer1' | 'printer2',
    pdfBuffer: Buffer,
    jobName?: string
  ): Promise<PrintResult> {
    return this.print(target, pdfBuffer, {
      media: STAMP_MEDIA,
      orientation: STAMP_ORIENTATION,
      jobName: jobName ?? `stamp_${target}`
    })
  }

  /**
   * Sends a ticket PDF to the ticket printer.
   * Automatically applies ticket media (variable height) and orientation.
   *
   * @param pdfBuffer - The ticket PDF content
   * @param heightMm - Height of the ticket in millimeters
   * @param jobName - Optional job name for identification
   */
  async printTicket(
    pdfBuffer: Buffer,
    heightMm: number,
    jobName?: string
  ): Promise<PrintResult> {
    return this.print('ticket', pdfBuffer, {
      media: buildTicketMedia(heightMm),
      orientation: TICKET_ORIENTATION,
      jobName: jobName ?? 'ticket'
    })
  }

  /**
   * Gets the status of all assigned printers.
   *
   * @returns Array of PrinterInfo for each assigned printer
   */
  async getStatus(): Promise<PrinterInfo[]> {
    const results: PrinterInfo[] = []
    const targets: PrinterTarget[] = ['printer1', 'printer2', 'ticket']

    for (const target of targets) {
      const uri = this.assignments[target]
      if (!uri) continue

      let status: PrinterStatus
      if (this.paused.has(target)) {
        status = 'paused'
      } else {
        try {
          status = await this.backend.getStatus(uri)
        } catch {
          status = 'disconnected'
        }
      }

      results.push({
        id: `${target}_${uri}`,
        name: uri,
        target,
        status,
        uri
      })
    }

    return results
  }

  /**
   * Pauses a printer target, preventing jobs from being sent to it.
   * Also calls the backend pause to stop the physical printer queue.
   *
   * @param target - The printer target to pause
   */
  async pause(target: PrinterTarget): Promise<boolean> {
    const uri = this.assignments[target]
    if (!uri) return false

    const result = await this.backend.pause(uri)
    if (result) {
      this.paused.add(target)
    }
    return result
  }

  /**
   * Resumes a previously paused printer target.
   * Calls the backend resume to re-enable the physical printer queue.
   *
   * @param target - The printer target to resume
   */
  async resume(target: PrinterTarget): Promise<boolean> {
    const uri = this.assignments[target]
    if (!uri) return false

    const result = await this.backend.resume(uri)
    if (result) {
      this.paused.delete(target)
    }
    return result
  }

  /**
   * Pauses all assigned printers.
   */
  async pauseAll(): Promise<void> {
    const targets: PrinterTarget[] = ['printer1', 'printer2', 'ticket']
    for (const target of targets) {
      if (this.assignments[target]) {
        await this.pause(target)
      }
    }
  }

  /**
   * Resumes all paused printers.
   */
  async resumeAll(): Promise<void> {
    const targets: PrinterTarget[] = ['printer1', 'printer2', 'ticket']
    for (const target of targets) {
      if (this.paused.has(target)) {
        await this.resume(target)
      }
    }
  }

  /**
   * Checks if a specific target is currently paused.
   */
  isPaused(target: PrinterTarget): boolean {
    return this.paused.has(target)
  }

  /**
   * Discovers available printers using the backend.
   */
  async discover(): Promise<DiscoveredPrinter[]> {
    return this.backend.discover()
  }

  /**
   * Cancels a print job on the printer assigned to the given target.
   */
  async cancelJob(target: PrinterTarget, jobId: string): Promise<boolean> {
    const uri = this.assignments[target]
    if (!uri) return false
    return this.backend.cancelJob(uri, jobId)
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Detects the current platform and returns the appropriate backend identifier.
 * Used by createPrinterManager to auto-select the backend.
 *
 * @param platformOverride - Optional platform string for testing (defaults to os.platform())
 */
export function detectPlatformBackend(platformOverride?: string): 'cups' | 'ipp' {
  const os = platformOverride ?? platform()
  if (os === 'linux' || os === 'darwin') {
    return 'cups'
  }
  // Windows and others use IPP
  return 'ipp'
}

/**
 * Creates a PrinterBackend instance based on the detected platform.
 *
 * - Linux/macOS → CupsBackend (uses `lp`, `lpstat`, `cupsdisable`, `cupsenable`)
 * - Windows → IppBackend (uses IPP protocol over HTTP)
 *
 * @param platformOverride - Optional platform string for testing (defaults to os.platform())
 * @returns The appropriate PrinterBackend for the current OS
 */
export function createPlatformBackend(platformOverride?: string): PrinterBackend {
  const backendType = detectPlatformBackend(platformOverride)
  if (backendType === 'cups') {
    return new CupsBackend()
  }
  return new IppBackend()
}

/**
 * Creates a PrinterManager with the platform-appropriate backend (auto-detected).
 *
 * Detects the current OS and instantiates:
 * - CupsBackend on Linux/macOS (development)
 * - IppBackend on Windows (production)
 *
 * Optionally accepts a backend override for testing or manual configuration.
 *
 * @param backendOrAssignments - Either a PrinterBackend override, or printer assignments (auto-detect backend)
 * @param assignments - Optional initial printer assignments (when first param is a backend)
 * @returns Configured PrinterManager instance
 */
export function createPrinterManager(
  backendOrAssignments?: PrinterBackend | PrinterAssignments,
  assignments?: PrinterAssignments
): PrinterManager {
  let backend: PrinterBackend
  let resolvedAssignments: PrinterAssignments | undefined

  if (backendOrAssignments && 'print' in backendOrAssignments) {
    // First argument is a PrinterBackend instance (override/testing)
    backend = backendOrAssignments as PrinterBackend
    resolvedAssignments = assignments
  } else {
    // Auto-detect backend based on platform
    backend = createPlatformBackend()
    resolvedAssignments = backendOrAssignments as PrinterAssignments | undefined
  }

  return new PrinterManager(backend, resolvedAssignments)
}
