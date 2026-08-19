/**
 * stamp-renderer.ts
 *
 * Generates PDF stamp labels (etiquetas) at 55mm × 25mm.
 * Replicates the legacy Python reportlab logic from report.py using pdfkit.
 *
 * Coordinate system:
 * - pdfkit uses points (72pt = 1 inch, 1mm = 2.83465pt)
 * - Origin is TOP-LEFT in pdfkit (unlike reportlab which uses BOTTOM-LEFT)
 * - All legacy coordinates are converted from bottom-left to top-left
 *
 * Layout (genStampI/genStampD):
 *   - Background image: full 55×25mm
 *   - Nombre Tarifa: FranklinGothic 13pt at (2mm, 50mm from bottom)
 *   - Descripción Tarifa: FranklinGothic 9pt at (2mm, 46.5mm from bottom)
 *   - Fecha evento (mes+año): FranklinGothic 9pt at (2mm, 43mm from bottom)
 *   - Localidad evento: FranklinGothic 9pt at (2mm, 39.5mm from bottom)
 *   - Código L1: FranklinGothic 8pt at (2mm, 36mm from bottom)
 *   - Código L2: FranklinGothic 7pt at (2mm, 32.5mm from bottom)
 */

import PDFDocument from 'pdfkit'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { existsSync } from 'fs'
import { ConfigRepository } from '../database/repositories/config.repository'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Conversion factor: 1mm = 72/25.4 points ------------------------ AQUI: 1 mm más en la etiqueta = pdf tamaño verdadero -----------
 es la unidad de pdfkit que usa internamente */
const MM_TO_PT = 72 / 25.4 // ≈ 2.83465
export const STAMP_WIDTH_MM = 55 // medida MAYOR (ROTACIÓN 90)
export const STAMP_HEIGHT_MM = 55 // medida mayor O IGUAL (ROTACIÓN 0) COORDENADAS TEXTO EN BASE HEIGHT
// Constantes finales
export const STAMP_WIDTH = STAMP_WIDTH_MM * MM_TO_PT // ~155.91 pt
export const STAMP_HEIGHT = STAMP_HEIGHT_MM * MM_TO_PT // ~70.87 pt

// ─────────────────────────────────────────────
// Font & Resource Path Helpers
// ─────────────────────────────────────────────

/** Font logical names */
export const FONTS = {
  regular: 'FranklinGothic',
  bold: 'FranklinGothicBold',
  condensed: 'FranklinGothicCondensed'
} as const

// ───────────────────────────────────────────── ************ NUEVO TAMAÑO Y COORDENADAS TEXTO ETIQUETA ****************
// Text Layout Constants
// ───────────────────────────────────────────── ------------------------- AQUI NUEVO --------------------
// Vertical positions are yBottom_mm (distance from the bottom of the canvas).
// The logo placement is derived from the fecha/localidad block, so these
// constants must be used by both the text drawing and the logo positioning
// to keep them in sync.

/** Left margin shared by all text fields (mm) */
export const TEXT_LEFT_MM = 2         //-------------------------------***  LEFT -CAMBIAR COLUMNA
/** Right margin kept free at the label edge (mm) */
export const TEXT_RIGHT_MARGIN_MM = 2  //-------------------------------***  RIGTH -CAMBIAR COLUMNA ¿?     
/** Font size used for the fecha and localidad lines (pt) */
export const FECHA_LOCALIDAD_FONT_SIZE = 9 //-------------------------------***  3 y 4 -CAMBIAR TAMAÑO TTF
/** yBottom of the fecha line (mm) */
export const FECHA_Y_MM = 43                //-------------------------------***  3-CAMBIAR fecha --------- VAR ETI
/** yBottom of the localidad line (mm) */
export const LOCALIDAD_Y_MM = 39.5          //-------------------------------***  4-CAMBIAR localidad ------ VAR ETI
/** Horizontal gap between the fecha/localidad text and the logo PNG (mm) */
export const LOGO_TEXT_GAP_MM = 5

/**
 * Resolves the path to the resources/fonts directory.
 * Override via `setTestFontsPath()` for testing.
 */
let _fontsPathOverride: string | null = null

