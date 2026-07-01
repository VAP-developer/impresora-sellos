/**
 * ipp-backend.ts
 *
 * Implementation of PrinterBackend for Windows using IPP (Internet Printing Protocol)
 * over HTTP. Communicates directly with IPP-compatible printers via HTTP POST
 * requests to port 631 (or custom port from the URI).
 *
 * IPP is a standard protocol (RFC 8011) where:
 * - Requests are HTTP POST with Content-Type: application/ipp
 * - The body contains binary-encoded IPP attributes + optional document data
 * - Responses are also application/ipp with status and attributes
 *
 * Validates: Requirement 9 (Capa de Abstracción de Impresora)
 * - IPP backend for Windows production environment
 * - Communicates via HTTP to printer's IPP endpoint
 */

import type {
  PrinterBackend,
  PrinterStatus,
  PrintOptions,
  PrintResult,
  DiscoveredPrinter
} from './printer-manager'
import { discoverWindowsPrinters, type DiscoveryCommandExecutor, type DiscoveryHttpProbe } from './printer-discovery'

// ─── IPP Constants ────────────────────────────────────────────────────────────

/** IPP version 1.1 (most widely supported) */
const IPP_VERSION_MAJOR = 1
const IPP_VERSION_MINOR = 1

/** IPP Operation IDs */
export const IPP_OPERATIONS = {
  PRINT_JOB: 0x0002,
  GET_PRINTER_ATTRIBUTES: 0x000b,
  GET_JOBS: 0x000a,
  CANCEL_JOB: 0x0008,
  PAUSE_PRINTER: 0x0010,
  RESUME_PRINTER: 0x0011
} as const

/** IPP Attribute Tags */
export const IPP_TAGS = {
  /** Delimiter tags */
  OPERATION_ATTRIBUTES: 0x01,
  JOB_ATTRIBUTES: 0x02,
  END_OF_ATTRIBUTES: 0x03,
  PRINTER_ATTRIBUTES: 0x04,

  /** Value tags */
  INTEGER: 0x21,
  BOOLEAN: 0x22,
  ENUM: 0x23,
  TEXT_WITHOUT_LANGUAGE: 0x41,
  NAME_WITHOUT_LANGUAGE: 0x42,
  KEYWORD: 0x44,
  URI: 0x45,
  CHARSET: 0x47,
  NATURAL_LANGUAGE: 0x48,
  MIME_MEDIA_TYPE: 0x49
} as const

/** IPP Status codes (high-level categories) */
export const IPP_STATUS = {
  SUCCESSFUL_OK: 0x0000,
  SUCCESSFUL_OK_IGNORED: 0x0001,
  CLIENT_ERROR_NOT_FOUND: 0x0406,
  CLIENT_ERROR_GONE: 0x0407,
  SERVER_ERROR_INTERNAL: 0x0500,
  SERVER_ERROR_NOT_ACCEPTING: 0x0503
} as const

/** Printer state enum values (RFC 8011 Section 5.4.11) */
export const IPP_PRINTER_STATE = {
  IDLE: 3,
  PROCESSING: 4,
  STOPPED: 5
} as const

// ─── HTTP Transport Interface (for testability) ───────────────────────────────

/**
 * Parsed IPP URI components.
 */
export interface IppUri {
  hostname: string
  port: number
  path: string
  /** The full IPP URI as a string (ipp://host:port/path) */
  printerUri: string
}

/**
 * Interface for HTTP transport. Allows injection of mocks for testing.
 */
export interface HttpTransport {
  /**
   * Sends an HTTP POST request with the given body to the specified endpoint.
   *
   * @param hostname - Target host
   * @param port - Target port
   * @param path - Request path (e.g. /ipp/print)
   * @param body - Request body (IPP binary data)
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Response body as Buffer
   */
  post(
    hostname: string,
    port: number,
    path: string,
    body: Buffer,
    timeoutMs: number
  ): Promise<Buffer>
}

/**
 * Default HTTP transport using Node.js built-in http module.
 */
