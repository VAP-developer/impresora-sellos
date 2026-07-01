/**
 * ipp-backend.test.ts
 *
 * Unit tests for IppBackend implementation.
 * Uses dependency injection (HttpTransport interface) for clean mocking,
 * following the same pattern as cups-backend.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  IppBackend,
  parseIppUri,
  parseIppResponse,
  mapPrinterState,
  buildPrintJobRequest,
  buildGetPrinterAttributesRequest,
  buildPausePrinterRequest,
  buildResumePrinterRequest,
  buildCancelJobRequest,
  IPP_OPERATIONS,
  IPP_TAGS,
  IPP_STATUS,
  IPP_PRINTER_STATE
} from '../ipp-backend'
import type { HttpTransport } from '../ipp-backend'

// ─── Mock Transport ───────────────────────────────────────────────────────────

type MockedHttpTransport = {
  post: ReturnType<
    typeof vi.fn<
      (hostname: string, port: number, path: string, body: Buffer, timeoutMs: number) => Promise<Buffer>
    >
  >
}

function createMockTransport(): MockedHttpTransport {
  return {
    post: vi.fn<
      (hostname: string, port: number, path: string, body: Buffer, timeoutMs: number) => Promise<Buffer>
    >()
  }
}

/**
 * Builds a minimal IPP response buffer for testing.
 */
