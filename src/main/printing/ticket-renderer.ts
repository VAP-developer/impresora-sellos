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
 * Uses top-down layout: fixed header + variable item rows + fixed footer.
 */
export function calcTicketHeightMm(numItems: number): number {
  const HEADER_HEIGHT_MM = 62
  const FOOTER_HEIGHT_MM = 30
  const ITEM_HEIGHT_MM = 3
  return HEADER_HEIGHT_MM + (numItems * ITEM_HEIGHT_MM) + FOOTER_HEIGHT_MM
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
 * Uses top-down layout: fixed header (with payment fields) + variable items + footer.
 */
export function calcTicketCajaHeightMm(numItems: number): number {
  const HEADER_HEIGHT_MM = 72
  const FOOTER_HEIGHT_MM = 22
  const ITEM_HEIGHT_MM = 3.5
  return HEADER_HEIGHT_MM + (numItems * ITEM_HEIGHT_MM) + FOOTER_HEIGHT_MM
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generates the main ticket PDF (Factura Simplificada).
 *
 * Layout (top-down):
 *   - Logo (image2.jpg) centered at top
 *   - Header: feria, lugar, empresa, CIF, CP
 *   - Date
 *   - Mode/title text
 *   - Column headers and separator
 *   - Item rows (variable number)
 *   - Total separator + total row
 *   - Session ID
 *   - Legal texts l1, l2, l3
 *
 * The page height is calculated dynamically based on the actual content size,
 * ensuring the ticket grows as needed without scaling text.
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

  // Calculate page height: fixed header/footer + variable item rows
  // Header (logo + texts + date + title + column headers): ~62mm
  // Each item row: 3mm
  // Footer (total + session + legal): ~30mm
  const HEADER_HEIGHT_MM = 62
  const FOOTER_HEIGHT_MM = 30
  const ITEM_HEIGHT_MM = 3
  const pageHeightMm = HEADER_HEIGHT_MM + (nitems * ITEM_HEIGHT_MM) + FOOTER_HEIGHT_MM
  const pageHeight = pageHeightMm * MM_TO_PT

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Factura Simplificada', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // ─── Top-down layout (all Y values are from top in mm) ───
  let y = 2 // Start 2mm from top

  // 1. Logo centered (height ~10mm)
  drawImageCentered(doc, 'image2.jpg', y * MM_TO_PT, 30 * MM_TO_PT, pageWidth)
  y += 12

  // 2. Background watermark (positioned behind content area)
  const bgY = y + 2
  drawImage(doc, 'fondoticketori.png', 5 * MM_TO_PT, bgY * MM_TO_PT, 20 * MM_TO_PT)

  // 3. Header texts
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth)
  y += 5
  drawCentered(doc, lugar, FONTS.bold, 10, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, empresa, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 3
  drawCentered(doc, cif, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 3
  drawCentered(doc, cp, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4

  // 4. Date
  drawCentered(doc, 'Fecha', FONTS.condensed, 8, y * MM_TO_PT, pageWidth)
  y += 3
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, y * MM_TO_PT, pageWidth)
  y += 4

  // 5. Mode/title text
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 6. Column headers
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Cant.', FONTS.condensed, 8, 45 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Precio', FONTS.condensed, 8, 55 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Importe', FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT)
  y += 3

  // 7. Separator line below headers
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 2

  // 8. Item rows
  let totalProductos = 0
  let totalImporte = 0

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

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT)

      y += ITEM_HEIGHT_MM
    }
  }

  // 9. Total separator and total row
  y += 2
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)
  y += 3

  drawLeft(doc, 'Total:', FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT)
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT)
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 10. Bottom separator
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 4

  // 11. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  drawCentered(doc, sessionText, FONTS.condensed, 9, y * MM_TO_PT, pageWidth)
  y += 5

  // 12. Legal texts at bottom
  drawCentered(doc, l1, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, l2, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, l3, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)

  doc.end()
  return result
}


