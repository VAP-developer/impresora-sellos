/**
 * ticket-html-renderer.ts
 *
 * Genera los tickets (factura simplificada, copia caja, master set) como HTML
 * para imprimirlos con `webContents.print()` de Electron, igual que los sellos.
 *
 * Sustituye a genTicket / genTicketCaja / genTicketMaster (que producían PDF vía
 * PDFKit + SumatraPDF). El motivo es el mismo que en las etiquetas: SumatraPDF
 * no controla bien el tamaño de papel y rota/recorta; Electron con HTML sí.
 *
 * Ancho fijo 78mm, alto variable según nº de items. El alto se sigue calculando
 * con las funciones existentes de ticket-renderer (calcTicketHeightMm, etc.)
 * para que el `pageSize` enviado al DEVMODE coincida con el contenido.
 *
 * Requisitos no opcionales al imprimir por Electron:
 *   1. `printBackground: true` en las opciones de impresión.
 *   2. El HTML pinta su propio fondo blanco (si no, hereda el gris del navegador
 *      y en monocromo sale negro).
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getImagesPath } from './stamp-renderer'
import {
  TICKET_WIDTH_MM,
  countActiveItems,
  formatClientId,
  formatPrice,
  calcTicketHeightMm,
  calcTicketCajaHeightMm,
  calcTicketMasterHeightMm,
  getTicketLayout
} from './ticket-renderer'
import type {
  GenTicketParams,
  GenTicketCajaParams,
  GenTicketMasterParams,
  TicketBlock,
  TicketBlockStyle
} from './ticket-renderer'
import { buildFontFaceCss, escapeHtml } from './stamp-html-renderer'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Convierte una imagen de resources/images a data URI (o null si no existe) */
function imageFileToSrc(imageName: string): string | null {
  const full = join(getImagesPath(), imageName)
  if (!existsSync(full)) return null
  try {
    const lower = imageName.toLowerCase()
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/jpeg'
    return `data:${mime};base64,${readFileSync(full).toString('base64')}`
  } catch {
    return null
  }
}

/** Fila de item: nombre (con wrap) + cantidad + precio + importe */
function itemRow(name: string, qty: string, price: string, total: string): string {
  return (
    `<div class="row">` +
    `<span class="c-name">${escapeHtml(name)}</span>` +
    `<span class="c-qty">${escapeHtml(qty)}</span>` +
    `<span class="c-price">${escapeHtml(price)}</span>` +
    `<span class="c-total">${escapeHtml(total)}</span>` +
    `</div>`
  )
}

