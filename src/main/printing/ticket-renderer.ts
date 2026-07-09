/**
 * ticket-renderer.ts
 *
 * Generates PDF tickets (facturas simplificadas) at 78mm width × variable height.
 * Replicates the legacy Python reportlab logic from report.py (genTicket, genTicketCaja, genTicketMaster).
 *
 * Ticket Types:
 *   - genTicket: Main ticket/receipt (Factura Simplificada) with full item details
 *   - genTicketCaja: Copy for cash register — simplified, with payment fields and "PASE POR CAJA" text
 *   - genTicketMaster: Master set ticket — shows "MASTER SET" label with fixed pricing
 *
 * Coordinate system:
 *   - pdfkit uses points (72pt = 1 inch, 1mm = 2.83465pt)
 *   - Origin is TOP-LEFT in pdfkit
 *   - The legacy uses BOTTOM-LEFT (reportlab), so all Y coordinates are converted
 *   - Layout is computed dynamically based on number of items (variable height)
 *
 * Layout structure (genTicket):
 *   1. Logo (image2.jpg) centered at top
 *   2. Background watermark (fondoticketori.png) at offset position
 *   3. Feria title (FranklinGothicBold 12pt) centered
 *   4. Lugar (FranklinGothicBold 10pt) centered
 *   5. Empresa, CIF, CP (FranklinGothicBold 7.5pt) centered
 *   6. "Fecha" label + date value (FranklinGothicCondensed 8pt) centered
 *   7. Mode/title text (FranklinGothicBold 6.5pt) left-aligned
 *   8. Column headers: Producto, Cant., Precio, Importe
 *   9. Separator line
 *  10. Item rows (model + product name, quantity, price, total)
 *  11. Total separator + total row
 *  12. Session ID: "MAQUINA - Sesión: XXXX" centered
 *  13. Legal lines l1, l2, l3 centered at bottom
 */

import PDFDocument from 'pdfkit'
import { join } from 'path'
import { existsSync } from 'fs'
import { getFontsPath, getImagesPath, FONTS } from './stamp-renderer'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Conversion factor: 1mm = 72/25.4 points */
const MM_TO_PT = 72 / 25.4 // ≈ 2.83465

/** Ticket width in mm (fixed) */
export const TICKET_WIDTH_MM = 78

/** Ticket width in points */
export const TICKET_WIDTH = TICKET_WIDTH_MM * MM_TO_PT

/** Base height of ticket in mm (without item rows) — legacy: 126mm base */
const TICKET_BASE_HEIGHT_MM = 126

/** Height per item row in mm — legacy uses 3mm per item */
const ITEM_ROW_HEIGHT_MM = 3

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** A single item line on the ticket */
export interface TicketItem {
  /** Product ID (last char determines model: "1" = model1, "2" = model2) */
  idProducto: string
  /** Quantity sold (0 means skip this item) */
  cantidad: number
}

/** Product definition for pricing and display */
export interface TicketProduct {
  /** Product ID matching TicketItem.idProducto */
  idProducto: string
  /** Display mode: "S" = simple, "T" = tira */
  modo: string
  /** Unit price */
  precio: number
  /** Display name for ticket (e.g. "Tarifa A", "Tarifa A Tira 4") */
  nombre_ticket: string
}

/** Parameters for genTicket (main receipt) */
export interface GenTicketParams {
  /** Date/time string for the ticket */
  fechaTicket: string
  /** Title/mode text (e.g. "Factura Simplificada", "Filatelia de: Factura Simplificada") */
  modoTicket: string
  /** Model 1 (left) display name */
  modelo1Ticket: string
  /** Model 2 (right) display name */
  modelo2Ticket: string
  /** Array of items with quantities */
  items: TicketItem[]
  /** Client session ID (will be zero-padded to 4 digits) */
  idCliente: number
  /** Machine name (e.g. "CH17") */
  nombreMaquina: string
  /** Product definitions with pricing info */
  productos: TicketProduct[]
  /** Fair/event name for header */
  feria: string
  /** Venue/location for header */
  lugar: string
  /** Company name */
  empresa: string
  /** Tax ID */
  cif: string
  /** Postal code */
  cp: string
  /** Legal text line 1 */
  l1: string
  /** Legal text line 2 */
  l2: string
  /** Legal text line 3 */
  l3: string
}

