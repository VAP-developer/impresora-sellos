/**
 * printer-manager.test.ts
 *
 * Unit tests for PrinterManager auto-detection and factory functions.
 * Validates: Requirement 9 (auto-detection of backend based on OS)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  detectPlatformBackend,
  createPlatformBackend,
  createPrinterManager,
  PrinterManager
} from '../printer-manager'
import { CupsBackend } from '../cups-backend'
import { IppBackend } from '../ipp-backend'

// ─── Tests: detectPlatformBackend ─────────────────────────────────────────────

describe('detectPlatformBackend', () => {
  it('returns "cups" on linux', () => {
    expect(detectPlatformBackend('linux')).toBe('cups')
  })

  it('returns "cups" on darwin (macOS)', () => {
    expect(detectPlatformBackend('darwin')).toBe('cups')
  })

  it('returns "ipp" on win32 (Windows)', () => {
    expect(detectPlatformBackend('win32')).toBe('ipp')
  })

  it('returns "ipp" on unknown platforms', () => {
    expect(detectPlatformBackend('freebsd')).toBe('ipp')
  })

  it('defaults to current platform when no override is provided', () => {
    // On this Linux CI machine, should return "cups"
    const result = detectPlatformBackend()
    expect(['cups', 'ipp']).toContain(result)
  })
})

// ─── Tests: createPlatformBackend ─────────────────────────────────────────────

describe('createPlatformBackend', () => {
  it('creates CupsBackend on linux', () => {
    const backend = createPlatformBackend('linux')
    expect(backend).toBeInstanceOf(CupsBackend)
  })

  it('creates CupsBackend on darwin', () => {
    const backend = createPlatformBackend('darwin')
    expect(backend).toBeInstanceOf(CupsBackend)
  })

  it('creates IppBackend on win32', () => {
    const backend = createPlatformBackend('win32')
    expect(backend).toBeInstanceOf(IppBackend)
  })

  it('creates IppBackend on unknown platforms', () => {
    const backend = createPlatformBackend('freebsd')
    expect(backend).toBeInstanceOf(IppBackend)
  })
})

// ─── Tests: createPrinterManager ──────────────────────────────────────────────

describe('createPrinterManager', () => {
  it('auto-detects backend when called with no arguments (uses current OS)', () => {
    const manager = createPrinterManager()
    expect(manager).toBeInstanceOf(PrinterManager)
    // On Linux CI, this should be CupsBackend
    const backend = manager.getBackend()
    expect(backend).toBeDefined()
  })

  it('auto-detects backend when called with only assignments', () => {
    const assignments = {
      printer1: 'EPSON_Printer_1',
      printer2: 'EPSON_Printer_2',
      ticket: 'Ticket_Printer'
    }
    const manager = createPrinterManager(assignments)
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getAssignments()).toEqual(assignments)
    // Backend should be auto-detected (CupsBackend on Linux)
    expect(manager.getBackend()).toBeInstanceOf(CupsBackend)
  })

  it('uses provided backend when explicitly passed (override for testing)', () => {
    const mockBackend = {
      print: vi.fn(),
      getStatus: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      discover: vi.fn(),
      cancelJob: vi.fn()
    }

    const assignments = { printer1: 'test-printer' }
    const manager = createPrinterManager(mockBackend, assignments)
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getBackend()).toBe(mockBackend)
    expect(manager.getAssignments()).toEqual(assignments)
  })

  it('uses provided backend without assignments', () => {
    const mockBackend = {
      print: vi.fn(),
      getStatus: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      discover: vi.fn(),
      cancelJob: vi.fn()
    }

    const manager = createPrinterManager(mockBackend)
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getBackend()).toBe(mockBackend)
    expect(manager.getAssignments()).toEqual({})
  })

  it('distinguishes backend from assignments by checking for print method', () => {
    // An assignments object should NOT be treated as a backend
    const assignments = { printer1: 'ipp://192.168.1.100/ipp/print' }
    const manager = createPrinterManager(assignments)
    expect(manager).toBeInstanceOf(PrinterManager)
    // Should auto-detect backend, not use assignments as backend
    expect(manager.getAssignments()).toEqual(assignments)
    expect(manager.getBackend()).not.toBe(assignments)
  })
})

// ─── Tests: Platform-specific backend instantiation ───────────────────────────

describe('createPlatformBackend integration', () => {
  it('CupsBackend has all required PrinterBackend methods', () => {
    const backend = createPlatformBackend('linux')
    expect(typeof backend.print).toBe('function')
    expect(typeof backend.getStatus).toBe('function')
    expect(typeof backend.pause).toBe('function')
    expect(typeof backend.resume).toBe('function')
    expect(typeof backend.discover).toBe('function')
    expect(typeof backend.cancelJob).toBe('function')
  })

  it('IppBackend has all required PrinterBackend methods', () => {
    const backend = createPlatformBackend('win32')
    expect(typeof backend.print).toBe('function')
    expect(typeof backend.getStatus).toBe('function')
    expect(typeof backend.pause).toBe('function')
    expect(typeof backend.resume).toBe('function')
    expect(typeof backend.discover).toBe('function')
    expect(typeof backend.cancelJob).toBe('function')
  })

  it('returns same structure from getStatus regardless of backend', async () => {
    const cupsManager = new PrinterManager(
      createPlatformBackend('linux'),
      { printer1: 'test-queue' }
    )
    const ippManager = new PrinterManager(
      createPlatformBackend('win32'),
      { printer1: 'ipp://localhost/ipp/print' }
    )

    // Both should return the same structure (array of PrinterInfo)
    const cupsStatus = await cupsManager.getStatus()
    const ippStatus = await ippManager.getStatus()

    expect(Array.isArray(cupsStatus)).toBe(true)
    expect(Array.isArray(ippStatus)).toBe(true)

    // Both results have the same shape
    if (cupsStatus.length > 0) {
      expect(cupsStatus[0]).toHaveProperty('id')
      expect(cupsStatus[0]).toHaveProperty('name')
      expect(cupsStatus[0]).toHaveProperty('target')
      expect(cupsStatus[0]).toHaveProperty('status')
      expect(cupsStatus[0]).toHaveProperty('uri')
    }
    if (ippStatus.length > 0) {
      expect(ippStatus[0]).toHaveProperty('id')
      expect(ippStatus[0]).toHaveProperty('name')
      expect(ippStatus[0]).toHaveProperty('target')
      expect(ippStatus[0]).toHaveProperty('status')
      expect(ippStatus[0]).toHaveProperty('uri')
    }
  })
})
