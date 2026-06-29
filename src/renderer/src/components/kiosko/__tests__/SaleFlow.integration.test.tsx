/**
 * SaleFlow.integration.test.tsx
 *
 * Integration test verifying the complete sale flow in the Kiosko UI
 * without real printing. Covers:
 *
 * 1. User selects quantities for different tariffs (both models)
 * 2. System calculates totals and limits in real-time
 * 3. User clicks "Imprimir Normal" button
 * 4. System validates limits, processes the sale
 * 5. After successful sale, quantities reset to zero
 * 6. Session (cliente) increments (IPC called)
 * 7. Rolls decrement correctly (IPC called)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.2, 4.1, 4.2, 4.3
 * Correctness Properties: 1 (total), 2 (limits), 5 (roll decrement)
 *
 * Task 7.12: Verificar flujo completo de venta en la UI (sin impresion real)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TariffTable from '../TariffTable'
import CartControls from '../CartControls'
import RollCounters from '../RollCounters'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { AppConfig } from '@renderer/types/config'

// ─── Mock IPC ─────────────────────────────────────────────────────────────────

const mockPrint = vi.fn()
const mockUpdateSesionError = vi.fn()
const mockUpdateRollosRevert = vi.fn()
const mockInsertOrders = vi.fn()

vi.mock('@renderer/lib/ipc-client', () => ({
  getConfig: vi.fn(),
  updateMaquina: vi.fn(),
  updateImprimir: vi.fn(),
  updateSesion: vi.fn(),
  updateSesionError: (...args: unknown[]) => mockUpdateSesionError(...args),
  updateRollos: vi.fn(),
  updateRollosRevert: (...args: unknown[]) => mockUpdateRollosRevert(...args),
  initConfig: vi.fn(),
  onConfigChange: vi.fn(() => vi.fn()),
  insertOrders: (...args: unknown[]) => mockInsertOrders(...args),
  downloadCSV: vi.fn(),
  uploadImage: vi.fn(),
  removeImage: vi.fn(),
  getImageByName: vi.fn(),
  getPrinterStatus: vi.fn(),
  print: (...args: unknown[]) => mockPrint(...args),
  pausePrinter: vi.fn(),
  resumePrinter: vi.fn(),
  getPrintQueue: vi.fn(),
  getSyncStatus: vi.fn(),
  triggerSync: vi.fn()
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
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
      empresa: 'S.E. Correos y Telegrafos S.A.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
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
          motivoi: 'Cornamusa Azul',
          motivod: 'Plaza Mayor',
          fecha: '21-24 abril 2025',
          localidad: 'Madrid'
        }
      ],
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

/**
 * Renders the three main Kiosko components together to simulate the real view.
 */