/** Parameters for genTicketCaja (cash register copy) */
export interface GenTicketCajaParams {
  /** Array of items with quantities */
  items: TicketItem[]
  /** Client session ID */
  idCliente: number
  /** Machine name */
  nombreMaquina: string
  /** Product definitions with pricing info */
  productos: TicketProduct[]
  /** Fair/event name for header */
  feria: string
  /** Title/mode text for the copy (tituloCopia field from config) */
  modoTicket: string
  /** Model 1 display name */
  modelo1Ticket: string
  /** Model 2 display name */
  modelo2Ticket: string
}

/** Parameters for genTicketMaster (master set ticket) */
export interface GenTicketMasterParams {
  /** Date/time string for the ticket */
  fechaTicket: string
  /** Title/mode text */
  modoTicket: string
  /** Model 1 display name */
  modelo1Ticket: string
  /** Model 2 display name */
  modelo2Ticket: string
  /** Array of items with quantities */
  items: TicketItem[]
  /** Client session ID */
  idCliente: number
  /** Machine name */
  nombreMaquina: string
  /** Product definitions with pricing info */
  productos: TicketProduct[]
  /** Fair/event name */
  feria: string
  /** Venue/location */
  lugar: string
  /** Company name */
  empresa: string
  /** Tax ID */
  cif: string
  /** Postal code */
  cp: string
  /** Legal text line 1 */
  l1: string
  /** Legal text line 2 */
  l2: string
  /** Legal text line 3 */
  l3: string
}

// ─────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────

/**
 * Registers Franklin Gothic fonts on a PDFDocument instance.
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
 * Counts the number of items with cantidad > 0.
 */
export function countActiveItems(items: TicketItem[]): number {
  return items.filter((item) => item.cantidad > 0).length
}

/**
 * Formats a client ID to 4 digits with zero-padding.
 */
export function formatClientId(id: number): string {
  if (id < 10) return '000' + id
  if (id < 100) return '00' + id
  if (id < 1000) return '0' + id
  return '' + id
}

/**
 * Formats a price value to display with euro sign.
 * Ensures at least 2 decimal places.
 */
export function formatPrice(value: number): string {
  const str = value.toFixed(2)
  return str + '€'
}

/**
 * Draws centered text at the specified Y position.
 */
function drawCentered(
  doc: PDFKit.PDFDocument,
  text: string,
  fontName: string,
  fontSize: number,
  y: number,
  pageWidth: number
): void {
  doc.font(fontName).fontSize(fontSize)
  const textWidth = doc.widthOfString(text)
  const x = (pageWidth - textWidth) / 2
  doc.text(text, x, y, { lineBreak: false })
}

/**
 * Draws left-aligned text.
 */
function drawLeft(
  doc: PDFKit.PDFDocument,
  text: string,
  fontName: string,
  fontSize: number,
  x: number,
  y: number
): void {
  doc.font(fontName).fontSize(fontSize)
  doc.text(text, x, y, { lineBreak: false })
}

/**
 * Draws right-aligned text (text ends at xRight).
 */
function drawRight(
  doc: PDFKit.PDFDocument,
  text: string,
  fontName: string,
  fontSize: number,
  xRight: number,
  y: number
): void {
  doc.font(fontName).fontSize(fontSize)
  const textWidth = doc.widthOfString(text)
  doc.text(text, xRight - textWidth, y, { lineBreak: false })
}

/**
 * Draws a dashed horizontal line.
 */
function drawLine(doc: PDFKit.PDFDocument, x: number, y: number, width: number): void {
  doc.lineWidth(0.6)
  doc.dash(1.5, { space: 0.4 })
  doc.moveTo(x, y).lineTo(x + width, y).stroke()
  doc.undash()
}

/**
 * Draws an image centered or at a specific position.
 * Returns false if image doesn't exist.
 */
function drawImage(
  doc: PDFKit.PDFDocument,
  imageName: string,
  x: number,
  y: number,
  width: number
): boolean {
  const imgPath = join(getImagesPath(), imageName)
  if (!existsSync(imgPath)) return false
  try {
    doc.image(imgPath, x, y, { width })
    return true
  } catch {
    return false
  }
}

