/**
 * CartControls.test.tsx
 *
 * Unit tests for CartControls component, specifically verifying the
 * "Imprimir Normal" button logic:
 * - Validates total doesn't exceed limiteImporte (Req 1.3, 1.4)
 * - Validates stock availability (Req 4.5)
 * - Resets quantities after successful sale (Req 1.5)
 * - Shows error messages when validation fails
 * - Calls IPC print on valid sale
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartControls from '../CartControls'

// Mock ipc-client
const mockPrint = vi.fn()
const mockUpdateSesionError = vi.fn()
const mockUpdateRollosRevert = vi.fn()
const mockInsertOrders = vi.fn()
const mockCancelSale = vi.fn()
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
  triggerSync: vi.fn(),
  cancelSale: (...args: unknown[]) => mockCancelSale(...args),
  executeSale: vi.fn()
}))

// Mock stores - we need to control their state
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import type { AppConfig } from '@renderer/types/config'

// Build a valid test config
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

describe('CartControls – Imprimir Normal (Task 7.6)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrint.mockResolvedValue(undefined)
    mockUpdateSesionError.mockResolvedValue(undefined)
    mockUpdateRollosRevert.mockResolvedValue(undefined)
    mockInsertOrders.mockResolvedValue(undefined)
    mockCancelSale.mockResolvedValue({ success: true, sesionId: 1 })
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Reset stores to clean state
    useKioskoStore.getState().reset()
    useKioskoStore.getState().clearLastSale()
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  /**
   * Set config store state directly for testing
   */
  function setConfig(config: AppConfig): void {
    useConfigStore.setState({ config, loading: false, error: null })
  }

  describe('Validation – Req 1.3, 1.4: Total must not exceed limiteImporte', () => {
    it('rejects sale when total exceeds limit and shows error message', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({ ticket: { limiteImporte: 10 } as AppConfig['ticket'] })
      setConfig(config)

      // Set quantities that exceed the 10€ limit
      // 30 stamps at 0.50€ each = 15€ > 10€
      useKioskoStore.getState().setQuantity('tarifaAS1', 30)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Ha excedido el límite de compra')
        )
      })

      // IPC print should NOT have been called
      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('accepts sale when total is exactly at limit', async () => {
      const user = userEvent.setup()
      // 2 stamps at 0.50€ = 1.00€, limit = 1.00€
      const config = buildTestConfig({
        ticket: {
          limiteImporte: 1.0,
          rollo1: 100,
          rollo2: 100,
          tickets: 100
        } as AppConfig['ticket']
      })
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 2)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      expect(alertSpy).not.toHaveBeenCalled()
    })
  })

  describe('Validation – Req 4.5: Stock availability', () => {
    it('rejects sale when rollo1 stock is insufficient', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 5, rollo2: 1500, tickets: 450 } as AppConfig['ticket']
      })
      setConfig(config)

      // Request 10 stamps from model 1, but only 5 available
      useKioskoStore.getState().setQuantity('tarifaAS1', 10)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes sellos del primer motivo')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('rejects sale when rollo2 stock is insufficient', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 1500, rollo2: 3, tickets: 450 } as AppConfig['ticket']
      })
      setConfig(config)

      // Request 10 stamps from model 2, but only 3 available
      useKioskoStore.getState().setQuantity('tarifaAS2', 10)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes sellos del segundo motivo')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('rejects sale when ticket stock is insufficient for tiras', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 1500, rollo2: 1500, tickets: 2 } as AppConfig['ticket']
      })
      setConfig(config)

      // Request 1 tira which needs 2+1 = 3 tickets, but only 2 available
      useKioskoStore.getState().setQuantity('tarifaAT1', 1)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes tickets')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })
  })

  describe('Successful sale – Req 1.5: Reset after sale', () => {
    it('calls IPC print with correct arguments on valid sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 2)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
        expect(mockPrint).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ tarifaAS1: 2 }),
          'normal'
        )
      })
    })

    it('resets all quantities to zero after successful sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 5)
      useKioskoStore.getState().setQuantity('tarifaBS2', 3)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // After successful sale, quantities should be reset
      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
      expect(state.quantities.tarifaBS2).toBe(0)
    })

    it('records last sale consumption for error reversal', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      // 5 simple + 2 tiras (2*4=8) = 13 stamps from rollo1
      useKioskoStore.getState().setQuantity('tarifaAS1', 5)
      useKioskoStore.getState().setQuantity('tarifaAT1', 2)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      // sellos1 = 5 + 2*4 = 13
      expect(state.lastSale.sellos1).toBe(13)
      expect(state.lastSale.sellos2).toBe(0)
      // tickets = 2 + usedTickets (2 tiras) = 4
      expect(state.lastSale.tickets).toBe(4)
    })
  })

  describe('Empty basket behavior', () => {
    it('silently rejects when basket is empty (no alert)', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      // All quantities at 0 (default)
      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      // Should not show alert for empty basket
      expect(alertSpy).not.toHaveBeenCalled()
      // Should not call print
      expect(mockPrint).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('shows error message when IPC print fails', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      mockPrint.mockRejectedValueOnce(new Error('Printer error'))
      useKioskoStore.getState().setQuantity('tarifaAS1', 2)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al procesar la impresión')
      })
    })

    it('does not reset quantities when IPC print fails', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      mockPrint.mockRejectedValueOnce(new Error('Printer error'))
      useKioskoStore.getState().setQuantity('tarifaAS1', 5)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled()
      })

      // Quantities should NOT be reset on failure
      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(5)
    })

    it('rejects sale when client ID exceeds 9999', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        codigo: { cliente: 10000 } as AppConfig['codigo']
      })
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Límite de ID Cliente')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })
  })

  describe('UI state during print', () => {
    it('disables print button while printing is in progress', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      // Make print hang
      let resolvePrint: () => void
      mockPrint.mockImplementation(
        () => new Promise<void>((resolve) => { resolvePrint = resolve })
      )

      useKioskoStore.getState().setQuantity('tarifaAS1', 2)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      // Button should be disabled while printing
      await waitFor(() => {
        expect(printBtn).toBeDisabled()
      })

      // Resolve the print promise
      await act(async () => {
        resolvePrint!()
      })

      // Button should re-enable after print completes
      await waitFor(() => {
        expect(printBtn).not.toBeDisabled()
      })
    })
  })

  describe('Profile-based limit – Property 14', () => {
    it('uses limiteImporte for profile 6 (FERIA)', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: {
          limiteImporte: 5.0,
          NUEVOlimiteImporte: 100.0,
          rollo1: 1500,
          rollo2: 1500,
          tickets: 450
        } as AppConfig['ticket'],
        sello: { elperfil: 6 } as AppConfig['sello']
      })
      setConfig(config)

      // 12 stamps at 0.50€ = 6€ > 5€ (limiteImporte for FERIA)
      useKioskoStore.getState().setQuantity('tarifaAS1', 12)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Ha excedido el límite de compra de 5€')
        )
      })
    })

    it('uses NUEVOlimiteImporte for non-FERIA profiles', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: {
          limiteImporte: 5.0,
          NUEVOlimiteImporte: 10.0,
          rollo1: 1500,
          rollo2: 1500,
          tickets: 450
        } as AppConfig['ticket'],
        sello: { elperfil: 1 } as AppConfig['sello']
      })
      setConfig(config)

      // 12 stamps at 0.50€ = 6€ > 5€ (limiteImporte) but < 10€ (NUEVOlimiteImporte)
      // Since profile is 1 (not FERIA), it should use NUEVOlimiteImporte = 10€
      useKioskoStore.getState().setQuantity('tarifaAS1', 12)

      render(<CartControls />)

      const printBtn = screen.getByLabelText('Imprimir normal - confirmar venta')
      await user.click(printBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      // No alert should be shown
      expect(alertSpy).not.toHaveBeenCalled()
    })
  })
})

