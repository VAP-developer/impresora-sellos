/**
 * Tests for the "Logo PNG" stamp option.
 *
 * Verifies that when printLogoPng is enabled, the model's logo PNG is drawn
 * immediately to the right of the fecha/localidad text block with a 5mm gap,
 * and that the previous overlay behaviour is preserved when it is disabled.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { join } from 'path'
import PDFDocument from 'pdfkit'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  renderStamp,
  setTestFontsPath,
  setTestImagesPath,
  formatFechaMonthYear,
  FONTS,
  STAMP_WIDTH,
  TEXT_LEFT_MM,
  TEXT_RIGHT_MARGIN_MM,
  LOGO_TEXT_GAP_MM,
  FECHA_LOCALIDAD_FONT_SIZE,
  type StampRenderParams
} from '../stamp-renderer'

const PROJECT_ROOT = join(__dirname, '../../../..')
const FONTS_PATH = join(PROJECT_ROOT, 'resources/fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources/images')
const REGULAR_FONT_FILE = join(FONTS_PATH, 'franklin_gothic.ttf')

const MM_TO_PT = 72 / 25.4

/** 1×1 transparent PNG as a data URI */
const PNG_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const baseParams: StampRenderParams = {
  tarifa: 'Tarifa A',
  tarifaDescripcion: 'Acceso General',
  fecha: '21-24 abril 2026',
  evento: 'Madrid',
  codigo: 'P26-4ES 0001-001',
  backgroundImage: null
}

interface ImageCall {
  x: number
  y: number
  options: Record<string, unknown>
}

let imageCalls: ImageCall[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalImage: any

beforeAll(() => {
  setTestFontsPath(FONTS_PATH)
  setTestImagesPath(IMAGES_PATH)

  // Spy on image drawing to capture real coordinates
  originalImage = PDFDocument.prototype.image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(PDFDocument.prototype as any).image = function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _src: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    x?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: any
  ) {
    imageCalls.push({ x: x ?? 0, y: y ?? 0, options: options ?? {} })
    return this
  }
})

afterAll(() => {
  setTestFontsPath(null)
  setTestImagesPath(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(PDFDocument.prototype as any).image = originalImage
})

beforeEach(() => {
  imageCalls = []
})

/**
 * Measures where the logo should start, using the same font metrics the
 * renderer uses: left margin + widest of (fecha, localidad) + 5mm gap.
 */
function expectedLogoX(fecha: string, evento: string): number {
  const probe = new PDFDocument({ size: [STAMP_WIDTH, STAMP_WIDTH], margin: 0 })
  probe.registerFont(FONTS.regular, REGULAR_FONT_FILE)
  probe.font(FONTS.regular).fontSize(FECHA_LOCALIDAD_FONT_SIZE)
  const widest = Math.max(
    probe.widthOfString(formatFechaMonthYear(fecha)),
    probe.widthOfString(evento)
  )
  probe.end()
  return TEXT_LEFT_MM * MM_TO_PT + widest + LOGO_TEXT_GAP_MM * MM_TO_PT
}

describe('Logo PNG placement', () => {
  describe('when printLogoPng is enabled', () => {
    it('draws the logo 5mm to the right of the fecha/localidad block', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })

      expect(imageCalls).toHaveLength(1)
      expect(imageCalls[0].x).toBeCloseTo(expectedLogoX(baseParams.fecha, baseParams.evento), 2)
    })

    it('keeps exactly a 5mm gap after the widest text line', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })

      const probe = new PDFDocument({ size: [STAMP_WIDTH, STAMP_WIDTH], margin: 0 })
      probe.registerFont(FONTS.regular, REGULAR_FONT_FILE)
      probe.font(FONTS.regular).fontSize(FECHA_LOCALIDAD_FONT_SIZE)
      const widest = Math.max(
        probe.widthOfString(formatFechaMonthYear(baseParams.fecha)),
        probe.widthOfString(baseParams.evento)
      )
      probe.end()

      const textRightEdge = TEXT_LEFT_MM * MM_TO_PT + widest
      const gapMm = (imageCalls[0].x - textRightEdge) / MM_TO_PT
      expect(gapMm).toBeCloseTo(LOGO_TEXT_GAP_MM, 2)
    })

    it('preserves the aspect ratio by using fit instead of a forced size', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })

      const { options } = imageCalls[0]
      expect(Array.isArray(options.fit)).toBe(true)
      expect(options.width).toBeUndefined()
      expect(options.height).toBeUndefined()
    })

    it('vertically centers the logo on the fecha/localidad block', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })

      expect(imageCalls[0].options.valign).toBe('center')
    })

    it('shifts the logo right when the locality is longer, avoiding overlap', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })
      const shortX = imageCalls[0].x

      imageCalls = []
      const longEvento = 'Santiago de Compostela'
      await renderStamp({
        ...baseParams,
        evento: longEvento,
        printLogoPng: true,
        logoPngImage: PNG_LOGO
      })

      expect(imageCalls[0].x).toBeGreaterThan(shortX)
      expect(imageCalls[0].x).toBeCloseTo(expectedLogoX(baseParams.fecha, longEvento), 2)
    })

    it('never draws the logo past the label right margin', async () => {
      await renderStamp({ ...baseParams, printLogoPng: true, logoPngImage: PNG_LOGO })

      const { x, options } = imageCalls[0]
      const fitWidth = (options.fit as number[])[0]
      expect(x + fitWidth).toBeLessThanOrEqual(
        STAMP_WIDTH - TEXT_RIGHT_MARGIN_MM * MM_TO_PT + 0.01
      )
    })

    it('draws the logo instead of the right-half overlay', async () => {
      await renderStamp({
        ...baseParams,
        overlayImage: PNG_LOGO,
        printLogoPng: true,
        logoPngImage: PNG_LOGO
      })

      // Only one image: the logo. The overlay must not be drawn at 27.5mm.
      expect(imageCalls).toHaveLength(1)
      expect(imageCalls[0].x).not.toBeCloseTo(27.5 * MM_TO_PT, 2)
    })

    it('draws nothing and does not throw when the logo image is missing', async () => {
      const buffer = await renderStamp({
        ...baseParams,
        printLogoPng: true,
        logoPngImage: null
      })

      expect(imageCalls).toHaveLength(0)
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('when printLogoPng is disabled', () => {
    it('still draws the overlay on the right half (unchanged behaviour)', async () => {
      await renderStamp({ ...baseParams, overlayImage: PNG_LOGO, printLogoPng: false })

      expect(imageCalls).toHaveLength(1)
      expect(imageCalls[0].x).toBeCloseTo(27.5 * MM_TO_PT, 2)
    })
  })
})
