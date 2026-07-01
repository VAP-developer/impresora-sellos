/**
 * printer-discovery.ts
 *
 * Implements network printer discovery for both Linux and Windows:
 * - Linux: Uses `avahi-browse` (mDNS/DNS-SD) to find IPP printers on the network,
 *   supplemented by `lpstat -a` for locally configured CUPS printers.
 * - Windows: Scans the local subnet for IPP printers by probing common IPP endpoints.
 *
 * Validates: Requirement 9 (Capa de Abstracción de Impresora - discovery)
 * Task 12.6: Implementar descubrimiento de impresoras
 */

import type { DiscoveredPrinter } from './printer-manager'

// ─── Command Executor Interface (reuse from cups-backend) ─────────────────────

/**
 * Interface for executing shell commands. Allows injection of mocks for testing.
 */
export interface DiscoveryCommandExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string }>
}

/**
 * Interface for HTTP probing (used by IPP subnet scanner).
 */
export interface DiscoveryHttpProbe {
  /**
   * Probes an IPP endpoint to check if a printer is listening.
   * Returns printer name if reachable, null otherwise.
   */
  probe(hostname: string, port: number, path: string, timeoutMs: number): Promise<string | null>
}

// ─── Default Implementations ──────────────────────────────────────────────────

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Default command executor using Node.js child_process.
 */
export const defaultDiscoveryExecutor: DiscoveryCommandExecutor = {
  exec: (command: string) => execAsync(command, { timeout: 10000 })
}

/**
 * Default HTTP probe that sends a minimal Get-Printer-Attributes IPP request
 * to check if a printer is listening on the given endpoint.
 */
export const defaultHttpProbe: DiscoveryHttpProbe = {
  probe(hostname: string, port: number, path: string, timeoutMs: number): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require('http')

    // Build a minimal Get-Printer-Attributes IPP request
    const printerUri = `ipp://${hostname}:${port}${path}`
    const ippRequest = buildMinimalGetAttributesRequest(printerUri)

    return new Promise<string | null>((resolve) => {
      const options = {
        hostname,
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/ipp',
          'Content-Length': ippRequest.length
        },
        timeout: timeoutMs
      }

      const req = http.request(
        options,
        (res: { statusCode: number; on: (event: string, cb: (...args: unknown[]) => void) => void }) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            // If we got any response with application/ipp content, it's likely a printer
            if (res.statusCode === 200) {
              const responseData = Buffer.concat(chunks)
              const name = extractPrinterName(responseData) ?? `IPP@${hostname}`
              resolve(name)
            } else {
              resolve(null)
            }
          })
        }
      )

      req.on('error', () => resolve(null))
      req.on('timeout', () => {
        req.destroy()
        resolve(null)
      })

      req.write(ippRequest)
      req.end()
    })
  }
}

// ─── IPP Encoding Helpers (minimal, for discovery probing) ────────────────────

/** IPP version 1.1 */
const IPP_V_MAJOR = 1
const IPP_V_MINOR = 1
const OP_GET_PRINTER_ATTRIBUTES = 0x000b
const TAG_OPERATION_ATTRIBUTES = 0x01
const TAG_END_OF_ATTRIBUTES = 0x03
const TAG_CHARSET = 0x47
const TAG_NATURAL_LANGUAGE = 0x48
const TAG_URI = 0x45
const TAG_KEYWORD = 0x44
const TAG_NAME_WITHOUT_LANGUAGE = 0x42