/** Envuelve el cuerpo en un documento HTML de ticket con el alto indicado */
function ticketDocument(title: string, heightMm: number, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${buildFontFaceCss()}
@page { size: ${TICKET_WIDTH_MM}mm ${Math.ceil(heightMm)}mm; margin: 0; }
html, body {
  margin: 0; padding: 0; background: #ffffff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.ticket {
  position: relative;
  width: ${TICKET_WIDTH_MM}mm;
  min-height: ${Math.ceil(heightMm)}mm;
  background: #ffffff;
  box-sizing: border-box;
  padding: 4mm 5mm 5mm 5mm;
  color: #000;
  font-family: 'FranklinGothic', Arial, Helvetica, sans-serif;
}
.logo { display:block; margin: 0 auto 1mm auto; }
.center { text-align: center; }
.bold { font-family: 'FranklinGothicBold', 'FranklinGothic', Arial, sans-serif; font-weight: bold; }
.cond { font-family: 'FranklinGothicCondensed', 'FranklinGothic', Arial, sans-serif; }
.feria { font-size: 12pt; }
.lugar { font-size: 10pt; margin-top: 1mm; }
.info { font-size: 7.5pt; margin-top: 0.6mm; }
.fecha { font-size: 8pt; margin-top: 1.5mm; }
.modo { font-size: 6.5pt; margin-top: 1.5mm; }
.sep { border: 0; border-top: 0.2mm dashed #000; margin: 1mm 0; }
.sep-total { border: 0; border-top: 0.2mm dashed #000; margin: 1mm 0 1mm 25mm; }
.cols, .row {
  position: relative;
  font-size: 8pt;
  min-height: 3.2mm;
}
.cols { font-weight: normal; }
.c-name { display: inline-block; width: 38mm; vertical-align: top; }
.c-qty { position: absolute; left: 40mm; width: 10mm; text-align: right; }
.c-price { position: absolute; left: 50mm; width: 12mm; text-align: right; }
.c-total { position: absolute; left: 62mm; width: 13mm; text-align: right; }
.h-name { display:inline-block; width: 38mm; }
.h-qty { position:absolute; left: 40mm; }
.h-price { position:absolute; left: 50mm; }
.h-total { position:absolute; left: 60mm; }
.total-row { position: relative; font-size: 8pt; margin-top: 1mm; }
.t-label { position:absolute; left: 30mm; }
.t-qty { position:absolute; left: 40mm; width:10mm; text-align:right; }
.t-total { position:absolute; left: 62mm; width:13mm; text-align:right; }
.legal { font-size: 7.5pt; margin-top: 1.5mm; }
.session { font-size: 7.5pt; margin-top: 1.5mm; }
.pay { font-size: 12pt; margin-top: 2mm; }
.pay-line { display:inline-block; border-bottom: 0.2mm solid #000; width: 20mm; margin-left: 2mm; }
.masterlabel { font-size: 9.5pt; margin-top: 1mm; }
</style>
</head>
<body>
<div class="ticket">
${body}
</div>
</body>
</html>`
}

/** Cabecera de columnas de productos */
function columnsHeader(): string {
  return (
    `<div class="cols cond">` +
    `<span class="h-name">Producto</span>` +
    `<span class="h-qty">Cant.</span>` +
    `<span class="h-price">Precio</span>` +
    `<span class="h-total">Importe</span>` +
    `</div>`
  )
}

// ─────────────────────────────────────────────
// Ticket principal (Factura Simplificada)
// ─────────────────────────────────────────────

/** Clase CSS para cada estilo de bloque de texto */
const BLOCK_STYLE_CLASS: Record<TicketBlockStyle, string> = {
  feria: 'center bold feria',
  lugar: 'center bold lugar',
  info: 'center bold info',
  fecha: 'center cond fecha',
  modo: 'bold modo',
  legal: 'center bold legal',
  session: 'center bold session',
  master: 'bold masterlabel'
}

/**
 * Renderiza el ticket principal recorriendo el layout de bloques activo
 * (default o Correo ESP según `formatoCorreoEsp`). Para cambiar qué aparece o
 * en qué orden, editar TICKET_LAYOUT_DEFAULT / TICKET_LAYOUT_CORREO_ESP en
 * ticket-renderer.ts.
 *
 * @param formatoCorreoEsp - valor del check "Formato Correo ESP"
 */
export function renderTicketHtml(params: GenTicketParams, formatoCorreoEsp = false): string {
  const {
    fechaTicket, modoTicket, modelo1Ticket, modelo2Ticket, items, productos,
    feria, lugar, empresa, cif, cp, l1, l2, l3, currencySymbol = '€'
  } = params

  const numItems = countActiveItems(items)
  const heightMm = calcTicketHeightMm(numItems)
  const logo = imageFileToSrc('image2.jpg')

  const codigoFeriaDisplay =
    params.codigoTicket || [params.codigoFeria1, params.codigoFeria2].filter(Boolean).join('-')
  const modoLine = codigoFeriaDisplay ? `${modoTicket}: ${codigoFeriaDisplay}` : modoTicket

  // Precalcular filas de items y totales
  let totalProductos = 0
  let totalImporte = 0
  const rows: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.cantidad <= 0) continue
    const producto = productos[i]
    const modeloTicket = item.idProducto.slice(-1) === '1' ? modelo1Ticket : modelo2Ticket
    totalProductos += item.cantidad
    totalImporte += item.cantidad * producto.precio
    rows.push(
      itemRow(
        `${modeloTicket} ${producto.nombre_ticket}`,
        String(item.cantidad),
        formatPrice(producto.precio, currencySymbol),
        formatPrice(item.cantidad * producto.precio, currencySymbol)
      )
    )
  }

  // Textos simples por source (los bloques que no son items/total/columnas/logo)
  const textFor = (block: TicketBlock): string => {
    switch (block.source) {
      case 'feria': return feria
      case 'lugar': return lugar
      case 'empresa': return empresa
      case 'cif': return cif
      case 'cp': return cp
      case 'fecha': return `Fecha ${fechaTicket}`
      case 'modo': return modoLine
      case 'session': return `${params.nombreMaquina ?? ''} - Sesión: ${formatClientId(params.idCliente ?? 0)}`
      case 'legal1': return l1
      case 'legal2': return l2
      case 'legal3': return l3
      case 'masterLabel': return 'MASTER SET'
      default: return ''
    }
  }

  const renderBlock = (block: TicketBlock): string => {
    const sep = block.separatorBefore
      ? (block.source === 'total' ? '<hr class="sep-total">' : '<hr class="sep">')
      : ''

    switch (block.source) {
      case 'logo':
        return logo ? `<img class="logo" src="${logo}" style="width:30mm">` : ''
      case 'columnas':
        return sep + columnsHeader()
      case 'items':
        return sep + rows.join('')
      case 'total':
        return (
          sep +
          `<div class="total-row cond">` +
          `<span class="t-label">Total:</span>` +
          `<span class="t-qty">${totalProductos}</span>` +
          `<span class="t-total">${escapeHtml(formatPrice(totalImporte, currencySymbol))}</span>` +
          `</div>`
        )
      default: {
        const text = textFor(block)
        if (!text) return sep
        const cls = block.style ? BLOCK_STYLE_CLASS[block.style] : 'info'
        return sep + `<div class="${cls}">${escapeHtml(text)}</div>`
      }
    }
  }

  const layout = getTicketLayout(formatoCorreoEsp)
  const body = layout.map(renderBlock).join('\n')

  return ticketDocument('Factura Simplificada', heightMm, body)
}

// ─────────────────────────────────────────────
// Ticket caja (copia)
// ─────────────────────────────────────────────

export function renderTicketCajaHtml(params: GenTicketCajaParams): string {
  const {
    items, idCliente, nombreMaquina, productos, feria, modoTicket,
    modelo1Ticket, modelo2Ticket, currencySymbol = '€'
  } = params

  const numItems = countActiveItems(items)
  const heightMm = calcTicketCajaHeightMm(numItems)
  const logo = imageFileToSrc('image2.jpg')

  let totalProductos = 0
  let totalImporte = 0
  let inicioMod2 = false
  const rows: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.cantidad <= 0) continue
    const producto = productos[i]
    const isModel2 = item.idProducto.slice(-1) === '2'
    const modeloTicket = isModel2 ? modelo2Ticket : modelo1Ticket
    if (isModel2 && !inicioMod2) {
      rows.push('<hr class="sep">')
      inicioMod2 = true
    }
    totalProductos += item.cantidad
    totalImporte += item.cantidad * producto.precio
    rows.push(
      itemRow(
        `${modeloTicket} ${producto.nombre_ticket}`,
        String(item.cantidad),
        formatPrice(producto.precio, currencySymbol),
        formatPrice(item.cantidad * producto.precio, currencySymbol)
      )
    )
  }

  const payField = (label: string): string =>
    `<div class="bold pay">${escapeHtml(label)}<span class="pay-line"></span></div>`

  const body = [
    logo ? `<img class="logo" src="${logo}" style="width:30mm">` : '',
    `<div class="center bold feria">${escapeHtml(feria)}</div>`,
    `<div class="bold modo">${escapeHtml(modoTicket)}</div>`,
    payField('TARJETA P.:'),
    payField('TP TUSELLO:'),
    payField('ATM SOBRE:'),
    payField('ATM Tarifa A:'),
    `<div class="cols cond"><span class="h-name">Producto</span><span class="h-qty">Cantidad</span></div>`,
    `<hr class="sep">`,
    rows.join(''),
    `<hr class="sep-total">`,
    `<div class="total-row cond">` +
      `<span class="t-label">Total:</span>` +
      `<span class="t-qty">${totalProductos}</span>` +
      `<span class="t-total">${escapeHtml(formatPrice(totalImporte, currencySymbol))}</span>` +
      `</div>`,
    `<hr class="sep">`,
    `<div class="center bold session">${escapeHtml(`${nombreMaquina} - Sesión: ${formatClientId(idCliente)}`)}</div>`,
    `<div class="center bold legal">PARA RECOGER SU PEDIDO</div>`,
    `<div class="center bold legal">PASE POR CAJA y ENTREGUE ESTE RESGUARDO</div>`
  ].join('\n')

  return ticketDocument('Copia Ticket Caja', heightMm, body)
}

// ─────────────────────────────────────────────
// Ticket master set
// ─────────────────────────────────────────────

const MASTER_SET_PRICE = 31.05

export function renderTicketMasterHtml(params: GenTicketMasterParams): string {
  const {
    fechaTicket, modoTicket, modelo1Ticket, modelo2Ticket, items, idCliente,
    nombreMaquina, feria, lugar, empresa, cif, cp, l1, l2, l3, currencySymbol = '€'
  } = params

  const numItems = countActiveItems(items)
  const heightMm = calcTicketMasterHeightMm(numItems)
  const logo = imageFileToSrc('image2.jpg')

  let totalItems = 0
  const rows: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.cantidad <= 0) continue
    const modeloTicket = item.idProducto.slice(-1) === '1' ? modelo1Ticket : modelo2Ticket
    totalItems++
    rows.push(
      itemRow(
        `${modeloTicket} Master Set`,
        '1',
        formatPrice(MASTER_SET_PRICE, currencySymbol),
        formatPrice(MASTER_SET_PRICE, currencySymbol)
      )
    )
  }
  const masterTotal = totalItems * MASTER_SET_PRICE

  const body = [
    logo ? `<img class="logo" src="${logo}" style="width:30mm">` : '',
    `<div class="center bold feria">${escapeHtml(feria)}</div>`,
    `<div class="center bold lugar">${escapeHtml(lugar)}</div>`,
    `<div class="center bold info">${escapeHtml(empresa)}</div>`,
    `<div class="center bold info">${escapeHtml(cif)}</div>`,
    `<div class="center bold info">${escapeHtml(cp)}</div>`,
    `<div class="center cond fecha">${escapeHtml(fechaTicket)}</div>`,
    `<div class="bold masterlabel">MASTER SET</div>`,
    `<div class="bold modo">${escapeHtml(modoTicket)}</div>`,
    columnsHeader(),
    `<hr class="sep">`,
    rows.join(''),
    `<hr class="sep-total">`,
    `<div class="total-row cond">` +
      `<span class="t-label">Total: ${totalItems}</span>` +
      `<span class="t-total">${escapeHtml(formatPrice(masterTotal, currencySymbol))}</span>` +
      `</div>`,
    `<hr class="sep">`,
    `<div class="center cond session">${escapeHtml(`${nombreMaquina} - Sesión: ${formatClientId(idCliente)}`)}</div>`,
    `<div class="center bold legal">${escapeHtml(l1)}</div>`,
    `<div class="center bold legal">${escapeHtml(l2)}</div>`,
    `<div class="center bold legal">${escapeHtml(l3)}</div>`
  ].join('\n')

  return ticketDocument('Master Set Ticket', heightMm, body)
}
