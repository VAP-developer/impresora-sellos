/**
 * cups-backend.test.ts
 *
 * Unit tests for CupsBackend implementation.
 * Uses dependency injection (CommandExecutor + FileIO interfaces) for clean mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CupsBackend,
  extractQueueName,
  parseLpstatStatus,
  parseLpstatDiscovery,
  parseJobId
} from '../cups-backend'


// ─── Mock Executor ────────────────────────────────────────────────────────────

type MockedCommandExecutor = {
  exec: ReturnType<typeof vi.fn<(command: string) => Promise<{ stdout: string; stderr: string }>>>
  execFile: ReturnType<
    typeof vi.fn<(file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>>
  >
}

type MockedFileIO = {
  writeFile: ReturnType<typeof vi.fn<(path: string, data: Buffer) => Promise<void>>>
  unlink: ReturnType<typeof vi.fn<(path: string) => Promise<void>>>
  createTempFilePath: () => string
}

function createMockExecutor(): MockedCommandExecutor {
  return {
    exec: vi.fn<(command: string) => Promise<{ stdout: string; stderr: string }>>(),
    execFile: vi.fn<(file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>>()
  }
}

function createMockFileIO(): MockedFileIO {
  return {
    writeFile: vi.fn<(path: string, data: Buffer) => Promise<void>>().mockResolvedValue(undefined),
    unlink: vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined),
    createTempFilePath: () => '/tmp/stamp-print-test.pdf'
  }
}

// ─── Pure Function Tests ──────────────────────────────────────────────────────

describe('extractQueueName', () => {
  it('returns simple queue names as-is', () => {
    expect(extractQueueName('MyPrinter')).toBe('MyPrinter')
    expect(extractQueueName('Epson_ET2850')).toBe('Epson_ET2850')
  })

  it('extracts queue name from IPP URI', () => {
    expect(extractQueueName('ipp://localhost/printers/MyPrinter')).toBe('MyPrinter')
    expect(extractQueueName('ipp://192.168.1.100/printers/Brother_QL820')).toBe('Brother_QL820')
  })

  it('extracts queue name from IPP URI with trailing slash', () => {
    expect(extractQueueName('ipp://localhost/printers/MyPrinter/')).toBe('MyPrinter')
  })

  it('extracts last path segment from other URI formats', () => {
    expect(extractQueueName('/printers/TestPrinter')).toBe('TestPrinter')
    expect(extractQueueName('http://host:631/printers/Label')).toBe('Label')
  })

  it('falls back to full string for unrecognized formats', () => {
    expect(extractQueueName('some:thing')).toBe('some:thing')
  })
})

describe('parseLpstatStatus', () => {
  it('detects idle printer as ready', () => {
    expect(parseLpstatStatus('printer MyPrinter is idle.  enabled since Mon 01 Jan')).toBe('ready')
  })

  it('detects printing state as busy', () => {
    expect(parseLpstatStatus('printer MyPrinter now printing MyPrinter-42.')).toBe('busy')
  })

  it('detects disabled printer as paused', () => {
    expect(parseLpstatStatus('printer MyPrinter disabled since Mon 01 Jan - paused')).toBe('paused')
  })

  it('detects not accepting as paused', () => {
    expect(parseLpstatStatus('printer MyPrinter is not accepting jobs.')).toBe('paused')
  })

  it('detects error state', () => {
    expect(parseLpstatStatus('printer MyPrinter has a fault.')).toBe('error')
  })

  it('detects enabled printer as ready', () => {
    expect(parseLpstatStatus('printer MyPrinter enabled since Mon 01 Jan')).toBe('ready')
  })

  it('defaults to ready for unrecognized output', () => {
    expect(parseLpstatStatus('something unexpected')).toBe('ready')
  })
})

describe('parseLpstatDiscovery', () => {
  it('parses accepting printers', () => {
    const output = 'MyPrinter accepting requests since Mon 01 Jan 2024 12:00:00'
    const result = parseLpstatDiscovery(output)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'MyPrinter',
      uri: 'MyPrinter',
      accepting: true,
      info: output.trim()
    })
  })

  it('parses not accepting printers', () => {
    const output = 'OldPrinter not accepting requests since Fri 15 Dec 2023'
    const result = parseLpstatDiscovery(output)
    expect(result).toHaveLength(1)
    expect(result[0].accepting).toBe(false)
    expect(result[0].name).toBe('OldPrinter')
  })

  it('parses multiple printers', () => {
    const output = [
      'Printer_A accepting requests since Mon 01 Jan 2024',
      'Printer_B not accepting requests since Tue 02 Jan 2024',
      'Printer_C accepting requests since Wed 03 Jan 2024'
    ].join('\n')
    const result = parseLpstatDiscovery(output)
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Printer_A')
    expect(result[0].accepting).toBe(true)
    expect(result[1].name).toBe('Printer_B')
    expect(result[1].accepting).toBe(false)
    expect(result[2].name).toBe('Printer_C')
    expect(result[2].accepting).toBe(true)
  })

  it('handles empty output', () => {
    expect(parseLpstatDiscovery('')).toEqual([])
  })

  it('skips unrecognized lines', () => {
    const output = 'some random line\nMyPrinter accepting requests since now\n'
    const result = parseLpstatDiscovery(output)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('MyPrinter')
  })
})

describe('parseJobId', () => {
  it('parses standard lp output', () => {
    expect(parseJobId('request id is MyPrinter-123 (1 file(s))')).toBe('MyPrinter-123')
  })

  it('parses output with different printer names', () => {
    expect(parseJobId('request id is Epson_ET2850-456 (1 file(s))')).toBe('Epson_ET2850-456')
  })

  it('returns undefined for unrecognized output', () => {
    expect(parseJobId('some other output')).toBeUndefined()
  })

  it('returns undefined for empty output', () => {
    expect(parseJobId('')).toBeUndefined()
  })
})

// ─── CupsBackend Integration Tests (with mock executor) ──────────────────────

describe('CupsBackend', () => {
  let backend: CupsBackend
  let executor: ReturnType<typeof createMockExecutor>
  let fileIO: ReturnType<typeof createMockFileIO>

  beforeEach(() => {
    executor = createMockExecutor()
    fileIO = createMockFileIO()
    backend = new CupsBackend(executor, fileIO)
  })

  describe('print', () => {
    it('sends PDF to the specified queue with correct options', async () => {
      executor.execFile.mockResolvedValue({
        stdout: 'request id is TestPrinter-42 (1 file(s))',
        stderr: ''
      })

      const pdfBuffer = Buffer.from('%PDF-1.4 test content')
      const result = await backend.print('TestPrinter', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6,
        jobName: 'stamp_test'
      })

      expect(result.success).toBe(true)
      expect(result.jobId).toBe('TestPrinter-42')

      // Verify file was written
      expect(fileIO.writeFile).toHaveBeenCalledWith('/tmp/stamp-print-test.pdf', pdfBuffer)

      // Verify lp was called with correct args
      expect(executor.execFile).toHaveBeenCalledWith('lp', expect.any(Array))
      const args = executor.execFile.mock.calls[0][1] as string[]
      expect(args).toContain('-d')
      expect(args).toContain('TestPrinter')
      expect(args).toContain('media=DC55x25')
      expect(args).toContain('orientation-requested=6')
      expect(args).toContain('-t')
      expect(args).toContain('stamp_test')
      expect(args).toContain('/tmp/stamp-print-test.pdf')
    })

    it('handles copies > 1', async () => {
      executor.execFile.mockResolvedValue({ stdout: 'request id is P-1 (1 file(s))', stderr: '' })

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('P', pdfBuffer, {
        media: 'Custom.78x120mm',
        orientation: 3,
        copies: 3
      })

      const args = executor.execFile.mock.calls[0][1] as string[]
      expect(args).toContain('-n')
      expect(args).toContain('3')
    })

    it('does not include -n flag when copies is 1 (default)', async () => {
      executor.execFile.mockResolvedValue({ stdout: 'request id is P-1 (1 file(s))', stderr: '' })

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('P', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      const args = executor.execFile.mock.calls[0][1] as string[]
      expect(args).not.toContain('-n')
    })

    it('returns error on lp failure', async () => {
      executor.execFile.mockRejectedValue(new Error('lp: Unknown destination "BadPrinter"'))

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('BadPrinter', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('CUPS print failed')
      expect(result.error).toContain('Unknown destination')
    })

    it('extracts queue name from IPP URI', async () => {
      executor.execFile.mockResolvedValue({ stdout: 'request id is Epson-1 (1 file(s))', stderr: '' })

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('ipp://localhost/printers/Epson', pdfBuffer, {
        media: 'DC55x25',
        orientation: 6
      })

      const args = executor.execFile.mock.calls[0][1] as string[]
      expect(args[1]).toBe('Epson')
    })

    it('cleans up temp file after successful print', async () => {
      executor.execFile.mockResolvedValue({ stdout: 'request id is P-1 (1 file(s))', stderr: '' })

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('P', pdfBuffer, { media: 'DC55x25', orientation: 6 })

      expect(fileIO.unlink).toHaveBeenCalledWith('/tmp/stamp-print-test.pdf')
    })

    it('cleans up temp file after failed print', async () => {
      executor.execFile.mockRejectedValue(new Error('fail'))

      const pdfBuffer = Buffer.from('%PDF')
      await backend.print('P', pdfBuffer, { media: 'DC55x25', orientation: 6 })

      expect(fileIO.unlink).toHaveBeenCalledWith('/tmp/stamp-print-test.pdf')
    })

    it('handles non-Error exceptions gracefully', async () => {
      executor.execFile.mockRejectedValue('string error')

      const pdfBuffer = Buffer.from('%PDF')
      const result = await backend.print('P', pdfBuffer, { media: 'DC55x25', orientation: 6 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('CUPS print failed')
    })
  })

  describe('getStatus', () => {
    it('returns ready for idle printer', async () => {
      executor.exec.mockResolvedValue({
        stdout: 'printer TestQ is idle.  enabled since Mon',
        stderr: ''
      })

      const status = await backend.getStatus('TestQ')
      expect(status).toBe('ready')
      expect(executor.exec).toHaveBeenCalledWith('lpstat -p TestQ')
    })

    it('returns busy for printing state', async () => {
      executor.exec.mockResolvedValue({
        stdout: 'printer TestQ now printing TestQ-5.',
        stderr: ''
      })

      const status = await backend.getStatus('TestQ')
      expect(status).toBe('busy')
    })

    it('returns paused for disabled printer', async () => {
      executor.exec.mockResolvedValue({
        stdout: 'printer TestQ disabled since Mon 01',
        stderr: ''
      })

      const status = await backend.getStatus('TestQ')
      expect(status).toBe('paused')
    })

    it('returns disconnected on command failure', async () => {
      executor.exec.mockRejectedValue(new Error('lpstat: No such printer'))

      const status = await backend.getStatus('NonExistent')
      expect(status).toBe('disconnected')
    })

    it('extracts queue name from URI before querying', async () => {
      executor.exec.mockResolvedValue({ stdout: 'printer Q is idle.', stderr: '' })

      await backend.getStatus('ipp://localhost/printers/Q')
      expect(executor.exec).toHaveBeenCalledWith('lpstat -p Q')
    })
  })

  describe('pause', () => {
    it('calls cupsdisable with queue name', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await backend.pause('MyPrinter')
      expect(result).toBe(true)
      expect(executor.execFile).toHaveBeenCalledWith('cupsdisable', ['MyPrinter'])
    })

    it('extracts queue name from URI', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      await backend.pause('ipp://localhost/printers/Label')
      expect(executor.execFile).toHaveBeenCalledWith('cupsdisable', ['Label'])
    })

    it('returns false on failure', async () => {
      executor.execFile.mockRejectedValue(new Error('permission denied'))

      const result = await backend.pause('MyPrinter')
      expect(result).toBe(false)
    })
  })

  describe('resume', () => {
    it('calls cupsenable with queue name', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await backend.resume('MyPrinter')
      expect(result).toBe(true)
      expect(executor.execFile).toHaveBeenCalledWith('cupsenable', ['MyPrinter'])
    })

    it('extracts queue name from URI', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      await backend.resume('ipp://localhost/printers/Label')
      expect(executor.execFile).toHaveBeenCalledWith('cupsenable', ['Label'])
    })

    it('returns false on failure', async () => {
      executor.execFile.mockRejectedValue(new Error('permission denied'))

      const result = await backend.resume('MyPrinter')
      expect(result).toBe(false)
    })
  })

  describe('discover', () => {
    it('returns discovered printers from avahi-browse and lpstat -a', async () => {
      executor.exec.mockImplementation((command: string) => {
        if (command.includes('_ipp._tcp')) {
          return Promise.resolve({ stdout: '', stderr: '' })
        }
        if (command.includes('_ipps._tcp')) {
          return Promise.resolve({ stdout: '', stderr: '' })
        }
        if (command.includes('lpstat')) {
          return Promise.resolve({
            stdout: [
              'Epson_ET2850 accepting requests since Mon 01 Jan',
              'Brother_QL820 accepting requests since Tue 02 Jan'
            ].join('\n'),
            stderr: ''
          })
        }
        return Promise.resolve({ stdout: '', stderr: '' })
      })

      const printers = await backend.discover()
      expect(printers).toHaveLength(2)
      expect(printers[0].name).toBe('Epson_ET2850')
      expect(printers[0].accepting).toBe(true)
      expect(printers[1].name).toBe('Brother_QL820')
    })

    it('returns empty array when no printers found', async () => {
      executor.exec.mockResolvedValue({ stdout: '', stderr: '' })

      const printers = await backend.discover()
      expect(printers).toEqual([])
    })

    it('returns empty array on command failure', async () => {
      executor.exec.mockRejectedValue(new Error('lpstat not found'))

      const printers = await backend.discover()
      expect(printers).toEqual([])
    })
  })

  describe('cancelJob', () => {
    it('calls cancel with job ID', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await backend.cancelJob('MyPrinter', 'MyPrinter-123')
      expect(result).toBe(true)
      expect(executor.execFile).toHaveBeenCalledWith('cancel', ['MyPrinter-123'])
    })

    it('returns false on failure', async () => {
      executor.execFile.mockRejectedValue(new Error('cancel: No such job'))

      const result = await backend.cancelJob('MyPrinter', 'BadJob-999')
      expect(result).toBe(false)
    })

    it('ignores printerUri (CUPS cancel uses global job IDs)', async () => {
      executor.execFile.mockResolvedValue({ stdout: '', stderr: '' })

      await backend.cancelJob('any-uri', 'Job-42')
      expect(executor.execFile).toHaveBeenCalledWith('cancel', ['Job-42'])
    })
  })
})