// Función test de fuentes
export function setTestFontsPath(path: string | null): void {
  _fontsPathOverride = path
}

// Gestion de las fuentes
export function getFontsPath(): string {
  if (_fontsPathOverride) return _fontsPathOverride
  if (is.dev) {
    return join(__dirname, '../../resources/fonts')
  }
  return join(process.resourcesPath, 'fonts')
}

//==============================================================================

/**
 * Resolves path to the resources/images directory.
 * Override via `setTestImagesPath()` for testing.
 */
let _imagesPathOverride: string | null = null

export function setTestImagesPath(path: string | null): void {
  _imagesPathOverride = path
}

export function getImagesPath(): string {
  if (_imagesPathOverride) return _imagesPathOverride
  if (is.dev) {
    return join(__dirname, '../../resources/images')
  }
  return join(process.resourcesPath, 'images')
}

// ─────────────────────────────────────────────
// Code Formatting
// ─────────────────────────────────────────────

/**
 * Extracts only month and year from a fecha string.
 *
 * Input:  "21-24 abril 2025"
 * Output: "abril 2025"
 *
 * Handles formats like "21-24 abril 2025", "5-8 junio 2025", "1 mayo 2026"
 */
export function formatFechaMonthYear(fecha: string): string {
  // Match the month name (Spanish) followed by the year at the end
  const match = fecha.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}$/i)
  if (match) {
    return match[0]
  }
  // Fallback: return as-is if can't parse
  return fecha
}

/**
 * Transforms a stamp code into two-line display format.
 *
 * New format:
 *   Input:  "J26-8GI 0001-001"
 *   Output: { line1: "J26-8GI", line2: "0001-001" }
 *
 * Legacy format (backwards compat):
 *   Input:  "P4ES26 CH17-0001-001"
 *   Output: { line1: "CH17-4ES", line2: "0001-001" }
 *
 * The code is always split on the space character:
 * - Line 1: everything before the space (the fair code identifier)
 * - Line 2: everything after the space (the serial numbers)
 */
