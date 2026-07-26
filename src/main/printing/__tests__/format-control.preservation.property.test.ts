/**
 * format-control.preservation.property.test.ts
 *
 * Property 2: Preservation — Comportamiento existente sin cambios
 *
 * These tests observe and encode the CURRENT (unfixed) behavior that must NOT change
 * after the bugfix is applied. They run BEFORE the fix and MUST PASS on unfixed code.
 *
 * Observations on unfixed code:
 * - drawBackground(doc, backgroundImage) draws at x=0, y=0, width=STAMP_WIDTH, height=STAMP_HEIGHT
 * - drawTextLeft(doc, tarifa, ...) uses x=2mm
 * - drawTextLeft(doc, codigo, ...) uses x=2mm
 * - renderStampEspecialStrip() uses same layout (E1-E4 unchanged)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  renderStamp,
  renderStampMultiPage,
  renderStampEspecialStrip,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate arbitrary StampRenderParams with backgroundImage present */
const arbStampParamsWithBackground: fc.Arbitrary<StampRenderParams> = fc.record({
  tarifa: fc.string({ minLength: 1, maxLength: 20 }),
  fecha: fc.string({ minLength: 1, maxLength: 20 }),
  evento: fc.string({ minLength: 1, maxLength: 20 }),
  codigo: fc.string({ minLength: 1, maxLength: 30 }),
  backgroundImage: fc.constant(join(IMAGES_PATH, 'fondoetiqueta-nada.png')),
  overlayImage: fc.constant(null)
})

/** Generate arbitrary StampRenderParams (without overlay, just tarifa/codigo preservation) */
const arbStampParams: fc.Arbitrary<StampRenderParams> = fc.record({
  tarifa: fc.string({ minLength: 1, maxLength: 20 }),
  fecha: fc.string({ minLength: 1, maxLength: 20 }),
  evento: fc.string({ minLength: 1, maxLength: 20 }),
  codigo: fc.string({ minLength: 1, maxLength: 30 }),
  backgroundImage: fc.oneof(
    fc.constant(join(IMAGES_PATH, 'fondoetiqueta-nada.png')),
    fc.constant(null)
  ),
  overlayImage: fc.constant(null)
})

/** Generate arbitrary StampEspecialParams for tiras especiales */
const arbEspecialCodigos: fc.Arbitrary<[string, string, string, string]> = fc.tuple(
  fc.string({ minLength: 1, maxLength: 25 }),
  fc.string({ minLength: 1, maxLength: 25 }),
  fc.string({ minLength: 1, maxLength: 25 }),
  fc.string({ minLength: 1, maxLength: 25 })
)

const arbEspecialSuffix: fc.Arbitrary<string> = fc.oneof(
  fc.constant('  -E'),
  fc.constant('-E')
)

const arbTarifa: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 15 })

// ─── Preservation Property Tests ──────────────────────────────────────────────