describe('CartControls – Error Impresión (Task 7.7)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrint.mockResolvedValue(undefined)
    mockUpdateSesionError.mockResolvedValue(undefined)
    mockUpdateRollosRevert.mockResolvedValue(undefined)
    mockInsertOrders.mockResolvedValue(undefined)
    mockCancelSale.mockResolvedValue({ success: true, sesionId: 1 })
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Reset stores to clean state
    useKioskoStore.getState().reset()
    useKioskoStore.getState().clearLastSale()
  })

  afterEach(() => {
    alertSpy.mockRestore()
    confirmSpy.mockRestore()
  })

  function setConfig(config: AppConfig): void {
    useConfigStore.setState({ config, loading: false, error: null })
  }

  describe('Req 10.1: Confirmation before proceeding', () => {
    it('asks for confirmation before cancelling last sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 3, 4)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      expect(confirmSpy).toHaveBeenCalledWith(
        '¿Error de IMPRESIÓN? ¡Se procederá a ANULAR la VENTA ANTERIOR!'
      )
    })

    it('does not proceed when confirmation is cancelled', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 3, 4)
      confirmSpy.mockReturnValue(false)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      expect(mockCancelSale).not.toHaveBeenCalled()
    })
  })

  describe('Req 10.5: Reject when no previous sale exists', () => {
    it('shows alert when no previous sale to revert', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      // lastSale is at defaults (0, 0, 0) — no previous sale

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('¡¡NINGUNA venta encontrada!!')
      })

      expect(mockCancelSale).not.toHaveBeenCalled()
    })
  })

  describe('Req 10.2: Revert session increment', () => {
    it('calls cancelSale with correct sellos1/sellos2/tickets', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(10, 5, 4)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(mockCancelSale).toHaveBeenCalledTimes(1)
        expect(mockCancelSale).toHaveBeenCalledWith({
          sellos1: 10,
          sellos2: 5,
          tickets: 4
        })
      })
    })
  })

  describe('Req 10.3: Restore roll and ticket quantities', () => {
    it('calls cancelSale with last sale quantities', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(13, 8, 6)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(mockCancelSale).toHaveBeenCalledWith({
          sellos1: 13,
          sellos2: 8,
          tickets: 6
        })
      })
    })
  })

  describe('Req 10.4: Insert audit order record', () => {
    it('calls cancelSale which atomically inserts audit record', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 3, 4)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(mockCancelSale).toHaveBeenCalledTimes(1)
        expect(mockCancelSale).toHaveBeenCalledWith({
          sellos1: 5,
          sellos2: 3,
          tickets: 4
        })
      })
    })
  })

  describe('State cleanup after successful reversal', () => {
    it('clears lastSale record after successful reversal', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(10, 5, 4)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(mockCancelSale).toHaveBeenCalled()
      })

      const state = useKioskoStore.getState()
      expect(state.lastSale.sellos1).toBe(0)
      expect(state.lastSale.sellos2).toBe(0)
      expect(state.lastSale.tickets).toBe(0)
    })

    it('resets quantities after successful reversal', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 0, 4)
      useKioskoStore.getState().setQuantity('tarifaAS1', 3)

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(mockCancelSale).toHaveBeenCalled()
      })

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('shows error alert when IPC call fails', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 3, 4)
      mockCancelSale.mockRejectedValueOnce(new Error('IPC error'))

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al anular la venta')
      })
    })

    it('disables error button while processing', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)
      useKioskoStore.getState().recordLastSale(5, 3, 4)

      let resolveCancel: (value: { success: true; sesionId: number }) => void
      mockCancelSale.mockImplementation(
        () => new Promise<{ success: true; sesionId: number }>((resolve) => { resolveCancel = resolve })
      )

      render(<CartControls />)

      const errorBtn = screen.getByLabelText('Error impresión - anular última venta')
      await user.click(errorBtn)

      await waitFor(() => {
        expect(errorBtn).toBeDisabled()
      })

      await act(async () => {
        resolveCancel!({ success: true, sesionId: 1 })
      })

      await waitFor(() => {
        expect(errorBtn).not.toBeDisabled()
      })
    })
  })
})