export function formatCodigoLines(codigo: string): { line1: string; line2: string } {
  const spaceIdx = codigo.indexOf(' ')
  if (spaceIdx === -1) {
    // Fallback: can't parse, return as-is on one line
    return { line1: codigo, line2: '' }
  }

  const line1 = codigo.substring(0, spaceIdx)
  const line2 = codigo.substring(spaceIdx + 1)

  return { line1, line2 }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * Layout options for stamp text positioning relative to the image.
 * - 'derecha': Image on the right, text on the left (default)
 * - 'izquierda': Image on the left, text on the right
 * - 'inferior': Image on the bottom, text split top left/right
 * - 'superior': Image on the top, text split bottom left/right
 */
export type StampLayout = 'derecha' | 'izquierda' | 'inferior' | 'superior'

/** Input parameters for rendering a standard stamp (with background image) */
export interface StampRenderParams {
  /** Tarifa display text, e.g. "Tarifa A", "Tarifa B" */
  tarifa: string
  /** Tarifa description text (second line below tarifa name) */
  tarifaDescripcion?: string
  /** Date text for the stamp, e.g. "21-24 abril 2025" */
  fecha: string
  /** Event/locality text, e.g. "Madrid" */
  evento: string
  /** Formatted label code, e.g. "P4ES25 CH17-0001-001" */
  codigo: string
  /**
   * Background image as either:
   * - A file path to a PNG/JPEG file (absolute path)
   * - A base64 data URI string ("data:image/png;base64,...")
   * - null/undefined for no background
   */
  backgroundImage?: string | null
  /**
   * Overlay image rendered on top of the background but below text.
   * Used for sello layer when both fondo (background) and sello are active.
   * Same format as backgroundImage (file path or data URI).
   */
  overlayImage?: string | null
  /**
   * When true, renders the logo PNG on the right side of the text fields.
   * The logo is rendered as a small image next to the text content.
   */
  printLogoPng?: boolean
  /**
   * Logo PNG image to render on the right when printLogoPng is true.
   * Same format as backgroundImage (file path or data URI).
   */
  logoPngImage?: string | null
  /**
   * Layout template for text positioning. Defaults to 'derecha' if not specified.
   */
  layout?: StampLayout
}

/** Input parameters for rendering a special strip stamp (tira especial) */
export interface StampEspecialParams {
  /** Formatted label code */
  codigo: string
  /** Special suffix text (e.g. "  -E" or "-E") */
  especial: string
  /** Optional tarifa text (used in E2 and E3 variants) */
  tarifa?: string
}

// ─────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────

/**
 * Reads the printRotation180 setting from the config repository.
 * Returns false if the DB is unavailable (e.g. in unit tests).
 */
function shouldRotate180(): boolean {
  try {
    const configRepo = new ConfigRepository()
    return configRepo.getPrintRotation()
  } catch {
    return false
  }
}

/** Height of the physical label in mm (the printer only prints this area) */
const LABEL_HEIGHT_MM = 25

/**
 * Applies a 180° rotation for printers that feed labels inverted.
 *
 * Strategy: rotate 180° around the center of the physical label area (25mm tall),
 * which occupies the top portion of the 55mm canvas.
 * The center of the printable area in pdfkit coordinates is at:
 *   X = STAMP_WIDTH / 2, Y = (LABEL_HEIGHT_MM / 2) * MM_TO_PT
 */
function applyRotation180(doc: PDFKit.PDFDocument): void {
  const centerX = STAMP_WIDTH / 2
  const centerY = (LABEL_HEIGHT_MM / 2) * MM_TO_PT
  doc.rotate(180, { origin: [centerX, centerY] })
}

/**
 * Registers Franklin Gothic fonts on a PDFDocument instance using absolute file paths.
 */
function registerFonts(doc: PDFKit.PDFDocument): void {
  const fontsPath = getFontsPath()
  const regularPath = join(fontsPath, 'franklin_gothic.ttf')
  const boldPath = join(fontsPath, 'franklin_gothic_bold.ttf')
  const condensedPath = join(fontsPath, 'franklin_gothic_condensed.ttf')

  if (existsSync(regularPath)) {
    doc.registerFont(FONTS.regular, regularPath)
  }
  if (existsSync(boldPath)) {
    doc.registerFont(FONTS.bold, boldPath)
  }
  if (existsSync(condensedPath)) {
    doc.registerFont(FONTS.condensed, condensedPath)
  }
}

/**
 * Converts a bottom-left Y coordinate (reportlab convention) to pdfkit top-left Y. ---------- AQUI
 * In reportlab: Y=0 is bottom, increases upward.
 * In pdfkit: Y=0 is top, increases downward.
 */
function bottomToTop(bottomY_mm: number, fontSizePt: number): number {
  const bottomYPt = bottomY_mm * MM_TO_PT
 return STAMP_HEIGHT - bottomYPt - fontSizePt
}

/**
 * Draws right-aligned text. xRight_mm is the right edge where text ends.
 */
function drawTextRight(
  doc: PDFKit.PDFDocument,
  text: string,
  fontName: string,
  fontSize: number,
  xRight_mm: number,
  yBottom_mm: number
): void {
  doc.font(fontName).fontSize(fontSize)
  const textWidth = doc.widthOfString(text)
  const x = xRight_mm * MM_TO_PT - textWidth
  const y = bottomToTop(yBottom_mm, fontSize)
  doc.text(text, x, y, { lineBreak: false })
}

/**
 * Draws left-aligned text. x_mm is the left edge coordinate.
 */
function drawTextLeft(
  doc: PDFKit.PDFDocument,
  text: string,
  fontName: string,
  fontSize: number,
  x_mm: number,
  yBottom_mm: number
): void {
  doc.font(fontName).fontSize(fontSize)
  const x = x_mm * MM_TO_PT
  const y = bottomToTop(yBottom_mm, fontSize)
  doc.text(text, x, y, { lineBreak: false })
}

/**
 * Pre-decodes all unique base64 images from a stamp batch into reusable Buffers.
 * File paths are skipped — PDFKit reads them directly from the filesystem.
 * Malformed base64 entries are silently skipped (don't abort the batch).
 */
function buildImageCache(stamps: StampRenderParams[]): Map<string, Buffer> {
  const cache = new Map<string, Buffer>()

  for (const stamp of stamps) {
    for (const src of [stamp.backgroundImage, stamp.overlayImage, stamp.logoPngImage]) {
      if (!src || cache.has(src)) continue
      if (src.startsWith('data:')) {
        const base64Data = src.split(',')[1]
        if (base64Data) {
          try {
            cache.set(src, Buffer.from(base64Data, 'base64'))
          } catch {
            // Malformed base64 — skip, drawBackground/drawOverlay will handle gracefully
          }
        }
      }
      // File paths no se cachean como Buffer — PDFKit los lee directamente del FS
    }
  }

  return cache
}

/**
 * Draws the background image on the stamp (full cover 55×25mm).
 * Handles file paths and base64 data URIs.
 * When imageCache is provided and contains the imageSource key, uses the cached Buffer
 * instead of re-decoding base64 (avoids redundant decoding in multi-page batches).
 */
function drawBackground(
  doc: PDFKit.PDFDocument,
  imageSource: string | null | undefined,
  imageCache?: Map<string, Buffer>
): void {
  if (!imageSource) return

  try {
    if (imageSource.startsWith('data:')) {
      const cached = imageCache?.get(imageSource)
      if (cached) {
        doc.image(cached, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
      } else {
        // Fallback: decode inline (para llamadores sin caché, e.g. renderStamp individual)
        const base64Data = imageSource.split(',')[1]
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64')
          doc.image(buffer, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
        }
      }
    } else if (existsSync(imageSource)) {
      doc.image(imageSource, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
    }
  } catch {
    // Gracefully ignore image errors (matches legacy behavior)
  }
}

/**
 * Draws the overlay image on the right half of the stamp (27.5mm–55mm x, 0–25mm y). --------------- AQUI 27.5 ----------
 * Used for sello layer that should only occupy the right half of the label.
 * Handles file paths and base64 data URIs.
 * When imageCache is provided and contains the key, uses the pre-decoded Buffer
 * instead of re-decoding inline (performance optimisation for multi-page batches).
 */
function drawOverlay(
  doc: PDFKit.PDFDocument,
  imageSource: string | null | undefined,
  imageCache?: Map<string, Buffer>
): void {
  if (!imageSource) return

  const overlayX = 27.5 * MM_TO_PT
  const overlayWidth = 27.5 * MM_TO_PT

  try {
    if (imageSource.startsWith('data:')) {
      const cached = imageCache?.get(imageSource)
      if (cached) {
        doc.image(cached, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT })
      } else {
        const base64Data = imageSource.split(',')[1]
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64')
          doc.image(buffer, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT })
        }
      }
    } else if (existsSync(imageSource)) {
      doc.image(imageSource, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT })
    }
  } catch {
    // Gracefully ignore image errors (matches legacy behavior)
  }
}