function encodeStrAttr(tag: number, name: string, value: string): Buffer {
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
 * Builds a minimal Get-Printer-Attributes request to probe for a printer.
 * Requests printer-name and printer-state only for efficiency.
 */
function buildMinimalGetAttributesRequest(printerUri: string): Buffer {
  const parts: Buffer[] = []

  // Header: version (1.1) + operation (Get-Printer-Attributes) + request-id (1)
  const header = Buffer.alloc(8)
  header.writeUInt8(IPP_V_MAJOR, 0)
  header.writeUInt8(IPP_V_MINOR, 1)
  header.writeUInt16BE(OP_GET_PRINTER_ATTRIBUTES, 2)
  header.writeInt32BE(1, 4)
  parts.push(header)

  // Operation attributes group
  parts.push(Buffer.from([TAG_OPERATION_ATTRIBUTES]))
  parts.push(encodeStrAttr(TAG_CHARSET, 'attributes-charset', 'utf-8'))
  parts.push(encodeStrAttr(TAG_NATURAL_LANGUAGE, 'attributes-natural-language', 'en'))
  parts.push(encodeStrAttr(TAG_URI, 'printer-uri', printerUri))
  parts.push(encodeStrAttr(TAG_NAME_WITHOUT_LANGUAGE, 'requesting-user-name', 'stamp-sales-app'))
  // Request printer-name attribute
  parts.push(encodeStrAttr(TAG_KEYWORD, 'requested-attributes', 'printer-name'))

  // End of attributes
  parts.push(Buffer.from([TAG_END_OF_ATTRIBUTES]))

  return Buffer.concat(parts)
}

/**
 * Extracts the printer-name from an IPP response buffer.
 * Returns null if not found or the response is too short.
 */
function extractPrinterName(data: Buffer): string | null {
  if (data.length < 8) return null

  // Skip header (8 bytes), then walk through attributes
  let offset = 8

  while (offset < data.length) {
    const tag = data.readUInt8(offset)
    offset += 1

    if (tag === TAG_END_OF_ATTRIBUTES) break

    // Delimiter tags (group delimiters 0x01-0x0f)
    if (tag <= 0x0f) continue

    // Value tag — read name + value
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

    if (name === 'printer-name' && valueLength > 0) {
      return data.subarray(offset, offset + valueLength).toString('utf-8')
    }

    offset += valueLength
  }

  return null
}

// ─── Avahi-Browse Parser (Linux mDNS/DNS-SD) ──────────────────────────────────

/**
 * Result from parsing avahi-browse output.
 */
export interface AvahiPrinter {
  name: string
  hostname: string
  port: number
  /** TXT record fields (e.g., rp=ipp/print, ty=Epson ET-2850) */
  txt: Record<string, string>
}

/**
 * Parses the output of `avahi-browse -tpr _ipp._tcp` to extract IPP printers.
 *
 * avahi-browse resolve output format (one line per field):
 * =;interface;protocol;name;type;domain;hostname;address;port;txt
 *
 * We only care about lines starting with "=" (resolved entries):
 * =;eth0;IPv4;Printer Name;_ipp._tcp;local;printer.local;192.168.1.50;631;"..."
 */
export function parseAvahiBrowse(output: string): AvahiPrinter[] {
  const printers: AvahiPrinter[] = []
  const lines = output.split('\n').filter((l) => l.startsWith('='))

  for (const line of lines) {
    // Fields are semicolon-separated
    const fields = line.split(';')

    // Expected format: =;iface;protocol;name;type;domain;hostname;address;port;txt
    // Index:           0  1      2        3    4    5      6        7       8    9
    if (fields.length < 9) continue

    const name = fields[3]?.trim()
    const hostname = fields[7]?.trim() // IP address
    const portStr = fields[8]?.trim()
    const txtRaw = fields[9]?.trim() ?? ''

    if (!name || !hostname || !portStr) continue

    const port = parseInt(portStr, 10)
    if (isNaN(port)) continue

    // Parse TXT record (space-separated key=value pairs inside quotes)
    const txt = parseTxtRecord(txtRaw)

    printers.push({ name, hostname, port, txt })
  }

  // Deduplicate by hostname:port (a printer might be advertised on multiple interfaces)
  const seen = new Set<string>()
  return printers.filter((p) => {
    const key = `${p.hostname}:${p.port}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Parses avahi TXT record string into key-value pairs.
 * Format: "key1=value1" "key2=value2" or key1=value1 key2=value2
 */
function parseTxtRecord(raw: string): Record<string, string> {
  const result: Record<string, string> = {}

  // Remove surrounding quotes and split on '" "'
  const cleaned = raw.replace(/^"/, '').replace(/"$/, '')
  const parts = cleaned.split('" "')

  for (const part of parts) {
    const eqIndex = part.indexOf('=')
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).trim()
      const value = part.substring(eqIndex + 1).trim().replace(/"/g, '')
      result[key] = value
    }
  }

  return result
}

/**
 * Converts avahi-browse results to DiscoveredPrinter format.
 */
function avahiToDiscoveredPrinters(avahiPrinters: AvahiPrinter[]): DiscoveredPrinter[] {
  return avahiPrinters.map((p) => {
    // Build the IPP URI from the discovered data
    const rp = p.txt['rp'] ?? 'ipp/print'
    const path = rp.startsWith('/') ? rp : `/${rp}`
    const uri = `ipp://${p.hostname}:${p.port}${path}`

    // Build info string from TXT record
    const model = p.txt['ty'] ?? p.txt['product'] ?? ''
    const info = model ? `${p.name} (${model})` : p.name

    return {
      name: p.name,
      uri,
      accepting: true, // mDNS-advertised printers are generally accepting
      info
    }
  })
}

// ─── Linux Discovery (avahi-browse + lpstat) ──────────────────────────────────

/**
 * Discovers printers on Linux using avahi-browse for network printers
 * and lpstat -a for locally configured CUPS printers.
 *
 * The results from both sources are merged, with avahi results providing
 * richer information (IPP URIs, model info from TXT records).
 *
 * @param executor - Command executor (injectable for testing)
 * @returns Array of discovered printers
 */
export async function discoverLinuxPrinters(
  executor: DiscoveryCommandExecutor = defaultDiscoveryExecutor
): Promise<DiscoveredPrinter[]> {
  const results: DiscoveredPrinter[] = []
  const seenUris = new Set<string>()

  // 1. Try avahi-browse for network IPP printers (mDNS/DNS-SD)
  try {
    const { stdout } = await executor.exec(
      'avahi-browse -tpr _ipp._tcp 2>/dev/null'
    )
    const avahiPrinters = parseAvahiBrowse(stdout)
    const discovered = avahiToDiscoveredPrinters(avahiPrinters)

    for (const printer of discovered) {
      if (!seenUris.has(printer.uri)) {
        seenUris.add(printer.uri)
        results.push(printer)
      }
    }
  } catch {
    // avahi-browse not available or no results — that's ok, fall through to lpstat
  }

  // 2. Also try avahi-browse for _ipps._tcp (IPP over TLS)
  try {
    const { stdout } = await executor.exec(
      'avahi-browse -tpr _ipps._tcp 2>/dev/null'
    )
    const avahiPrinters = parseAvahiBrowse(stdout)
    const discovered = avahiToDiscoveredPrinters(avahiPrinters)

    for (const printer of discovered) {
      // For IPPS, adjust the URI scheme
      const ippsUri = printer.uri.replace('ipp://', 'ipps://')
      if (!seenUris.has(ippsUri)) {
        seenUris.add(ippsUri)
        results.push({ ...printer, uri: ippsUri })
      }
    }
  } catch {
    // IPPS discovery failed — not critical
  }

  // 3. Fall back to lpstat -a for locally configured CUPS printers
  try {
    const { stdout } = await executor.exec('lpstat -a 2>/dev/null')
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(accepting|not accepting)\s+requests/)
      if (match) {
        const name = match[1]
        const accepting = match[2] === 'accepting'
        // Use the queue name as URI (CUPS convention)
        const uri = name

        if (!seenUris.has(uri)) {
          seenUris.add(uri)
          results.push({
            name,
            uri,
            accepting,
            info: line.trim()
          })
        }
      }
    }
  } catch {
    // lpstat not available — no local printers to report
  }

  return results
}

