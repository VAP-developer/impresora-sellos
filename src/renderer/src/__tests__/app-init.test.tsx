/**
 * app-init.test.tsx
 *
 * Integration test that verifies all stores load data correctly when the app initializes.
 * Simulates the app startup flow: App mounts → stores call IPC → state is populated.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useConfigStore } from '@renderer/stores/config.store'
import { usePrinterStore } from '@renderer/stores/printer.store'
import { useOrdersStore } from '@renderer/stores/orders.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { AppConfig } from '@renderer/types/config'
import type { PrinterInfo } from '@renderer/types/printer'

// Mock the ipc-client module
vi.mock('@renderer/lib/ipc-client', () => ({
  getConfig: vi.fn(),
  updateMaquina: vi.fn(),
  updateImprimir: vi.fn(),
  updateSesion: vi.fn(),
  updateSesionError: vi.fn(),
  updateRollos: vi.fn(),
  updateRollosRevert: vi.fn(),
  initConfig: vi.fn(),
  onConfigChange: vi.fn(() => vi.fn()),
  insertOrders: vi.fn(),
  downloadCSV: vi.fn(),
  uploadImage: vi.fn(),
  removeImage: vi.fn(),
  getImageByName: vi.fn(),
  getPrinterStatus: vi.fn(),
  print: vi.fn(),
  pausePrinter: vi.fn(),
  resumePrinter: vi.fn(),
  getPrintQueue: vi.fn(),
  getSyncStatus: vi.fn(),
  triggerSync: vi.fn()
}))

import * as ipc from '@renderer/lib/ipc-client'
import App from '@renderer/App'

const mockConfig: AppConfig = {
  ticket: {
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor - Madrid',
    fecha: 'auto',
    hora: 'auto',
    titulo: 'Factura Simplificada',
    tituloCopia: 'COPIA Factura Simplificada',
    rollo1: 1500,
    rollo2: 1500,
    tickets: 450,
    limiteTickets: 450,
    limiteImporte: 399.99,
    NUEVOlimiteImporte: 399.99,
    empresa: 'S.E. Correos y Telegrafos S.A., S.M.E.',
    cif: 'A83052407',
    cp: '28042 Madrid',
    l1: 'Exento de impuestos',
    l2: 'Objeto de coleccionismo',
    l3: 'No se admiten devoluciones',
    ImprimeCopiaTicket: 'S',
    ImprimeMasterTicket: 'N',
    bloqueado: 'DESBLOQUEADO'
  },
  codigo: {
    modo: 'P',
    mes: 0,
    annio: 'auto',
    pais: 'ES',
    maquina: 'CH17',
    cliente: 1,
    producto: 1
  },
  sello: {
    elperfil: 6,
    elnperfil: 'FERIA',
    elevento: 0,
    elnevento: 'Feria Madrid 2025',
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor Madrid',
    modelo1: 'modelo1',
    modelo2: 'modelo2',
    modo: 0,
    nperfil1: 'Filatelia',
    nperfil2: 'Esporadicos',
    nperfil3: 'SPDE',
    nperfil4: '',
    nperfil5: 'Abono/Envio',
    nperfil6: 'FERIA',
    eventos: [
      {
        nevento: 'Feria Madrid',
        nferia: 'XLIX Feria Nacional Sello',
        nlugar: 'Plaza Mayor Madrid',
        motivoi: 'NombreModeloIzq',
        motivod: 'NombreModeloDer',
        fecha: '21-24 abril 2025',
        localidad: 'Madrid'
      }
    ]
  },
  precios: {
    tarifaA: 0.5,
    tarifaA2: 0.6,
    tarifaB: 1.25,
    tarifaC: 1.35,
    tarifaTA: 2.0,
    tarifaT4: 3.7
  }
}

const mockPrinters: PrinterInfo[] = [
  {
    id: 'printer-1',
    name: 'Epson LQ-590',
    target: 'printer1',
    status: 'ready',
    uri: 'ipp://192.168.1.100:631/printers/epson1'
  },
  {
    id: 'printer-2',
    name: 'Epson LQ-590 (2)',
    target: 'printer2',
    status: 'ready',
    uri: 'ipp://192.168.1.101:631/printers/epson2'
  },
  {
    id: 'ticket-printer',
    name: 'Epson TM-T88',
    target: 'ticket',
    status: 'ready',
    uri: 'ipp://192.168.1.102:631/printers/ticket'
  }
]

describe('App initialization – stores load correctly', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useConfigStore.setState({ config: null, loading: false, error: null })
    usePrinterStore.setState({ printers: [], queue: [], loading: false, printing: false, error: null })
    useOrdersStore.setState({ loading: false, error: null, lastInserted: [] })
    useKioskoStore.setState({
      quantities: {
        tarifaAS1: 0, tarifaA2S1: 0, tarifaBS1: 0, tarifaCS1: 0, tarifaAT1: 0, tarifa4T1: 0,
        tarifaAS2: 0, tarifaA2S2: 0, tarifaBS2: 0, tarifaCS2: 0, tarifaAT2: 0, tarifa4T2: 0
      },
      lastSale: { sellos1: 0, sellos2: 0, tickets: 0 }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load config store on app mount', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      const state = useConfigStore.getState()
      expect(state.config).toEqual(mockConfig)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  it('should load printer status on app mount', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      const state = usePrinterStore.getState()
      expect(state.printers).toEqual(mockPrinters)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  it('should display loading state while config is being fetched', async () => {
    // Create a never-resolving promise to hold the loading state
    let resolveConfig: (value: AppConfig) => void
    vi.mocked(ipc.getConfig).mockImplementation(
      () => new Promise((resolve) => { resolveConfig = resolve })
    )
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    expect(screen.getByText('Cargando configuración...')).toBeInTheDocument()

    // Resolve to clean up
    resolveConfig!(mockConfig)
    await waitFor(() => {
      expect(screen.queryByText('Cargando configuración...')).not.toBeInTheDocument()
    })
  })

  it('should display error state when config load fails', async () => {
    vi.mocked(ipc.getConfig).mockRejectedValue(new Error('Connection refused'))
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar la aplicación')).toBeInTheDocument()
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  it('should render main content after successful load', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('should subscribe to config changes from main process', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      expect(ipc.onConfigChange).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  it('should have kiosko store initialized with zero quantities', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      expect(useConfigStore.getState().config).not.toBeNull()
    })

    // Kiosko store starts with zero quantities (no IPC load needed)
    const kioskoState = useKioskoStore.getState()
    expect(kioskoState.quantities.tarifaAS1).toBe(0)
    expect(kioskoState.quantities.tarifaA2S1).toBe(0)
    expect(kioskoState.quantities.tarifaBS1).toBe(0)
    expect(kioskoState.quantities.tarifaCS1).toBe(0)
    expect(kioskoState.quantities.tarifaAT1).toBe(0)
    expect(kioskoState.quantities.tarifa4T1).toBe(0)
    expect(kioskoState.quantities.tarifaAS2).toBe(0)
    expect(kioskoState.quantities.tarifaA2S2).toBe(0)
    expect(kioskoState.quantities.tarifaBS2).toBe(0)
    expect(kioskoState.quantities.tarifaCS2).toBe(0)
    expect(kioskoState.quantities.tarifaAT2).toBe(0)
    expect(kioskoState.quantities.tarifa4T2).toBe(0)
  })

  it('should have orders store in clean initial state', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      expect(useConfigStore.getState().config).not.toBeNull()
    })

    const ordersState = useOrdersStore.getState()
    expect(ordersState.loading).toBe(false)
    expect(ordersState.error).toBeNull()
    expect(ordersState.lastInserted).toEqual([])
  })

  it('should allow kiosko store to compute totals after config is loaded', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockResolvedValue(mockPrinters)

    render(<App />)

    await waitFor(() => {
      expect(useConfigStore.getState().config).not.toBeNull()
    })

    const config = useConfigStore.getState().config!
    const kiosko = useKioskoStore.getState()

    // With zero quantities, total should be 0
    expect(kiosko.getTotal(config.precios)).toBe(0)

    // Limits should be positive (budget available)
    const limits = kiosko.getLimits(config.precios, config.ticket, config.sello)
    expect(limits.limiteAS1).toBeGreaterThan(0)
    expect(limits.limiteAS2).toBeGreaterThan(0)
    expect(limits.limiteBS1).toBeGreaterThan(0)
    expect(limits.limiteBS2).toBeGreaterThan(0)
  })

  it('should handle printer status load failure gracefully', async () => {
    vi.mocked(ipc.getConfig).mockResolvedValue(mockConfig)
    vi.mocked(ipc.getPrinterStatus).mockRejectedValue(new Error('No printers found'))

    render(<App />)

    // App should still render even if printer status fails
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    // Config loads fine
    expect(useConfigStore.getState().config).toEqual(mockConfig)

    // Printer store has error but doesn't block app
    const printerState = usePrinterStore.getState()
    expect(printerState.error).toBe('No printers found')
    expect(printerState.printers).toEqual([])
  })
})