/**
 * Computes the logo PNG placement box. --------------------------- AQUI LOGO ------------------- L O G O --------
 *
 * The logo is positioned relative to the text block but scaled 3× larger than
 * the original text-height-based box, shifted 5mm down and 10mm to the left
 * to give it more visual presence on the label.
 *
 * Exported for testing.
 */
export function computeLogoBox(
  doc: PDFKit.PDFDocument,
  fecha: string,
  evento: string
): { x: number; y: number; width: number; height: number } | null {
  doc.font(FONTS.regular).fontSize(FECHA_LOCALIDAD_FONT_SIZE)

  const fechaWidth = doc.widthOfString(formatFechaMonthYear(fecha))
  const eventoWidth = doc.widthOfString(evento)
  const textBlockWidth = Math.max(fechaWidth, eventoWidth)

  // X position: right of the text block + gap, shifted left
  //const baseX = TEXT_LEFT_MM * MM_TO_PT + textBlockWidth + LOGO_TEXT_GAP_MM * MM_TO_PT
  const baseX = 88
  const x = baseX - 31 * MM_TO_PT

  // Vertical: use bottomToTop for the same coordinate system as text
  const top = bottomToTop(FECHA_Y_MM, FECHA_LOCALIDAD_FONT_SIZE)
  const bottom = bottomToTop(LOCALIDAD_Y_MM, FECHA_LOCALIDAD_FONT_SIZE) + FECHA_LOCALIDAD_FONT_SIZE
  const baseHeight = bottom - top
  const height = 160
  const y = top - 25 * MM_TO_PT

  // Width scaled proportionally, capped to available space
  const maxWidth = 100
  const width = 155

  if (width <= 0 || height <= 0) return null

  return { x, y, width, height }
}