// ─── Windows Local Printer Discovery (PowerShell) ─────────────────────────────

/**
 * Result from PowerShell Get-Printer command.
 */
export interface WindowsLocalPrinter {
  Name: string
  PortName: string
  PrinterStatus: number
  Shared: boolean
  DriverName: string
  Type: number
}

/**
 * Discovers locally installed printers on Windows using PowerShell Get-Printer.
 * This finds USB, network, and virtual printers registered in the OS spooler.
 *
 * Filters out virtual/software printers (Microsoft Print to PDF, XPS Writer, etc.)
 *
 * @param executor - Command executor (injectable for testing)
 * @returns Array of discovered printers (local/USB printers)
 */
export async function discoverWindowsLocalPrinters(
  executor: DiscoveryCommandExecutor = defaultDiscoveryExecutor
): Promise<DiscoveredPrinter[]> {
  const results: DiscoveredPrinter[] = []

  try {
    const { stdout } = await executor.exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object Name, PortName, PrinterStatus, Shared, DriverName, Type | ConvertTo-Json -Compress"'
    )

    if (!stdout || stdout.trim().length === 0) {
      return results
    }

    let printers: WindowsLocalPrinter[]
    const parsed = JSON.parse(stdout.trim())
    // PowerShell returns a single object (not array) if there's only one printer
    printers = Array.isArray(parsed) ? parsed : [parsed]

    // Virtual / software printers to exclude
    const VIRTUAL_PRINTER_NAMES = [
      'microsoft print to pdf',
      'microsoft xps document writer',
      'fax',
      'send to onenote',
      'onenote for windows 10',
      'onenote (desktop)'
    ]

    for (const p of printers) {
      if (!p.Name) continue

      // Skip virtual/software printers
      const nameLower = p.Name.toLowerCase()
      if (VIRTUAL_PRINTER_NAMES.some((vp) => nameLower.includes(vp))) continue

      // Type 4 = Local connection (including USB)
      // Type 0 = Default / Local
      // We include all non-virtual printers regardless of type

      // Build a URI using the win: scheme for local Windows printers
      const uri = `win://${encodeURIComponent(p.Name)}`

      const portInfo = p.PortName ? ` (${p.PortName})` : ''
      const driverInfo = p.DriverName ? ` - ${p.DriverName}` : ''
      const info = `${p.Name}${portInfo}${driverInfo}`

      results.push({
        name: p.Name,
        uri,
        accepting: p.PrinterStatus === 0 || p.PrinterStatus === 1, // 0=Normal, 1=Paused but exists
        info
      })
    }
  } catch (err) {
    console.warn('[PrinterDiscovery] PowerShell Get-Printer failed:', err)
  }

  return results
}