/**
 * Draws an image centered horizontally on the page.
 */
function drawImageCentered(
  doc: PDFKit.PDFDocument,
  imageName: string,
  y: number,
  imgWidth: number,
  pageWidth: number
): boolean {
  const x = (pageWidth - imgWidth) / 2
  return drawImage(doc, imageName, x, y, imgWidth)
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

/**
 * Calculates the page height for a ticket based on number of active items.
 * Replicates legacy formula: page_height = (126 + eitems) * mm
 * where eitems = 3*nitems - 17 (for genTicket)
 *
 * @returns Height in points (for PDFDocument page size)
 */
export function calcTicketHeight(numItems: number): number {
  const heightMm = calcTicketHeightMm(numItems)
  return heightMm * MM_TO_PT
}

/**
 * Calculates the page height in mm for a ticket based on number of active items.
 */
export function calcTicketHeightMm(numItems: number): number {
  const eitems = 3 * numItems - 17
  return TICKET_BASE_HEIGHT_MM + eitems
}

/**
 * Calculates the page height for genTicketCaja/genTicketMaster (slightly different formula).
 * Legacy: eitems = 3.5*nitems - 12, then various offsets (-6 for c1-c5)
 *
 * @returns Height in points (for PDFDocument page size)
 */
export function calcTicketCajaHeight(numItems: number): number {
  const heightMm = calcTicketCajaHeightMm(numItems)
  return heightMm * MM_TO_PT
}

/**
 * Calculates the page height in mm for genTicketCaja/genTicketMaster.
 */
export function calcTicketCajaHeightMm(numItems: number): number {
  const eitems = 3.5 * numItems - 12
  return TICKET_BASE_HEIGHT_MM + eitems - 6
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generates the main ticket PDF (Factura Simplificada).
 *
 * Layout (replicating legacy genTicket from report.py):
 *   - Logo (image2.jpg) centered
 *   - Background watermark (fondoticketori.png)
 *   - Header: feria, lugar, empresa, CIF, CP
 *   - Date
 *   - Mode/title text
 *   - Column headers and item rows
 *   - Total
 *   - Session ID
 *   - Legal texts
 *
 * @returns Buffer containing the generated ticket PDF
 */
export async function genTicket(params: GenTicketParams): Promise<Buffer> {
  const {
    fechaTicket,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket,
    items,
    idCliente,
    nombreMaquina,
    productos,
    feria,
    lugar,
    empresa,
    cif,
    cp,
    l1,
    l2,
    l3
  } = params

  const nitems = countActiveItems(items)
  const eitems = 3 * nitems - 12
  const pageHeight = calcTicketHeight(nitems)

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Factura Simplificada', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // Legacy coordinate offsets (converted from bottom-left to top-left)
  // In legacy: c1 = 71 + eitems, c2 = 86 + eitems, c3 = 56 + eitems, c4 = 51 + eitems, c5 = 50 + eitems
  // These are Y coordinates from BOTTOM in mm. We convert to TOP-LEFT for pdfkit.
  const pageHeightMm = pageHeight / MM_TO_PT
  const c1 = pageHeightMm - (71 + eitems)
  const c2 = pageHeightMm - (86 + eitems)
  const c5 = pageHeightMm - (50 + eitems)

  // 1. Logo centered
  drawImageCentered(doc, 'image2.jpg', c1 * MM_TO_PT, 30 * MM_TO_PT, pageWidth)

  // 2. Background watermark (fondoticketori.png)
  const bgX = 5 * MM_TO_PT
  const bgY = (c5 + 10) * MM_TO_PT // c5*mm - 10*mm from bottom → top offset
  drawImage(doc, 'fondoticketori.png', bgX, bgY, 20 * MM_TO_PT)

  // 3. Header texts (feria, lugar, empresa, CIF, CP) — all centered
  drawCentered(doc, feria, FONTS.bold, 12, c2 * MM_TO_PT, pageWidth)
  drawCentered(doc, lugar, FONTS.bold, 10, (c2 + 6) * MM_TO_PT, pageWidth)
  drawCentered(doc, empresa, FONTS.bold, 7.5, (c2 + 10) * MM_TO_PT, pageWidth)
  drawCentered(doc, cif, FONTS.bold, 7.5, (c2 + 14) * MM_TO_PT, pageWidth)
  drawCentered(doc, cp, FONTS.bold, 7.5, (c2 + 18) * MM_TO_PT, pageWidth)

  // 4. Date label and value
  drawCentered(doc, 'Fecha', FONTS.condensed, 8, (c2 + 22) * MM_TO_PT, pageWidth)
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, (c2 + 25) * MM_TO_PT, pageWidth)

  // 5. Mode/title text (left aligned at 5mm)
  const c3 = pageHeightMm - (56 + eitems)
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, c3 * MM_TO_PT)

  // 6. Column headers
  const c4 = pageHeightMm - (51 + eitems)
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Cant.', FONTS.condensed, 8, 45 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Precio', FONTS.condensed, 8, 55 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Importe', FONTS.condensed, 8, 65 * MM_TO_PT, c4 * MM_TO_PT)

  // 7. Separator line below headers
  drawLine(doc, 5 * MM_TO_PT, c5 * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)

  // 8. Item rows
  let totalProductos = 0
  let totalImporte = 0
  // Legacy: y starts at 46 + eitems (from bottom), decreasing by 3 per item
  let yBottomMm = 46 + eitems

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item.cantidad > 0) {
      const producto = productos[index]
      const modeloTicket = item.idProducto.slice(-1) === '1' ? modelo1Ticket : modelo2Ticket

      totalProductos += item.cantidad
      totalImporte += item.cantidad * producto.precio

      const itemName = modeloTicket + ' ' + producto.nombre_ticket
      const quantity = String(item.cantidad)
      const price = formatPrice(producto.precio)
      const total = formatPrice(item.cantidad * producto.precio)

      // Convert Y from bottom to top
      const yTop = (pageHeightMm - yBottomMm) * MM_TO_PT

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, yTop)
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, yTop)
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, yTop)
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, yTop)

      yBottomMm -= 3
    }
  }

  // 9. Total separator and total row
  // Legacy: drawLine(30*mm, 34*mm, ...) and drawTotal(30*mm, ...)
  const totalLineY = (pageHeightMm - 34) * MM_TO_PT
  drawLine(doc, 30 * MM_TO_PT, totalLineY, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)

  const totalRowY = (pageHeightMm - 30) * MM_TO_PT
  drawLeft(doc, 'Total:', FONTS.condensed, 8, 35 * MM_TO_PT, totalRowY)
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, totalRowY)
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, totalRowY)

  // 10. Bottom separator
  const bottomLineY = (pageHeightMm - 26) * MM_TO_PT
  drawLine(doc, 5 * MM_TO_PT, bottomLineY, pageWidth - 2 * 5 * MM_TO_PT)

  // 11. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  const sessionY = (pageHeightMm - 20) * MM_TO_PT
  drawCentered(doc, sessionText, FONTS.condensed, 9, sessionY, pageWidth)

  // 12. Legal texts at bottom
  const l1Y = (pageHeightMm - 13) * MM_TO_PT
  const l2Y = (pageHeightMm - 9) * MM_TO_PT
  const l3Y = (pageHeightMm - 5) * MM_TO_PT
  drawCentered(doc, l1, FONTS.bold, 7.5, l1Y, pageWidth)
  drawCentered(doc, l2, FONTS.bold, 7.5, l2Y, pageWidth)
  drawCentered(doc, l3, FONTS.bold, 7.5, l3Y, pageWidth)

  doc.end()
  return result
}


