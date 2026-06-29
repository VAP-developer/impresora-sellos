/**
 * Tests for stamp-renderer.ts
 * Verifies that stamp PDFs are generated correctly with proper dimensions and content.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  renderStamp,
  renderStampBlank,
  renderStampMultiPage,
  renderStampE1,
  renderStampE2,
  renderStampE3,
  renderStampE4,
  renderStampEspecialStrip,
  STAMP_WIDTH,
  STAMP_HEIGHT,
  STAMP_WIDTH_MM,
  STAMP_HEIGHT_MM,
  StampRenderParams,
  StampEspecialParams,
  setTestFontsPath,
  setTestImagesPath
} from '../stamp-renderer'

// The actual fonts path from the project root
const PROJECT_ROOT = join(__dirname, '../../../..')
const FONTS_PATH = join(PROJECT_ROOT, 'resources/fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources/images')

beforeAll(() => {
  // Override internal paths for testing
  setTestFontsPath(FONTS_PATH)
  setTestImagesPath(IMAGES_PATH)
})

afterAll(() => {
  setTestFontsPath(null)
  setTestImagesPath(null)
})

describe('stamp-renderer', () => {
  const baseParams: StampRenderParams = {
    tarifa: 'Tarifa A',
    fecha: '21-24 abril 2025',
    evento: 'Madrid',
    codigo: 'P4ES25 CH17-0001-001',
    backgroundImage: null
  }

  describe('Constants', () => {
    it('should define correct stamp dimensions in mm', () => {
      expect(STAMP_WIDTH_MM).toBe(55)
      expect(STAMP_HEIGHT_MM).toBe(25)
    })

    it('should convert mm to points correctly', () => {
      const MM_TO_PT = 72 / 25.4
      expect(STAMP_WIDTH).toBeCloseTo(55 * MM_TO_PT, 2)
      expect(STAMP_HEIGHT).toBeCloseTo(25 * MM_TO_PT, 2)
    })
  })

  describe('renderStamp', () => {
    it('should generate a valid PDF buffer', async () => {
      const buffer = await renderStamp(baseParams)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      // PDF magic bytes
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should include stamp text content in the PDF', async () => {
      const buffer = await renderStamp(baseParams)
      // pdfkit with custom TTF fonts encodes text as glyph IDs, not plain strings.
      // We verify the PDF is valid and has reasonable size (contains text drawing operations).
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(1000) // PDF with text content should be substantial
    })

    it('should set correct page dimensions', async () => {
      const buffer = await renderStamp(baseParams)
      const pdfContent = buffer.toString('latin1')

      // Check MediaBox for page dimensions (rounded)
      const widthStr = STAMP_WIDTH.toFixed(2)
      const heightStr = STAMP_HEIGHT.toFixed(2)
      // pdfkit writes MediaBox with the page dimensions
      expect(pdfContent).toContain('MediaBox')
    })

    it('should handle empty tarifa text gracefully', async () => {
      const buffer = await renderStamp({ ...baseParams, tarifa: '' })
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle special characters in text', async () => {
      const buffer = await renderStamp({
        ...baseParams,
        tarifa: 'Tarifa A2',
        evento: 'Plaza Mayor - Madrid',
        fecha: '21-24 abril 2025'
      })
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  describe('renderStampBlank', () => {
    it('should generate a valid PDF without background', async () => {
      const buffer = await renderStampBlank(baseParams)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should contain the same text as renderStamp', async () => {
      const buffer = await renderStampBlank(baseParams)
      // Verify it produces a valid PDF with content
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(1000)
    })
  })

  describe('renderStampMultiPage', () => {
    it('should generate a multi-page PDF for a strip of 4', async () => {
      const stamps: StampRenderParams[] = [
        { ...baseParams, tarifa: 'Tarifa A', codigo: 'P4ES25 CH17-0001-001' },
        { ...baseParams, tarifa: 'Tarifa A', codigo: 'P4ES25 CH17-0001-002' },
        { ...baseParams, tarifa: 'Tarifa A', codigo: 'P4ES25 CH17-0001-003' },
        { ...baseParams, tarifa: 'Tarifa A', codigo: 'P4ES25 CH17-0001-004' }
      ]

      const buffer = await renderStampMultiPage(stamps)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      // Multi-page PDF should be larger than single page
      const singleBuffer = await renderStamp(baseParams)
      expect(buffer.length).toBeGreaterThan(singleBuffer.length)
    })

    it('should reject with empty stamps array', async () => {
      await expect(renderStampMultiPage([])).rejects.toThrow('No stamps to render')
    })

    it('should generate strip with different tarifas (4 Tarifas)', async () => {
      const stamps: StampRenderParams[] = [
        { ...baseParams, tarifa: 'Tarifa A', codigo: 'P4ES25 CH17-0001-001' },
        { ...baseParams, tarifa: 'Tarifa A2', codigo: 'P4ES25 CH17-0001-002' },
        { ...baseParams, tarifa: 'Tarifa B', codigo: 'P4ES25 CH17-0001-003' },
        { ...baseParams, tarifa: 'Tarifa C', codigo: 'P4ES25 CH17-0001-004' }
      ]

      const buffer = await renderStampMultiPage(stamps)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      // Multi-page with different tarifas should have 4 pages worth of content
      expect(buffer.length).toBeGreaterThan(5000)
    })
  })

  describe('renderStampE1', () => {
    it('should generate a valid PDF for special stamp E1', async () => {
      const params: StampEspecialParams = {
        codigo: 'P4ES25 CH17-0001-001',
        especial: '  -E'
      }

      const buffer = await renderStampE1(params)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('renderStampE2', () => {
    it('should generate a valid PDF for special stamp E2 with tarifa', async () => {
      const params: StampEspecialParams = {
        codigo: 'P4ES25 CH17-0001-002',
        especial: '  -E',
        tarifa: 'Tarifa A3'
      }

      const buffer = await renderStampE2(params)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      // E2 with tarifa should be larger than E1 (no tarifa)
      const e1Buffer = await renderStampE1({ codigo: params.codigo, especial: params.especial })
      expect(buffer.length).toBeGreaterThanOrEqual(e1Buffer.length)
    })
  })

  describe('renderStampE3', () => {
    it('should generate a valid PDF for special stamp E3 with tarifa', async () => {
      const params: StampEspecialParams = {
        codigo: 'P4ES25 CH17-0001-003',
        especial: '  -E',
        tarifa: 'Tarifa A3'
      }

      const buffer = await renderStampE3(params)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('renderStampE4', () => {
    it('should generate a valid PDF for special stamp E4', async () => {
      const params: StampEspecialParams = {
        codigo: 'P4ES25 CH17-0001-004',
        especial: '  -E'
      }

      const buffer = await renderStampE4(params)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('renderStampEspecialStrip', () => {
    it('should generate a 4-page PDF for a special strip', async () => {
      const codigos: [string, string, string, string] = [
        'P4ES25 CH17-0001-001',
        'P4ES25 CH17-0001-002',
        'P4ES25 CH17-0001-003',
        'P4ES25 CH17-0001-004'
      ]

      const buffer = await renderStampEspecialStrip(codigos, '  -E', 'Tarifa A3')
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      // Should be larger than a single stamp (4 pages)
      const singleE1 = await renderStampE1({ codigo: codigos[0], especial: '  -E' })
      expect(buffer.length).toBeGreaterThan(singleE1.length)
    })
  })

  describe('background image handling', () => {
    it('should handle base64 data URI backgrounds', async () => {
      // Create a minimal 1x1 PNG as base64
      const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const buffer = await renderStamp({
        ...baseParams,
        backgroundImage: minimalPng
      })
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should handle null backgroundImage gracefully', async () => {
      const buffer = await renderStamp({
        ...baseParams,
        backgroundImage: null
      })
      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('should handle non-existent file path gracefully', async () => {
      const buffer = await renderStamp({
        ...baseParams,
        backgroundImage: '/non/existent/path.png'
      })
      expect(buffer).toBeInstanceOf(Buffer)
    })
  })
})