export const defaultHttpTransport: HttpTransport = {
  post(hostname: string, port: number, path: string, body: Buffer, timeoutMs: number): Promise<Buffer> {
    // Dynamic import to avoid loading http module at module level
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require('http')

    return new Promise<Buffer>((resolve, reject) => {
      const options = {
        hostname,
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/ipp',
          'Content-Length': body.length
        },
        timeout: timeoutMs
      }

      const req = http.request(options, (res: { on: (event: string, cb: (...args: unknown[]) => void) => void }) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })

      req.on('error', (err: Error) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('IPP request timed out'))
      })

      req.write(body)
      req.end()
    })
  }
}

// ─── IPP URI Parsing ──────────────────────────────────────────────────────────

/**
 * Parses an IPP URI into its components.
 *
 * Supported formats:
 * - ipp://hostname:port/path
 * - ipp://hostname/path (default port 631)
 * - http://hostname:port/path
 * - hostname (assumes ipp://hostname:631/ipp/print)
 *
 * @param uri - The printer URI
 * @returns Parsed URI components
 */
export function parseIppUri(uri: string): IppUri {
  // If it's a simple hostname (no protocol), build a default URI
  if (!uri.includes('://') && !uri.includes('/')) {
    return {
      hostname: uri,
      port: 631,
      path: '/ipp/print',
      printerUri: `ipp://${uri}:631/ipp/print`
    }
  }

  // Normalize ipp:// to http:// for URL parsing (same transport)
  let normalizedUri = uri
  if (uri.startsWith('ipp://')) {
    normalizedUri = 'http://' + uri.slice(6)
  }

  try {
    const parsed = new URL(normalizedUri)
    const hostname = parsed.hostname
    const port = parsed.port ? parseInt(parsed.port, 10) : 631
    const path = parsed.pathname || '/ipp/print'

    // Reconstruct the IPP URI for attribute purposes
    const printerUri = `ipp://${hostname}:${port}${path}`

    return { hostname, port, path, printerUri }
  } catch {
    // Fallback: treat as hostname
    return {
      hostname: uri,
      port: 631,
      path: '/ipp/print',
      printerUri: `ipp://${uri}:631/ipp/print`
    }
  }
}

// ─── IPP Encoding Utilities ───────────────────────────────────────────────────

/**
 * Encodes a string as an IPP attribute value (tag + name + value).
 */
function encodeStringAttribute(tag: number, name: string, value: string): Buffer {
  const nameBytes = Buffer.from(name, 'utf-8')
  const valueBytes = Buffer.from(value, 'utf-8')

  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + valueBytes.length)
  let offset = 0

  buf.writeUInt8(tag, offset); offset += 1
  buf.writeUInt16BE(nameBytes.length, offset); offset += 2
  nameBytes.copy(buf, offset); offset += nameBytes.length
  buf.writeUInt16BE(valueBytes.length, offset); offset += 2
  valueBytes.copy(buf, offset)

  return buf
}

/**
 * Encodes an integer as an IPP attribute value.
 */
function encodeIntegerAttribute(tag: number, name: string, value: number): Buffer {
  const nameBytes = Buffer.from(name, 'utf-8')

  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + 4)
  let offset = 0

  buf.writeUInt8(tag, offset); offset += 1
  buf.writeUInt16BE(nameBytes.length, offset); offset += 2
  nameBytes.copy(buf, offset); offset += nameBytes.length
  buf.writeUInt16BE(4, offset); offset += 2
  buf.writeInt32BE(value, offset)

  return buf
}

/**
 * Encodes a boolean as an IPP attribute value.
 */
function encodeBooleanAttribute(name: string, value: boolean): Buffer {
  const nameBytes = Buffer.from(name, 'utf-8')

  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + 1)
  let offset = 0

  buf.writeUInt8(IPP_TAGS.BOOLEAN, offset); offset += 1
  buf.writeUInt16BE(nameBytes.length, offset); offset += 2
  nameBytes.copy(buf, offset); offset += nameBytes.length
  buf.writeUInt16BE(1, offset); offset += 2
  buf.writeUInt8(value ? 1 : 0, offset)

  return buf
}

/**
 * Builds the IPP request header (version + operation + request-id).
 */
function encodeIppHeader(operationId: number, requestId: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeUInt8(IPP_VERSION_MAJOR, 0)
  buf.writeUInt8(IPP_VERSION_MINOR, 1)
  buf.writeUInt16BE(operationId, 2)
  buf.writeInt32BE(requestId, 4)
  return buf
}