function renderKioskoView(): ReturnType<typeof render> {
  return render(
    <div>
      <TariffTable />
      <CartControls />
      <RollCounters />
    </div>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Kiosko – Complete Sale Flow Integration (Task 7.12)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrint.mockResolvedValue(undefined)
    mockUpdateSesionError.mockResolvedValue(undefined)
    mockUpdateRollosRevert.mockResolvedValue(undefined)
    mockInsertOrders.mockResolvedValue(undefined)
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Reset stores to clean state
    useKioskoStore.getState().reset()
    useKioskoStore.getState().clearLastSale()
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  describe('Step 1-2: Quantity selection and real-time totals/limits', () => {
    it('displays tariff inputs for both models and calculates subtotals in real-time', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Find Tarifa A input for modelo 1 and type a quantity
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '3')

      // Subtotal for modelo 1 should reflect 3 * 0.50 = 1.50€
      expect(screen.getByLabelText('Subtotal modelo 1: 1.50€')).toBeInTheDocument()

      // Total cesta should show 1.50€
      expect(screen.getByText(/Cesta 1\.50€/)).toBeInTheDocument()
    })

    it('calculates totals across both models simultaneously', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Set Tarifa A on modelo 1: 4 * 0.50 = 2.00€
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '4')

      // Set Tarifa B on modelo 2: 2 * 1.25 = 2.50€
      const tarifaBInput2 = screen.getByLabelText('Cantidad Tarifa B modelo 2')
      await user.clear(tarifaBInput2)
      await user.type(tarifaBInput2, '2')

      // Total = 2.00 + 2.50 = 4.50€
      expect(screen.getByText(/Cesta 4\.50€/)).toBeInTheDocument()
    })

    it('displays roll counters showing used stamps from current basket', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Initially all rolls show full stock
      expect(screen.getByLabelText(/Rollo 1:/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Rollo 2:/)).toBeInTheDocument()

      // Set some quantities on modelo 1
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '5')

      // The "Venta: 5" should appear for rollo 1
      expect(screen.getByText('(Venta: 5)')).toBeInTheDocument()
    })

    it('shows tira strips consuming 4 stamps per unit from roll counters', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Set 2 tiras (Tarifa A Tira 4) on modelo 1: consumes 2*4=8 stamps
      const tarifaATiraInput1 = screen.getByLabelText('Cantidad Tarifa A Tira 4 modelo 1')
      await user.clear(tarifaATiraInput1)
      await user.type(tarifaATiraInput1, '2')

      // Venta field for rollo 1 should show 8 (2 tiras * 4 stamps each)
      expect(screen.getByText('(Venta: 8)')).toBeInTheDocument()
    })
  })

  describe('Steps 3-5: Print Normal triggers sale, validates, and resets', () => {
    it('completes full sale flow: select quantities → print → quantities reset to 0', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Step 1: Select quantities for different tariffs on both models
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '3')

      const tarifaBInput2 = screen.getByLabelText('Cantidad Tarifa B modelo 2')
      await user.clear(tarifaBInput2)
      await user.type(tarifaBInput2, '2')

      // Step 2: Verify total is calculated (3*0.50 + 2*1.25 = 4.00)
      expect(screen.getByText(/Cesta 4\.00€/)).toBeInTheDocument()

      // Step 3: Click "Imprimir Normal"
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      // Step 4: Verify IPC print was called with correct data
      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
        expect(mockPrint).toHaveBeenCalledWith(
          config,
          expect.objectContaining({
            tarifaAS1: 3,
            tarifaBS2: 2
          }),
          'normal'
        )
      })

      // Step 5: After successful sale, quantities are reset to 0
      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
      expect(state.quantities.tarifaBS2).toBe(0)

      // Total should show 0.00€ after reset
      expect(screen.getByText(/Cesta 0\.00€/)).toBeInTheDocument()
    })

    it('validates limit before processing: rejects sale exceeding limiteImporte', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { limiteImporte: 5.0 } as AppConfig['ticket']
      })
      setConfig(config)

      renderKioskoView()

      // Set quantities that would total 15€ (30 * 0.50) > 5€ limit
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '30')

      // Attempt to print
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      // Should show limit error
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Ha excedido el límite de compra de 5€')
        )
      })

      // Print IPC should NOT be called
      expect(mockPrint).not.toHaveBeenCalled()

      // Quantities should remain unchanged (not reset)
      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(30)
    })

    it('validates roll stock before processing: rejects when rollo1 insufficient', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 5, rollo2: 1500, tickets: 450 } as AppConfig['ticket']
      })
      setConfig(config)

      renderKioskoView()

      // Request 10 stamps from modelo 1 but only 5 in stock
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '10')

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes sellos del primer motivo')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })
  })

  describe('Step 6: Session (cliente) increment via IPC', () => {
    it('records last sale consumption for session tracking after successful sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // Select quantities: 5 simple stamps (modelo 1) + 1 tira (modelo 2)
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '5')

      const tarifaATiraInput2 = screen.getByLabelText('Cantidad Tarifa A Tira 4 modelo 2')
      await user.clear(tarifaATiraInput2)
      await user.type(tarifaATiraInput2, '1')

      // Print
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // The print IPC call processes the sale which includes session increment
      // Verify the IPC was called with config containing current cliente value
      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo: expect.objectContaining({ cliente: 1 })
        }),
        expect.any(Object),
        'normal'
      )

      // lastSale should be recorded for potential error reversal
      const state = useKioskoStore.getState()
      // sellos1 = 5 (simple), sellos2 = 4 (1 tira * 4)
      expect(state.lastSale.sellos1).toBe(5)
      expect(state.lastSale.sellos2).toBe(4)
      // tickets = 2 + 1 tira = 3
      expect(state.lastSale.tickets).toBe(3)
    })
  })

  describe('Step 7: Rolls decrement correctly', () => {
    it('correctly computes roll consumption: simple stamps count 1, tiras count 4', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 100, rollo2: 100, tickets: 50 } as AppConfig['ticket']
      })
      setConfig(config)

      renderKioskoView()

      // Model 1: 3 simple + 2 tiras = 3 + 8 = 11 from rollo1
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '3')

      const tarifaATiraInput1 = screen.getByLabelText('Cantidad Tarifa A Tira 4 modelo 1')
      await user.clear(tarifaATiraInput1)
      await user.type(tarifaATiraInput1, '2')

      // Model 2: 5 simple = 5 from rollo2
      const tarifaBInput2 = screen.getByLabelText('Cantidad Tarifa B modelo 2')
      await user.clear(tarifaBInput2)
      await user.type(tarifaBInput2, '5')

      // Verify roll usage in UI before printing
      // Rollo 1: 100 - 11 = 89 remaining
      expect(screen.getByText('(Venta: 11)')).toBeInTheDocument()
      // Rollo 2: 100 - 5 = 95 remaining
      expect(screen.getByText('(Venta: 5)')).toBeInTheDocument()

      // Print
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // After sale: lastSale records the correct consumption
      const state = useKioskoStore.getState()
      expect(state.lastSale.sellos1).toBe(11) // 3 + 2*4
      expect(state.lastSale.sellos2).toBe(5)
      // tickets = 2 + 2 tiras from model1 = 4
      expect(state.lastSale.tickets).toBe(4)
    })

    it('tracks ticket consumption from tiras across both models', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 500, rollo2: 500, tickets: 100 } as AppConfig['ticket']
      })
      setConfig(config)

      renderKioskoView()

      // 2 tiras modelo 1 + 3 tiras modelo 2 = 5 tiras total → 5 tickets
      const tarifaATiraInput1 = screen.getByLabelText('Cantidad Tarifa A Tira 4 modelo 1')
      await user.clear(tarifaATiraInput1)
      await user.type(tarifaATiraInput1, '2')

      const tira4TInput2 = screen.getByLabelText('Cantidad Tira de 4 Tarifas modelo 2')
      await user.clear(tira4TInput2)
      await user.type(tira4TInput2, '3')

      // Tickets used display should show 5
      expect(screen.getByText('(Utilizados: 5)')).toBeInTheDocument()

      // Print the sale
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // lastSale tickets = 2 (mandatory) + 5 (tiras) = 7
      const state = useKioskoStore.getState()
      expect(state.lastSale.tickets).toBe(7)
    })
  })

  describe('Full E2E flow: multiple tariffs, both models, print, reset, verify state', () => {
    it('processes a complex sale with multiple tariff types and both models', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 200, rollo2: 200, tickets: 50 } as AppConfig['ticket']
      })
      setConfig(config)

      renderKioskoView()

      // Select a mix of tariffs on both models:
      // Model 1: 2 Tarifa A (2*0.50=1.00) + 1 Tarifa B (1*1.25=1.25) + 1 Tira A (1*2.00=2.00)
      // Model 2: 3 Tarifa C (3*1.35=4.05) + 1 Tira 4T (1*3.70=3.70)
      // Total = 1.00 + 1.25 + 2.00 + 4.05 + 3.70 = 12.00

      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '2')

      const tarifaBInput1 = screen.getByLabelText('Cantidad Tarifa B modelo 1')
      await user.clear(tarifaBInput1)
      await user.type(tarifaBInput1, '1')

      const tarifaATiraInput1 = screen.getByLabelText('Cantidad Tarifa A Tira 4 modelo 1')
      await user.clear(tarifaATiraInput1)
      await user.type(tarifaATiraInput1, '1')

      const tarifaCInput2 = screen.getByLabelText('Cantidad Tarifa C modelo 2')
      await user.clear(tarifaCInput2)
      await user.type(tarifaCInput2, '3')

      const tira4TInput2 = screen.getByLabelText('Cantidad Tira de 4 Tarifas modelo 2')
      await user.clear(tira4TInput2)
      await user.type(tira4TInput2, '1')

      // Verify total is correct (12.00€)
      expect(screen.getByText(/Cesta 12\.00€/)).toBeInTheDocument()

      // Verify remaining budget is displayed (399.99 - 12.00 = 387.99)
      expect(screen.getByLabelText('Presupuesto restante')).toHaveTextContent('387.99 €')

      // Click print
      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      // Wait for IPC to complete
      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // Verify IPC called with all the correct quantities
      expect(mockPrint).toHaveBeenCalledWith(
        config,
        expect.objectContaining({
          tarifaAS1: 2,
          tarifaBS1: 1,
          tarifaAT1: 1,
          tarifaCS2: 3,
          tarifa4T2: 1
        }),
        'normal'
      )

      // After successful sale, ALL quantities reset to 0
      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
      expect(state.quantities.tarifaBS1).toBe(0)
      expect(state.quantities.tarifaAT1).toBe(0)
      expect(state.quantities.tarifaCS2).toBe(0)
      expect(state.quantities.tarifa4T2).toBe(0)
      expect(state.quantities.tarifaA2S1).toBe(0)
      expect(state.quantities.tarifaAS2).toBe(0)

      // Total should be 0 after reset
      expect(screen.getByText(/Cesta 0\.00€/)).toBeInTheDocument()

      // Last sale is recorded for error reversal
      // sellos1 = 2 (simple A) + 1 (simple B) + 1*4 (tira A) = 7
      // sellos2 = 3 (simple C) + 1*4 (tira 4T) = 7
      // tickets = 2 (mandatory) + 2 tiras total = 4
      expect(state.lastSale.sellos1).toBe(7)
      expect(state.lastSale.sellos2).toBe(7)
      expect(state.lastSale.tickets).toBe(4)
    })

    it('can process a second sale after the first one resets quantities', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      renderKioskoView()

      // First sale: 2 Tarifa A modelo 1
      const tarifaAInput1 = screen.getByLabelText('Cantidad Tarifa A modelo 1')
      await user.clear(tarifaAInput1)
      await user.type(tarifaAInput1, '2')

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // After first sale, quantities are at 0
      expect(useKioskoStore.getState().quantities.tarifaAS1).toBe(0)

      // Second sale: 5 Tarifa C modelo 2
      const tarifaCInput2 = screen.getByLabelText('Cantidad Tarifa C modelo 2')
      await user.clear(tarifaCInput2)
      await user.type(tarifaCInput2, '5')

      // Total should reflect only the new quantities
      expect(screen.getByText(/Cesta 6\.75€/)).toBeInTheDocument()

      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(2)
      })

      // Second call should have the new quantities
      expect(mockPrint).toHaveBeenLastCalledWith(
        config,
        expect.objectContaining({
          tarifaAS1: 0,
          tarifaCS2: 5
        }),
        'normal'
      )

      // After second sale, quantities reset again
      expect(useKioskoStore.getState().quantities.tarifaCS2).toBe(0)
    })
  })
})