/**
 * Draws the logo PNG immediately to the right of the fecha/localidad block,
 * separated by LOGO_TEXT_GAP_MM (5mm).
 *
 * The image is fitted inside the available box preserving its aspect ratio and
 * aligned to the left/vertical-center of that box, so it visually hangs right
 * next to the text. Handles file paths and base64 data URIs.
 */
function drawLogoPng(
  doc: PDFKit.PDFDocument,
  imageSource: string | null | undefined,
  fecha: string,
  evento: string,
  imageCache?: Map<string, Buffer>
): void {
  if (!imageSource) return

  const box = computeLogoBox(doc, fecha, evento)
  if (!box) return

  const options: PDFKit.Mixins.ImageOption = {
    fit: [box.width, box.height],
    valign: 'center'
  }

  try {
    if (imageSource.startsWith('data:')) {
      const cached = imageCache?.get(imageSource)
      if (cached) {
        doc.image(cached, box.x, box.y, options)
      } else {
        const base64Data = imageSource.split(',')[1]
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64')
          doc.image(buffer, box.x, box.y, options)
        }
      }
    } else if (existsSync(imageSource)) {
      doc.image(imageSource, box.x, box.y, options)
    }
  } catch {
    // Gracefully ignore image errors
  }
}

/**
 * Resolves the default blank background image path.
 */
export function getDefaultBackgroundPath(): string | null {
  const imgPath = join(getImagesPath(), 'fondoetiqueta-nada.png')
  return existsSync(imgPath) ? imgPath : null
}

/**
 * Collects a PDFDocument stream into a Buffer.
 */
function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generates a single stamp PDF as a Buffer./ evento / fecha -------------------------------------------------- individual
 * Page is portrait (25×55mm) with content rotated 90° CCW so that the Brother
 * TD-4100N prints it horizontally when feeding along the 55mm side.
 *
 * Layout (in logical landscape coordinates after rotation):
 *   1. Background image (full 55×25mm)
 *   2. Overlay image (right half 27.5–55mm × 25mm), or — when printLogoPng is
 *      set — the model's logo PNG placed 5mm to the right of the
 *      fecha/localidad text block instead of the overlay
 *   3. Nombre Tarifa: FranklinGothic 13pt at (2mm, 50mm from bottom)
 *   4. Descripción Tarifa: FranklinGothic 9pt at (2mm, 46.5mm from bottom)
 *   5. Fecha evento (mes+año): FranklinGothic 9pt at (2mm, 43mm from bottom)
 *   6. Localidad evento: FranklinGothic 9pt at (2mm, 39.5mm from bottom)
 *   7. Código L1: FranklinGothic 8pt at (2mm, 36mm from bottom)
 *   8. Código L2: FranklinGothic 7pt at (2mm, 32.5mm from bottom)
 */
