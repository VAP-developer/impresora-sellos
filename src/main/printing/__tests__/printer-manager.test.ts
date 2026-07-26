/**
 * printer-manager.test.ts
 *
 * Unit tests for PrinterManager factory functions.
 * Validates: Requirement 9 (printer abstraction layer)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  detectPlatformBackend,
  createPlatformBackend,
  createPrinterManager,
  PrinterManager
} from '../printer-manager'
import { WindowsBackend } from '../windows-backend'

// ─── Tests: detectPlatformBackend ─────────────────────────────────────────────

describe('detectPlatformBackend', () => {
  it('always returns "windows"', () => {
    expect(detectPlatformBackend()).toBe('windows')
    expect(detectPlatformBackend('win32')).toBe('windows')
    expect(detectPlatformBackend('linux')).toBe('windows')
    expect(detectPlatformBackend('darwin')).toBe('windows')
  })
})

// ─── Tests: createPlatformBackend ─────────────────────────────────────────────

describe('createPlatformBackend', () => {
  it('creates WindowsBackend', () => {
    const backend = createPlatformBackend()
    expect(backend).toBeInstanceOf(WindowsBackend)
  })

  it('WindowsBackend has all required PrinterBackend methods', () => {
    const backend = createPlatformBackend()
    expect(typeof backend.print).toBe('function')
    expect(typeof backend.getStatus).toBe('function')
    expect(typeof backend.pause).toBe('function')
    expect(typeof backend.resume).toBe('function')
    expect(typeof backend.discover).toBe('function')
    expect(typeof backend.cancelJob).toBe('function')
  })
})

// ─── Tests: createPrinterManager ──────────────────────────────────────────────

describe('createPrinterManager', () => {
  it('creates a PrinterManager with WindowsBackend when called with no arguments', () => {
    const manager = createPrinterManager()
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getBackend()).toBeInstanceOf(WindowsBackend)
  })

  it('uses provided assignments when passed', () => {
    const assignments = {
      printer1: 'win://Brother_TD-4100N',
      printer2: 'win://Brother_TD-4100N_2',
      ticket: 'win://Ticket_Printer'
    }
    const manager = createPrinterManager(assignments)
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getAssignments()).toEqual(assignments)
    expect(manager.getBackend()).toBeInstanceOf(WindowsBackend)
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

    const assignments = { printer1: 'win://test-printer' }
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
    const assignments = { printer1: 'win://My_Printer' }
    const manager = createPrinterManager(assignments)
    expect(manager).toBeInstanceOf(PrinterManager)
    expect(manager.getAssignments()).toEqual(assignments)
    expect(manager.getBackend()).not.toBe(assignments)
  })
})

// ─── Tests: PrinterManager getStatus structure ────────────────────────────────

describe('PrinterManager getStatus', () => {
  it('returns array of PrinterInfo with correct shape', async () => {
    const manager = new PrinterManager(
      createPlatformBackend(),
      { printer1: 'win://Test_Printer' }
    )

    const status = await manager.getStatus()
    expect(Array.isArray(status)).toBe(true)

    if (status.length > 0) {
      expect(status[0]).toHaveProperty('id')
      expect(status[0]).toHaveProperty('name')
      expect(status[0]).toHaveProperty('target')
      expect(status[0]).toHaveProperty('status')
      expect(status[0]).toHaveProperty('uri')
    }
  })
})