/**
 * Generates the cash register copy ticket (COPIA / ticket caja).
 *
 * Layout differences from genTicket:
 *   - Uses fondoticketcop-nada.png as background
 *   - Slightly different spacing (eitems = 3.5*nitems - 12, offsets -6)
 *   - Includes extra payment fields (TARJETA P., TP TUSELLO, ATM SOBRE, ATM Tarifa A)
 *   - Column headers show only "Producto" and "Cantidad" (no price/total in header)
 *   - Separates model1 and model2 items with a line
 *   - Bottom text: "PASE POR CAJA y ENTREGUE ESTE RESGUARDO" + "PARA RECOGER SU PEDIDO"
 *
 * @returns Buffer containing the generated ticket PDF
 */
export async function genTicketCaja(params: GenTicketCajaParams): Promise<Buffer> {
  const {
    items,
    idCliente,
    nombreMaquina,
    productos,
    feria,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket
  } = params

  const nitems = countActiveItems(items)
  const eitems = 3.5 * nitems - 12
  const pageHeightMm = TICKET_BASE_HEIGHT_MM + eitems - 6
  const pageHeight = pageHeightMm * MM_TO_PT

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Copia Ticket Caja', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // Legacy coordinate offsets (with -6 adjustment for caja variant)
  const c1 = pageHeightMm - (71 + eitems - 6)
  const c2 = pageHeightMm - (86 + eitems - 6)
  const c3 = pageHeightMm - (56 + eitems - 6)
  const c4 = pageHeightMm - (51 + eitems - 6)
  const c5 = pageHeightMm - (50 + eitems - 6)

  // 1. Logo centered
  drawImageCentered(doc, 'image2.jpg', c1 * MM_TO_PT, 30 * MM_TO_PT, pageWidth)

  // 2. Background watermark (fondoticketcop-nada.png)
  const bgX = 5 * MM_TO_PT
  const bgY = (c5 + 10) * MM_TO_PT
  drawImage(doc, 'fondoticketcop-nada.png', bgX, bgY, 20 * MM_TO_PT)

  // 3. Header: feria (only feria for caja, not full company info)
  drawCentered(doc, feria, FONTS.bold, 12, c2 * MM_TO_PT, pageWidth)

  // 4. Date (uses fechaTicket="" for caja — legacy passes empty strings)
  drawCentered(doc, '', FONTS.condensed, 8, (c2 + 12) * MM_TO_PT, pageWidth)

  // 5. Mode/title text
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, c3 * MM_TO_PT)

  // 6. Payment fields (TARJETA P., TP TUSELLO, ATM SOBRE, ATM Tarifa A)
  const payFieldY1 = (c2 + 9) * MM_TO_PT
  drawLeft(doc, 'TARJETA P.:', FONTS.bold, 12, 20 * MM_TO_PT, payFieldY1)
  drawLine(doc, 55 * MM_TO_PT, payFieldY1 + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)

  const payFieldY2 = (c2 + 15) * MM_TO_PT
  drawLeft(doc, 'TP TUSELLO:', FONTS.bold, 12, 20 * MM_TO_PT, payFieldY2)
  drawLine(doc, 55 * MM_TO_PT, payFieldY2 + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)

  const payFieldY3 = (c2 + 21) * MM_TO_PT
  drawLeft(doc, 'ATM SOBRE:', FONTS.bold, 12, 20 * MM_TO_PT, payFieldY3)
  drawLine(doc, 55 * MM_TO_PT, payFieldY3 + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)

  const payFieldY4 = (c2 + 27) * MM_TO_PT
  drawLeft(doc, 'ATM Tarifa A:', FONTS.bold, 12, 20 * MM_TO_PT, payFieldY4)
  drawLine(doc, 55 * MM_TO_PT, payFieldY4 + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)

  // 7. Column headers (simplified for caja: only Producto + Cantidad)
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Cantidad', FONTS.condensed, 8, 30 * MM_TO_PT, c4 * MM_TO_PT)

  // 8. Separator line below headers
  drawLine(doc, 5 * MM_TO_PT, c5 * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)

  // 9. Item rows (with model separator line between model1 and model2)
  let totalProductos = 0
  let totalImporte = 0
  let yBottomMm = 46 + eitems - 6
  let inicioMod2 = false

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item.cantidad > 0) {
      const producto = productos[index]
      const isModel2 = item.idProducto.slice(-1) === '2'
      const modeloTicket = isModel2 ? modelo2Ticket : modelo1Ticket

      // Draw separator line when switching from model1 to model2 items
      if (isModel2 && !inicioMod2) {
        yBottomMm += 1.7
        const sepY = (pageHeightMm - yBottomMm) * MM_TO_PT
        drawLine(doc, 5 * MM_TO_PT, sepY, pageWidth - 2 * 5 * MM_TO_PT)
        inicioMod2 = true
        yBottomMm -= 3.5
      }

      totalProductos += item.cantidad
      totalImporte += item.cantidad * producto.precio

      const itemName = modeloTicket + ' ' + producto.nombre_ticket
      const quantity = String(item.cantidad)
      const price = formatPrice(producto.precio)
      const total = formatPrice(item.cantidad * producto.precio)

      const yTop = (pageHeightMm - yBottomMm) * MM_TO_PT

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, yTop)
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, yTop)
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, yTop)
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, yTop)

      yBottomMm -= 3.5
    }
  }

  // 10. Total separator and total row
  const totalLineY = (pageHeightMm - 27) * MM_TO_PT
  drawLine(doc, 30 * MM_TO_PT, totalLineY, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)

  const totalRowY = (pageHeightMm - 23) * MM_TO_PT
  drawLeft(doc, 'Total:', FONTS.condensed, 8, 35 * MM_TO_PT, totalRowY)
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, totalRowY)
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, totalRowY)

  // 11. Bottom separator
  const bottomLineY = (pageHeightMm - 21) * MM_TO_PT
  drawLine(doc, 5 * MM_TO_PT, bottomLineY, pageWidth - 2 * 5 * MM_TO_PT)

  // 12. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  const sessionY = (pageHeightMm - 15) * MM_TO_PT
  drawCentered(doc, sessionText, FONTS.bold, 7.5, sessionY, pageWidth)

  // 13. Bottom texts (legacy: "PASE POR CAJA..." and "PARA RECOGER SU PEDIDO")
  const pasoY = (pageHeightMm - 9) * MM_TO_PT
  drawCentered(doc, 'PARA RECOGER SU PEDIDO', FONTS.bold, 7.5, pasoY, pageWidth)
  const cajaY = (pageHeightMm - 5) * MM_TO_PT
  drawCentered(doc, 'PASE POR CAJA y ENTREGUE ESTE RESGUARDO', FONTS.bold, 7.5, cajaY, pageWidth)

  doc.end()
  return result
}

