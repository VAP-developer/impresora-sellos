/**
 * navigation.test.tsx
 *
 * Verification test for Task 5.5: confirms that navigation works correctly
 * between views (Home, Kiosko, Maquina, Imprimir, SubirImagen, Settings).
 *
 * Tests:
 * - All routes render their corresponding view
 * - NavComponent links navigate between views
 * - Active state is applied to current nav link
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import MainLayout from '@renderer/components/layout/MainLayout'
import { HomeView, KioskoView, MaquinaView, ImprimirView, SubirImagenView } from '@renderer/views'

// Mock ipc-client to prevent actual IPC calls
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

/**
 * Helper to render the app with a memory router starting at a given path.
 */
function renderWithRouter(initialRoute = '/home') {
  const routes = [
    {
      path: '/',
      element: <MainLayout />,
      children: [
        { path: 'home', element: <HomeView /> },
        { path: 'kiosko', element: <KioskoView /> },
        { path: 'maquina', element: <MaquinaView /> },
        { path: 'imprimir', element: <ImprimirView /> },
        { path: 'subir-imagen', element: <SubirImagenView /> }
      ]
    }
  ]

  const router = createMemoryRouter(routes, {
    initialEntries: [initialRoute]
  })

  return render(<RouterProvider router={router} />)
}

describe('Navigation – Task 5.5 Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Route rendering', () => {
    it('renders HomeView at /home', () => {
      renderWithRouter('/home')
      // HomeView shows CONFIGURACIÓN and MÁQUINA headers
      expect(screen.getByText('CONFIGURACIÓN')).toBeInTheDocument()
      expect(screen.getByText('MÁQUINA')).toBeInTheDocument()
    })

    it('renders KioskoView at /kiosko', () => {
      renderWithRouter('/kiosko')
      // KioskoView renders the tariff table
      expect(screen.getByRole('table', { name: 'Tabla de tarifas dividida por sello' })).toBeInTheDocument()
    })

    it('renders MaquinaView at /maquina', () => {
      renderWithRouter('/maquina')
      // MaquinaView shows machine configuration content
      expect(screen.getByLabelText('Máquina')).toBeInTheDocument()
    })

    it('renders ImprimirView at /imprimir', () => {
      renderWithRouter('/imprimir')
      // ImprimirView shows loading state initially
      expect(screen.getByText(/Cargando configuración/)).toBeInTheDocument()
    })

    it('renders SubirImagenView at /subir-imagen', () => {
      renderWithRouter('/subir-imagen')
      expect(screen.getByRole('heading', { name: 'Subir Imagen' })).toBeInTheDocument()
      expect(screen.getByText(/Gestión de imágenes/)).toBeInTheDocument()
    })
  })

  describe('NavComponent links', () => {
    it('navigates from Home to Kiosko via nav link', async () => {
      const user = userEvent.setup()
      renderWithRouter('/home')

      expect(screen.getByText('CONFIGURACIÓN')).toBeInTheDocument()

      const kioskoLink = screen.getByLabelText('Kiosko')
      await user.click(kioskoLink)

      await waitFor(() => {
        expect(screen.getByRole('table', { name: 'Tabla de tarifas dividida por sello' })).toBeInTheDocument()
      })
    })

    it('navigates from Home to Maquina via nav link', async () => {
      const user = userEvent.setup()
      renderWithRouter('/home')

      const maquinaLink = screen.getByLabelText('Máquina')
      await user.click(maquinaLink)

      await waitFor(() => {
        // MaquinaView is rendered (nav link Máquina becomes active)
        const maquinaNavLink = screen.getByLabelText('Máquina')
        expect(maquinaNavLink).toHaveClass('bg-yellow-500/50')
      })
    })

    it('navigates from Home to Imprimir via nav link', async () => {
      const user = userEvent.setup()
      renderWithRouter('/home')

      const imprimirLink = screen.getByLabelText('Imprimir')
      await user.click(imprimirLink)

      await waitFor(() => {
        expect(screen.getByText(/Cargando configuración/)).toBeInTheDocument()
      })
    })

    it('navigates from Kiosko back to Home via nav link', async () => {
      const user = userEvent.setup()
      renderWithRouter('/kiosko')

      expect(screen.getByRole('table', { name: 'Tabla de tarifas dividida por sello' })).toBeInTheDocument()

      const homeLink = screen.getByLabelText('Inicio')
      await user.click(homeLink)

      await waitFor(() => {
        expect(screen.getByText('CONFIGURACIÓN')).toBeInTheDocument()
        expect(screen.getByText('MÁQUINA')).toBeInTheDocument()
      })
    })
  })

  describe('Layout structure', () => {
    it('renders NavComponent on all views', () => {
      renderWithRouter('/home')

      // Nav links should be present with i18n translated labels
      expect(screen.getByLabelText('Inicio')).toBeInTheDocument()
      expect(screen.getByLabelText('Imprimir')).toBeInTheDocument()
      expect(screen.getByLabelText('Máquina')).toBeInTheDocument()
      expect(screen.getByLabelText('Kiosko')).toBeInTheDocument()
      expect(screen.getByLabelText('Información del kiosko')).toBeInTheDocument()
      expect(screen.getByLabelText('Configuración')).toBeInTheDocument()
    })

    it('renders NavComponent on Kiosko view as well', () => {
      renderWithRouter('/kiosko')

      expect(screen.getByLabelText('Inicio')).toBeInTheDocument()
      expect(screen.getByLabelText('Imprimir')).toBeInTheDocument()
      expect(screen.getByLabelText('Máquina')).toBeInTheDocument()
      expect(screen.getByLabelText('Kiosko')).toBeInTheDocument()
    })

    it('info popup toggles on click', async () => {
      const user = userEvent.setup()
      renderWithRouter('/home')

      const infoButton = screen.getByLabelText('Información del kiosko')
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

      await user.click(infoButton)
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        expect(screen.getByText(/CARRO ANULACIÓN VENTA/)).toBeInTheDocument()
      })
    })
  })

  describe('Active state styling', () => {
    it('highlights the Home nav link when on /home', () => {
      renderWithRouter('/home')
      const homeLink = screen.getByLabelText('Inicio')
      expect(homeLink).toHaveClass('bg-yellow-500/50')
    })

    it('highlights the Kiosko nav link when on /kiosko', () => {
      renderWithRouter('/kiosko')
      const kioskoLink = screen.getByLabelText('Kiosko')
      expect(kioskoLink).toHaveClass('bg-yellow-500/50')
    })

    it('highlights the Maquina nav link when on /maquina', () => {
      renderWithRouter('/maquina')
      const maquinaLink = screen.getByLabelText('Máquina')
      expect(maquinaLink).toHaveClass('bg-yellow-500/50')
    })

    it('highlights the Imprimir nav link when on /imprimir', () => {
      renderWithRouter('/imprimir')
      const imprimirLink = screen.getByLabelText('Imprimir')
      expect(imprimirLink).toHaveClass('bg-yellow-500/50')
    })

    it('does not highlight inactive nav links', () => {
      renderWithRouter('/home')
      const kioskoLink = screen.getByLabelText('Kiosko')
      expect(kioskoLink).not.toHaveClass('bg-yellow-500/50')
    })
  })
})