export async function renderStamp(params: StampRenderParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT], // ancho x alto en puntos (55mm  160 x 25mm 71 )
    margin: 0,
    //layout: 'portrait',
    info: { Title: 'Etiqueta', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)



  registerFonts(doc)

  // Apply 180° rotation if enabled (for printers that feed labels inverted)
  if (shouldRotate180()) {
    applyRotation180(doc)
  }

  drawBackground(doc, params.backgroundImage)
  
  // If printLogoPng is true, draw the logo to the right of fecha/localidad
  // instead of using the full right-half overlay
  if (params.printLogoPng && params.logoPngImage) {
    drawLogoPng(doc, params.logoPngImage, params.fecha, params.evento)
  } else {
    // Otherwise, use the standard overlay behavior
    drawOverlay(doc, params.overlayImage)
  }

  // Layout vertical (yBottom_mm = distancia desde abajo):
  //   Nombre Tarifa:       50mm desde abajo (arriba del todo)
  //   Descripción tarifa:  46.5mm (pegado debajo de nombre)
  //   Fecha evento:        43mm (pegado debajo de descripción)
  //   Localidad evento:    39.5mm (pegado debajo de fecha)
  //   Código L1:           36mm (pegado debajo de localidad)
  //   Código L2:           32.5mm (pegado debajo de L1)
  drawTextLeft(doc, params.tarifa, FONTS.regular, 14, TEXT_LEFT_MM, 50)
  drawTextLeft(doc, params.tarifaDescripcion ?? '', FONTS.regular, 7, TEXT_LEFT_MM, 47.5)
  drawTextLeft(
    doc,
    formatFechaMonthYear(params.fecha),
    FONTS.regular,
    FECHA_LOCALIDAD_FONT_SIZE,
    TEXT_LEFT_MM,
    FECHA_Y_MM
  )
  drawTextLeft(
    doc,
    params.evento,
    FONTS.regular,
    FECHA_LOCALIDAD_FONT_SIZE,
    TEXT_LEFT_MM,
    LOCALIDAD_Y_MM
  )

  // Código en 2 líneas: línea 1 = "P26-4ES", línea 2 = "0001-001"
  const { line1, line2 } = formatCodigoLines(params.codigo)
  drawTextLeft(doc, line1, FONTS.regular, 5, 2, 35.5)
  drawTextLeft(doc, line2, FONTS.regular, 5, 2, 33.5)

  // Como el "lienzo" ahora está rotado, para que el texto quede centrado
  // y vertical hay que pensar las coordenadas como si el alto y ancho
  // estuvieran invertidos

      doc.end()


  // ... resto del contenido que no quieras rotado

  return result
}

/**
 * Generates a stamp PDF without background (mdcc mode).------------------- modo MDCC --------------------- AQUI PTE. ---
 * Used for machine codes like "MD" or "FI" that don't print motif backgrounds.
 * Uses "fondoetiqueta-nada.png" if available.
 */
export function renderStampBlank(params: StampRenderParams): Promise<Buffer> {
  const defaultBg = getDefaultBackgroundPath()
  return renderStamp({ ...params, backgroundImage: defaultBg })
}

/**
 * Generates a special strip stamp (Tira Especial 1) PDF.----------------- TIRA ESPECIAL 1 --------------
 * Background: TiraEspecial1.png
 * Layout: código (6pt at 1.5mm, 2mm) + especial suffix (at 23.3mm, 2mm)
 */
export async function renderStampE1(params: StampEspecialParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: 'Tira Especial 1', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  if (shouldRotate180()) {
    applyRotation180(doc)
  }

  const bgPath = join(getImagesPath(), 'TiraEspecial1.png')
  drawBackground(doc, existsSync(bgPath) ? bgPath : null)
  drawTextLeft(doc, params.codigo, FONTS.regular, 6, 2, 32)
  drawTextLeft(doc, params.especial, FONTS.regular, 6, 24, 32)

  doc.end()
  return result
}

/**
 * Generates a special strip stamp (Tira Especial 2) PDF. -------------- TIRA ESPECIAL 2 ---------------
 * Background: TiraEspecial2.png
 * Layout: tarifa (12pt) + código (6pt) + especial (6pt)
 */
export async function renderStampE2(params: StampEspecialParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: 'Tira Especial 2', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  if (shouldRotate180()) {
    applyRotation180(doc)
  }

  const bgPath = join(getImagesPath(), 'TiraEspecial2.png')
  drawBackground(doc, existsSync(bgPath) ? bgPath : null)

  if (params.tarifa) {
    drawTextLeft(doc, params.tarifa, FONTS.regular, 12, 2, 49)
  }
  drawTextLeft(doc, params.codigo, FONTS.regular, 6, 2, 32)
  drawTextLeft(doc, params.especial, FONTS.regular, 6, 24, 32)

  doc.end()
  return result
}

/**
 * Generates a special strip stamp (Tira Especial 3) PDF. -------------- TIRA ESPECIAL 3 -----------------
 * Background: TiraEspecial3.png
 * Layout: Same as E2 (tarifa + código + especial)
 */