describe('Property 2: Preservation — baseline behavior must not change after fix', () => {
  describe('Preservation: backgroundImage draws at full stamp size (0, 0, 55mm, 25mm)', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For all arbitrary StampRenderParams with backgroundImage:
     * background draws at (0, 0, STAMP_WIDTH, STAMP_HEIGHT)
     */
    it('for any StampRenderParams with backgroundImage, background draws at (0, 0, 55mm, 25mm)', async () => {
      await fc.assert(
        fc.asyncProperty(arbStampParamsWithBackground, async (params: StampRenderParams) => {
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
            imageCalls.length = 0
            await renderStamp(params)

            // The first image call is always the backgroundImage
            expect(imageCalls.length).toBeGreaterThanOrEqual(1)

            const bgCall = imageCalls[0]
            // Background should draw at x=0, y=0
            expect(bgCall.x).toBeCloseTo(0, 1)
            expect(bgCall.y).toBeCloseTo(0, 1)
            // Background should cover full stamp: width=STAMP_WIDTH, height=STAMP_HEIGHT
            expect(bgCall.width).toBeCloseTo(STAMP_WIDTH, 1)
            expect(bgCall.height).toBeCloseTo(STAMP_HEIGHT, 1)
          } finally {
            PDFDocument.prototype.image = originalImage
          }
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Preservation: tarifa text at x=2mm, codigo text at x=2mm', () => {
    /**
     * **Validates: Requirements 3.3, 3.4**
     *
     * For all arbitrary StampRenderParams: tarifa text at x=2mm, codigo text at x=2mm
     */
    it('for any StampRenderParams, tarifa is drawn at x=2mm and codigo at x=2mm', async () => {
      await fc.assert(
        fc.asyncProperty(arbStampParams, async (params: StampRenderParams) => {
          const PDFDocument = (await import('pdfkit')).default

          const textCalls: Array<{ text: string; x: number; y: number }> = []
          const originalText = PDFDocument.prototype.text
          const originalImage = PDFDocument.prototype.image

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

          PDFDocument.prototype.image = function () {
            return this
          }

          try {
            textCalls.length = 0
            await renderStamp(params)

            // tarifa is the first text drawn (left-aligned at x=2mm)
            const tarifaCall = textCalls.find((c) => c.text === params.tarifa)
            expect(tarifaCall).toBeDefined()
            const tarifaX_mm = tarifaCall!.x / MM_TO_PT
            expect(tarifaX_mm).toBeCloseTo(2, 1)

            // codigo is drawn left-aligned at x=2mm
            const codigoCall = textCalls.find((c) => c.text === params.codigo)
            expect(codigoCall).toBeDefined()
            const codigoX_mm = codigoCall!.x / MM_TO_PT
            expect(codigoX_mm).toBeCloseTo(2, 1)
          } finally {
            PDFDocument.prototype.text = originalText
            PDFDocument.prototype.image = originalImage
          }
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Preservation: tiras especiales layout unchanged (E1-E4)', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * For all tiras especiales: layout unchanged
     * - E1-E4 use backgrounds (TiraEspecial1-4.png)
     * - codigo at x=1.5mm
     * - especial at x=23.3mm
     */
    it('for any tira especial, codigo is at x=1.5mm and especial at x=23.3mm', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbEspecialCodigos,
          arbEspecialSuffix,
          arbTarifa,
          async (
            codigos: [string, string, string, string],
            especial: string,
            tarifa: string
          ) => {
            const PDFDocument = (await import('pdfkit')).default

            const textCalls: Array<{ text: string; x: number; y: number }> = []
            const imageCalls: Array<{ x: number; y: number; width: number; height: number }> = []
            const originalText = PDFDocument.prototype.text
            const originalImage = PDFDocument.prototype.image

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
              textCalls.length = 0
              imageCalls.length = 0
              await renderStampEspecialStrip(codigos, especial, tarifa)

              // All background images (E1-E4) should draw at full size (0, 0, STAMP_WIDTH, STAMP_HEIGHT)
              // There are 4 pages, each with a background
              expect(imageCalls.length).toBe(4)
              for (const imgCall of imageCalls) {
                expect(imgCall.x).toBeCloseTo(0, 1)
                expect(imgCall.y).toBeCloseTo(0, 1)
                expect(imgCall.width).toBeCloseTo(STAMP_WIDTH, 1)
                expect(imgCall.height).toBeCloseTo(STAMP_HEIGHT, 1)
              }

              // Find all codigo text calls (at x=1.5mm)
              const codigoCalls = textCalls.filter((c) =>
                codigos.includes(c.text)
              )
              // Should have 4 codigo texts (one per page)
              expect(codigoCalls.length).toBe(4)
              for (const codigoCall of codigoCalls) {
                const x_mm = codigoCall.x / MM_TO_PT
                expect(x_mm).toBeCloseTo(1.5, 1)
              }

              // Find all especial text calls (at x=23.3mm)
              const especialCalls = textCalls.filter((c) => c.text === especial)
              // Should have 4 especial texts (one per page)
              expect(especialCalls.length).toBe(4)
              for (const especialCall of especialCalls) {
                const x_mm = especialCall.x / MM_TO_PT
                expect(x_mm).toBeCloseTo(23.3, 1)
              }
            } finally {
              PDFDocument.prototype.text = originalText
              PDFDocument.prototype.image = originalImage
            }
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
