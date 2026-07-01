/**
 * printer-discovery.test.ts
 *
 * Unit tests for the printer discovery module.
 * Tests both Linux (avahi-browse) and Windows (IPP subnet scan) discovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseAvahiBrowse,
  discoverLinuxPrinters,
  discoverWindowsPrinters,
  getSubnetTargets,
  type DiscoveryCommandExecutor,
  type DiscoveryHttpProbe,
  type SubnetScanConfig
} from '../printer-discovery'

// ─── Mock Factories ───────────────────────────────────────────────────────────

function createMockExecutor(): {
  exec: ReturnType<typeof vi.fn<(command: string) => Promise<{ stdout: string; stderr: string }>>>
} {
  return {
    exec: vi.fn<(command: string) => Promise<{ stdout: string; stderr: string }>>()
  }
}

function createMockProbe(): {
  probe: ReturnType<
    typeof vi.fn<
      (hostname: string, port: number, path: string, timeoutMs: number) => Promise<string | null>
    >
  >
} {
  return {
    probe: vi.fn<
      (hostname: string, port: number, path: string, timeoutMs: number) => Promise<string | null>
    >()
  }
}

// ─── parseAvahiBrowse Tests ───────────────────────────────────────────────────

describe('parseAvahiBrowse', () => {
  it('parses a single resolved printer entry', () => {
    const output =
      '=;eth0;IPv4;Brother QL-820NWB;_ipp._tcp;local;BRN123456.local;192.168.1.50;631;"rp=ipp/print" "ty=Brother QL-820NWB"'

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Brother QL-820NWB')
    expect(result[0].hostname).toBe('192.168.1.50')
    expect(result[0].port).toBe(631)
    expect(result[0].txt['rp']).toBe('ipp/print')
    expect(result[0].txt['ty']).toBe('Brother QL-820NWB')
  })

  it('parses multiple printer entries', () => {
    const output = [
      '=;eth0;IPv4;Epson ET-2850;_ipp._tcp;local;epson.local;192.168.1.51;631;"rp=ipp/print" "ty=Epson ET-2850"',
      '=;eth0;IPv4;Brother QL-820;_ipp._tcp;local;brother.local;192.168.1.52;631;"rp=ipp/print" "ty=Brother QL-820"'
    ].join('\n')

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Epson ET-2850')
    expect(result[0].hostname).toBe('192.168.1.51')
    expect(result[1].name).toBe('Brother QL-820')
    expect(result[1].hostname).toBe('192.168.1.52')
  })

  it('deduplicates entries by hostname:port (multiple interfaces)', () => {
    const output = [
      '=;eth0;IPv4;MyPrinter;_ipp._tcp;local;printer.local;192.168.1.50;631;"rp=ipp/print"',
      '=;wlan0;IPv4;MyPrinter;_ipp._tcp;local;printer.local;192.168.1.50;631;"rp=ipp/print"'
    ].join('\n')

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(1)
    expect(result[0].hostname).toBe('192.168.1.50')
  })

  it('ignores non-resolved lines (starting with + or - instead of =)', () => {
    const output = [
      '+;eth0;IPv4;MyPrinter;_ipp._tcp;local',
      '=;eth0;IPv4;MyPrinter;_ipp._tcp;local;printer.local;192.168.1.50;631;"rp=ipp/print"',
      '-;eth0;IPv4;OldPrinter;_ipp._tcp;local'
    ].join('\n')

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('MyPrinter')
  })

  it('returns empty array for empty output', () => {
    expect(parseAvahiBrowse('')).toEqual([])
  })

  it('handles entries with non-standard ports', () => {
    const output =
      '=;eth0;IPv4;Custom Printer;_ipp._tcp;local;custom.local;10.0.0.5;9100;"rp=/print"'

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(1)
    expect(result[0].port).toBe(9100)
  })

  it('handles entries with missing TXT record fields gracefully', () => {
    const output =
      '=;eth0;IPv4;Simple Printer;_ipp._tcp;local;simple.local;192.168.1.55;631;'

    const result = parseAvahiBrowse(output)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Simple Printer')
    expect(result[0].txt).toEqual({})
  })

  it('skips entries with fewer than 9 fields', () => {
    const output = '=;eth0;IPv4;Short;_ipp._tcp;local;host.local'

    const result = parseAvahiBrowse(output)

    expect(result).toEqual([])
  })

  it('skips entries with invalid port', () => {
    const output =
      '=;eth0;IPv4;BadPort;_ipp._tcp;local;host.local;192.168.1.1;abc;"rp=ipp/print"'

    const result = parseAvahiBrowse(output)

    expect(result).toEqual([])
  })
})

// ─── discoverLinuxPrinters Tests ──────────────────────────────────────────────

describe('discoverLinuxPrinters', () => {
  let executor: ReturnType<typeof createMockExecutor>

  beforeEach(() => {
    executor = createMockExecutor()
  })

  it('discovers printers via avahi-browse for _ipp._tcp', async () => {
    // avahi-browse _ipp._tcp returns one printer
    executor.exec.mockImplementation((command: string) => {
      if (command.includes('_ipp._tcp')) {
        return Promise.resolve({
          stdout:
            '=;eth0;IPv4;Test Printer;_ipp._tcp;local;test.local;192.168.1.100;631;"rp=ipp/print" "ty=Test Model"',
          stderr: ''
        })
      }
      // _ipps._tcp returns nothing
      if (command.includes('_ipps._tcp')) {
        return Promise.resolve({ stdout: '', stderr: '' })
      }
      // lpstat returns nothing
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('Test Printer')
    expect(printers[0].uri).toBe('ipp://192.168.1.100:631/ipp/print')
    expect(printers[0].accepting).toBe(true)
    expect(printers[0].info).toContain('Test Model')
  })

  it('combines avahi-browse and lpstat results without duplicates', async () => {
    executor.exec.mockImplementation((command: string) => {
      if (command.includes('_ipp._tcp')) {
        return Promise.resolve({
          stdout:
            '=;eth0;IPv4;Network Printer;_ipp._tcp;local;net.local;192.168.1.100;631;"rp=ipp/print"',
          stderr: ''
        })
      }
      if (command.includes('_ipps._tcp')) {
        return Promise.resolve({ stdout: '', stderr: '' })
      }
      if (command.includes('lpstat')) {
        return Promise.resolve({
          stdout: 'Local_Printer accepting requests since Mon 01 Jan 2024',
          stderr: ''
        })
      }
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toHaveLength(2)
    expect(printers[0].name).toBe('Network Printer')
    expect(printers[0].uri).toBe('ipp://192.168.1.100:631/ipp/print')
    expect(printers[1].name).toBe('Local_Printer')
    expect(printers[1].uri).toBe('Local_Printer')
  })

  it('discovers IPPS printers with ipps:// URI scheme', async () => {
    executor.exec.mockImplementation((command: string) => {
      if (command.includes('_ipp._tcp') && !command.includes('_ipps._tcp')) {
        return Promise.resolve({ stdout: '', stderr: '' })
      }
      if (command.includes('_ipps._tcp')) {
        return Promise.resolve({
          stdout:
            '=;eth0;IPv4;Secure Printer;_ipps._tcp;local;secure.local;192.168.1.200;443;"rp=ipp/print"',
          stderr: ''
        })
      }
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('Secure Printer')
    expect(printers[0].uri).toBe('ipps://192.168.1.200:443/ipp/print')
  })

  it('falls back to lpstat when avahi-browse fails', async () => {
    executor.exec.mockImplementation((command: string) => {
      if (command.includes('avahi-browse')) {
        return Promise.reject(new Error('avahi-browse: command not found'))
      }
      if (command.includes('lpstat')) {
        return Promise.resolve({
          stdout: 'Fallback_Printer accepting requests since Mon 01',
          stderr: ''
        })
      }
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('Fallback_Printer')
  })

  it('returns empty array when all discovery methods fail', async () => {
    executor.exec.mockRejectedValue(new Error('all commands fail'))

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toEqual([])
  })

  it('handles avahi-browse returning empty output', async () => {
    executor.exec.mockResolvedValue({ stdout: '', stderr: '' })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toEqual([])
  })

  it('uses rp from TXT record for URI path', async () => {
    executor.exec.mockImplementation((command: string) => {
      if (command.includes('_ipp._tcp')) {
        return Promise.resolve({
          stdout:
            '=;eth0;IPv4;Custom Path;_ipp._tcp;local;host.local;10.0.0.1;631;"rp=printers/label"',
          stderr: ''
        })
      }
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    const printers = await discoverLinuxPrinters(executor)

    expect(printers).toHaveLength(1)
    expect(printers[0].uri).toBe('ipp://10.0.0.1:631/printers/label')
  })
})

// ─── getSubnetTargets Tests ───────────────────────────────────────────────────

describe('getSubnetTargets', () => {
  let executor: ReturnType<typeof createMockExecutor>

  beforeEach(() => {
    executor = createMockExecutor()
  })

  it('extracts IPs from ARP table output', async () => {
    executor.exec.mockResolvedValue({
      stdout: [
        'Interface: 192.168.1.5 --- 0x4',
        '  Internet Address      Physical Address      Type',
        '  192.168.1.1            aa-bb-cc-dd-ee-ff     dynamic',
        '  192.168.1.50           11-22-33-44-55-66     dynamic',
        '  192.168.1.100          77-88-99-aa-bb-cc     dynamic',
        '  192.168.1.255          ff-ff-ff-ff-ff-ff     static'
      ].join('\n'),
      stderr: ''
    })

    const targets = await getSubnetTargets(executor)

    expect(targets).toContain('192.168.1.5')
    expect(targets).toContain('192.168.1.1')
    expect(targets).toContain('192.168.1.50')
    expect(targets).toContain('192.168.1.100')
    // Should exclude broadcast address
    expect(targets).not.toContain('192.168.1.255')
  })

  it('deduplicates IP addresses', async () => {
    executor.exec.mockResolvedValue({
      stdout: '192.168.1.1 ... 192.168.1.1 ...',
      stderr: ''
    })

    const targets = await getSubnetTargets(executor)

    expect(targets).toHaveLength(1)
    expect(targets[0]).toBe('192.168.1.1')
  })

  it('returns empty array when arp command fails', async () => {
    executor.exec.mockRejectedValue(new Error('arp: command not found'))

    const targets = await getSubnetTargets(executor)

    expect(targets).toEqual([])
  })

  it('returns empty array for empty arp output', async () => {
    executor.exec.mockResolvedValue({ stdout: '', stderr: '' })

    const targets = await getSubnetTargets(executor)

    expect(targets).toEqual([])
  })

  it('excludes .0 network addresses', async () => {
    executor.exec.mockResolvedValue({
      stdout: '192.168.1.0    ff-ff-ff-ff-ff-ff    static\n192.168.1.5    aa-bb-cc    dynamic',
      stderr: ''
    })

    const targets = await getSubnetTargets(executor)

    expect(targets).not.toContain('192.168.1.0')
    expect(targets).toContain('192.168.1.5')
  })
})

// ─── discoverWindowsPrinters Tests ────────────────────────────────────────────

describe('discoverWindowsPrinters', () => {
  let executor: ReturnType<typeof createMockExecutor>
  let probe: ReturnType<typeof createMockProbe>

  beforeEach(() => {
    executor = createMockExecutor()
    probe = createMockProbe()
  })

  it('discovers printers by probing targets on IPP port', async () => {
    const config: SubnetScanConfig = {
      targets: ['192.168.1.50', '192.168.1.51'],
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 1000
    }

    probe.probe.mockImplementation(
      (hostname: string) => {
        if (hostname === '192.168.1.50') return Promise.resolve('Epson ET-2850')
        return Promise.resolve(null)
      }
    )

    const printers = await discoverWindowsPrinters(config, executor, probe)

    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('Epson ET-2850')
    expect(printers[0].uri).toBe('ipp://192.168.1.50:631/ipp/print')
    expect(printers[0].accepting).toBe(true)
  })

  it('discovers multiple printers on different hosts', async () => {
    const config: SubnetScanConfig = {
      targets: ['10.0.0.1', '10.0.0.2', '10.0.0.3'],
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 500
    }

    probe.probe.mockImplementation(
      (hostname: string) => {
        if (hostname === '10.0.0.1') return Promise.resolve('Printer A')
        if (hostname === '10.0.0.3') return Promise.resolve('Printer B')
        return Promise.resolve(null)
      }
    )

    const printers = await discoverWindowsPrinters(config, executor, probe)

    expect(printers).toHaveLength(2)
    expect(printers[0].name).toBe('Printer A')
    expect(printers[1].name).toBe('Printer B')
  })

  it('returns empty array when no targets are found and ARP fails', async () => {
    executor.exec.mockRejectedValue(new Error('arp failed'))

    const printers = await discoverWindowsPrinters({}, executor, probe)

    expect(printers).toEqual([])
  })

  it('returns empty array when no printers respond', async () => {
    const config: SubnetScanConfig = {
      targets: ['192.168.1.1', '192.168.1.2'],
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 500
    }

    probe.probe.mockResolvedValue(null)

    const printers = await discoverWindowsPrinters(config, executor, probe)

    expect(printers).toEqual([])
  })

  it('auto-detects targets from ARP table when no targets specified', async () => {
    executor.exec.mockResolvedValue({
      stdout: '192.168.1.10  aa-bb-cc  dynamic\n192.168.1.20  dd-ee-ff  dynamic',
      stderr: ''
    })

    probe.probe.mockImplementation(
      (hostname: string) => {
        if (hostname === '192.168.1.10') return Promise.resolve('Found Printer')
        return Promise.resolve(null)
      }
    )

    const config: SubnetScanConfig = {
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 500
    }

    const printers = await discoverWindowsPrinters(config, executor, probe)

    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('Found Printer')
    expect(printers[0].uri).toBe('ipp://192.168.1.10:631/ipp/print')
  })

  it('deduplicates results from same host:port with different paths', async () => {
    const config: SubnetScanConfig = {
      targets: ['192.168.1.50'],
      ports: [631],
      paths: ['/ipp/print', '/ipp/printer', '/'],
      timeoutMs: 500
    }

    // First path succeeds, subsequent paths for same host:port should be skipped
    probe.probe.mockImplementation(
      (_hostname: string, _port: number, path: string) => {
        if (path === '/ipp/print') return Promise.resolve('My Printer')
        return Promise.resolve('My Printer Again')
      }
    )

    const printers = await discoverWindowsPrinters(config, executor, probe)

    // Should only have 1 result since host:port is the same
    expect(printers).toHaveLength(1)
    expect(printers[0].name).toBe('My Printer')
  })

  it('respects concurrency limit', async () => {
    const config: SubnetScanConfig = {
      targets: Array.from({ length: 50 }, (_, i) => `10.0.0.${i + 1}`),
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 500,
      concurrency: 5
    }

    let maxConcurrent = 0
    let current = 0

    probe.probe.mockImplementation(
      () => {
        current++
        maxConcurrent = Math.max(maxConcurrent, current)
        return new Promise<string | null>((resolve) => {
          setTimeout(() => {
            current--
            resolve(null)
          }, 10)
        })
      }
    )

    await discoverWindowsPrinters(config, executor, probe)

    // Concurrency should be respected per batch
    expect(maxConcurrent).toBeLessThanOrEqual(5)
  })

  it('handles probe errors gracefully', async () => {
    const config: SubnetScanConfig = {
      targets: ['192.168.1.1'],
      ports: [631],
      paths: ['/ipp/print'],
      timeoutMs: 500
    }

    probe.probe.mockRejectedValue(new Error('Connection refused'))

    // Should not throw — errors are handled internally
    const printers = await discoverWindowsPrinters(config, executor, probe)

    expect(printers).toEqual([])
  })
})