export async function renderStampE3(params: StampEspecialParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: 'Tira Especial 3', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  if (shouldRotate180()) {
    applyRotation180(doc)
  }

  const bgPath = join(getImagesPath(), 'TiraEspecial3.png')
  drawBackground(doc, existsSync(bgPath) ? bgPath : null)

  if (params.tarifa) {
    drawTextLeft(doc, params.tarifa, FONTS.regular, 12, 2, 49)
  }
  drawTextLeft(doc, params.codigo, FONTS.regular, 6, 2, 32)
  drawTextLeft(doc, params.especial, FONTS.regular, 6, 24, 32)

  doc.end()
  return result
}

/**
 * Generates a special strip stamp (Tira Especial 4) PDF. ------------- TIRA ESPECIAL 4 -------------------
 * Background: TiraEspecial4.png
 * Layout: Same as E1 (only código + especial)
 */
export async function renderStampE4(params: StampEspecialParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: 'Tira Especial 4', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const bgPath = join(getImagesPath(), 'TiraEspecial4.png')
  drawBackground(doc, existsSync(bgPath) ? bgPath : null)

  drawTextLeft(doc, params.codigo, FONTS.regular, 6, 2, 32)
  drawTextLeft(doc, params.especial, FONTS.regular, 6, 24, 32)

  doc.end()
  return result
}

/**
 * Generates a multi-page PDF with multiple stamps (for tiras/strips of 4).--------------- T AAAA / T4T ----------- AMBAS TIRAS ---
 * Each page is one stamp (55×25mm).    /////////////// --------------- Y   S I M P L E ----------------
 *
 * @param stamps - Array of StampRenderParams, one per stamp page
 * @returns Buffer containing a multi-page PDF
 */
export async function renderStampMultiPage(stamps: StampRenderParams[]): Promise<Buffer> {
  if (stamps.length === 0) {
    throw new Error('No stamps to render')
  }

  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: `Tira de ${stamps.length} etiquetas`, Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)
  const imageCache = buildImageCache(stamps)

  // Read rotation setting once for the entire batch
  const rotate180 = shouldRotate180()

  stamps.forEach((stamp, index) => {
    if (index > 0) {
      doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
    }

    // Apply 180° rotation on each page if enabled
    if (rotate180) {
      applyRotation180(doc)
    }

    drawBackground(doc, stamp.backgroundImage, imageCache)
    
    // If printLogoPng is true, draw the logo to the right of fecha/localidad
    // instead of using the full right-half overlay
    if (stamp.printLogoPng && stamp.logoPngImage) {
      drawLogoPng(doc, stamp.logoPngImage, stamp.fecha, stamp.evento, imageCache)
    } else {
      // Otherwise, use the standard overlay behavior
      drawOverlay(doc, stamp.overlayImage, imageCache)
    }


      // Layout vertical: DISEÑO 1 imagen DERECHA Post & Go + MOT 1 DIS 1 + MOT 2 DIS 2 --------------- IMG DCHA
      //   Nombre Tarifa → Descripción → Fecha (mes+año) → Localidad → Código L1 → Código L2
    const { line1, line2 } = formatCodigoLines(stamp.codigo)
    const layout = stamp.layout ?? 'derecha'

    if (layout === 'derecha') {
      // Text on left, image on right
      drawTextLeft(doc, stamp.tarifa, FONTS.regular, 12.2, 2, 50)
      drawTextLeft(doc, stamp.tarifaDescripcion ?? '', FONTS.regular, 9, 2, 47.2)
      drawTextLeft(doc, formatFechaMonthYear(stamp.fecha), FONTS.regular, 9, 2, 43)
      drawTextLeft(doc, stamp.evento, FONTS.regular, 9, 2, 39.5)
      drawTextLeft(doc, line1, FONTS.regular, 5.7, 2, 35.2)
      drawTextLeft(doc, line2, FONTS.regular, 5.7, 2, 33)
    } else if (layout === 'izquierda') {
      // Text on right, image on left
      drawTextRight(doc, stamp.tarifa, FONTS.regular, 12.2, 53, 50)
      drawTextRight(doc, stamp.tarifaDescripcion ?? '', FONTS.regular, 9, 53, 47.2)
      drawTextRight(doc, formatFechaMonthYear(stamp.fecha), FONTS.regular, 9, 53, 43)
      drawTextRight(doc, stamp.evento, FONTS.regular, 9, 53, 39.5)
      drawTextRight(doc, line1, FONTS.regular, 5.7, 53, 35.2)
      drawTextRight(doc, line2, FONTS.regular, 5.7, 53, 33)
    } else if (layout === 'inferior') {
      // Image on bottom, text on top split left/right
      drawTextLeft(doc, stamp.tarifa, FONTS.regular, 12.2, 2, 50)
      drawTextLeft(doc, stamp.tarifaDescripcion ?? '', FONTS.regular, 9, 2, 47.2)
      drawTextRight(doc, formatFechaMonthYear(stamp.fecha), FONTS.regular, 9, 53, 50)
      drawTextRight(doc, stamp.evento, FONTS.regular, 9, 53, 47.2)
      drawTextLeft(doc, line1, FONTS.regular, 5.7, 22, 46)
      drawTextLeft(doc, line2, FONTS.regular, 5.7, 22, 44.4)
    } else if (layout === 'superior') {
      // Image on top, text on bottom split left/right
      drawTextLeft(doc, stamp.tarifa, FONTS.regular, 12.2, 2, 36.8)
      drawTextLeft(doc, stamp.tarifaDescripcion ?? '', FONTS.regular, 9, 2, 34)
      drawTextRight(doc, formatFechaMonthYear(stamp.fecha), FONTS.regular, 9, 53, 36.8)
      drawTextRight(doc, stamp.evento, FONTS.regular, 9, 53, 34)
      drawTextLeft(doc, line1, FONTS.regular, 5.7, 22, 35.2)
      drawTextLeft(doc, line2, FONTS.regular, 5.7, 22, 33)
    }
  })

  doc.end()
  return result
}