function buildMockIppResponse(options: {
  statusCode?: number
  requestId?: number
  printerState?: number
  jobId?: number
}): Buffer {
  const parts: Buffer[] = []

  // Header: version (1.1), status-code, request-id
  const header = Buffer.alloc(8)
  header.writeUInt8(1, 0) // version major
  header.writeUInt8(1, 1) // version minor
  header.writeUInt16BE(options.statusCode ?? 0x0000, 2) // status
  header.writeInt32BE(options.requestId ?? 1, 4) // request-id
  parts.push(header)

  // If printerState is provided, add printer-attributes group
  if (options.printerState !== undefined) {
    parts.push(Buffer.from([IPP_TAGS.PRINTER_ATTRIBUTES]))

    // printer-state attribute (enum tag, name, 4-byte value)
    const name = 'printer-state'
    const nameBytes = Buffer.from(name, 'utf-8')
    const attr = Buffer.alloc(1 + 2 + nameBytes.length + 2 + 4)
    let offset = 0
    attr.writeUInt8(IPP_TAGS.ENUM, offset); offset += 1
    attr.writeUInt16BE(nameBytes.length, offset); offset += 2
    nameBytes.copy(attr, offset); offset += nameBytes.length
    attr.writeUInt16BE(4, offset); offset += 2
    attr.writeInt32BE(options.printerState, offset)
    parts.push(attr)
  }

  // If jobId is provided, add job-attributes group
  if (options.jobId !== undefined) {
    parts.push(Buffer.from([IPP_TAGS.JOB_ATTRIBUTES]))

    // job-id attribute
    const name = 'job-id'
    const nameBytes = Buffer.from(name, 'utf-8')
    const attr = Buffer.alloc(1 + 2 + nameBytes.length + 2 + 4)
    let offset = 0
    attr.writeUInt8(IPP_TAGS.INTEGER, offset); offset += 1
    attr.writeUInt16BE(nameBytes.length, offset); offset += 2
    nameBytes.copy(attr, offset); offset += nameBytes.length
    attr.writeUInt16BE(4, offset); offset += 2
    attr.writeInt32BE(options.jobId, offset)
    parts.push(attr)
  }

  // End of attributes
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

// ─── Pure Function Tests ──────────────────────────────────────────────────────

describe('parseIppUri', () => {
  it('parses full ipp:// URI', () => {
    const result = parseIppUri('ipp://192.168.1.100:631/ipp/print')
    expect(result.hostname).toBe('192.168.1.100')
    expect(result.port).toBe(631)
    expect(result.path).toBe('/ipp/print')
    expect(result.printerUri).toBe('ipp://192.168.1.100:631/ipp/print')
  })

  it('defaults port to 631 when not specified', () => {
    const result = parseIppUri('ipp://192.168.1.100/ipp/print')
    expect(result.hostname).toBe('192.168.1.100')
    expect(result.port).toBe(631)
    expect(result.path).toBe('/ipp/print')
  })

  it('parses http:// URI (treated same as ipp)', () => {
    const result = parseIppUri('http://printer.local:631/ipp/print')
    expect(result.hostname).toBe('printer.local')
    expect(result.port).toBe(631)
    expect(result.path).toBe('/ipp/print')
  })

  it('handles simple hostname (no protocol)', () => {
    const result = parseIppUri('192.168.1.50')
    expect(result.hostname).toBe('192.168.1.50')
    expect(result.port).toBe(631)
    expect(result.path).toBe('/ipp/print')
    expect(result.printerUri).toBe('ipp://192.168.1.50:631/ipp/print')
  })

  it('handles URI with custom port', () => {
    const result = parseIppUri('ipp://myprinter:9100/ipp/print')
    expect(result.port).toBe(9100)
  })

  it('handles URI with custom path (e.g. /printers/name)', () => {
    const result = parseIppUri('ipp://192.168.1.5/printers/Epson')
    expect(result.hostname).toBe('192.168.1.5')
    expect(result.path).toBe('/printers/Epson')
    expect(result.printerUri).toBe('ipp://192.168.1.5:631/printers/Epson')
  })

  it('falls back to default for invalid input', () => {
    // Something that has no slashes and no protocol — treated as hostname
    const result = parseIppUri('my-printer')
    expect(result.hostname).toBe('my-printer')
    expect(result.port).toBe(631)
    expect(result.path).toBe('/ipp/print')
  })
})

describe('parseIppResponse', () => {
  it('parses a successful response with job-id', () => {
    const data = buildMockIppResponse({ statusCode: 0x0000, requestId: 42, jobId: 123 })
    const response = parseIppResponse(data)
    expect(response.statusCode).toBe(0x0000)
    expect(response.requestId).toBe(42)
    expect(response.jobId).toBe(123)
  })

  it('parses a successful response with printer-state', () => {
    const data = buildMockIppResponse({
      statusCode: 0x0000,
      requestId: 5,
      printerState: IPP_PRINTER_STATE.IDLE
    })
    const response = parseIppResponse(data)
    expect(response.statusCode).toBe(0x0000)
    expect(response.printerState).toBe(3) // idle
  })

  it('parses an error response', () => {
    const data = buildMockIppResponse({
      statusCode: IPP_STATUS.CLIENT_ERROR_NOT_FOUND,
      requestId: 7
    })
    const response = parseIppResponse(data)
    expect(response.statusCode).toBe(0x0406)
    expect(response.requestId).toBe(7)
  })

  it('handles too-short response gracefully', () => {
    const data = Buffer.from([0x01, 0x01]) // Only 2 bytes, need 8
    const response = parseIppResponse(data)
    expect(response.statusCode).toBe(IPP_STATUS.SERVER_ERROR_INTERNAL)
  })

  it('handles response with no attributes', () => {
    const header = Buffer.alloc(8)
    header.writeUInt8(1, 0)
    header.writeUInt8(1, 1)
    header.writeUInt16BE(0x0000, 2)
    header.writeInt32BE(10, 4)
    const data = Buffer.concat([header, Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES])])

    const response = parseIppResponse(data)
    expect(response.statusCode).toBe(0x0000)
    expect(response.requestId).toBe(10)
    expect(response.printerState).toBeUndefined()
    expect(response.jobId).toBeUndefined()
  })
})

describe('mapPrinterState', () => {
  it('maps IDLE (3) to ready', () => {
    expect(mapPrinterState(IPP_PRINTER_STATE.IDLE)).toBe('ready')
  })

  it('maps PROCESSING (4) to busy', () => {
    expect(mapPrinterState(IPP_PRINTER_STATE.PROCESSING)).toBe('busy')
  })

  it('maps STOPPED (5) to paused', () => {
    expect(mapPrinterState(IPP_PRINTER_STATE.STOPPED)).toBe('paused')
  })

  it('maps undefined to disconnected', () => {
    expect(mapPrinterState(undefined)).toBe('disconnected')
  })

  it('maps unknown values to disconnected', () => {
    expect(mapPrinterState(99)).toBe('disconnected')
  })
})

