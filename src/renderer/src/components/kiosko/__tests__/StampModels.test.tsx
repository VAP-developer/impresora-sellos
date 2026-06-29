/**
 * StampModels.test.tsx
 *
 * Verification test for Task 10.4:
 * Confirms that images uploaded via SubirImagen (stored as base64 data URIs)
 * appear as background/preview images in the Kiosko view's StampModels component.
 *
 * Tests:
 * 1. StampModels uses motivoi/motivod from the active event to load images
 * 2. It calls IPC images:getByName to fetch the uploaded image data
 * 3. The fetched base64 data URI is used as the image source in stamp preview
 * 4. If the image is not found, it falls back to a placeholder display
 * 5. When model names change (event switch), images are reloaded
 *
 * Validates: Requirements 14.3, 14.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StampModels from '../StampModels'
import { useConfigStore } from '@renderer/stores/config.store'
import type { AppConfig } from '@renderer/types/config'

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

import * as ipc from '@renderer/lib/ipc-client'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_BASE64_IMAGE_1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRu5ErkJggg=='
const FAKE_BASE64_IMAGE_2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg=='

function buildTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    ticket: {
      feria: 'XLIX Feria Nacional Sello',
      lugar: 'Plaza Mayor Madrid',
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
      empresa: 'S.E. Correos',
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
      modelo1: 'DefaultModelo1',
      modelo2: 'DefaultModelo2',
      modo: 0,
      nperfil1: 'Filatelia',
      nperfil2: 'Esporadicos',
      nperfil3: 'SPDE',
      nperfil4: '',
      nperfil5: 'Abono/Envio',
      nperfil6: 'FERIA',
      eventos: [
        {
          nevento: 'Feria Madrid 2025',
          nferia: 'XLIX Feria Nacional Sello',
          nlugar: 'Plaza Mayor Madrid',
          motivoi: 'CornamusaAzul',
          motivod: 'PlazaMayorNar',
          fecha: '21-24 abril 2025',
          localidad: 'Madrid'
        },
        {
          nevento: 'Exfilna Sevilla',
          nferia: 'Exfilna 2025',
          nlugar: 'Palacio Congresos',
          motivoi: 'GiraldaSevilla',
          motivod: 'TorredelOro',
          fecha: '10-13 mayo 2025',
          localidad: 'Sevilla'
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StampModels – Image integration (Task 10.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConfigStore.setState({ config: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Uses motivoi/motivod from active event config', () => {
    it('calls getImageByName with motivoi name from active event for Modelo 1', async () => {
      const config = buildTestConfig()
      setConfig(config)

      // Mock the IPC response: image exists
      vi.mocked(ipc.getImageByName).mockResolvedValue({
        name: 'CornamusaAzul',
        url: FAKE_BASE64_IMAGE_1
      })

      render(<StampModels />)

      await waitFor(() => {
        expect(ipc.getImageByName).toHaveBeenCalledWith('CornamusaAzul')
      })
    })

    it('calls getImageByName with motivod name from active event for Modelo 2', async () => {
      const config = buildTestConfig()
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockResolvedValue({
        name: 'PlazaMayorNar',
        url: FAKE_BASE64_IMAGE_2
      })

      render(<StampModels />)

      await waitFor(() => {
        expect(ipc.getImageByName).toHaveBeenCalledWith('PlazaMayorNar')
      })
    })

    it('uses elevento index to select the correct event from eventos array', async () => {
      // Set elevento=1 to use "Exfilna Sevilla" event (GiraldaSevilla / TorredelOro)
      const config = buildTestConfig({
        sello: {
          ...buildTestConfig().sello,
          elevento: 1,
          elnevento: 'Exfilna Sevilla'
        }
      })
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockResolvedValue(null)

      render(<StampModels />)

      await waitFor(() => {
        expect(ipc.getImageByName).toHaveBeenCalledWith('GiraldaSevilla')
        expect(ipc.getImageByName).toHaveBeenCalledWith('TorredelOro')
      })
    })
  })

  describe('Displays uploaded base64 images as preview', () => {
    it('renders an img element with the base64 data URI as src when image is found', async () => {
      const config = buildTestConfig()
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockImplementation(async (name) => {
        if (name === 'CornamusaAzul') return { name: 'CornamusaAzul', url: FAKE_BASE64_IMAGE_1 }
        if (name === 'PlazaMayorNar') return { name: 'PlazaMayorNar', url: FAKE_BASE64_IMAGE_2 }
        return null
      })

      render(<StampModels />)

      // Wait for images to load
      await waitFor(() => {
        const images = screen.getAllByRole('img')
        expect(images.length).toBeGreaterThanOrEqual(2)
      })

      const img1 = screen.getByAltText('Modelo 1')
      const img2 = screen.getByAltText('Modelo 2')

      expect(img1).toHaveAttribute('src', FAKE_BASE64_IMAGE_1)
      expect(img2).toHaveAttribute('src', FAKE_BASE64_IMAGE_2)
    })
  })

  describe('Fallback when image is not found', () => {
    it('shows placeholder with model name when getImageByName returns null', async () => {
      const config = buildTestConfig()
      setConfig(config)

      // Images not found in database
      vi.mocked(ipc.getImageByName).mockResolvedValue(null)

      render(<StampModels />)

      // Wait for loading to finish and placeholder to appear
      await waitFor(() => {
        // Should show the model name in the placeholder
        expect(screen.getByText('CornamusaAzul')).toBeInTheDocument()
        expect(screen.getByText('PlazaMayorNar')).toBeInTheDocument()
      })

      // Should NOT render <img> elements when images are missing
      expect(screen.queryByAltText('Modelo 1')).not.toBeInTheDocument()
      expect(screen.queryByAltText('Modelo 2')).not.toBeInTheDocument()
    })

    it('shows "Sin modelo" when model name is empty', async () => {
      const config = buildTestConfig({
        sello: {
          ...buildTestConfig().sello,
          eventos: [
            {
              nevento: 'Empty Event',
              nferia: 'Empty Feria',
              nlugar: 'Empty Place',
              motivoi: '',
              motivod: '',
              fecha: '1 enero 2025',
              localidad: 'Nowhere'
            }
          ]
        }
      })
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockResolvedValue(null)

      render(<StampModels />)

      await waitFor(() => {
        const sinModeloElements = screen.getAllByText('Sin modelo')
        expect(sinModeloElements.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('Event data overlay on stamp preview', () => {
    it('displays fecha and localidad from active event', async () => {
      const config = buildTestConfig()
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockResolvedValue(null)

      render(<StampModels />)

      await waitFor(() => {
        // Each event is shown in both model previews
        const fechaElements = screen.getAllByText('21-24 abril 2025')
        expect(fechaElements.length).toBeGreaterThanOrEqual(1)

        const localidadElements = screen.getAllByText('Madrid')
        expect(localidadElements.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Image reload on model name change', () => {
    it('reloads images when active event changes (elevento updated)', async () => {
      const config = buildTestConfig()
      setConfig(config)

      vi.mocked(ipc.getImageByName).mockResolvedValue(null)

      const { rerender } = render(<StampModels />)

      await waitFor(() => {
        expect(ipc.getImageByName).toHaveBeenCalledWith('CornamusaAzul')
        expect(ipc.getImageByName).toHaveBeenCalledWith('PlazaMayorNar')
      })

      // Clear mock call history
      vi.mocked(ipc.getImageByName).mockClear()

      // Change to event 1
      const newConfig = buildTestConfig({
        sello: {
          ...buildTestConfig().sello,
          elevento: 1,
          elnevento: 'Exfilna Sevilla'
        }
      })
      setConfig(newConfig)

      rerender(<StampModels />)

      await waitFor(() => {
        expect(ipc.getImageByName).toHaveBeenCalledWith('GiraldaSevilla')
        expect(ipc.getImageByName).toHaveBeenCalledWith('TorredelOro')
      })
    })
  })
})