// ─── Windows Discovery (IPP subnet scan + local printers) ─────────────────────

/**
 * Configuration for Windows subnet scanning.
 */
export interface SubnetScanConfig {
  /** IP addresses to scan (if empty, auto-detects from local interfaces) */
  targets?: string[]
  /** Ports to probe (default: [631, 9100, 443]) */
  ports?: number[]
  /** IPP paths to try (default: ['/ipp/print', '/ipp', '/']) */
  paths?: string[]
  /** Timeout per probe in ms (default: 2000) */
  timeoutMs?: number
  /** Max concurrent probes (default: 20) */
  concurrency?: number
}

const DEFAULT_IPP_PORTS = [631]
const DEFAULT_IPP_PATHS = ['/ipp/print', '/ipp/printer', '/']
const DEFAULT_PROBE_TIMEOUT = 2000
const DEFAULT_CONCURRENCY = 20

/**
 * Gets the local network interfaces and computes subnet addresses to scan.
 * Returns IP addresses in the same /24 subnet as local interfaces.
 *
 * @param executor - Command executor for running system commands
 * @returns Array of IP addresses to probe
 */
export async function getSubnetTargets(
  executor: DiscoveryCommandExecutor = defaultDiscoveryExecutor
): Promise<string[]> {
  const targets: string[] = []

  try {
    // On Windows, use `arp -a` to find hosts on the local network
    const { stdout } = await executor.exec('arp -a')
    const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g
    let match: RegExpExecArray | null

    while ((match = ipRegex.exec(stdout)) !== null) {
      const ip = match[1]
      // Skip broadcast addresses and self
      if (!ip.endsWith('.255') && !ip.endsWith('.0') && ip !== '255.255.255.255') {
        targets.push(ip)
      }
    }
  } catch {
    // arp not available or failed — return empty
  }

  // Deduplicate
  return [...new Set(targets)]
}

