/**
 * cups-backend.ts
 *
 * Implementation of PrinterBackend for Linux/macOS using CUPS commands.
 * Uses `lp` for printing, `lpstat` for status, `cupsdisable`/`cupsenable` for
 * pause/resume, and `lpstat -a` for printer discovery.
 *
 * Validates: Requirement 9 (Capa de Abstracción de Impresora)
 * - CUPS backend for Linux/Ubuntu development environment
 * - Commands: lp, lpstat, cupsdisable, cupsenable
 */

import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

import type {
  PrinterBackend,
  PrinterStatus,
  PrintOptions,
  PrintResult,
  DiscoveredPrinter
} from './printer-manager'
import { discoverLinuxPrinters, type DiscoveryCommandExecutor } from './printer-discovery'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

// ─── Command Executor Interface (for testability) ─────────────────────────────

/**
 * Interface for executing shell commands. Allows injection of mocks for testing.
 */
export interface CommandExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string }>
  execFile(file: string, args: string[]): Promise<{ stdout: string; stderr: string }>
}

/**
 * Default executor that uses Node.js child_process.
 */
export const defaultExecutor: CommandExecutor = {
  exec: (command: string) => execAsync(command),
  execFile: (file: string, args: string[]) => execFileAsync(file, args)
}

// ─── File Writer Interface (for testability) ───────────────────────────────────

/**
 * Interface for file I/O operations. Allows injection of mocks for testing.
 */
export interface FileIO {
  writeFile(path: string, data: Buffer): Promise<void>
  unlink(path: string): Promise<void>
  createTempFilePath(): string
}

/**
 * Default file I/O using Node.js fs/promises.
 */
export const defaultFileIO: FileIO = {
  writeFile: (path: string, data: Buffer) => writeFile(path, data),
  unlink: (path: string) => unlink(path),
  createTempFilePath: () => {
    const id = randomBytes(8).toString('hex')
    return join(tmpdir(), `stamp-print-${id}.pdf`)
  }
}

// ─── Parsing Utilities ────────────────────────────────────────────────────────

/**
 * Extracts the CUPS queue name from a URI or queue identifier.
 * If the input is already a simple queue name (no slashes or colons), returns it as-is.
 * If it's an IPP URI like "ipp://localhost/printers/MyPrinter", extracts "MyPrinter".
 */
export function extractQueueName(uri: string): string {
  // If it's a simple queue name (no special chars), return as-is
  if (!uri.includes('/') && !uri.includes(':')) {
    return uri
  }

  // Try to extract from IPP-style URI: ipp://host/printers/QueueName
  const printerMatch = uri.match(/\/printers\/([^/]+)\/?$/)
  if (printerMatch) {
    return printerMatch[1]
  }

  // Try to extract from path-style: /printers/QueueName
  const pathMatch = uri.match(/\/([^/]+)\/?$/)
  if (pathMatch) {
    return pathMatch[1]
  }

  // Fallback: return the whole string
  return uri
}

/**
 * Parses the output of `lpstat -p <printer>` to determine printer status.
 *
 * Typical outputs:
 * - "printer MyPrinter is idle."
 * - "printer MyPrinter now printing ..."
 * - "printer MyPrinter disabled since ..."
 * - "printer MyPrinter is not accepting jobs."
 */
export function parseLpstatStatus(output: string): PrinterStatus {
  const lower = output.toLowerCase()

  if (lower.includes('disabled') || lower.includes('not accepting')) {
    return 'paused'
  }
  if (lower.includes('printing')) {
    return 'busy'
  }
  if (lower.includes('idle') || lower.includes('enabled')) {
    return 'ready'
  }
  if (lower.includes('error') || lower.includes('fault')) {
    return 'error'
  }

  // Default to ready if we can't parse
  return 'ready'
}

/**
 * Parses the output of `lpstat -a` to discover available printers.
 *
 * Typical output lines:
 * "MyPrinter accepting requests since Mon 01 Jan 2024 ..."
 * "OtherPrinter not accepting requests since ..."
 */
export function parseLpstatDiscovery(output: string): DiscoveredPrinter[] {
  const printers: DiscoveredPrinter[] = []
  const lines = output.split('\n').filter((line) => line.trim().length > 0)

  for (const line of lines) {
    // Format: "PrinterName accepting requests since ..." or "PrinterName not accepting requests ..."
    const match = line.match(/^(\S+)\s+(accepting|not accepting)\s+requests/)
    if (match) {
      const name = match[1]
      const accepting = match[2] === 'accepting'
      printers.push({
        name,
        uri: name, // On CUPS, the queue name is used as the URI
        accepting,
        info: line.trim()
      })
    }
  }

  return printers
}

/**
 * Parses the job ID from `lp` command output.
 * Typical output: "request id is MyPrinter-123 (1 file(s))"
 */