/**
 * Generates the Master Set ticket.
 *
 * Layout differences from genTicket:
 *   - Uses fondoticketcop.png as background (with transparency)
 *   - Shows "MASTER SET" label prominently
 *   - Items are displayed as "ModelName Master Set" with fixed quantity=1 and price=31.05€
 *   - Total shows fixed values (28.60€ in the legacy — but we calculate dynamically)
 *   - Slightly different spacing (eitems = 3.5*nitems - 12, offsets -6)
 *
 * @returns Buffer containing the generated ticket PDF
 */
export async function genTicketMaster(params: GenTicketMasterParams): Promise<Buffer> {
  const {
    fechaTicket,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket,
    items,
    idCliente,
    nombreMaquina,
    productos,
    feria,
    lugar,
    empresa,
    cif,
    cp,
    l1,
    l2,
    l3
  } = params

  const nitems = countActiveItems(items)
  const eitems = 3.5 * nitems - 12
  const pageHeightMm = TICKET_BASE_HEIGHT_MM + eitems - 6
  const pageHeight = pageHeightMm * MM_TO_PT

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Master Set Ticket', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // Legacy coordinate offsets
  const c1 = pageHeightMm - (71 + eitems - 6)
  const c2 = pageHeightMm - (86 + eitems - 6)
  const c3 = pageHeightMm - (56 + eitems)
  const c4 = pageHeightMm - (51 + eitems - 3)
  const c5 = pageHeightMm - (50 + eitems - 6)

  // 1. Logo centered
  drawImageCentered(doc, 'image2.jpg', c1 * MM_TO_PT, 30 * MM_TO_PT, pageWidth)

  // 2. Background watermark (fondoticketcop.png) — larger, positioned differently
  drawImage(doc, 'fondoticketcop.png', 5 * MM_TO_PT, c1 * MM_TO_PT + 45, 70 * MM_TO_PT)

  // 3. Header: feria, lugar, empresa, CIF, CP
  drawCentered(doc, feria, FONTS.bold, 12, c2 * MM_TO_PT, pageWidth)
  drawCentered(doc, lugar, FONTS.bold, 10, (c2 + 6) * MM_TO_PT, pageWidth)
  drawCentered(doc, empresa, FONTS.bold, 7.5, (c2 + 10) * MM_TO_PT, pageWidth)
  drawCentered(doc, cif, FONTS.bold, 7.5, (c2 + 14) * MM_TO_PT, pageWidth)
  drawCentered(doc, cp, FONTS.bold, 7.5, (c2 + 18) * MM_TO_PT, pageWidth)

  // 4. Date
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, (c2 + 22) * MM_TO_PT, pageWidth)

  // 5. "MASTER SET" label + mode text
  const masterY = (c3 + 4) * MM_TO_PT
  drawLeft(doc, 'MASTER SET', FONTS.bold, 9.5, 5 * MM_TO_PT, masterY)
  const modoY = (c3 + 6) * MM_TO_PT
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, modoY)

  // 6. Column headers (same as genTicket)
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Cant.', FONTS.condensed, 8, 45 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Precio', FONTS.condensed, 8, 55 * MM_TO_PT, c4 * MM_TO_PT)
  drawLeft(doc, 'Importe', FONTS.condensed, 8, 65 * MM_TO_PT, c4 * MM_TO_PT)

  // 7. Separator line below headers
  const headerLineY = c4 * MM_TO_PT + 1 * MM_TO_PT
  drawLine(doc, 5 * MM_TO_PT, headerLineY, pageWidth - 2 * 5 * MM_TO_PT)

  // 8. Item rows — each item displayed as "ModelName Master Set" with qty=1, price=31.05€
  // Legacy uses hardcoded 31.05€ price per master set item
  const MASTER_SET_PRICE = 31.05
  let totalItems = 0
  let yBottomMm = 43 + eitems

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item.cantidad > 0) {
      const modeloTicket = item.idProducto.slice(-1) === '1' ? modelo1Ticket : modelo2Ticket

      totalItems++
      const itemName = modeloTicket + ' Master Set'
      const yTop = (pageHeightMm - yBottomMm) * MM_TO_PT

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, yTop)
      drawRight(doc, '1', FONTS.condensed, 8, 50 * MM_TO_PT, yTop)
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 62 * MM_TO_PT, yTop)
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 73 * MM_TO_PT, yTop)

      yBottomMm -= 3
    }
  }

  // 9. Total separator and total row
  const totalLineY = (pageHeightMm - 32) * MM_TO_PT
  drawLine(doc, 30 * MM_TO_PT, totalLineY, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)

  // Legacy uses hardcoded total: "Total:     1    28.60€"
  // We calculate dynamically: totalItems * MASTER_SET_PRICE
  const masterTotal = totalItems * MASTER_SET_PRICE
  const totalY = (pageHeightMm - yBottomMm + 4) * MM_TO_PT
  drawLeft(doc, `Total:     ${totalItems}`, FONTS.condensed, 8, 40 * MM_TO_PT, totalY)
  drawLeft(doc, formatPrice(masterTotal), FONTS.condensed, 8, 65 * MM_TO_PT, totalY)

  // 10. Bottom separator
  const bottomLineY = (pageHeightMm - 26) * MM_TO_PT
  drawLine(doc, 5 * MM_TO_PT, bottomLineY, pageWidth - 2 * 5 * MM_TO_PT)

  // 11. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  const sessionY = (pageHeightMm - 20) * MM_TO_PT
  drawCentered(doc, sessionText, FONTS.condensed, 9, sessionY, pageWidth)

  // 12. Legal texts
  const l1Y = (pageHeightMm - 13) * MM_TO_PT
  const l2Y = (pageHeightMm - 9) * MM_TO_PT
  const l3Y = (pageHeightMm - 5) * MM_TO_PT
  drawCentered(doc, l1, FONTS.bold, 7.5, l1Y, pageWidth)
  drawCentered(doc, l2, FONTS.bold, 7.5, l2Y, pageWidth)
  drawCentered(doc, l3, FONTS.bold, 7.5, l3Y, pageWidth)

  doc.end()
  return result
}