describe('CartControls – Profile Buttons: Filatelia, Protocolo, SPDE (Task 7.8)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrint.mockResolvedValue(undefined)
    mockUpdateSesionError.mockResolvedValue(undefined)
    mockUpdateRollosRevert.mockResolvedValue(undefined)
    mockInsertOrders.mockResolvedValue(undefined)
    mockCancelSale.mockResolvedValue({ success: true, sesionId: 1 })
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Reset stores to clean state
    useKioskoStore.getState().reset()
    useKioskoStore.getState().clearLastSale()
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  function setConfig(config: AppConfig): void {
    useConfigStore.setState({ config, loading: false, error: null })
  }

  describe('Filatelia button – Req 7.3', () => {
    it('calls IPC print with profile "filatelia" on valid sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 2)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
        expect(mockPrint).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ tarifaAS1: 2 }),
          'filatelia'
        )
      })
    })

    it('resets quantities after successful filatelia sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaBS1', 3)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaBS1).toBe(0)
    })

    it('validates sale before printing with filatelia profile', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({ ticket: { limiteImporte: 1 } as AppConfig['ticket'] })
      setConfig(config)

      // Total will exceed limit (10 * 0.50 = 5.00 > 1)
      useKioskoStore.getState().setQuantity('tarifaAS1', 10)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Ha excedido el límite de compra')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('does nothing when basket is empty', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      expect(mockPrint).not.toHaveBeenCalled()
      expect(alertSpy).not.toHaveBeenCalled()
    })

    it('records last sale for error reversal', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 3)
      useKioskoStore.getState().setQuantity('tarifaAS2', 2)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      expect(state.lastSale.sellos1).toBe(3)
      expect(state.lastSale.sellos2).toBe(2)
    })

    it('is disabled while printing is in progress', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      let resolvePrint: () => void
      mockPrint.mockImplementation(
        () => new Promise<void>((resolve) => { resolvePrint = resolve })
      )

      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      render(<CartControls />)

      const filateliaBtn = screen.getByLabelText('Imprimir Filatelia')
      await user.click(filateliaBtn)

      await waitFor(() => {
        expect(filateliaBtn).toBeDisabled()
      })

      await act(async () => {
        resolvePrint!()
      })

      await waitFor(() => {
        expect(filateliaBtn).not.toBeDisabled()
      })
    })
  })

  describe('Protocolo button – Req 7.4', () => {
    it('calls IPC print with profile "protocolo" on valid sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaA2S1', 4)

      render(<CartControls />)

      const protocoloBtn = screen.getByLabelText('Imprimir Protocolo')
      await user.click(protocoloBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
        expect(mockPrint).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ tarifaA2S1: 4 }),
          'protocolo'
        )
      })
    })

    it('resets quantities after successful protocolo sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaCS2', 5)

      render(<CartControls />)

      const protocoloBtn = screen.getByLabelText('Imprimir Protocolo')
      await user.click(protocoloBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaCS2).toBe(0)
    })

    it('validates sale before printing with protocolo profile', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 2, rollo2: 1500, tickets: 450 } as AppConfig['ticket']
      })
      setConfig(config)

      // Request 5 stamps from rollo1 but only 2 available
      useKioskoStore.getState().setQuantity('tarifaAS1', 5)

      render(<CartControls />)

      const protocoloBtn = screen.getByLabelText('Imprimir Protocolo')
      await user.click(protocoloBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes sellos del primer motivo')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('does nothing when basket is empty', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      render(<CartControls />)

      const protocoloBtn = screen.getByLabelText('Imprimir Protocolo')
      await user.click(protocoloBtn)

      expect(mockPrint).not.toHaveBeenCalled()
      expect(alertSpy).not.toHaveBeenCalled()
    })
  })

  describe('SPDE button – Req 7.5', () => {
    it('calls IPC print with profile "spde" on valid sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaBS2', 3)

      render(<CartControls />)

      const spdeBtn = screen.getByLabelText('Imprimir SPDE')
      await user.click(spdeBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
        expect(mockPrint).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ tarifaBS2: 3 }),
          'spde'
        )
      })
    })

    it('resets quantities after successful SPDE sale', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAT2', 2)

      render(<CartControls />)

      const spdeBtn = screen.getByLabelText('Imprimir SPDE')
      await user.click(spdeBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAT2).toBe(0)
    })

    it('validates sale before printing with SPDE profile', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        ticket: { rollo1: 1500, rollo2: 1500, tickets: 2 } as AppConfig['ticket']
      })
      setConfig(config)

      // Request tira which needs 2+1=3 tickets but only 2 available
      useKioskoStore.getState().setQuantity('tarifaAT1', 1)

      render(<CartControls />)

      const spdeBtn = screen.getByLabelText('Imprimir SPDE')
      await user.click(spdeBtn)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('No hay suficientes tickets')
        )
      })

      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('does nothing when basket is empty', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      render(<CartControls />)

      const spdeBtn = screen.getByLabelText('Imprimir SPDE')
      await user.click(spdeBtn)

      expect(mockPrint).not.toHaveBeenCalled()
      expect(alertSpy).not.toHaveBeenCalled()
    })

    it('records last sale for error reversal', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAT1', 2)
      useKioskoStore.getState().setQuantity('tarifa4T2', 1)

      render(<CartControls />)

      const spdeBtn = screen.getByLabelText('Imprimir SPDE')
      await user.click(spdeBtn)

      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledTimes(1)
      })

      const state = useKioskoStore.getState()
      // sellos1 = 2*4 = 8 (tiras from model 1)
      expect(state.lastSale.sellos1).toBe(8)
      // sellos2 = 1*4 = 4 (tira 4 tarifas from model 2)
      expect(state.lastSale.sellos2).toBe(4)
      // tickets = 2 + usedTickets (2 + 1 = 3)
      expect(state.lastSale.tickets).toBe(5)
    })
  })

  describe('All profile buttons share same validation logic', () => {
    it('all profile buttons reject when client ID exceeds 9999', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig({
        codigo: { cliente: 10000 } as AppConfig['codigo']
      })
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      render(<CartControls />)

      // Filatelia
      await user.click(screen.getByLabelText('Imprimir Filatelia'))
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Límite de ID Cliente')
        )
      })
      expect(mockPrint).not.toHaveBeenCalled()

      alertSpy.mockClear()

      // Protocolo
      await user.click(screen.getByLabelText('Imprimir Protocolo'))
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Límite de ID Cliente')
        )
      })
      expect(mockPrint).not.toHaveBeenCalled()

      alertSpy.mockClear()

      // SPDE
      await user.click(screen.getByLabelText('Imprimir SPDE'))
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Límite de ID Cliente')
        )
      })
      expect(mockPrint).not.toHaveBeenCalled()
    })

    it('profile buttons pass different profile strings to IPC print', async () => {
      const user = userEvent.setup()
      const config = buildTestConfig()
      setConfig(config)

      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      render(<CartControls />)

      // Click Filatelia
      await user.click(screen.getByLabelText('Imprimir Filatelia'))
      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'filatelia')
      })

      mockPrint.mockClear()
      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      // Click Protocolo
      await user.click(screen.getByLabelText('Imprimir Protocolo'))
      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'protocolo')
      })

      mockPrint.mockClear()
      useKioskoStore.getState().setQuantity('tarifaAS1', 1)

      // Click SPDE
      await user.click(screen.getByLabelText('Imprimir SPDE'))
      await waitFor(() => {
        expect(mockPrint).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'spde')
      })
    })
  })
})