/**
 * Generates a multi-page PDF for a special strip (tira especial).
 * A special strip always has 4 pages: E1, E2, E3, E4 backgrounds.
 *
 * @param codigos - Array of 4 códigos (one per stamp in the strip)
 * @param especial - Special suffix (e.g. "  -E" or "-E")
 * @param tarifa - Tarifa text for E2 and E3 (e.g. "Tarifa A3")
 * @returns Buffer containing a 4-page PDF
 */
export async function renderStampEspecialStrip(
  codigos: [string, string, string, string],
  especial: string,
  tarifa: string
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
     layout: 'portrait',
    info: { Title: 'Tira Especial', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)
  const pageWidth = doc.page.width   // 156
  const pageHeight = doc.page.height // 71

  // Read rotation setting once for the entire strip
  const rotate180 = shouldRotate180()

  doc.save() // guardamos el estado antes de rotar  // const pageWidth = doc.page.width   // 156
   // Rotamos 90° (o -90° según el sentido que quieras) // const pageHeight = doc.page.height // 71
  // el origin es el punto sobre el que pivota la rotación
  // doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  if (rotate180) {
    applyRotation180(doc)
  }

  const imagesPath = getImagesPath()

  // Page 1: E1 — only código + especial
  const bg1 = join(imagesPath, 'TiraEspecial1.png')
  drawBackground(doc, existsSync(bg1) ? bg1 : null)
  drawTextLeft(doc, codigos[0], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 2: E2 — tarifa + código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  if (rotate180) {
    applyRotation180(doc)
  }
  const bg2 = join(imagesPath, 'TiraEspecial2.png')
  drawBackground(doc, existsSync(bg2) ? bg2 : null)
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5)
  drawTextLeft(doc, codigos[1], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 3: E3 — tarifa + código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  if (rotate180) {
    applyRotation180(doc)
  }
  const bg3 = join(imagesPath, 'TiraEspecial3.png')
  drawBackground(doc, existsSync(bg3) ? bg3 : null)
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5)
  drawTextLeft(doc, codigos[2], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 4: E4 — only código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  if (rotate180) {
    applyRotation180(doc)
  }
  const bg4 = join(imagesPath, 'TiraEspecial4.png')
  drawBackground(doc, existsSync(bg4) ? bg4 : null)
  drawTextLeft(doc, codigos[3], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  doc.end()
  return result
}