export function parseJobId(output: string): string | undefined {
  const match = output.match(/request id is (\S+)/)
  return match ? match[1] : undefined
}

// ─── CupsBackend Implementation ──────────────────────────────────────────────

/**
 * CupsBackend implements PrinterBackend using CUPS commands for Linux/macOS.
 *
 * Commands used:
 * - `lp` — Send a file to a printer queue
 * - `lpstat` — Query printer and job status
 * - `cupsdisable` — Pause a printer queue
 * - `cupsenable` — Resume a printer queue
 * - `cancel` — Cancel a print job
 *
 * Accepts an optional CommandExecutor and FileIO for testability.
 */
export class CupsBackend implements PrinterBackend {
  private cmd: CommandExecutor
  private io: FileIO

  constructor(executor?: CommandExecutor, fileIO?: FileIO) {
    this.cmd = executor ?? defaultExecutor
    this.io = fileIO ?? defaultFileIO
  }

  /**
   * Sends a PDF buffer to the specified CUPS printer queue.
   *
   * Workflow:
   * 1. Write PDF buffer to a temp file
   * 2. Execute `lp -d <queue> -o media=<media> -o orientation-requested=<n> -n <copies> -t <jobName> <file>`
   * 3. Parse job ID from output
   * 4. Clean up temp file
   */
  async print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    const queue = extractQueueName(printerUri)
    const tempFile = this.io.createTempFilePath()

    try {
      // Write PDF to temp file (lp requires a file path)
      await this.io.writeFile(tempFile, pdfBuffer)

      // Build lp command arguments
      const args: string[] = ['-d', queue]

      // Media option
      if (options.media) {
        args.push('-o', `media=${options.media}`)
      }

      // Orientation option
      if (options.orientation) {
        args.push('-o', `orientation-requested=${options.orientation}`)
      }

      // Copies
      const copies = options.copies ?? 1
      if (copies > 1) {
        args.push('-n', String(copies))
      }

      // Job name
      if (options.jobName) {
        args.push('-t', options.jobName)
      }

      // File to print
      args.push(tempFile)

      const { stdout } = await this.cmd.execFile('lp', args)
      const jobId = parseJobId(stdout)

      return {
        success: true,
        jobId
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: `CUPS print failed: ${message}`
      }
    } finally {
      // Clean up temp file (best effort)
      try {
        await this.io.unlink(tempFile)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Queries the status of a CUPS printer queue using `lpstat -p <queue>`.
   */
  async getStatus(printerUri: string): Promise<PrinterStatus> {
    const queue = extractQueueName(printerUri)

    try {
      const { stdout } = await this.cmd.exec(`lpstat -p ${queue}`)
      return parseLpstatStatus(stdout)
    } catch {
      return 'disconnected'
    }
  }

  /**
   * Pauses a CUPS printer queue using `cupsdisable <queue>`.
   * This prevents the printer from processing new jobs but preserves the queue.
   */
  async pause(printerUri: string): Promise<boolean> {
    const queue = extractQueueName(printerUri)

    try {
      await this.cmd.execFile('cupsdisable', [queue])
      return true
    } catch {
      return false
    }
  }

  /**
   * Resumes a previously paused CUPS printer queue using `cupsenable <queue>`.
   * This allows the printer to resume processing queued jobs.
   */
  async resume(printerUri: string): Promise<boolean> {
    const queue = extractQueueName(printerUri)

    try {
      await this.cmd.execFile('cupsenable', [queue])
      return true
    } catch {
      return false
    }
  }

  /**
   * Discovers available printers using avahi-browse (mDNS/DNS-SD) for network
   * printers and `lpstat -a` for locally configured CUPS printers.
   *
   * Uses the discoverLinuxPrinters function from printer-discovery.ts which:
   * 1. Runs `avahi-browse -tpr _ipp._tcp` for IPP printers on the network
   * 2. Runs `avahi-browse -tpr _ipps._tcp` for IPP-over-TLS printers
   * 3. Falls back to `lpstat -a` for locally configured CUPS queues
   *
   * Results are deduplicated by URI.
   */
  async discover(): Promise<DiscoveredPrinter[]> {
    // Use the command executor as a DiscoveryCommandExecutor (compatible interface)
    const discoveryExecutor: DiscoveryCommandExecutor = {
      exec: (command: string) => this.cmd.exec(command)
    }
    return discoverLinuxPrinters(discoveryExecutor)
  }

  /**
   * Cancels a specific print job using the `cancel` command.
   *
   * @param _printerUri - Not used for CUPS cancel (job IDs are global)
   * @param jobId - The CUPS job ID (e.g. "MyPrinter-123")
   */
  async cancelJob(_printerUri: string, jobId: string): Promise<boolean> {
    try {
      await this.cmd.execFile('cancel', [jobId])
      return true
    } catch {
      return false
    }
  }
}
