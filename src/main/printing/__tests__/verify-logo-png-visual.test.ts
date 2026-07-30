/**
 * verify-logo-png-visual.test.ts
 *
 * Visual verification for the "Logo PNG" stamp option.
 *
 * Generates real stamp PDFs using the actual fair images from
 * `bbdd-ferias/2026/serpiente/` and writes them to `out/logo-png-samples/`
 * so the result can be inspected in a PDF viewer.
 *
 * Run with:
 *   npx vitest run src/main/printing/__tests__/verify-logo-png-visual.test.ts
 *
 * Samples generated:
 *   01-logo-only.pdf              → logo PNG, no background
 *   02-logo-over-fondo.pdf        → fondo JPG + logo PNG (the real sale case)
 *   03-overlay-no-logo.pdf        → old behaviour (sello as right-half overlay)
 *   04-logo-long-locality.pdf     → logo pushed right by a long locality
 *   05-logo-multipage-group.pdf   → 4-page group, the path used by real sales
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { vi } from 'vitest'

// Mock @electron-toolkit/utils to avoid the Electron dependency
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  setTestFontsPath,
  setTestImagesPath,
  renderStamp,
  renderStampMultiPage,
  computeLogoBox,
  STAMP_WIDTH,
  STAMP_WIDTH_MM,
  STAMP_HEIGHT_MM,
  type StampRenderParams
} from '../stamp-renderer'
import PDFDocument from 'pdfkit'

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..')
const OUTPUT_DIR = join(PROJECT_ROOT, 'out', 'logo-png-samples')
const FONTS_PATH = join(PROJECT_ROOT, 'resources', 'fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources', 'images')
const FAIR_DIR = join(PROJECT_ROOT, 'bbdd-ferias', '2026', 'serpiente')

const MM_TO_PT = 72 / 25.4

/** Loads a fair image from disk as a base64 data URI, mirroring what the DB stores. */
function loadAsDataUri(filename: string, mime: string): string | null {
  const path = join(FAIR_DIR, filename)
  if (!existsSync(path)) return null
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

const FONDO_JPG = loadAsDataUri('Año Serpiente-fondo.jpg', 'image/jpeg')
const SELLO_PNG = loadAsDataUri('Año Serpiente-sello.png', 'image/png')

const baseParams: StampRenderParams = {
  tarifa: 'Tarifa A',
  tarifaDescripcion: 'Acceso General',
  fecha: '21-24 abril 2026',
  evento: 'Madrid',
  codigo: 'P4ES26 CH17-0042-001',
  backgroundImage: null
}

function savePdf(filename: string, buffer: Buffer): string {
  const filepath = join(OUTPUT_DIR, filename)
  writeFileSync(filepath, buffer)
  return filepath
}

describe('Logo PNG visual verification', () => {
  beforeAll(() => {
    setTestFontsPath(FONTS_PATH)
    setTestImagesPath(IMAGES_PATH)
    mkdirSync(OUTPUT_DIR, { recursive: true })
  })

  afterAll(() => {
    setTestFontsPath(null)
    setTestImagesPath(null)
  })

  it('has the real fair images available on disk', () => {
    expect(FONDO_JPG, `missing fondo JPG in ${FAIR_DIR}`).not.toBeNull()
    expect(SELLO_PNG, `missing sello PNG in ${FAIR_DIR}`).not.toBeNull()
    console.log(`    🖼  fondo: ${FONDO_JPG!.length} chars (data URI)`)
    console.log(`    🖼  sello: ${SELLO_PNG!.length} chars (data URI)`)
  })

  it('reports the computed logo box in mm', () => {
    const probe = new PDFDocument({ size: [STAMP_WIDTH, STAMP_WIDTH], margin: 0 })
    probe.registerFont('FranklinGothic', join(FONTS_PATH, 'franklin_gothic.ttf'))
    const box = computeLogoBox(probe, baseParams.fecha, baseParams.evento)
    probe.end()

    expect(box).not.toBeNull()
    console.log(
      `    📐 logo box → x=${(box!.x / MM_TO_PT).toFixed(2)}mm ` +
        `y=${(box!.y / MM_TO_PT).toFixed(2)}mm ` +
        `w=${(box!.width / MM_TO_PT).toFixed(2)}mm ` +
        `h=${(box!.height / MM_TO_PT).toFixed(2)}mm ` +
        `(canvas ${STAMP_WIDTH_MM}×${STAMP_HEIGHT_MM}mm)`
    )
  })

  it('generates a stamp with only the logo PNG', async () => {
    const buffer = await renderStamp({
      ...baseParams,
      printLogoPng: true,
      logoPngImage: SELLO_PNG
    })

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    console.log(`    📄 ${savePdf('01-logo-only.pdf', buffer)} (${buffer.length} bytes)`)
  })

  it('generates a stamp with fondo JPG + logo PNG (real sale case)', async () => {
    const buffer = await renderStamp({
      ...baseParams,
      backgroundImage: FONDO_JPG,
      overlayImage: SELLO_PNG,
      printLogoPng: true,
      logoPngImage: SELLO_PNG
    })

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    console.log(`    📄 ${savePdf('02-logo-over-fondo.pdf', buffer)} (${buffer.length} bytes)`)
  })

  it('generates a stamp with the old right-half overlay for comparison', async () => {
    const buffer = await renderStamp({
      ...baseParams,
      backgroundImage: FONDO_JPG,
      overlayImage: SELLO_PNG,
      printLogoPng: false
    })

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    console.log(`    📄 ${savePdf('03-overlay-no-logo.pdf', buffer)} (${buffer.length} bytes)`)
  })

  it('generates a stamp where a long locality pushes the logo right', async () => {
    const buffer = await renderStamp({
      ...baseParams,
      evento: 'Santiago de Compostela',
      printLogoPng: true,
      logoPngImage: SELLO_PNG
    })

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    console.log(`    📄 ${savePdf('04-logo-long-locality.pdf', buffer)} (${buffer.length} bytes)`)
  })

  it('generates a 4-stamp group via renderStampMultiPage (real sale path)', async () => {
    const stamp: StampRenderParams = {
      ...baseParams,
      backgroundImage: FONDO_JPG,
      printLogoPng: true,
      logoPngImage: SELLO_PNG
    }

    const buffer = await renderStampMultiPage([
      { ...stamp, codigo: 'P4ES26 CH17-0042-001' },
      { ...stamp, codigo: 'P4ES26 CH17-0042-002' },
      { ...stamp, codigo: 'P4ES26 CH17-0042-003' },
      { ...stamp, codigo: 'P4ES26 CH17-0042-004' }
    ])

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    console.log(`    📄 ${savePdf('05-logo-multipage-group.pdf', buffer)} (${buffer.length} bytes)`)
  })
})
