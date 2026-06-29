/**
 * CartControls.display.test.tsx
 *
 * Component tests for CartControls UI display and Reset button:
 * - Displays basket total correctly
 * - Displays remaining budget
 * - Shows active profile name
 * - Shows print indicators (master set, copy ticket)
 * - Reset button clears all quantities (Task 7.9)
 * - Pause/Resume button rendering
 *
 * Validates: Requirements 1.2, 2.3, 13.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartControls from '../CartControls'

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
      ImprimeMasterTicket: 'N',
      ImprimeCopiaTicket: 'S',
      TEmod1: 'N',
      TEmod2: 'N',
      T1especial: 0,
      T2especial: 0,
      T3especial: 0,
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

describe('CartControls – Display (Task 7.11)', () => {
  beforeEach(() => {
    useKioskoStore.getState().reset()
    useKioskoStore.getState().clearLastSale()
  })

  describe('Basket total display – Req 1.2', () => {
    it('displays total as 0.00€ when basket is empty', () => {
      setConfig(buildTestConfig())
      render(<CartControls />)

      expect(screen.getByLabelText('Total de la cesta')).toHaveTextContent('Cesta 0.00€')
    })

    it('displays correct total when quantities are set', () => {
      setConfig(buildTestConfig({
        precios: { tarifaA: 0.5, tarifaA2: 0.6, tarifaB: 1.25, tarifaC: 1.35, tarifaTA: 2.0, tarifaT4: 3.7 }
      }))

      // 3 Tarifa A at 0.50€ + 2 Tarifa B at 1.25€ = 1.50 + 2.50 = 4.00
      useKioskoStore.getState().setQuantity('tarifaAS1', 3)
      useKioskoStore.getState().setQuantity('tarifaBS1', 2)

      render(<CartControls />)

      expect(screen.getByLabelText('Total de la cesta')).toHaveTextContent('Cesta 4.00€')
    })

    it('displays total including both models', () => {
      setConfig(buildTestConfig({
        precios: { tarifaA: 0.5, tarifaA2: 0.6, tarifaB: 1.25, tarifaC: 1.35, tarifaTA: 2.0, tarifaT4: 3.7 }
      }))

      // 2 Tarifa A model1 (1.00) + 4 Tarifa A model2 (2.00) = 3.00
      useKioskoStore.getState().setQuantity('tarifaAS1', 2)
      useKioskoStore.getState().setQuantity('tarifaAS2', 4)

      render(<CartControls />)

      expect(screen.getByLabelText('Total de la cesta')).toHaveTextContent('Cesta 3.00€')
    })
  })

  describe('Budget remaining display', () => {
    it('displays full budget when basket is empty', () => {
      setConfig(buildTestConfig({
        ticket: { limiteImporte: 399.99 } as AppConfig['ticket']
      }))
      render(<CartControls />)

      expect(screen.getByLabelText('Presupuesto restante')).toHaveTextContent('399.99 €')
    })

    it('displays reduced budget when quantities are set', () => {
      setConfig(buildTestConfig({
        ticket: { limiteImporte: 100 } as AppConfig['ticket'],
        precios: { tarifaA: 0.5, tarifaA2: 0.6, tarifaB: 1.25, tarifaC: 1.35, tarifaTA: 2.0, tarifaT4: 3.7 }
      }))

      // 10 Tarifa A = 5.00€, remaining = 100 - 5 = 95.00
      useKioskoStore.getState().setQuantity('tarifaAS1', 10)

      render(<CartControls />)

      expect(screen.getByLabelText('Presupuesto restante')).toHaveTextContent('95.00 €')
    })
  })

  describe('Profile/mode display – Req 13.4', () => {
    it('does not show profile name for FERIA (profile 6)', () => {
      setConfig(buildTestConfig({ sello: { elperfil: 6 } as AppConfig['sello'] }))
      render(<CartControls />)

      // Profile 6 (FERIA) shows no profile label
      const modeLabel = screen.queryByLabelText('Modo de impresión activo')
      expect(modeLabel).not.toBeInTheDocument()
    })

    it('shows profile name "Filatelia" for profile 1', () => {
      setConfig(buildTestConfig({ sello: { elperfil: 1, nperfil1: 'Filatelia' } as AppConfig['sello'] }))
      render(<CartControls />)

      expect(screen.getByLabelText('Modo de impresión activo')).toHaveTextContent('Filatelia')
    })

    it('shows profile name "Esporadicos" for profile 2', () => {
      setConfig(buildTestConfig({ sello: { elperfil: 2, nperfil2: 'Esporadicos' } as AppConfig['sello'] }))
      render(<CartControls />)

      expect(screen.getByLabelText('Modo de impresión activo')).toHaveTextContent('Esporadicos')
    })

    it('shows profile name "SPDE" for profile 3', () => {
      setConfig(buildTestConfig({ sello: { elperfil: 3, nperfil3: 'SPDE' } as AppConfig['sello'] }))
      render(<CartControls />)

      expect(screen.getByLabelText('Modo de impresión activo')).toHaveTextContent('SPDE')
    })
  })

  describe('Print indicators', () => {
    it('displays MASTER SET indicator with configured value', () => {
      setConfig(buildTestConfig({
        ticket: { ImprimeMasterTicket: 'S' } as AppConfig['ticket']
      }))
      render(<CartControls />)

      expect(screen.getByText(/S: MASTER SET/)).toBeInTheDocument()
    })

    it('displays COPIA TICKET indicator with configured value', () => {
      setConfig(buildTestConfig({
        ticket: { ImprimeCopiaTicket: 'S' } as AppConfig['ticket']
      }))
      render(<CartControls />)

      expect(screen.getByText(/S: COPIA TICKET/)).toBeInTheDocument()
    })

    it('displays tira especial indicators', () => {
      setConfig(buildTestConfig({
        ticket: {
          TEmod1: 'S',
          TEmod2: 'N',
          T1especial: 1,
          T2especial: 2,
          T3especial: 3
        } as AppConfig['ticket']
      }))
      render(<CartControls />)

      expect(screen.getByText(/S\/N \(€: 1-2-3\)/)).toBeInTheDocument()
    })
  })

  describe('Reset button – Task 7.9', () => {
    it('renders the reset button', () => {
      setConfig(buildTestConfig())
      render(<CartControls />)

      expect(screen.getByLabelText('Reset - limpiar cantidades')).toBeInTheDocument()
    })

    it('resets all quantities to 0 when clicked', async () => {
      const user = userEvent.setup()
      setConfig(buildTestConfig())

      useKioskoStore.getState().setQuantity('tarifaAS1', 5)
      useKioskoStore.getState().setQuantity('tarifaBS2', 3)
      useKioskoStore.getState().setQuantity('tarifaAT1', 2)

      render(<CartControls />)

      const resetBtn = screen.getByLabelText('Reset - limpiar cantidades')
      await user.click(resetBtn)

      const state = useKioskoStore.getState()
      expect(state.quantities.tarifaAS1).toBe(0)
      expect(state.quantities.tarifaBS2).toBe(0)
      expect(state.quantities.tarifaAT1).toBe(0)
    })

    it('calls onReset callback when provided', async () => {
      const user = userEvent.setup()
      const onReset = vi.fn()
      setConfig(buildTestConfig())

      render(<CartControls onReset={onReset} />)

      const resetBtn = screen.getByLabelText('Reset - limpiar cantidades')
      await user.click(resetBtn)

      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('Button accessibility', () => {
    it('renders all action buttons with aria-labels', () => {
      setConfig(buildTestConfig())
      render(<CartControls />)

      expect(screen.getByLabelText('Imprimir normal - confirmar venta')).toBeInTheDocument()
      expect(screen.getByLabelText('Error impresión - anular última venta')).toBeInTheDocument()
      expect(screen.getByLabelText('Imprimir Filatelia')).toBeInTheDocument()
      expect(screen.getByLabelText('Imprimir Protocolo')).toBeInTheDocument()
      expect(screen.getByLabelText('Imprimir SPDE')).toBeInTheDocument()
      expect(screen.getByLabelText('Reset - limpiar cantidades')).toBeInTheDocument()
    })

    it('has region role with accessible label', () => {
      setConfig(buildTestConfig())
      render(<CartControls />)

      expect(screen.getByRole('region', { name: 'Controles de cesta' })).toBeInTheDocument()
    })
  })
})
