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
 * Layout (legacy genStampI/genStampD):
 *   - Background image: full 55×25mm
 *   - Tarifa text: FranklinGothic 12pt at (2mm, 19.5mm from bottom)
 *   - Evento text: FranklinGothic 9pt right-aligned at (53mm, 19mm from bottom)
 *   - Fecha text: FranklinGothic 9pt right-aligned at (53mm, 15mm from bottom)
 *   - Código text: FranklinGothic 6pt at (2mm, 15mm from bottom)
 */

import PDFDocument from 'pdfkit'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { existsSync } from 'fs'

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
 * Transforms a stamp code from original format to two-line display format.
 *
 * Input:  "P4ES26 CH17-0001-001"
 * Output: { line1: "P26-4ES", line2: "0001-001" }
 *
 * Format breakdown:
 *   Original: P{mes}{pais}{año} {maquina}-{serie}-{num}
 *   Line 1:   P{año}-{mes}{pais}
 *   Line 2:   {serie}-{num}  (stamp code, mocked for now)
 */
export function formatCodigoLines(codigo: string): { line1: string; line2: string } {
  // Expected format: "P4ES26 CH17-0001-001"
  // Parts[0] = "P4ES26", Parts[1] = "CH17-0001-001"
  const spaceIdx = codigo.indexOf(' ')
  if (spaceIdx === -1) {
    // Fallback: can't parse, return as-is on one line
    return { line1: codigo, line2: '' }
  }

  const prefix = codigo.substring(0, spaceIdx) // e.g. "P4ES26"
  const suffix = codigo.substring(spaceIdx + 1) // e.g. "CH17-0001-001"

  // Parse prefix: P{mes}{pais2}{año2} → "P4ES26"
  // P = prefix[0]
  // mes = prefix[1] (single digit/char: 1-9, O, N, D)
  // pais = prefix[2..3] (2 chars, e.g. "ES")
  // año = prefix[4..5] (2 chars, e.g. "26")
  if (prefix.length < 6 || prefix[0] !== 'P') {
    return { line1: codigo, line2: '' }
  }

  const mes = prefix[1]
  const pais = prefix.substring(2, 4)
  const anio = prefix.substring(4, 6)

  // Line 1: P{año}-{mes}{pais}
  const line1 = `P${anio}-${mes}${pais}`

  // Line 2: extract serie-num from suffix (last two dash-separated parts)
  // suffix = "CH17-0001-001" → we want "0001-001"
  const dashParts = suffix.split('-')
  let line2: string
  if (dashParts.length >= 3) {
    // Take last two parts: "0001" and "001"
    line2 = `${dashParts[dashParts.length - 2]}-${dashParts[dashParts.length - 1]}`
  } else if (dashParts.length === 2) {
    line2 = `${dashParts[0]}-${dashParts[1]}`
  } else {
    line2 = suffix
  }

  return { line1, line2 }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Input parameters for rendering a standard stamp (with background image) */
export interface StampRenderParams {
  /** Tarifa display text, e.g. "Tarifa A", "Tarifa B" */
  tarifa: string
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
 * Draws the background image on the stamp (full cover 55×25mm).
 * Handles file paths and base64 data URIs.
 */
function drawBackground(doc: PDFKit.PDFDocument, imageSource: string | null | undefined): void {
  if (!imageSource) return

  try {
    if (imageSource.startsWith('data:')) {
      const base64Data = imageSource.split(',')[1]
      if (base64Data) {
        const buffer = Buffer.from(base64Data, 'base64')
        doc.image(buffer, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT })
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
 */
function drawOverlay(doc: PDFKit.PDFDocument, imageSource: string | null | undefined): void {
  if (!imageSource) return

 // const overlayX = 27.5 * MM_TO_PT
  //const overlayWidth = 27.5 * MM_TO_PT
  const overlayX = 27.5 * MM_TO_PT
  const overlayWidth = 27.5 * MM_TO_PT

  try {
    if (imageSource.startsWith('data:')) {
      const base64Data = imageSource.split(',')[1]
      if (base64Data) {
        const buffer = Buffer.from(base64Data, 'base64')
        doc.image(buffer, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT })
      }
    } else if (existsSync(imageSource)) {
      doc.image(imageSource, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT })
    }
  } catch {
    // Gracefully ignore image errors (matches legacy behavior)
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
 *   2. Overlay image (right half 27.5–55mm × 25mm)
 *   3. Tarifa text: FranklinGothic 12pt at (2mm, 19.5mm from bottom)
 *   4. Evento text: FranklinGothic 9pt right-aligned at (26mm, 19mm from bottom)
 *   5. Fecha text: FranklinGothic 9pt right-aligned at (26mm, 15mm from bottom)
 *   6. Código text: FranklinGothic 6pt at (2mm, 15mm from bottom)
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
  drawBackground(doc, params.backgroundImage)
  drawOverlay(doc, params.overlayImage)

  // Layout vertical (yBottom_mm = distancia desde abajo):
  //   Tarifa:      49mm desde abajo (arriba del todo)
  //   Fecha:       43mm (~6mm debajo de tarifa)
  //   Localidad:   40mm (justo debajo de fecha, pegado)
  //   Código L1:   36mm (~4mm debajo de localidad)
  //   Código L2:   33mm (justo debajo de L1, pegado)
  drawTextLeft(doc, params.tarifa, FONTS.regular, 12, 2, 49)
  drawTextLeft(doc, formatFechaMonthYear(params.fecha), FONTS.regular, 8, 2, 43)
  drawTextLeft(doc, params.evento, FONTS.regular, 8, 2, 40)

  // Código en 2 líneas: línea 1 = "P26-4ES", línea 2 = "0001-001"
  const { line1, line2 } = formatCodigoLines(params.codigo)
  drawTextLeft(doc, line1, FONTS.regular, 7, 2, 36)
  drawTextLeft(doc, line2, FONTS.regular, 6, 2, 33)

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
 * Each page is one stamp (55×25mm).
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

  stamps.forEach((stamp, index) => {
    if (index > 0) {
      doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
    }

    drawBackground(doc, stamp.backgroundImage)
    drawOverlay(doc, stamp.overlayImage)
    drawTextLeft(doc, stamp.tarifa, FONTS.regular, 12, 2, 49)
    drawTextRight(doc, stamp.evento, FONTS.regular, 9, 53, 49)
    drawTextRight(doc, stamp.fecha, FONTS.regular, 9, 53, 40)
    drawTextLeft(doc, stamp.codigo, FONTS.regular, 6, 2, 32)
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
  const pageWidth = doc.page.width   // 156
  const pageHeight = doc.page.height // 71

  doc.save() // guardamos el estado antes de rotar  // const pageWidth = doc.page.width   // 156
   // Rotamos 90° (o -90° según el sentido que quieras) // const pageHeight = doc.page.height // 71
  // el origin es el punto sobre el que pivota la rotación
  // doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] })

  const imagesPath = getImagesPath()

  // Page 1: E1 — only código + especial
  const bg1 = join(imagesPath, 'TiraEspecial1.png')
  drawBackground(doc, existsSync(bg1) ? bg1 : null)
  drawTextLeft(doc, codigos[0], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 2: E2 — tarifa + código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  const bg2 = join(imagesPath, 'TiraEspecial2.png')
  drawBackground(doc, existsSync(bg2) ? bg2 : null)
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5)
  drawTextLeft(doc, codigos[1], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 3: E3 — tarifa + código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  const bg3 = join(imagesPath, 'TiraEspecial3.png')
  drawBackground(doc, existsSync(bg3) ? bg3 : null)
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5)
  drawTextLeft(doc, codigos[2], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  // Page 4: E4 — only código + especial
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 })
  const bg4 = join(imagesPath, 'TiraEspecial4.png')
  drawBackground(doc, existsSync(bg4) ? bg4 : null)
  drawTextLeft(doc, codigos[3], FONTS.regular, 6, 1.5, 2)
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2)

  doc.end()
  return result
}
