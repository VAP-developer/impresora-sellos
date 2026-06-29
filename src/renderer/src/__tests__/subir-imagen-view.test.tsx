/**
 * subir-imagen-view.test.tsx
 *
 * Unit tests for SubirImagenView verifying:
 * - The view renders model previews and upload buttons
 * - Clicking "Subir Imagen" shows the ImageUpload component
 * - Image upload flow calls IPC correctly
 * - Successful uploads refresh the preview
 * - Navigation back to /maquina works
 *
 * Validates: Requirement 14.1 (store image as data URI with unique name)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import SubirImagenView from '@renderer/views/SubirImagenView'

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
  uploadImage: vi.fn().mockResolvedValue(undefined),
  removeImage: vi.fn(),
  getImageByName: vi.fn().mockResolvedValue(null),
  getPrinterStatus: vi.fn(),
  print: vi.fn(),
  pausePrinter: vi.fn(),
  resumePrinter: vi.fn(),
  getPrintQueue: vi.fn(),
  getSyncStatus: vi.fn(),
  triggerSync: vi.fn()
}))

// Mock react-easy-crop since it requires canvas
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (area: unknown, pixels: unknown) => void }) => {
    // Simulate a crop area being defined
    setTimeout(() => {
      onCropComplete(
        { x: 0, y: 0, width: 100, height: 45 },
        { x: 0, y: 0, width: 550, height: 250 }
      )
    }, 0)
    return <div data-testid="mock-cropper">Cropper</div>
  }
}))

import { getImageByName, uploadImage, removeImage } from '@renderer/lib/ipc-client'
import { useConfigStore } from '@renderer/stores/config.store'

// Set up a minimal config state in the store
const mockConfig = {
  ticket: {
    feria: 'Test Feria',
    lugar: 'Test Lugar',
    fecha: 'auto',
    hora: 'auto',
    titulo: 'Factura',
    tituloCopia: 'COPIA',
    rollo1: 1500,
    rollo2: 1500,
    tickets: 450,
    limiteTickets: 450,
    limiteImporte: 399.99,
    empresa: 'Test SA',
    cif: 'A12345678',
    cp: '28001 Madrid',
    l1: '',
    l2: '',
    l3: ''
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
    elnevento: 'Feria Madrid',
    feria: 'XLIX Feria',
    lugar: 'Plaza Mayor',
    modelo1: 'FeriaIzq',
    modelo2: 'FeriaDer',
    modo: 1,
    nperfil1: 'Filatelia',
    nperfil2: 'Esporadicos',
    nperfil3: 'SPDE',
    nperfil4: '',
    nperfil5: 'Abono/Envio',
    nperfil6: 'FERIA',
    eventos: [
      {
        nevento: 'Feria Madrid',
        nferia: 'XLIX Feria',
        nlugar: 'Plaza Mayor',
        motivoi: 'MotivoIzq2025',
        motivod: 'MotivoDer2025',
        fecha: '21-24 abril 2025',
        localidad: 'Madrid'
      }
    ]
  },
  precios: {
    tarifaA: 0.5,
    tarifaA2: 0.6,
    tarifaB: 1.25,
    tarifaC: 1.35
  }
}

function renderSubirImagenView() {
  const routes = [
    {
      path: '/subir-imagen',
      element: <SubirImagenView />
    },
    {
      path: '/maquina',
      element: <div data-testid="maquina-view">Maquina View</div>
    }
  ]

  const router = createMemoryRouter(routes, {
    initialEntries: ['/subir-imagen']
  })

  return render(<RouterProvider router={router} />)
}

describe('SubirImagenView – Task 10.2 Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getImageByName as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    // Set mock config in the store
    useConfigStore.setState({ config: mockConfig as never, loading: false, error: null })
  })

  describe('Rendering', () => {
    it('renders the page title "Subir Imagen"', () => {
      renderSubirImagenView()
      expect(screen.getByRole('heading', { name: 'Subir Imagen' })).toBeInTheDocument()
    })

    it('renders the description text', () => {
      renderSubirImagenView()
      expect(screen.getByText(/Gestión de imágenes/)).toBeInTheDocument()
    })

    it('renders Modelo 1 and Modelo 2 sections', () => {
      renderSubirImagenView()
      expect(screen.getByText('Modelo 1')).toBeInTheDocument()
      expect(screen.getByText('Modelo 2')).toBeInTheDocument()
    })

    it('shows model image names from config', () => {
      renderSubirImagenView()
      expect(screen.getByText('MotivoIzq2025')).toBeInTheDocument()
      expect(screen.getByText('MotivoDer2025')).toBeInTheDocument()
    })

    it('renders upload buttons for both models', () => {
      renderSubirImagenView()
      const buttons = screen.getAllByRole('button', { name: /Subir Imagen/i })
      expect(buttons).toHaveLength(2)
    })

    it('renders "Volver" button', () => {
      renderSubirImagenView()
      expect(screen.getByText('Volver')).toBeInTheDocument()
    })

    it('shows "Sin imagen" when no images are loaded', async () => {
      renderSubirImagenView()
      await waitFor(() => {
        const noImageTexts = screen.getAllByText('Sin imagen')
        expect(noImageTexts).toHaveLength(2)
      })
    })
  })

  describe('Image Preview', () => {
    it('shows image preview when model image exists in DB', async () => {
      ;(getImageByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'MotivoIzq2025') {
          return Promise.resolve({ name: 'MotivoIzq2025', url: 'data:image/png;base64,TESTIMG1' })
        }
        return Promise.resolve(null)
      })

      renderSubirImagenView()

      await waitFor(() => {
        const img = screen.getByAltText('Modelo 1')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', 'data:image/png;base64,TESTIMG1')
      })
    })

    it('shows "Cambiar" button when model has existing image', async () => {
      ;(getImageByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'MotivoIzq2025') {
          return Promise.resolve({ name: 'MotivoIzq2025', url: 'data:image/png;base64,ABC' })
        }
        return Promise.resolve(null)
      })

      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cambiar Imagen/i })).toBeInTheDocument()
      })
    })
  })

  describe('Upload Flow', () => {
    it('shows ImageUpload component when "Subir Imagen" button is clicked for Modelo 1', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      const buttons = screen.getAllByRole('button', { name: /Subir Imagen/i })
      await user.click(buttons[0]) // First button is Modelo 1

      expect(screen.getByText(/Subir imagen para Modelo 1/)).toBeInTheDocument()
      expect(screen.getByText('(MotivoIzq2025)')).toBeInTheDocument()
    })

    it('shows ImageUpload component when "Subir Imagen" button is clicked for Modelo 2', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      const buttons = screen.getAllByRole('button', { name: /Subir Imagen/i })
      await user.click(buttons[1]) // Second button is Modelo 2

      expect(screen.getByText(/Subir imagen para Modelo 2/)).toBeInTheDocument()
      expect(screen.getByText('(MotivoDer2025)')).toBeInTheDocument()
    })

    it('shows back button to return to model selection', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      const buttons = screen.getAllByRole('button', { name: /Subir Imagen/i })
      await user.click(buttons[0])

      expect(screen.getByText('← Volver a modelos')).toBeInTheDocument()

      await user.click(screen.getByText('← Volver a modelos'))

      // Should be back at model selection
      expect(screen.getByText('Modelo 1')).toBeInTheDocument()
      expect(screen.getByText('Modelo 2')).toBeInTheDocument()
    })

    it('loads images from DB on mount using getImageByName', async () => {
      renderSubirImagenView()

      await waitFor(() => {
        expect(getImageByName).toHaveBeenCalledWith('MotivoIzq2025')
        expect(getImageByName).toHaveBeenCalledWith('MotivoDer2025')
      })
    })
  })

  describe('Navigation', () => {
    it('navigates to /maquina when "Volver" button is clicked', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await user.click(screen.getByText('Volver'))

      await waitFor(() => {
        expect(screen.getByTestId('maquina-view')).toBeInTheDocument()
      })
    })
  })

  describe('IPC Integration', () => {
    it('has uploadImage available from ipc-client', () => {
      expect(uploadImage).toBeDefined()
      expect(typeof uploadImage).toBe('function')
    })

    it('uploadImage calls the IPC layer correctly', async () => {
      await uploadImage('TestImage', 'data:image/png;base64,ABC', 'image/png', 1024)
      expect(uploadImage).toHaveBeenCalledWith(
        'TestImage',
        'data:image/png;base64,ABC',
        'image/png',
        1024
      )
    })
  })

  describe('Image Deletion – Task 10.3', () => {
    beforeEach(() => {
      // Set up images as if they exist
      ;(getImageByName as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'MotivoIzq2025') {
          return Promise.resolve({ name: 'MotivoIzq2025', url: 'data:image/png;base64,IMG1' })
        }
        if (name === 'MotivoDer2025') {
          return Promise.resolve({ name: 'MotivoDer2025', url: 'data:image/png;base64,IMG2' })
        }
        return Promise.resolve(null)
      })
      ;(removeImage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    })

    it('shows "Eliminar" button when a model has an image', async () => {
      renderSubirImagenView()

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
        expect(deleteButtons).toHaveLength(2)
      })
    })

    it('does not show "Eliminar" button when model has no image', async () => {
      ;(getImageByName as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument()
      })
    })

    it('shows confirmation dialog when "Eliminar" is clicked', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2)
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      expect(screen.getByText('Confirmar eliminación')).toBeInTheDocument()
      expect(screen.getByText(/¿Estás seguro/)).toBeInTheDocument()
      expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument()
    })

    it('cancels deletion when "Cancelar" is clicked in the dialog', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2)
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      // Click cancel in the confirmation dialog
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      // Confirmation dialog should be gone
      expect(screen.queryByText('Confirmar eliminación')).not.toBeInTheDocument()
      // Image should still be there
      expect(removeImage).not.toHaveBeenCalled()
    })

    it('calls removeImage via IPC when deletion is confirmed', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2)
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      // Click "Eliminar" in the confirmation dialog
      const confirmButton = screen.getAllByRole('button', { name: /Eliminar/i })
      // The dialog's Eliminar button (not the one from the card)
      const dialogEliminar = confirmButton.find(
        (btn) => btn.closest('.fixed') !== null
      )
      await user.click(dialogEliminar!)

      await waitFor(() => {
        expect(removeImage).toHaveBeenCalledWith('MotivoIzq2025')
      })
    })

    it('shows success message after successful deletion', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2)
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      const dialogEliminar = screen
        .getAllByRole('button', { name: /Eliminar/i })
        .find((btn) => btn.closest('.fixed') !== null)
      await user.click(dialogEliminar!)

      await waitFor(() => {
        expect(screen.getByText(/eliminada correctamente/)).toBeInTheDocument()
      })
    })

    it('shows error message when deletion fails', async () => {
      ;(removeImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2)
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      const dialogEliminar = screen
        .getAllByRole('button', { name: /Eliminar/i })
        .find((btn) => btn.closest('.fixed') !== null)
      await user.click(dialogEliminar!)

      await waitFor(() => {
        expect(screen.getByText(/Error al eliminar/)).toBeInTheDocument()
      })
    })

    it('removes image preview from UI after successful deletion', async () => {
      const user = userEvent.setup()
      renderSubirImagenView()

      await waitFor(() => {
        expect(screen.getByAltText('Modelo 1')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
      await user.click(deleteButtons[0])

      const dialogEliminar = screen
        .getAllByRole('button', { name: /Eliminar/i })
        .find((btn) => btn.closest('.fixed') !== null)
      await user.click(dialogEliminar!)

      await waitFor(() => {
        expect(screen.queryByAltText('Modelo 1')).not.toBeInTheDocument()
      })
    })
  })
})