/**
 * Generates the cash register copy ticket (COPIA / ticket caja).
 *
 * Layout (top-down):
 *   - Logo (image2.jpg) centered at top
 *   - Feria header
 *   - Mode/title text
 *   - Payment fields (TARJETA P., TP TUSELLO, ATM SOBRE, ATM Tarifa A)
 *   - Column headers and separator
 *   - Item rows (with model separator)
 *   - Total row
 *   - Session ID
 *   - "PASE POR CAJA" / "PARA RECOGER SU PEDIDO" bottom text
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

  // Calculate page height: header/payment fields (~72mm) + items + footer (~22mm)
  const HEADER_HEIGHT_MM = 72
  const FOOTER_HEIGHT_MM = 22
  const ITEM_HEIGHT_MM = 3.5
  const pageHeightMm = HEADER_HEIGHT_MM + (nitems * ITEM_HEIGHT_MM) + FOOTER_HEIGHT_MM
  const pageHeight = pageHeightMm * MM_TO_PT

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Copia Ticket Caja', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // ─── Top-down layout ───
  let y = 2

  // 1. Logo centered
  drawImageCentered(doc, 'image2.jpg', y * MM_TO_PT, 30 * MM_TO_PT, pageWidth)
  y += 12

  // 2. Background watermark
  drawImage(doc, 'fondoticketcop-nada.png', 5 * MM_TO_PT, (y + 2) * MM_TO_PT, 20 * MM_TO_PT)

  // 3. Feria header
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth)
  y += 5

  // 4. Mode/title text
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 5. Payment fields
  drawLeft(doc, 'TARJETA P.:', FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT)
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)
  y += 6

  drawLeft(doc, 'TP TUSELLO:', FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT)
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)
  y += 6

  drawLeft(doc, 'ATM SOBRE:', FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT)
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)
  y += 6

  drawLeft(doc, 'ATM Tarifa A:', FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT)
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT)
  y += 7

  // 6. Column headers
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Cantidad', FONTS.condensed, 8, 30 * MM_TO_PT, y * MM_TO_PT)
  y += 3

  // 7. Separator line
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 2

  // 8. Item rows
  let totalProductos = 0
  let totalImporte = 0
  let inicioMod2 = false

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item.cantidad > 0) {
      const producto = productos[index]
      const isModel2 = item.idProducto.slice(-1) === '2'
      const modeloTicket = isModel2 ? modelo2Ticket : modelo1Ticket

      // Draw separator line when switching from model1 to model2 items
      if (isModel2 && !inicioMod2) {
        drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
        inicioMod2 = true
        y += 2
      }

      totalProductos += item.cantidad
      totalImporte += item.cantidad * producto.precio

      const itemName = modeloTicket + ' ' + producto.nombre_ticket
      const quantity = String(item.cantidad)
      const price = formatPrice(producto.precio)
      const total = formatPrice(item.cantidad * producto.precio)

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT)

      y += ITEM_HEIGHT_MM
    }
  }

  // 9. Total separator and total row
  y += 2
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)
  y += 3

  drawLeft(doc, 'Total:', FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT)
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT)
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 10. Bottom separator
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 4

  // 11. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  drawCentered(doc, sessionText, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4

  // 12. Bottom texts
  drawCentered(doc, 'PARA RECOGER SU PEDIDO', FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, 'PASE POR CAJA y ENTREGUE ESTE RESGUARDO', FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)

  doc.end()
  return result
}

/**
 * Generates the Master Set ticket.
 *
 * Layout (top-down):
 *   - Logo (image2.jpg) centered at top
 *   - Header: feria, lugar, empresa, CIF, CP
 *   - Date
 *   - "MASTER SET" label
 *   - Column headers and separator
 *   - Item rows (each as "ModelName Master Set" qty=1, price=31.05€)
 *   - Total row
 *   - Session ID
 *   - Legal texts
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

  // Calculate page height
  const HEADER_HEIGHT_MM = 66
  const FOOTER_HEIGHT_MM = 30
  const ITEM_HEIGHT_MM = 3
  const pageHeightMm = HEADER_HEIGHT_MM + (nitems * ITEM_HEIGHT_MM) + FOOTER_HEIGHT_MM
  const pageHeight = pageHeightMm * MM_TO_PT

  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: 'Master Set Ticket', Author: 'Stamp Sales App' }
  })

  const result = collectPdf(doc)
  registerFonts(doc)

  const pageWidth = TICKET_WIDTH

  // ─── Top-down layout ───
  let y = 2

  // 1. Logo centered
  drawImageCentered(doc, 'image2.jpg', y * MM_TO_PT, 30 * MM_TO_PT, pageWidth)
  y += 12

  // 2. Background watermark
  drawImage(doc, 'fondoticketcop.png', 5 * MM_TO_PT, y * MM_TO_PT, 70 * MM_TO_PT)

  // 3. Header texts
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth)
  y += 5
  drawCentered(doc, lugar, FONTS.bold, 10, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, empresa, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 3
  drawCentered(doc, cif, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 3
  drawCentered(doc, cp, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4

  // 4. Date
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, y * MM_TO_PT, pageWidth)
  y += 4

  // 5. "MASTER SET" label + mode text
  drawLeft(doc, 'MASTER SET', FONTS.bold, 9.5, 5 * MM_TO_PT, y * MM_TO_PT)
  y += 3
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 6. Column headers
  drawLeft(doc, 'Producto', FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Cant.', FONTS.condensed, 8, 45 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Precio', FONTS.condensed, 8, 55 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, 'Importe', FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT)
  y += 3

  // 7. Separator line
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 2

  // 8. Item rows
  const MASTER_SET_PRICE = 31.05
  let totalItems = 0

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item.cantidad > 0) {
      const modeloTicket = item.idProducto.slice(-1) === '1' ? modelo1Ticket : modelo2Ticket
      totalItems++

      const itemName = modeloTicket + ' Master Set'

      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, '1', FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT)
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT)

      y += ITEM_HEIGHT_MM
    }
  }

  // 9. Total separator and row
  y += 2
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT)
  y += 3

  const masterTotal = totalItems * MASTER_SET_PRICE
  drawLeft(doc, `Total:     ${totalItems}`, FONTS.condensed, 8, 40 * MM_TO_PT, y * MM_TO_PT)
  drawLeft(doc, formatPrice(masterTotal), FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT)
  y += 4

  // 10. Bottom separator
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT)
  y += 4

  // 11. Session ID
  const clienteStr = formatClientId(idCliente)
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`
  drawCentered(doc, sessionText, FONTS.condensed, 9, y * MM_TO_PT, pageWidth)
  y += 5

  // 12. Legal texts
  drawCentered(doc, l1, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, l2, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)
  y += 4
  drawCentered(doc, l3, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth)

  doc.end()
  return result
}