/**
 * Encodes the standard operation attributes group required by all IPP requests.
 */
function encodeOperationAttributes(printerUri: string, jobName?: string): Buffer {
  const parts: Buffer[] = []

  // Operation attributes tag
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))

  // Required: attributes-charset
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, 'attributes-charset', 'utf-8'))

  // Required: attributes-natural-language
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, 'attributes-natural-language', 'en')
  )

  // Required: printer-uri
  parts.push(encodeStringAttribute(IPP_TAGS.URI, 'printer-uri', printerUri))

  // Optional: job-name
  if (jobName) {
    parts.push(encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, 'job-name', jobName))
  }

  // Required for Print-Job: requesting-user-name
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, 'requesting-user-name', 'stamp-sales-app')
  )

  // Required for Print-Job: document-format
  parts.push(
    encodeStringAttribute(IPP_TAGS.MIME_MEDIA_TYPE, 'document-format', 'application/pdf')
  )

  return Buffer.concat(parts)
}

/**
 * Builds a complete Print-Job IPP request body (without the document data).
 */
export function buildPrintJobRequest(
  printerUri: string,
  options: PrintOptions,
  requestId: number
): Buffer {
  const parts: Buffer[] = []

  // Header
  parts.push(encodeIppHeader(IPP_OPERATIONS.PRINT_JOB, requestId))

  // Operation attributes
  parts.push(encodeOperationAttributes(printerUri, options.jobName))

  // Job attributes (media, orientation, copies)
  parts.push(Buffer.from([IPP_TAGS.JOB_ATTRIBUTES]))

  // media
  if (options.media) {
    parts.push(encodeStringAttribute(IPP_TAGS.KEYWORD, 'media', options.media))
  }

  // orientation-requested
  if (options.orientation) {
    parts.push(encodeIntegerAttribute(IPP_TAGS.ENUM, 'orientation-requested', options.orientation))
  }

  // copies
  const copies = options.copies ?? 1
  if (copies > 1) {
    parts.push(encodeIntegerAttribute(IPP_TAGS.INTEGER, 'copies', copies))
  }

  // End of attributes
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

/**
 * Builds a Get-Printer-Attributes IPP request.
 */
export function buildGetPrinterAttributesRequest(printerUri: string, requestId: number): Buffer {
  const parts: Buffer[] = []

  // Header
  parts.push(encodeIppHeader(IPP_OPERATIONS.GET_PRINTER_ATTRIBUTES, requestId))

  // Operation attributes
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, 'attributes-charset', 'utf-8'))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, 'attributes-natural-language', 'en')
  )
  parts.push(encodeStringAttribute(IPP_TAGS.URI, 'printer-uri', printerUri))

  // Request only the attributes we need
  parts.push(
    encodeStringAttribute(IPP_TAGS.KEYWORD, 'requested-attributes', 'printer-state')
  )

  // End of attributes
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

/**
 * Builds a Pause-Printer IPP request.
 */
export function buildPausePrinterRequest(printerUri: string, requestId: number): Buffer {
  const parts: Buffer[] = []

  parts.push(encodeIppHeader(IPP_OPERATIONS.PAUSE_PRINTER, requestId))
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, 'attributes-charset', 'utf-8'))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, 'attributes-natural-language', 'en')
  )
  parts.push(encodeStringAttribute(IPP_TAGS.URI, 'printer-uri', printerUri))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, 'requesting-user-name', 'stamp-sales-app')
  )
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

/**
 * Builds a Resume-Printer IPP request.
 */
export function buildResumePrinterRequest(printerUri: string, requestId: number): Buffer {
  const parts: Buffer[] = []

  parts.push(encodeIppHeader(IPP_OPERATIONS.RESUME_PRINTER, requestId))
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, 'attributes-charset', 'utf-8'))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, 'attributes-natural-language', 'en')
  )
  parts.push(encodeStringAttribute(IPP_TAGS.URI, 'printer-uri', printerUri))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, 'requesting-user-name', 'stamp-sales-app')
  )
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

/**
 * Builds a Cancel-Job IPP request.
 */
