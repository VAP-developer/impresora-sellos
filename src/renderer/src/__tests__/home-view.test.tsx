/**
 * home-view.test.tsx
 *
 * Verification test for Task 6.4: confirms that the HomeView component
 * renders correctly with navigation buttons, CSV export functionality,
 * and informational tooltips.
 *
 * Tests:
 * - Navigation buttons render and navigate to /imprimir and /maquina
 * - Export CSV button calls downloadCSV from ipc-client
 * - Tooltips display changelog and export instructions on hover/click
 * - Error state displays when export fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import HomeView from '@renderer/views/HomeView'

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
  downloadCSV: vi.fn().mockResolvedValue('col1;col2\nval1;val2'),
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

import { downloadCSV } from '@renderer/lib/ipc-client'

/**
 * Helper to render HomeView within a router context.
 * Includes a simple catch-all for navigated routes so we can verify navigation.
 */
function renderHomeView() {
  const routes = [
    {
      path: '/home',
      element: <HomeView />
    },
    {
      path: '/imprimir',
      element: <div data-testid="imprimir-view">Imprimir View</div>
    },
    {
      path: '/maquina',
      element: <div data-testid="maquina-view">Maquina View</div>
    }
  ]

  const router = createMemoryRouter(routes, {
    initialEntries: ['/home']
  })

  return render(<RouterProvider router={router} />)
}

describe('HomeView – Task 6.4 Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(downloadCSV as ReturnType<typeof vi.fn>).mockResolvedValue('col1;col2\nval1;val2')
  })

  describe('Rendering', () => {
    it('renders the HomeView with CONFIGURACIÓN and MÁQUINA headers', () => {
      renderHomeView()
      expect(screen.getByText('CONFIGURACIÓN')).toBeInTheDocument()
      expect(screen.getByText('MÁQUINA')).toBeInTheDocument()
    })

    it('renders the export CSV button', () => {
      renderHomeView()
      const exportBtn = screen.getByLabelText('Exportar informe CSV')
      expect(exportBtn).toBeInTheDocument()
      expect(screen.getByText('EXPORTAR CSV')).toBeInTheDocument()
    })

    it('renders the Configuración (Imprimir) navigation button', () => {
      renderHomeView()
      const configBtn = screen.getByLabelText('Configuración de impresión')
      expect(configBtn).toBeInTheDocument()
    })

    it('renders the Máquina navigation button', () => {
      renderHomeView()
      const maquinaBtn = screen.getByLabelText('Configuración de máquina')
      expect(maquinaBtn).toBeInTheDocument()
    })

    it('renders description labels for all sections', () => {
      renderHomeView()
      expect(screen.getByText(/PERFIL/)).toBeInTheDocument()
      expect(screen.getByText(/EVENTO/)).toBeInTheDocument()
      expect(screen.getByText(/TARIFAS/)).toBeInTheDocument()
      expect(screen.getByText(/INFORME/)).toBeInTheDocument()
      expect(screen.getByText(/VENTAS/)).toBeInTheDocument()
      expect(screen.getByText(/CÓDIGO ETIQUETA/)).toBeInTheDocument()
      expect(screen.getByText(/TICKET/)).toBeInTheDocument()
      expect(screen.getByText(/ROLLOS/)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('navigates to /imprimir when Configuración button is clicked', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const configBtn = screen.getByLabelText('Configuración de impresión')
      await user.click(configBtn)

      await waitFor(() => {
        expect(screen.getByTestId('imprimir-view')).toBeInTheDocument()
      })
    })

    it('navigates to /maquina when Máquina button is clicked', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const maquinaBtn = screen.getByLabelText('Configuración de máquina')
      await user.click(maquinaBtn)

      await waitFor(() => {
        expect(screen.getByTestId('maquina-view')).toBeInTheDocument()
      })
    })
  })

  describe('CSV Export', () => {
    it('calls downloadCSV when export button is clicked', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const exportBtn = screen.getByLabelText('Exportar informe CSV')
      await user.click(exportBtn)

      await waitFor(() => {
        expect(downloadCSV).toHaveBeenCalledTimes(1)
      })
    })

    it('shows EXPORTANDO... text while export is in progress', async () => {
      // Make downloadCSV hang so we can observe the loading state
      let resolveCSV: (value: string) => void
      ;(downloadCSV as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise<string>((resolve) => { resolveCSV = resolve })
      )

      const user = userEvent.setup()
      renderHomeView()

      const exportBtn = screen.getByLabelText('Exportar informe CSV')
      await user.click(exportBtn)

      await waitFor(() => {
        expect(screen.getByText('EXPORTANDO...')).toBeInTheDocument()
      })

      // Button should be disabled while exporting
      expect(exportBtn).toBeDisabled()

      // Resolve the promise to clean up
      resolveCSV!('data')
      await waitFor(() => {
        expect(screen.getByText('EXPORTAR CSV')).toBeInTheDocument()
      })
    })

    it('shows error message when export fails', async () => {
      ;(downloadCSV as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      renderHomeView()

      const exportBtn = screen.getByLabelText('Exportar informe CSV')
      await user.click(exportBtn)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Error al exportar. Inténtelo de nuevo.')).toBeInTheDocument()
      })
    })

    it('re-enables button after export completes', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const exportBtn = screen.getByLabelText('Exportar informe CSV')
      await user.click(exportBtn)

      await waitFor(() => {
        expect(exportBtn).not.toBeDisabled()
        expect(screen.getByText('EXPORTAR CSV')).toBeInTheDocument()
      })
    })
  })

  describe('Tooltips', () => {
    it('renders the app changelog tooltip trigger', () => {
      renderHomeView()
      expect(screen.getByText('app')).toBeInTheDocument()
    })

    it('renders the export info tooltip trigger', () => {
      renderHomeView()
      expect(screen.getByText('i')).toBeInTheDocument()
    })

    it('shows changelog tooltip content on hover', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const appTrigger = screen.getByText('app')
      await user.hover(appTrigger)

      // Radix tooltips render content in multiple nodes; use getAllBy to verify presence
      await waitFor(() => {
        const matches = screen.getAllByText(/MEJORAS/)
        expect(matches.length).toBeGreaterThan(0)
      })
    })

    it('shows export instructions tooltip on hover', async () => {
      const user = userEvent.setup()
      renderHomeView()

      const infoTrigger = screen.getByText('i')
      await user.hover(infoTrigger)

      // Radix renders tooltip content in both visual and accessible nodes
      await waitFor(() => {
        const matches = screen.getAllByText(/INFORME: EXPORTAR CSV/)
        expect(matches.length).toBeGreaterThan(0)
      })
    })
  })
})