/**
 * Discovers printers on Windows by combining two strategies:
 * 1. Local printers: PowerShell Get-Printer (finds USB, local network, and spooler-registered printers)
 * 2. Network printers: IPP subnet scan (probes hosts from ARP table on port 631)
 *
 * The local discovery is fast and reliable for USB printers. The network scan
 * adds any IPP printers that might not be registered in Windows but are on the network.
 *
 * @param config - Scan configuration (targets, ports, timeout)
 * @param executor - Command executor (injectable for testing)
 * @param probe - HTTP probe (injectable for testing)
 * @returns Array of discovered printers (local + network, deduplicated)
 */
export async function discoverWindowsPrinters(
  config: SubnetScanConfig = {},
  executor: DiscoveryCommandExecutor = defaultDiscoveryExecutor,
  probe: DiscoveryHttpProbe = defaultHttpProbe
): Promise<DiscoveredPrinter[]> {
  // 1. Discover local printers via PowerShell (fast, includes USB)
  const localPrinters = await discoverWindowsLocalPrinters(executor)

  // 2. Discover network printers via IPP subnet scan
  const networkPrinters = await discoverWindowsNetworkPrinters(config, executor, probe)

  // 3. Merge results, deduplicating by name (local printers take precedence)
  const seenNames = new Set<string>(localPrinters.map((p) => p.name.toLowerCase()))
  const merged = [...localPrinters]

  for (const netPrinter of networkPrinters) {
    if (!seenNames.has(netPrinter.name.toLowerCase())) {
      seenNames.add(netPrinter.name.toLowerCase())
      merged.push(netPrinter)
    }
  }

  return merged
}

/**
 * Discovers IPP printers on the network by probing known hosts on the local subnet.
 *
 * Strategy:
 * 1. Get list of hosts from ARP table (recently communicated-with hosts)
 * 2. For each host, probe common IPP ports and paths
 * 3. If a host responds with a valid IPP response, record it as a printer
 *
 * @param config - Scan configuration (targets, ports, timeout)
 * @param executor - Command executor (injectable for testing)
 * @param probe - HTTP probe (injectable for testing)
 * @returns Array of discovered network printers
 */
export async function discoverWindowsNetworkPrinters(
  config: SubnetScanConfig = {},
  executor: DiscoveryCommandExecutor = defaultDiscoveryExecutor,
  probe: DiscoveryHttpProbe = defaultHttpProbe
): Promise<DiscoveredPrinter[]> {
  const ports = config.ports ?? DEFAULT_IPP_PORTS
  const paths = config.paths ?? DEFAULT_IPP_PATHS
  const timeoutMs = config.timeoutMs ?? DEFAULT_PROBE_TIMEOUT
  const concurrency = config.concurrency ?? DEFAULT_CONCURRENCY

  // Get targets: user-provided or auto-detected from ARP table
  const targets = config.targets ?? await getSubnetTargets(executor)

  if (targets.length === 0) {
    return []
  }

  // Build list of all (host, port, path) combinations to probe
  const probes: Array<{ host: string; port: number; path: string }> = []
  for (const host of targets) {
    for (const port of ports) {
      for (const path of paths) {
        probes.push({ host, port, path })
      }
    }
  }

  // Group probes by host:port — for each host:port, try paths in order (stop at first success)
  const hostPortGroups = new Map<string, Array<{ host: string; port: number; path: string }>>()
  for (const p of probes) {
    const key = `${p.host}:${p.port}`
    if (!hostPortGroups.has(key)) {
      hostPortGroups.set(key, [])
    }
    hostPortGroups.get(key)!.push(p)
  }

  // Convert to array of host:port groups for batched execution
  const groups = Array.from(hostPortGroups.values())

  // Run groups with concurrency limit
  const results: DiscoveredPrinter[] = []

  for (let i = 0; i < groups.length; i += concurrency) {
    const batch = groups.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(async (pathsForHost) => {
        // Try each path in order for this host:port, return first success
        for (const { host, port, path } of pathsForHost) {
          try {
            const name = await probe.probe(host, port, path, timeoutMs)
            if (name) {
              return {
                name,
                uri: `ipp://${host}:${port}${path}`,
                accepting: true,
                info: `IPP printer at ${host}:${port}`
              } satisfies DiscoveredPrinter
            }
          } catch {
            // Probe failed — try next path
          }
        }
        return null
      })
    )

    for (const result of batchResults) {
      if (result) {
        results.push(result)
      }
    }
  }

  return results
}