export function buildCancelJobRequest(printerUri: string, jobId: number, requestId: number): Buffer {
  const parts: Buffer[] = []

  parts.push(encodeIppHeader(IPP_OPERATIONS.CANCEL_JOB, requestId))
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, 'attributes-charset', 'utf-8'))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, 'attributes-natural-language', 'en')
  )
  parts.push(encodeStringAttribute(IPP_TAGS.URI, 'printer-uri', printerUri))
  parts.push(encodeIntegerAttribute(IPP_TAGS.INTEGER, 'job-id', jobId))
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, 'requesting-user-name', 'stamp-sales-app')
  )
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

// ─── IPP Response Parsing ─────────────────────────────────────────────────────

/**
 * Parsed IPP response (minimal — we only extract what we need).
 */
export interface IppResponse {
  /** IPP version (major.minor) */
  versionMajor: number
  versionMinor: number
  /** Status code (0x0000 = success) */
  statusCode: number
  /** Request ID echoed back */
  requestId: number
  /** Printer state (3=idle, 4=processing, 5=stopped) — from Get-Printer-Attributes */
  printerState?: number
  /** Job ID — from Print-Job response */
  jobId?: number
}

/**
 * Parses an IPP response buffer to extract status and key attributes.
 *
 * IPP response format:
 * - Bytes 0-1: version (major.minor)
 * - Bytes 2-3: status-code
 * - Bytes 4-7: request-id
 * - Byte 8+: attribute groups (tag + attributes...)
 */
export function parseIppResponse(data: Buffer): IppResponse {
  if (data.length < 8) {
    return {
      versionMajor: 0,
      versionMinor: 0,
      statusCode: IPP_STATUS.SERVER_ERROR_INTERNAL,
      requestId: 0
    }
  }

  const response: IppResponse = {
    versionMajor: data.readUInt8(0),
    versionMinor: data.readUInt8(1),
    statusCode: data.readUInt16BE(2),
    requestId: data.readInt32BE(4)
  }

  // Parse attributes to find printer-state and job-id
  let offset = 8

  while (offset < data.length) {
    const tag = data.readUInt8(offset)
    offset += 1

    // End of attributes tag
    if (tag === IPP_TAGS.END_OF_ATTRIBUTES) {
      break
    }

    // Delimiter tags (operation, job, printer attributes group)
    if (tag <= 0x0f) {
      // Group delimiter — just skip, next bytes are value tags
      continue
    }

    // Value tag — read attribute name and value
    if (offset + 2 > data.length) break
    const nameLength = data.readUInt16BE(offset)
    offset += 2

    if (offset + nameLength > data.length) break
    const name = data.subarray(offset, offset + nameLength).toString('utf-8')
    offset += nameLength

    if (offset + 2 > data.length) break
    const valueLength = data.readUInt16BE(offset)
    offset += 2

    if (offset + valueLength > data.length) break

    // Extract values we care about
    if (name === 'printer-state' && valueLength === 4) {
      response.printerState = data.readInt32BE(offset)
    } else if (name === 'job-id' && valueLength === 4) {
      response.jobId = data.readInt32BE(offset)
    }

    offset += valueLength
  }

  return response
}

/**
 * Maps IPP printer-state enum to our PrinterStatus.
 */
export function mapPrinterState(state: number | undefined): PrinterStatus {
  switch (state) {
    case IPP_PRINTER_STATE.IDLE:
      return 'ready'
    case IPP_PRINTER_STATE.PROCESSING:
      return 'busy'
    case IPP_PRINTER_STATE.STOPPED:
      return 'paused'
    default:
      return 'disconnected'
  }
}

// ─── IppBackend Implementation ────────────────────────────────────────────────

/**
 * IppBackend implements PrinterBackend using IPP protocol over HTTP for Windows.
 *
 * IPP communication flow:
 * 1. Build binary IPP request (header + attributes + optional document data)
 * 2. Send as HTTP POST to printer's IPP endpoint (typically port 631)
 * 3. Parse binary IPP response to extract status/job info
 *
 * For local/USB printers (win:// URIs), it delegates to the Windows print spooler
 * via PowerShell, which supports any printer installed in Windows regardless of
 * whether it exposes an IPP endpoint.
 *
 * Accepts an optional HttpTransport for testability (like CupsBackend's CommandExecutor).
 */
export class IppBackend implements PrinterBackend {
  private transport: HttpTransport
  private requestId: number
  private timeoutMs: number