describe('buildPrintJobRequest', () => {
  it('produces a valid IPP request buffer', () => {
    const request = buildPrintJobRequest('ipp://printer:631/ipp/print', {
      media: 'DC55x25',
      orientation: 6,
      jobName: 'test-stamp'
    }, 1)

    // Should start with IPP version 1.1
    expect(request.readUInt8(0)).toBe(1) // major
    expect(request.readUInt8(1)).toBe(1) // minor
    // Operation should be Print-Job (0x0002)
    expect(request.readUInt16BE(2)).toBe(IPP_OPERATIONS.PRINT_JOB)
    // Request ID
    expect(request.readInt32BE(4)).toBe(1)
    // Should contain operation attributes tag
    expect(request.includes(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]))).toBe(true)
    // Should contain end-of-attributes tag at the end
    expect(request[request.length - 1]).toBe(IPP_TAGS.END_OF_ATTRIBUTES)
    // Should contain the media keyword
    expect(request.includes(Buffer.from('DC55x25'))).toBe(true)
    // Should contain the job name
    expect(request.includes(Buffer.from('test-stamp'))).toBe(true)
  })

  it('includes copies when > 1', () => {
    const request = buildPrintJobRequest('ipp://printer:631/ipp/print', {
      media: 'DC55x25',
      orientation: 6,
      copies: 3
    }, 2)

    // Should contain the copies attribute name
    expect(request.includes(Buffer.from('copies'))).toBe(true)
  })

  it('omits copies when default (1)', () => {
    const request = buildPrintJobRequest('ipp://printer:631/ipp/print', {
      media: 'DC55x25',
      orientation: 6
    }, 3)

    // Should NOT contain the copies attribute name
    expect(request.includes(Buffer.from('copies'))).toBe(false)
  })
})

describe('buildGetPrinterAttributesRequest', () => {
  it('produces a valid Get-Printer-Attributes request', () => {
    const request = buildGetPrinterAttributesRequest('ipp://printer:631/ipp/print', 5)

    expect(request.readUInt8(0)).toBe(1) // version major
    expect(request.readUInt8(1)).toBe(1) // version minor
    expect(request.readUInt16BE(2)).toBe(IPP_OPERATIONS.GET_PRINTER_ATTRIBUTES)
    expect(request.readInt32BE(4)).toBe(5) // request ID
    expect(request.includes(Buffer.from('printer-state'))).toBe(true)
  })
})

describe('buildPausePrinterRequest', () => {
  it('produces a valid Pause-Printer request', () => {
    const request = buildPausePrinterRequest('ipp://printer:631/ipp/print', 10)

    expect(request.readUInt16BE(2)).toBe(IPP_OPERATIONS.PAUSE_PRINTER)
    expect(request.readInt32BE(4)).toBe(10)
    expect(request.includes(Buffer.from('printer-uri'))).toBe(true)
  })
})

describe('buildResumePrinterRequest', () => {
  it('produces a valid Resume-Printer request', () => {
    const request = buildResumePrinterRequest('ipp://printer:631/ipp/print', 11)

    expect(request.readUInt16BE(2)).toBe(IPP_OPERATIONS.RESUME_PRINTER)
    expect(request.readInt32BE(4)).toBe(11)
  })
})

describe('buildCancelJobRequest', () => {
  it('produces a valid Cancel-Job request with job-id', () => {
    const request = buildCancelJobRequest('ipp://printer:631/ipp/print', 42, 12)

    expect(request.readUInt16BE(2)).toBe(IPP_OPERATIONS.CANCEL_JOB)
    expect(request.readInt32BE(4)).toBe(12) // request-id
    expect(request.includes(Buffer.from('job-id'))).toBe(true)
  })
})

// ─── IppBackend Integration Tests (with mock transport) ───────────────────────

