/**
 * format-control.bug-condition.property.test.ts
 *
 * Property 1: Bug Condition — overlay/texto mal posicionados
 *
 * CRITICAL: This test encodes the EXPECTED (correct) behavior.
 * On UNFIXED code, the test MUST FAIL — failure confirms the bugs exist.
 * After the fix is implemented, this test should PASS.
 *
 * Bug: renderStamp() draws overlayImage at x=0 full width instead of right half
 * Bug: renderStamp() positions evento/fecha text at xRight=53mm instead of <=27.5mm
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as fc from 'fast-check'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  renderStamp,
  renderStampMultiPage,
  setTestFontsPath,
  setTestImagesPath,
  STAMP_WIDTH,
  STAMP_HEIGHT
} from '../stamp-renderer'
import type { StampRenderParams } from '../stamp-renderer'

// ─── Test Setup ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, '../../../..')
const FONTS_PATH = join(PROJECT_ROOT, 'resources/fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources/images')

beforeAll(() => {
  setTestFontsPath(FONTS_PATH)
  setTestImagesPath(IMAGES_PATH)
})

afterAll(() => {
  setTestFontsPath(null)
  setTestImagesPath(null)
})

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate arbitrary StampRenderParams with overlayImage present */
const arbStampParamsWithOverlay: fc.Arbitrary<StampRenderParams> = fc.record({
  tarifa: fc.string({ minLength: 1, maxLength: 20 }),
  fecha: fc.string({ minLength: 1, maxLength: 20 }),
  evento: fc.string({ minLength: 1, maxLength: 20 }),
  codigo: fc.string({ minLength: 1, maxLength: 30 }),
  backgroundImage: fc.constant(join(IMAGES_PATH, 'fondoetiqueta-nada.png')),
  overlayImage: fc.constant(join(IMAGES_PATH, 'fondoetiqueta-nada.png'))
})

// ─── Bug Condition Property Tests ─────────────────────────────────────────────