  constructor(transport?: HttpTransport, timeoutMs?: number) {
    this.transport = transport ?? defaultHttpTransport
    this.requestId = 1
    this.timeoutMs = timeoutMs ?? 10000
  }

  /** Gets the next request ID (incrementing counter) */
  private nextRequestId(): number {
    return this.requestId++
  }

  /**
   * Checks if a printer URI refers to a local Windows printer (win:// scheme).
   */
  private isLocalWindowsPrinter(printerUri: string): boolean {
    return printerUri.startsWith('win://')
  }

  /**
   * Extracts the printer name from a win:// URI.
   * win://Canon%20PIXMA%20MG3600 → "Canon PIXMA MG3600"
   */
  private getWindowsPrinterName(printerUri: string): string {
    const encoded = printerUri.replace('win://', '')
    return decodeURIComponent(encoded)
  }

  /**
   * Prints a PDF to a local Windows printer using Electron's built-in printing API.
   *
   * Creates a hidden BrowserWindow, loads the PDF via file:// protocol, and uses
   * webContents.print() with silent mode to send directly to the named printer
   * via the OS spooler. This avoids any dependency on external PDF viewers
   * and prints completely silently without any visible window or dialog.
   */
  private async printViaWindowsSpooler(
    printerName: string,
    pdfBuffer: Buffer,
    options: PrintOptions
  ): Promise<PrintResult> {
    const { BrowserWindow } = require('electron')
    const { writeFileSync, unlinkSync, mkdirSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')

    const jobName = options.jobName ?? `print_${Date.now()}`
    const copies = options.copies ?? 1

    // Write PDF to a temp file (Chromium needs a file:// URL for reliable PDF loading)
    const tempDir = join(tmpdir(), 'stamp-sales-print')
    try {
      mkdirSync(tempDir, { recursive: true })
    } catch {
      // dir already exists
    }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.pdf`)

    try {
      writeFileSync(tempFile, pdfBuffer)

      // Create a hidden window to render and print the PDF
      const printWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          plugins: true // Enable PDF plugin for proper rendering
        }
      })

      try {
        // Load the PDF via file:// protocol (more reliable than data: URLs for PDFs)
        const fileUrl = `file://${tempFile.replace(/\\/g, '/')}`
        await printWindow.loadURL(fileUrl)

        // Wait for the PDF to be fully rendered by Chromium's PDF viewer
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Print silently to the specified printer
        for (let i = 0; i < copies; i++) {
          await new Promise<void>((resolve, reject) => {
            printWindow.webContents.print(
              {
                silent: true,
                deviceName: printerName,
                printBackground: true
              },
              (success, failureReason) => {
                if (success) {
                  resolve()
                } else {
                  reject(new Error(failureReason || 'Print failed'))
                }
              }
            )
          })
        }

        return { success: true, jobId: jobName }
      } finally {
        // Always close the hidden window and clean up temp file
        printWindow.close()
        setTimeout(() => {
          try { unlinkSync(tempFile) } catch { /* ignore */ }
        }, 5000)
      }
    } catch (err: unknown) {
      // Clean up on error
      try { unlinkSync(tempFile) } catch { /* ignore */ }
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Windows print failed: ${message}` }
    }
  }


  /**
   * Sends a PDF buffer to the specified printer.
   * Routes to either IPP (network printers) or Windows spooler (local/USB printers)
   * based on the URI scheme.
   *
   * Workflow for IPP (ipp:// URIs):
   * 1. Parse the printer URI to get hostname/port/path
   * 2. Build IPP Print-Job request with options (media, orientation, copies)
   * 3. Concatenate IPP request header + PDF document data
   * 4. Send via HTTP POST to the printer
   * 5. Parse response for job ID and status
   *
   * Workflow for local printers (win:// URIs):
   * 1. Extract printer name from URI
   * 2. Write PDF to temp file
   * 3. Print via PowerShell using Windows spooler
   */
  async print(printerUri: string, pdfBuffer: Buffer, options: PrintOptions): Promise<PrintResult> {
    // Route local Windows printers through the spooler
    if (this.isLocalWindowsPrinter(printerUri)) {
      const printerName = this.getWindowsPrinterName(printerUri)
      return this.printViaWindowsSpooler(printerName, pdfBuffer, options)
    }

    // IPP path for network printers
    const uri = parseIppUri(printerUri)
    const reqId = this.nextRequestId()

    try {
      // Build the IPP request (attributes portion)
      const ippRequest = buildPrintJobRequest(uri.printerUri, options, reqId)

      // The full body is IPP request + document data (for Print-Job)
      const body = Buffer.concat([ippRequest, pdfBuffer])

      // Send HTTP POST
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        body,
        this.timeoutMs
      )

      // Parse IPP response
      const response = parseIppResponse(responseData)

      if (response.statusCode <= 0x00ff) {
        // Successful (0x0000-0x00ff range)
        return {
          success: true,
          jobId: response.jobId ? String(response.jobId) : undefined
        }
      } else {
        return {
          success: false,
          error: `IPP error: status code 0x${response.statusCode.toString(16).padStart(4, '0')}`
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: `IPP print failed: ${message}`
      }
    }
  }

  /**
   * Queries the current status of a printer.
   * For IPP printers: uses Get-Printer-Attributes.
   * For local Windows printers (win://): uses PowerShell Get-Printer.
   */
  async getStatus(printerUri: string): Promise<PrinterStatus> {
    // Local Windows printer — query via PowerShell
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.getWindowsPrinterStatus(printerUri)
    }

    // IPP printer — use Get-Printer-Attributes
    const uri = parseIppUri(printerUri)
    const reqId = this.nextRequestId()

    try {
      const request = buildGetPrinterAttributesRequest(uri.printerUri, reqId)

      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      )

      const response = parseIppResponse(responseData)

      // If the request itself failed (non-success status), treat as error
      if (response.statusCode > 0x00ff) {
        return 'error'
      }

      return mapPrinterState(response.printerState)
    } catch {
      return 'disconnected'
    }
  }

  /**
   * Queries a local Windows printer's status via PowerShell.
   */
  private async getWindowsPrinterStatus(printerUri: string): Promise<PrinterStatus> {
    const printerName = this.getWindowsPrinterName(printerUri)

    try {
      const { exec: nodeExec } = require('child_process')
      const { promisify: nodePromisify } = require('util')
      const execAsync = nodePromisify(nodeExec)

      const escapedName = printerName.replace(/'/g, "''")
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-Printer -Name '${escapedName}' | Select-Object PrinterStatus | ConvertTo-Json -Compress"`,
        { timeout: 5000 }
      )

