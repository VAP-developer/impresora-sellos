/**
 * TariffTable.test.tsx
 *
 * Component tests for TariffTable, verifying:
 * - Renders all 6 tariff rows (Tarifa A Tira 4, Tira 4 Tarifas, A, A2, B, C)
 * - Displays correct prices from config
 * - Displays correct limits from calculations
 * - Handles quantity input changes (updates store)
 * - Shows correct subtotals (quantity × price)
 * - Renders header row with column labels
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4
 * Correctness Properties: 1, 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TariffTable from '../TariffTable'

// Mock ipc-client
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

import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { AppConfig } from '@renderer/types/config'

function buildTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    ticket: {
      feria: 'Test Feria',
      lugar: 'Test Place',
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
      empresa: 'Test S.A.',
      cif: 'A12345678',
      cp: '28001 Madrid',
      l1: 'Line 1',
      l2: 'Line 2',
      l3: 'Line 3',
      ...overrides?.ticket
    },
    codigo: {
      modo: 'P',
      mes: 0,
      annio: 'auto',
      pais: 'ES',
      maquina: 'CH17',
      cliente: 1,
      producto: 1,
      ...overrides?.codigo
    },
    sello: {
      elperfil: 6,
      elnperfil: 'FERIA',
      elevento: 0,
      elnevento: 'Test Event',
      feria: 'Test Feria',
      lugar: 'Test Place',
      modelo1: 'modelo1',
      modelo2: 'modelo2',
      modo: 0,
      nperfil1: 'Filatelia',
      nperfil2: 'Esporadicos',
      nperfil3: 'SPDE',
      nperfil4: '',
      nperfil5: 'Abono/Envio',
      nperfil6: 'FERIA',
      eventos: [],
      ...overrides?.sello
    },
    precios: {
      tarifaA: 0.5,
      tarifaA2: 0.6,
      tarifaB: 1.25,
      tarifaC: 1.35,
      tarifaTA: 2.0,
      tarifaT4: 3.7,
      ...overrides?.precios
    }
  }
}

function setConfig(config: AppConfig): void {
  useConfigStore.setState({ config, loading: false, error: null })
}

describe('TariffTable – Rendering (Task 7.11)', () => {
  beforeEach(() => {
    useKioskoStore.getState().reset()
  })

  describe('Row rendering – all tariffs present', () => {
    it('renders all 6 tariff rows', () => {
      setConfig(buildTestConfig())
      render(<TariffTable />)

      expect(screen.getByRole('row', { name: /Fila tarifa Tarifa A Tira 4/i })).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /Fila tarifa Tira de 4 Tarifas/i })).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /Fila tarifa Tarifa A$/i })).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /Fila tarifa Tarifa A2/i })).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /Fila tarifa Tarifa B/i })).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /Fila tarifa Tarifa C/i })).toBeInTheDocument()
    })

    it('renders the header row with column labels', () => {
      setConfig(buildTestConfig())
      render(<TariffTable />)

      const header = screen.getByRole('row', { name: /Encabezado tabla tarifas/i })
      expect(header).toHaveTextContent('Subtotal')
      expect(header).toHaveTextContent('Límite')
      expect(header).toHaveTextContent('Cantidad')
      expect(header).toHaveTextContent('Modalidad')
      expect(header).toHaveTextContent('Precio')
    })

    it('renders the table with accessible role', () => {
      setConfig(buildTestConfig())
      render(<TariffTable />)

      expect(screen.getByRole('table', { name: 'Tabla de tarifas' })).toBeInTheDocument()
    })
  })

  describe('Price display – Req 1.1', () => {
    it('displays correct prices from config for each tariff', () => {
      setConfig(buildTestConfig({
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))
      render(<TariffTable />)

      expect(screen.getByText('0.50€')).toBeInTheDocument()
      expect(screen.getByText('0.60€')).toBeInTheDocument()
      expect(screen.getByText('1.25€')).toBeInTheDocument()
      expect(screen.getByText('1.35€')).toBeInTheDocument()
      expect(screen.getByText('2.00€')).toBeInTheDocument()
      expect(screen.getByText('3.70€')).toBeInTheDocument()
    })

    it('displays 0.00€ when config is not loaded', () => {
      useConfigStore.setState({ config: null, loading: false, error: null })
      render(<TariffTable />)

      const zeroPrices = screen.getAllByText('0.00€')
      expect(zeroPrices.length).toBe(6) // 6 tariff rows
    })
  })

  describe('Limits display – Req 2.1, 2.2, 2.3, 2.4', () => {
    it('displays correct limits for simple tariffs based on budget and roll stock', () => {
      // With limiteImporte=10, tarifaA=0.50, rollo1=1500
      // limit = min(floor(10/0.50), 1500) = min(20, 1500) = 20
      setConfig(buildTestConfig({
        ticket: {
          limiteImporte: 10,
          rollo1: 1500,
          rollo2: 1500,
          tickets: 450
        } as AppConfig['ticket'],
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))
      render(<TariffTable />)

      // Tarifa A limit: min(floor(10/0.50), 1500) = 20
      const tarifaARow = screen.getByRole('row', { name: /Fila tarifa Tarifa A$/i })
      expect(tarifaARow).toHaveTextContent('20')
    })

    it('displays 0 limits when config is null', () => {
      useConfigStore.setState({ config: null, loading: false, error: null })
      render(<TariffTable />)

      // All limit cells should show 0
      const limitLabels = screen.getAllByLabelText(/Límite modelo [12]: 0/)
      expect(limitLabels.length).toBeGreaterThan(0)
    })

    it('updates limits when quantities change (Req 2.3)', () => {
      setConfig(buildTestConfig({
        ticket: {
          limiteImporte: 10,
          rollo1: 100,
          rollo2: 100,
          tickets: 50
        } as AppConfig['ticket'],
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))

      // Add some quantity to reduce budget remaining
      useKioskoStore.getState().setQuantity('tarifaAS1', 10) // 10*0.50 = 5€ used

      render(<TariffTable />)

      // Remaining budget = 10 - 5 = 5€
      // New limit for Tarifa A model1: min(floor(5/0.50), 100-10) = min(10, 90) = 10
      const inputA1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      expect(inputA1).toHaveValue(10)

      // Limit for Tarifa B model1: min(floor(5/1.25), 100-10) = min(4, 90) = 4
      const tarifaBRow = screen.getByRole('row', { name: /Fila tarifa Tarifa B/i })
      expect(tarifaBRow).toHaveTextContent('4')
    })

    it('limits for tiras account for tickets and roll/4 (Req 2.2)', () => {
      // With limiteImporte=20, tarifaTA=2.00, rollo1=100, tickets=450
      // Tira limit = min(floor(20/2.00), 450-2, floor(100/4)) = min(10, 448, 25) = 10
      setConfig(buildTestConfig({
        ticket: {
          limiteImporte: 20,
          rollo1: 100,
          rollo2: 100,
          tickets: 450
        } as AppConfig['ticket'],
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))

      render(<TariffTable />)

      // Tira A limit = min(floor(20/2.0), 448, floor(100/4)) = min(10, 448, 25) = 10
      const tiraARow = screen.getByRole('row', { name: /Fila tarifa Tarifa A Tira 4/i })
      expect(tiraARow).toHaveTextContent('10')
    })

    it('limits for tiras constrained by low ticket stock', () => {
      // tickets=4, so ticketsAvailable = 4-2 = 2
      // Tira limit = min(floor(399.99/2.00), 2, floor(1500/4)) = min(199, 2, 375) = 2
      setConfig(buildTestConfig({
        ticket: {
          limiteImporte: 399.99,
          rollo1: 1500,
          rollo2: 1500,
          tickets: 4
        } as AppConfig['ticket']
      }))

      render(<TariffTable />)

      const tiraARow = screen.getByRole('row', { name: /Fila tarifa Tarifa A Tira 4/i })
      expect(tiraARow).toHaveTextContent('2')
    })
  })

  describe('Subtotals – Req 1.1', () => {
    it('displays subtotal as quantity × price for each tariff/model', () => {
      setConfig(buildTestConfig({
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))

      // Set 3 Tarifa A model 1 → subtotal = 3 * 0.50 = 1.50
      useKioskoStore.getState().setQuantity('tarifaAS1', 3)

      render(<TariffTable />)

      expect(screen.getByLabelText('Subtotal modelo 1: 1.50€')).toBeInTheDocument()
    })

    it('displays 0.00 subtotal when quantity is 0', () => {
      setConfig(buildTestConfig())
      render(<TariffTable />)

      // All subtotals should be 0.00
      const subtotals = screen.getAllByText('0.00 €')
      expect(subtotals.length).toBe(12) // 6 tariffs × 2 models
    })

    it('updates subtotal when quantity changes', () => {
      setConfig(buildTestConfig({
        precios: {
          tarifaA: 0.5,
          tarifaA2: 0.6,
          tarifaB: 1.25,
          tarifaC: 1.35,
          tarifaTA: 2.0,
          tarifaT4: 3.7
        }
      }))

      // Set 5 Tarifa B model 2 → subtotal = 5 * 1.25 = 6.25
      useKioskoStore.getState().setQuantity('tarifaBS2', 5)

      render(<TariffTable />)

      expect(screen.getByLabelText('Subtotal modelo 2: 6.25€')).toBeInTheDocument()
    })
  })

  describe('Quantity inputs – interaction', () => {
    it('renders quantity inputs for both models with initial value 0', () => {
      setConfig(buildTestConfig())
      render(<TariffTable />)

      const inputs = screen.getAllByRole('spinbutton')
      // 6 tariffs × 2 models = 12 inputs
      expect(inputs).toHaveLength(12)
      inputs.forEach((input) => {
        expect(input).toHaveValue(0)
      })
    })

    it('updates store when user types a quantity', async () => {
      const user = userEvent.setup()
      setConfig(buildTestConfig())
      render(<TariffTable />)

      const inputA1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(inputA1)
      await user.type(inputA1, '5')

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(5)
    })

    it('updates store for model 2 quantity input', async () => {
      const user = userEvent.setup()
      setConfig(buildTestConfig())
      render(<TariffTable />)

      const inputB2 = screen.getByLabelText('Cantidad Tarifa B modelo 2')
      await user.clear(inputB2)
      await user.type(inputB2, '7')

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaBS2).toBe(7)
    })

    it('normalizes negative values to 0 (Req 1.6)', async () => {
      const user = userEvent.setup()
      setConfig(buildTestConfig())
      render(<TariffTable />)

      // Directly set a negative value through the store to test normalization
      useKioskoStore.getState().setQuantity('tarifaAS1', -5)

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
    })
  })
})