describe('IppBackend', () => {
  let backend: IppBackend
  let transport: MockedHttpTransport

  beforeEach(() => {
    transport = createMockTransport()
    backend = new IppBackend(transport as HttpTransport, 5000)
  })

  describe('print', () => {
    it('sends PDF to the printer with correct options', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000, jobId: 42 })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF-1.4 test content')
      const result = await backend.print('ipp://192.168.1.100:631/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6,
        jobName: 'stamp_printer1'
      })

      expect(result.success).toBe(true)
      expect(result.jobId).toBe('42')

      // Verify transport was called with correct host/port/path
      expect(transport.post).toHaveBeenCalledWith(
        '192.168.1.100',
        631,
        '/ipp/print',
        expect.any(Buffer),
        5000
      )

      // Verify the body contains the PDF data
      const sentBody = transport.post.mock.calls[0][3] as Buffer
      expect(sentBody.includes(pdfBuffer)).toBe(true)
    })

    it('handles simple hostname URI', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000, jobId: 1 })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('192.168.1.50', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(transport.post).toHaveBeenCalledWith(
        '192.168.1.50',
        631,
        '/ipp/print',
        expect.any(Buffer),
        5000
      )
    })

    it('returns error on IPP error status', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: IPP_STATUS.CLIENT_ERROR_NOT_FOUND
      })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('IPP error')
      expect(result.error).toContain('0406')
    })

    it('returns error on network failure', async () => {
      transport.post.mockRejectedValue(new Error('ECONNREFUSED'))

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('IPP print failed')
      expect(result.error).toContain('ECONNREFUSED')
    })

    it('returns error on timeout', async () => {
      transport.post.mockRejectedValue(new Error('IPP request timed out'))

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timed out')
    })

    it('handles non-Error exceptions gracefully', async () => {
      transport.post.mockRejectedValue('connection failed')

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('IPP print failed')
    })

    it('includes media and orientation in the IPP request', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('ipp://printer:631/ipp/print', pdfBuffer, {
        media: 'Custom.78x120mm',
        orientation: 3,
        jobName: 'ticket_main'
      })

      const sentBody = transport.post.mock.calls[0][3] as Buffer
      expect(sentBody.includes(Buffer.from('Custom.78x120mm'))).toBe(true)
      expect(sentBody.includes(Buffer.from('ticket_main'))).toBe(true)
    })

    it('returns undefined jobId when response has no job-id', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(true)
      expect(result.jobId).toBeUndefined()
    })
  })

  describe('getStatus', () => {
    it('returns ready for idle printer (state=3)', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: 0x0000,
        printerState: IPP_PRINTER_STATE.IDLE
      })
      transport.post.mockResolvedValue(mockResponse)

      const status = await backend.getStatus('ipp://192.168.1.100:631/ipp/print')
      expect(status).toBe('ready')
    })

    it('returns busy for processing printer (state=4)', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: 0x0000,
        printerState: IPP_PRINTER_STATE.PROCESSING
      })
      transport.post.mockResolvedValue(mockResponse)

      const status = await backend.getStatus('ipp://printer/ipp/print')
      expect(status).toBe('busy')
    })

    it('returns paused for stopped printer (state=5)', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: 0x0000,
        printerState: IPP_PRINTER_STATE.STOPPED
      })
      transport.post.mockResolvedValue(mockResponse)

      const status = await backend.getStatus('ipp://printer/ipp/print')
      expect(status).toBe('paused')
    })

    it('returns error when IPP response has error status', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: IPP_STATUS.SERVER_ERROR_INTERNAL
      })
      transport.post.mockResolvedValue(mockResponse)

      const status = await backend.getStatus('ipp://printer/ipp/print')
      expect(status).toBe('error')
    })

    it('returns disconnected on network failure', async () => {
      transport.post.mockRejectedValue(new Error('ECONNREFUSED'))

      const status = await backend.getStatus('ipp://printer/ipp/print')
      expect(status).toBe('disconnected')
    })

    it('sends Get-Printer-Attributes request to correct endpoint', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: 0x0000,
        printerState: IPP_PRINTER_STATE.IDLE
      })
      transport.post.mockResolvedValue(mockResponse)

      await backend.getStatus('ipp://192.168.1.5:631/printers/Epson')

      expect(transport.post).toHaveBeenCalledWith(
        '192.168.1.5',
        631,
        '/printers/Epson',
        expect.any(Buffer),
        5000
      )
    })
  })

  describe('pause', () => {
    it('sends Pause-Printer request and returns true on success', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.pause('ipp://192.168.1.100:631/ipp/print')
      expect(result).toBe(true)

      // Verify the request was sent to correct endpoint
      expect(transport.post).toHaveBeenCalledWith(
        '192.168.1.100',
        631,
        '/ipp/print',
        expect.any(Buffer),
        5000
      )

      // Verify it's a Pause-Printer operation
      const sentBody = transport.post.mock.calls[0][3] as Buffer
      expect(sentBody.readUInt16BE(2)).toBe(IPP_OPERATIONS.PAUSE_PRINTER)
    })

    it('returns false on IPP error', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: IPP_STATUS.SERVER_ERROR_INTERNAL
      })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.pause('ipp://printer/ipp/print')
      expect(result).toBe(false)
    })

    it('returns false on network failure', async () => {
      transport.post.mockRejectedValue(new Error('network error'))

      const result = await backend.pause('ipp://printer/ipp/print')
      expect(result).toBe(false)
    })
  })

  describe('resume', () => {
    it('sends Resume-Printer request and returns true on success', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.resume('ipp://192.168.1.100:631/ipp/print')
      expect(result).toBe(true)

      // Verify it's a Resume-Printer operation
      const sentBody = transport.post.mock.calls[0][3] as Buffer
      expect(sentBody.readUInt16BE(2)).toBe(IPP_OPERATIONS.RESUME_PRINTER)
    })

    it('returns false on IPP error', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: IPP_STATUS.SERVER_ERROR_INTERNAL
      })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.resume('ipp://printer/ipp/print')
      expect(result).toBe(false)
    })

    it('returns false on network failure', async () => {
      transport.post.mockRejectedValue(new Error('timeout'))

      const result = await backend.resume('ipp://printer/ipp/print')
      expect(result).toBe(false)
    })
  })

  describe('discover', () => {
    it('returns empty array (network discovery deferred to Task 12.6)', async () => {
      const printers = await backend.discover()
      expect(printers).toEqual([])
    })
  })

  describe('cancelJob', () => {
    it('sends Cancel-Job request with numeric job ID', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.cancelJob('ipp://192.168.1.100:631/ipp/print', '42')
      expect(result).toBe(true)

      // Verify it's a Cancel-Job operation
      const sentBody = transport.post.mock.calls[0][3] as Buffer
      expect(sentBody.readUInt16BE(2)).toBe(IPP_OPERATIONS.CANCEL_JOB)
      // Verify the body contains job-id attribute
      expect(sentBody.includes(Buffer.from('job-id'))).toBe(true)
    })

    it('returns false for non-numeric job ID', async () => {
      const result = await backend.cancelJob('ipp://printer/ipp/print', 'not-a-number')
      expect(result).toBe(false)
      // Should not have made any HTTP request
      expect(transport.post).not.toHaveBeenCalled()
    })

    it('returns false on IPP error', async () => {
      const mockResponse = buildMockIppResponse({
        statusCode: IPP_STATUS.CLIENT_ERROR_NOT_FOUND
      })
      transport.post.mockResolvedValue(mockResponse)

      const result = await backend.cancelJob('ipp://printer/ipp/print', '99')
      expect(result).toBe(false)
    })

    it('returns false on network failure', async () => {
      transport.post.mockRejectedValue(new Error('connection reset'))

      const result = await backend.cancelJob('ipp://printer/ipp/print', '42')
      expect(result).toBe(false)
    })
  })

  describe('request ID incrementing', () => {
    it('increments request ID for each request', async () => {
      const mockResponse = buildMockIppResponse({ statusCode: 0x0000 })
      transport.post.mockResolvedValue(mockResponse)

      const pdfBuffer = Buffer.from('%PDF')

      await backend.print('ipp://printer/ipp/print', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })
      await backend.getStatus('ipp://printer/ipp/print')
      await backend.pause('ipp://printer/ipp/print')

      // Each call should have a different request ID in the body
      const body1 = transport.post.mock.calls[0][3] as Buffer
      const body2 = transport.post.mock.calls[1][3] as Buffer
      const body3 = transport.post.mock.calls[2][3] as Buffer

      const reqId1 = body1.readInt32BE(4)
      const reqId2 = body2.readInt32BE(4)
      const reqId3 = body3.readInt32BE(4)

      expect(reqId1).toBe(1)
      expect(reqId2).toBe(2)
      expect(reqId3).toBe(3)
    })
  })
})