      if (!stdout || stdout.trim().length === 0) {
        return 'disconnected'
      }

      const result = JSON.parse(stdout.trim())
      // PrinterStatus values: 0=Normal, 1=Paused, 2=Error, 3=Deleting, 4=PendingDeletion
      switch (result.PrinterStatus) {
        case 0: return 'ready'
        case 1: return 'paused'
        case 2: return 'error'
        default: return 'disconnected'
      }
    } catch {
      return 'disconnected'
    }
  }

  /**
   * Pauses a printer.
   * For IPP printers: uses Pause-Printer operation.
   * For local Windows printers (win://): uses PowerShell Set-Printer.
   */
  async pause(printerUri: string): Promise<boolean> {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.pauseWindowsPrinter(printerUri)
    }

    const uri = parseIppUri(printerUri)
    const reqId = this.nextRequestId()

    try {
      const request = buildPausePrinterRequest(uri.printerUri, reqId)

      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      )

      const response = parseIppResponse(responseData)
      return response.statusCode <= 0x00ff
    } catch {
      return false
    }
  }

  /**
   * Pauses a local Windows printer via PowerShell.
   */
  private async pauseWindowsPrinter(printerUri: string): Promise<boolean> {
    const printerName = this.getWindowsPrinterName(printerUri)
    try {
      const { exec: nodeExec } = require('child_process')
      const { promisify: nodePromisify } = require('util')
      const execAsync = nodePromisify(nodeExec)

      const escapedName = printerName.replace(/'/g, "''")
      await execAsync(
        `powershell -NoProfile -Command "Stop-Printer -Name '${escapedName}'"`,
        { timeout: 5000 }
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Resumes a printer.
   * For IPP printers: uses Resume-Printer operation.
   * For local Windows printers (win://): uses PowerShell Restart-Printer.
   */
  async resume(printerUri: string): Promise<boolean> {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.resumeWindowsPrinter(printerUri)
    }

    const uri = parseIppUri(printerUri)
    const reqId = this.nextRequestId()

    try {
      const request = buildResumePrinterRequest(uri.printerUri, reqId)

      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      )

      const response = parseIppResponse(responseData)
      return response.statusCode <= 0x00ff
    } catch {
      return false
    }
  }

  /**
   * Resumes a local Windows printer via PowerShell.
   */
  private async resumeWindowsPrinter(printerUri: string): Promise<boolean> {
    const printerName = this.getWindowsPrinterName(printerUri)
    try {
      const { exec: nodeExec } = require('child_process')
      const { promisify: nodePromisify } = require('util')
      const execAsync = nodePromisify(nodeExec)

      const escapedName = printerName.replace(/'/g, "''")
      await execAsync(
        `powershell -NoProfile -Command "Restart-Printer -Name '${escapedName}'"`,
        { timeout: 5000 }
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Discovers printers available on the system using two strategies:
   * 1. Local printers via PowerShell Get-Printer (USB, local network, spooler-registered)
   * 2. Network printers via IPP subnet scan (probes hosts from ARP table)
   *
   * Uses the discoverWindowsPrinters function from printer-discovery.ts which
   * merges both sources and deduplicates.
   */
  async discover(): Promise<DiscoveredPrinter[]> {
    // Build a DiscoveryHttpProbe compatible with our transport
    const probe: DiscoveryHttpProbe = {
      probe: async (hostname: string, port: number, path: string, timeoutMs: number): Promise<string | null> => {
        try {
          const printerUri = `ipp://${hostname}:${port}${path}`
          const request = buildGetPrinterAttributesRequest(printerUri, this.nextRequestId())

          const responseData = await this.transport.post(hostname, port, path, request, timeoutMs)
          const response = parseIppResponse(responseData)

          if (response.statusCode <= 0x00ff) {
            // Successful response — this is a printer
            return `IPP@${hostname}`
          }
          return null
        } catch {
          return null
        }
      }
    }

    // Build a DiscoveryCommandExecutor for ARP table scanning and PowerShell
    const executor: DiscoveryCommandExecutor = {
      exec: (command: string) => {
        const { exec: nodeExec } = require('child_process')
        const { promisify: nodePromisify } = require('util')
        const execPromise = nodePromisify(nodeExec)
        return execPromise(command, { timeout: 15000 })
      }
    }

    return discoverWindowsPrinters({}, executor, probe)
  }

  /**
   * Cancels a specific print job.
   * For IPP printers: uses Cancel-Job operation.
   * For local Windows printers (win://): uses PowerShell Remove-PrintJob.
   *
   * @param printerUri - The printer URI where the job is queued
   * @param jobId - The job ID as a string (will be parsed to integer)
   */
  async cancelJob(printerUri: string, jobId: string): Promise<boolean> {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.cancelWindowsJob(printerUri, jobId)
    }

    const uri = parseIppUri(printerUri)
    const reqId = this.nextRequestId()
    const numericJobId = parseInt(jobId, 10)

    if (isNaN(numericJobId)) {
      return false
    }

    try {
      const request = buildCancelJobRequest(uri.printerUri, numericJobId, reqId)

      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      )

      const response = parseIppResponse(responseData)
      return response.statusCode <= 0x00ff
    } catch {
      return false
    }
  }

  /**
   * Cancels a print job on a local Windows printer via PowerShell.
   */
  private async cancelWindowsJob(printerUri: string, jobId: string): Promise<boolean> {
    const printerName = this.getWindowsPrinterName(printerUri)
    const numericJobId = parseInt(jobId, 10)
    if (isNaN(numericJobId)) return false

    try {
      const { exec: nodeExec } = require('child_process')
      const { promisify: nodePromisify } = require('util')
      const execAsync = nodePromisify(nodeExec)

      const escapedName = printerName.replace(/'/g, "''")
      await execAsync(
        `powershell -NoProfile -Command "Remove-PrintJob -PrinterName '${escapedName}' -ID ${numericJobId}"`,
        { timeout: 5000 }
      )
      return true
    } catch {
      return false
    }
  }
}