describe('Property 1: Bug Condition — format control bugs exist in unfixed code', () => {
  describe('Bug: renderStamp() overlay MUST be positioned in right half', () => {
    it('overlayImage SHALL be drawn at x >= 27.5mm (right half), not x=0 full width', async () => {
      // We spy on PDFDocument.prototype.image to capture draw coordinates
      const PDFDocument = (await import('pdfkit')).default

      const imageCalls: Array<{ x: number; y: number; width: number; height: number }> = []

      const originalImage = PDFDocument.prototype.image
      PDFDocument.prototype.image = function (
        src: unknown,
        x?: number,
        y?: number,
        options?: { width?: number; height?: number }
      ) {
        imageCalls.push({
          x: x ?? 0,
          y: y ?? 0,
          width: options?.width ?? 0,
          height: options?.height ?? 0
        })
        // Don't actually render (avoid file system issues)
        return this
      }

      try {
        const params: StampRenderParams = {
          tarifa: 'Tarifa A',
          fecha: '21-24 abril 2025',
          evento: 'Madrid',
          codigo: 'P4ES25 CH17-0001-001',
          backgroundImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png'),
          overlayImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png')
        }

        imageCalls.length = 0
        await renderStamp(params)

        // With both backgroundImage and overlayImage, there should be 2 image calls
        expect(imageCalls.length).toBeGreaterThanOrEqual(2)

        // The second image call is the overlayImage
        // Expected behavior: overlay should be at x >= 27.5mm * MM_TO_PT (~77.95pt)
        const MM_TO_PT = 72 / 25.4
        const overlayCall = imageCalls[1]
        const overlayX_mm = overlayCall.x / MM_TO_PT

        // The overlay MUST be in the right half (x >= 27.5mm)
        expect(overlayX_mm).toBeGreaterThanOrEqual(27.5)
      } finally {
        PDFDocument.prototype.image = originalImage
      }
    })

    it('overlayImage SHALL NOT cover full stamp width', async () => {
      const PDFDocument = (await import('pdfkit')).default

      const imageCalls: Array<{ x: number; y: number; width: number; height: number }> = []

      const originalImage = PDFDocument.prototype.image
      PDFDocument.prototype.image = function (
        _src: unknown,
        x?: number,
        y?: number,
        options?: { width?: number; height?: number }
      ) {
        imageCalls.push({
          x: x ?? 0,
          y: y ?? 0,
          width: options?.width ?? 0,
          height: options?.height ?? 0
        })
        return this
      }

      try {
        const params: StampRenderParams = {
          tarifa: 'Tarifa B',
          fecha: '15-18 mayo 2025',
          evento: 'Barcelona',
          codigo: 'P4ES25 CH17-0002-001',
          backgroundImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png'),
          overlayImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png')
        }

        imageCalls.length = 0
        await renderStamp(params)

        // The overlay (second call) should have width <= half of stamp width
        const overlayCall = imageCalls[1]
        const halfWidth = STAMP_WIDTH / 2

        // Expected behavior: overlay width should be at most half the stamp width
        expect(overlayCall.width).toBeLessThanOrEqual(halfWidth + 0.01)
      } finally {
        PDFDocument.prototype.image = originalImage
      }
    })
  })

  describe('Bug: renderStamp() texto evento/fecha MUST be in left half', () => {
    it('evento text xRight SHALL be <= 27.5mm (left half), not 53mm', async () => {
      const PDFDocument = (await import('pdfkit')).default

      const textCalls: Array<{ text: string; x: number; y: number }> = []

      const originalText = PDFDocument.prototype.text
      const originalWidthOfString = PDFDocument.prototype.widthOfString

      // Mock widthOfString to return a reasonable width
      PDFDocument.prototype.widthOfString = function (_text: string) {
        return 30 // ~10mm in points at typical sizes
      }

      PDFDocument.prototype.text = function (
        text: string,
        x?: number,
        y?: number,
        _options?: unknown
      ) {
        if (typeof x === 'number' && typeof y === 'number') {
          textCalls.push({ text, x, y })
        }
        return this
      }

      // Also mock image to avoid fs errors
      const originalImage = PDFDocument.prototype.image
      PDFDocument.prototype.image = function () {
        return this
      }

      try {
        const params: StampRenderParams = {
          tarifa: 'Tarifa A',
          fecha: '21-24 abril 2025',
          evento: 'Madrid',
          codigo: 'P4ES25 CH17-0001-001',
          backgroundImage: null,
          overlayImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png')
        }

        textCalls.length = 0
        await renderStamp(params)

        // drawTextRight calculates: x = xRight_mm * MM_TO_PT - textWidth
        // For evento with xRight=53mm: x = 53 * 2.83465 - 30 = ~150.2 - 30 = ~120.2pt
        // For evento with xRight=26mm: x = 26 * 2.83465 - 30 = ~73.7 - 30 = ~43.7pt
        //
        // The right edge of the text = x + textWidth
        // Expected behavior: rightEdge should be <= 27.5mm * MM_TO_PT (~77.95pt)
        const MM_TO_PT = 72 / 25.4
        const maxRightEdgePt = 27.5 * MM_TO_PT

        // Find the evento text call (right-aligned, "Madrid")
        const eventoCall = textCalls.find((c) => c.text === 'Madrid')
        expect(eventoCall).toBeDefined()

        // The right edge of evento text = x + textWidth (30pt mock)
        const eventoRightEdge = eventoCall!.x + 30
        expect(eventoRightEdge).toBeLessThanOrEqual(maxRightEdgePt)
      } finally {
        PDFDocument.prototype.text = originalText
        PDFDocument.prototype.widthOfString = originalWidthOfString
        PDFDocument.prototype.image = originalImage
      }
    })

    it('fecha text xRight SHALL be <= 27.5mm (left half), not 53mm', async () => {
      const PDFDocument = (await import('pdfkit')).default

      const textCalls: Array<{ text: string; x: number; y: number }> = []

      const originalText = PDFDocument.prototype.text
      const originalWidthOfString = PDFDocument.prototype.widthOfString

      PDFDocument.prototype.widthOfString = function (_text: string) {
        return 30
      }

      PDFDocument.prototype.text = function (
        text: string,
        x?: number,
        y?: number,
        _options?: unknown
      ) {
        if (typeof x === 'number' && typeof y === 'number') {
          textCalls.push({ text, x, y })
        }
        return this
      }

      const originalImage = PDFDocument.prototype.image
      PDFDocument.prototype.image = function () {
        return this
      }

      try {
        const params: StampRenderParams = {
          tarifa: 'Tarifa A',
          fecha: '21-24 abril 2025',
          evento: 'Madrid',
          codigo: 'P4ES25 CH17-0001-001',
          backgroundImage: null,
          overlayImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png')
        }

        textCalls.length = 0
        await renderStamp(params)

        const MM_TO_PT = 72 / 25.4
        const maxRightEdgePt = 27.5 * MM_TO_PT

        // Find the fecha text call (right-aligned, "21-24 abril 2025")
        const fechaCall = textCalls.find((c) => c.text === '21-24 abril 2025')
        expect(fechaCall).toBeDefined()

        // The right edge of fecha text = x + textWidth (30pt mock)
        const fechaRightEdge = fechaCall!.x + 30
        expect(fechaRightEdge).toBeLessThanOrEqual(maxRightEdgePt)
      } finally {
        PDFDocument.prototype.text = originalText
        PDFDocument.prototype.widthOfString = originalWidthOfString
        PDFDocument.prototype.image = originalImage
      }
    })
  })

  describe('Bug: renderStampMultiPage() same bugs apply', () => {
    it('overlay in multi-page MUST also be in right half', async () => {
      const PDFDocument = (await import('pdfkit')).default

      const imageCalls: Array<{ x: number; y: number; width: number; height: number }> = []

      const originalImage = PDFDocument.prototype.image
      PDFDocument.prototype.image = function (
        _src: unknown,
        x?: number,
        y?: number,
        options?: { width?: number; height?: number }
      ) {
        imageCalls.push({
          x: x ?? 0,
          y: y ?? 0,
          width: options?.width ?? 0,
          height: options?.height ?? 0
        })
        return this
      }

      try {
        const stamps: StampRenderParams[] = [
          {
            tarifa: 'Tarifa A',
            fecha: '21-24 abril 2025',
            evento: 'Madrid',
            codigo: 'P4ES25 CH17-0001-001',
            backgroundImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png'),
            overlayImage: join(IMAGES_PATH, 'fondoetiqueta-nada.png')
          }
        ]

        imageCalls.length = 0
        await renderStampMultiPage(stamps)

        // Same as renderStamp: second image call is the overlay
        expect(imageCalls.length).toBeGreaterThanOrEqual(2)

        const MM_TO_PT = 72 / 25.4
        const overlayCall = imageCalls[1]
        const overlayX_mm = overlayCall.x / MM_TO_PT

        expect(overlayX_mm).toBeGreaterThanOrEqual(27.5)
      } finally {
        PDFDocument.prototype.image = originalImage
      }
    })
  })
})
