/**
 * pdf-generator.ts
 *
 * Orchestrates the generation of all PDFs for a single sale:
 * - Individual stamp labels (55x25mm) for each tariff/model with qty > 0
 * - Tira strips (4 pages per tira) for strip tariffs
 * - Special strips (tiras especiales) when enabled
 * - Main ticket (factura simplificada)
 * - Copy ticket (when ImprimeCopiaTicket = "S")
 * - Master set ticket (when ImprimeMasterTicket = "S")
 *
 * This module does NOT handle sending to printers or persisting to the print queue.
 * It receives config + quantities + profile and returns a list of generated PDF buffers
 * with routing metadata (which printer each should go to).
 *
 * Validates: Requirements 6, 7, 8 (generation part)
 * Correctness Property: 7 (deterministic PDF count), 8 (ticket title by profile), 9 (routing)
 */

import type { AppConfig, PreciosConfig } from '../../renderer/src/types/config'
import { renderStamp, renderStampMultiPage, renderStampEspecialStrip } from './stamp-renderer'
import type { StampRenderParams } from './stamp-renderer'
import { genTicket, genTicketCaja, genTicketMaster, calcTicketHeightMm, calcTicketCajaHeightMm, countActiveItems } from './ticket-renderer'
import type { TicketItem, TicketProduct } from './ticket-renderer'
import { ImagesRepository } from '../database/repositories/images.repository'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Quantities per tariff and model (mirrors renderer KioskoQuantities) */
export interface SaleQuantities {
  // Modelo 1 (izquierdo / printer1)
  tarifaAS1: number
  tarifaA2S1: number
  tarifaBS1: number
  tarifaCS1: number
  tarifaAT1: number // Tira tarifa A modelo1
  tarifa4T1: number // Tira 4 tarifas modelo1
  // Modelo 2 (derecho / printer2)
  tarifaAS2: number
  tarifaA2S2: number
  tarifaBS2: number
  tarifaCS2: number
  tarifaAT2: number
  tarifa4T2: number
}

/** Target printer for a generated PDF */
export type PrinterTarget = 'printer1' | 'printer2' | 'ticket'

/** A generated PDF with its routing metadata */
export interface GeneratedPdf {
  /** PDF content as Buffer */
  buffer: Buffer
  /** Target printer for this PDF */
  target: PrinterTarget
  /** Type identifier (e.g. "stamp_simple", "stamp_tira", "stamp_especial", "ticket", "ticket_caja", "ticket_master") */
  pdfType: string
  /** Human-readable description for debugging/logging */
  description: string
  /** Actual page height in mm (used for ticket media sizing) */
  ticketHeightMm?: number
}

/** Result of generating all PDFs for a sale */
export interface SaleGenerationResult {
  /** All generated PDFs with routing metadata */
  pdfs: GeneratedPdf[]
  /** Total number of stamp PDFs generated */
  stampCount: number
  /** Total number of ticket PDFs generated */
  ticketCount: number
  /** The next product counter value (to persist in config for the following sale) */
  nextProducto: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats the month component of the label code.
 * Months 10/11/12 → O/N/D, others → digit string.
 */
function formatMes(mesCfg: number): string {
  const month = mesCfg === 0 ? new Date().getMonth() + 1 : mesCfg
  if (month === 10) return 'O'
  if (month === 11) return 'N'
  if (month === 12) return 'D'
  return month.toString()
}

/**
 * Formats the year component (2 digits).
 */
function formatAnnio(annioCfg: string): string {
  if (annioCfg === 'auto') {
    return (new Date().getFullYear() - 2000).toString()
  }
  return annioCfg
}

/**
 * Formats the client/session ID with zero-padding to 4 digits.
 */
function formatCliente(cliente: number): string {
  return cliente.toString().padStart(4, '0')
}

/**
 * Formats the product ID with zero-padding to 3 digits.
 */
function formatProducto(producto: number): string {
  return producto.toString().padStart(3, '0')
}

/**
 * Builds the complete label code string.
 * Pattern: {modo}{mes}{pais}{año} {maquina}-{cliente4dígitos}-{producto3dígitos}
 *
 * @param config - App configuration
 * @param productoId - The product/stamp counter value to encode (increments per stamp)
 */
function buildLabelCode(config: AppConfig, productoId: number): string {
  const { codigo } = config
  const modo = codigo.modo
  const mes = formatMes(codigo.mes)
  const pais = codigo.pais
  const annio = formatAnnio(codigo.annio)
  const maquina = codigo.maquina
  const cliente = formatCliente(codigo.cliente)
  const producto = formatProducto(productoId)
  return `${modo}${mes}${pais}${annio} ${maquina}-${cliente}-${producto}`
}

/**
 * Determines the ticket title based on the active profile.
 * - Filatelia → "Filatelia de: {titulo}"
 * - Protocolo → "Protocolo de: {titulo}"
 * - SPDE → "SPDE de: {titulo}"
 * - Others → titulo as-is
 */
export function buildTicketTitle(profile: string, baseTitle: string): string {
  const profileLower = profile.toLowerCase()
  if (profileLower === 'filatelia') return `Filatelia de: ${baseTitle}`
  if (profileLower === 'protocolo') return `Protocolo de: ${baseTitle}`
  if (profileLower === 'spde') return `SPDE de: ${baseTitle}`
  return baseTitle
}

/**
 * Gets the current date/time formatted for the ticket.
 * If config says "auto", uses current system date/time.
 */
function getTicketDateTime(config: AppConfig): string {
  const { ticket } = config
  const now = new Date()

  const fecha =
    ticket.fecha === 'auto'
      ? now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ticket.fecha

  const hora =
    ticket.hora === 'auto'
      ? now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : ticket.hora

  return `${fecha} ${hora}`
}

/**
 * Retrieves the background image for a given model name.
 * Returns the data URI from the database, or null if not found.
 */
function getModelBackground(modelName: string, imagesRepo: ImagesRepository): string | null {
  if (!modelName) return null
  const image = imagesRepo.getByName(modelName)
  return image ? image.url : null
}

/**
 * Builds the TicketItem array and TicketProduct array from quantities and prices.
 * Items follow the legacy convention where idProducto ends with "1" for model1, "2" for model2.
 */
function buildTicketData(
  quantities: SaleQuantities,
  precios: PreciosConfig
): { items: TicketItem[]; productos: TicketProduct[] } {
  const tarifaTA = precios.tarifaTA ?? precios.tarifaA * 4
  const tarifaT4 =
    precios.tarifaT4 ?? precios.tarifaA + precios.tarifaA2 + precios.tarifaB + precios.tarifaC

  const items: TicketItem[] = [
    { idProducto: 'AT1', cantidad: quantities.tarifaAT1 },
    { idProducto: 'AT2', cantidad: quantities.tarifaAT2 },
    { idProducto: '4T1', cantidad: quantities.tarifa4T1 },
    { idProducto: '4T2', cantidad: quantities.tarifa4T2 },
    { idProducto: 'AS1', cantidad: quantities.tarifaAS1 },
    { idProducto: 'AS2', cantidad: quantities.tarifaAS2 },
    { idProducto: 'A2S1', cantidad: quantities.tarifaA2S1 },
    { idProducto: 'A2S2', cantidad: quantities.tarifaA2S2 },
    { idProducto: 'BS1', cantidad: quantities.tarifaBS1 },
    { idProducto: 'BS2', cantidad: quantities.tarifaBS2 },
    { idProducto: 'CS1', cantidad: quantities.tarifaCS1 },
    { idProducto: 'CS2', cantidad: quantities.tarifaCS2 }
  ]

  const productos: TicketProduct[] = [
    { idProducto: 'AT1', modo: 'T', precio: tarifaTA, nombre_ticket: 'Tarifa A Tira 4' },
    { idProducto: 'AT2', modo: 'T', precio: tarifaTA, nombre_ticket: 'Tarifa A Tira 4' },
    { idProducto: '4T1', modo: 'T', precio: tarifaT4, nombre_ticket: 'Tira de 4 Tarifas' },
    { idProducto: '4T2', modo: 'T', precio: tarifaT4, nombre_ticket: 'Tira de 4 Tarifas' },
    { idProducto: 'AS1', modo: 'S', precio: precios.tarifaA, nombre_ticket: 'Tarifa A' },
    { idProducto: 'AS2', modo: 'S', precio: precios.tarifaA, nombre_ticket: 'Tarifa A' },
    { idProducto: 'A2S1', modo: 'S', precio: precios.tarifaA2, nombre_ticket: 'Tarifa A2' },
    { idProducto: 'A2S2', modo: 'S', precio: precios.tarifaA2, nombre_ticket: 'Tarifa A2' },
    { idProducto: 'BS1', modo: 'S', precio: precios.tarifaB, nombre_ticket: 'Tarifa B' },
    { idProducto: 'BS2', modo: 'S', precio: precios.tarifaB, nombre_ticket: 'Tarifa B' },
    { idProducto: 'CS1', modo: 'S', precio: precios.tarifaC, nombre_ticket: 'Tarifa C' },
    { idProducto: 'CS2', modo: 'S', precio: precios.tarifaC, nombre_ticket: 'Tarifa C' }
  ]

  return { items, productos }
}

// ─── Tariff definitions for iteration ─────────────────────────────────────────

interface TariffDef {
  /** Key in SaleQuantities */
  qtyKey: keyof SaleQuantities
  /** Display name for the stamp */
  label: string
  /** Whether this is a tira (strip of 4) */
  isTira: boolean
  /** Model number (1 or 2) */
  model: 1 | 2
  /** Printer target */
  target: PrinterTarget
}

const TARIFF_DEFS: TariffDef[] = [
  // Model 1 simple stamps
  { qtyKey: 'tarifaAS1', label: 'Tarifa A', isTira: false, model: 1, target: 'printer1' },
  { qtyKey: 'tarifaA2S1', label: 'Tarifa A2', isTira: false, model: 1, target: 'printer1' },
  { qtyKey: 'tarifaBS1', label: 'Tarifa B', isTira: false, model: 1, target: 'printer1' },
  { qtyKey: 'tarifaCS1', label: 'Tarifa C', isTira: false, model: 1, target: 'printer1' },
  // Model 1 tiras
  { qtyKey: 'tarifaAT1', label: 'Tarifa A', isTira: true, model: 1, target: 'printer1' },
  { qtyKey: 'tarifa4T1', label: 'Tira 4 Tarifas', isTira: true, model: 1, target: 'printer1' },
  // Model 2 simple stamps
  { qtyKey: 'tarifaAS2', label: 'Tarifa A', isTira: false, model: 2, target: 'printer2' },
  { qtyKey: 'tarifaA2S2', label: 'Tarifa A2', isTira: false, model: 2, target: 'printer2' },
  { qtyKey: 'tarifaBS2', label: 'Tarifa B', isTira: false, model: 2, target: 'printer2' },
  { qtyKey: 'tarifaCS2', label: 'Tarifa C', isTira: false, model: 2, target: 'printer2' },
  // Model 2 tiras
  { qtyKey: 'tarifaAT2', label: 'Tarifa A', isTira: true, model: 2, target: 'printer2' },
  { qtyKey: 'tarifa4T2', label: 'Tira 4 Tarifas', isTira: true, model: 2, target: 'printer2' }
]

// ─── Main orchestration ───────────────────────────────────────────────────────

/**
 * Generates all PDFs for a sale.
 *
 * Given the app configuration, quantities selected by the vendor, and the active profile,
 * this function produces all stamp label PDFs and ticket PDFs needed, each tagged with
 * the target printer for routing.
 *
 * @param config - Current app configuration (includes codigo, ticket, sello, precios)
 * @param quantities - Quantities per tariff/model selected in the kiosko
 * @param profile - Active profile name (e.g. "FERIA", "Filatelia", "Protocolo", "SPDE")
 * @param imagesRepo - Optional ImagesRepository instance (for testability)
 * @returns SaleGenerationResult with all PDFs and counts
 */
export async function generateSalePdfs(
  config: AppConfig,
  quantities: SaleQuantities,
  profile: string,
  imagesRepo?: ImagesRepository
): Promise<SaleGenerationResult> {
  const repo = imagesRepo ?? new ImagesRepository()
  const pdfs: GeneratedPdf[] = []

  // Product counter starts from config value and increments per stamp generated
  let productoCounter = config.codigo.producto

  // Get active event data for stamp text
  const eventoIndex = config.sello.elevento
  const evento = config.sello.eventos?.[eventoIndex]
  const stampFecha = evento?.fecha ?? ''
  const stampEvento = evento?.localidad ?? ''

  // Get background images for each model
  const model1Name = evento?.motivoi ?? config.sello.modelo1 ?? ''
  const model2Name = evento?.motivod ?? config.sello.modelo2 ?? ''
  const bg1 = getModelBackground(model1Name, repo)
  const bg2 = getModelBackground(model2Name, repo)

  // Determine if we use blank stamps (modes MD/FI don't print background)
  const usesBlankBackground = config.codigo.modo === 'MD' || config.codigo.modo === 'FI'

  // ─── Generate stamp PDFs ───────────────────────────────────────────────────

  for (const tariff of TARIFF_DEFS) {
    const qty = quantities[tariff.qtyKey]
    if (qty <= 0) continue

    const background = usesBlankBackground
      ? null
      : tariff.model === 1
        ? bg1
        : bg2

    if (tariff.isTira) {
      // Tiras: each unit generates a 4-page PDF (4 stamps in one print job)
      for (let i = 0; i < qty; i++) {
        const stamps: StampRenderParams[] = []

        if (tariff.qtyKey.startsWith('tarifa4T')) {
          // "Tira 4 Tarifas" — 4 different tariffs: A, A2, B, C
          const tariffLabels = ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa C']
          for (const tLabel of tariffLabels) {
            stamps.push({
              tarifa: tLabel,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: buildLabelCode(config, productoCounter),
              backgroundImage: background
            })
            productoCounter++
          }
        } else {
          // "Tira Tarifa A" — 4 stamps all same tariff
          for (let j = 0; j < 4; j++) {
            stamps.push({
              tarifa: tariff.label,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: buildLabelCode(config, productoCounter),
              backgroundImage: background
            })
            productoCounter++
          }
        }

        const pdfBuffer = await renderStampMultiPage(stamps)
        pdfs.push({
          buffer: pdfBuffer,
          target: tariff.target,
          pdfType: 'stamp_tira',
          description: `Tira ${tariff.label} modelo${tariff.model} #${i + 1}`
        })
      }
    } else {
      // Simple stamps: one single-page PDF per stamp
      for (let i = 0; i < qty; i++) {
        const pdfBuffer = await renderStamp({
          tarifa: tariff.label,
          fecha: stampFecha,
          evento: stampEvento,
          codigo: buildLabelCode(config, productoCounter),
          backgroundImage: background
        })
        productoCounter++
        pdfs.push({
          buffer: pdfBuffer,
          target: tariff.target,
          pdfType: 'stamp_simple',
          description: `${tariff.label} modelo${tariff.model} #${i + 1}`
        })
      }
    }
  }

  // ─── Generate special strips (tiras especiales) ────────────────────────────

  const counterRef = { value: productoCounter }
  await generateEspecialStrips(config, quantities, counterRef, pdfs)
  productoCounter = counterRef.value

  // ─── Generate ticket PDFs ──────────────────────────────────────────────────

  const { items, productos } = buildTicketData(quantities, config.precios)
  const hasAnyItems = items.some((item) => item.cantidad > 0)

  if (hasAnyItems) {
    const fechaTicket = getTicketDateTime(config)
    const modoTicket = buildTicketTitle(profile, config.ticket.titulo)
    const modelo1Ticket = model1Name || 'Modelo 1'
    const modelo2Ticket = model2Name || 'Modelo 2'

    // Calculate actual ticket heights based on number of active items
    const nitems = countActiveItems(items)
    const ticketHeightMm = calcTicketHeightMm(nitems)
    const ticketCajaHeightMm = calcTicketCajaHeightMm(nitems)

    // Main ticket
    const ticketBuffer = await genTicket({
      fechaTicket,
      modoTicket,
      modelo1Ticket,
      modelo2Ticket,
      items,
      idCliente: config.codigo.cliente,
      nombreMaquina: config.codigo.maquina,
      productos,
      feria: config.ticket.feria,
      lugar: config.ticket.lugar,
      empresa: config.ticket.empresa,
      cif: config.ticket.cif,
      cp: config.ticket.cp,
      l1: config.ticket.l1,
      l2: config.ticket.l2,
      l3: config.ticket.l3
    })
    pdfs.push({
      buffer: ticketBuffer,
      target: 'ticket',
      pdfType: 'ticket',
      description: 'Ticket principal (Factura Simplificada)',
      ticketHeightMm
    })

    // Copy ticket (ticket caja) — when configured
    if (config.ticket.ImprimeCopiaTicket === 'S') {
      const ticketCajaBuffer = await genTicketCaja({
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        productos,
        feria: config.ticket.feria,
        modoTicket: config.ticket.tituloCopia || 'COPIA Factura Simplificada',
        modelo1Ticket,
        modelo2Ticket
      })
      pdfs.push({
        buffer: ticketCajaBuffer,
        target: 'ticket',
        pdfType: 'ticket_caja',
        description: 'Ticket copia (caja)',
        ticketHeightMm: ticketCajaHeightMm
      })
    }

    // Master set ticket — when configured
    if (config.ticket.ImprimeMasterTicket === 'S') {
      const ticketMasterBuffer = await genTicketMaster({
        fechaTicket,
        modoTicket: 'Master Set',
        modelo1Ticket,
        modelo2Ticket,
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        productos,
        feria: config.ticket.feria,
        lugar: config.ticket.lugar,
        empresa: config.ticket.empresa,
        cif: config.ticket.cif,
        cp: config.ticket.cp,
        l1: config.ticket.l1,
        l2: config.ticket.l2,
        l3: config.ticket.l3
      })
      pdfs.push({
        buffer: ticketMasterBuffer,
        target: 'ticket',
        pdfType: 'ticket_master',
        description: 'Ticket master set',
        ticketHeightMm: ticketCajaHeightMm
      })
    }

    // ─── Individual ticket per tira (strip) ─────────────────────────────────
    // Legacy behavior: for each tira unit, generate an individual ticket showing
    // only that single tira item (cantidad=1). This only applies when the machine
    // mode is NOT "MD" or "FI".
    const maquinaPrefix = config.codigo.maquina.substring(0, 2).toUpperCase()
    if (maquinaPrefix !== 'MD' && maquinaPrefix !== 'FI') {
      for (let idx = 0; idx < items.length; idx++) {
        if (items[idx].cantidad > 0 && productos[idx].modo === 'T') {
          // Generate one ticket per tira unit
          for (let t = 0; t < items[idx].cantidad; t++) {
            // Build items array with only this tira item set to cantidad=1
            const singleTiraItems: TicketItem[] = items.map((item, i) => ({
              idProducto: item.idProducto,
              cantidad: i === idx ? 1 : 0
            }))

            const singleTiraHeightMm = calcTicketHeightMm(1)
            const singleTiraBuffer = await genTicket({
              fechaTicket,
              modoTicket,
              modelo1Ticket,
              modelo2Ticket,
              items: singleTiraItems,
              idCliente: config.codigo.cliente,
              nombreMaquina: config.codigo.maquina,
              productos,
              feria: config.ticket.feria,
              lugar: config.ticket.lugar,
              empresa: config.ticket.empresa,
              cif: config.ticket.cif,
              cp: config.ticket.cp,
              l1: config.ticket.l1,
              l2: config.ticket.l2,
              l3: config.ticket.l3
            })
            pdfs.push({
              buffer: singleTiraBuffer,
              target: 'ticket',
              pdfType: 'ticket_tira',
              description: `Ticket individual tira ${productos[idx].nombre_ticket} #${t + 1}`,
              ticketHeightMm: singleTiraHeightMm
            })
          }
        }
      }
    }
  }

  // ─── Count results ─────────────────────────────────────────────────────────

  const stampCount = pdfs.filter(
    (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira' || p.pdfType === 'stamp_especial'
  ).length
  const ticketCount = pdfs.filter(
    (p) => p.pdfType === 'ticket' || p.pdfType === 'ticket_caja' || p.pdfType === 'ticket_master' || p.pdfType === 'ticket_tira'
  ).length

  return { pdfs, stampCount, ticketCount, nextProducto: productoCounter }
}

// ─── Special strips generation ────────────────────────────────────────────────

/**
 * Generates special strip PDFs (tiras especiales) when enabled in config.
 * Special strips use unique backgrounds (TiraEspecial1-4.png) and are independent
 * of the regular tiras. They're enabled per model via TEmod1/TEmod2.
 *
 * T1especial, T2especial, T3especial define the prices/types of especial strips.
 * When a Tespecial value > 0 and TEmod is "S", it generates the strip.
 */
async function generateEspecialStrips(
  config: AppConfig,
  quantities: SaleQuantities,
  counterRef: { value: number },
  pdfs: GeneratedPdf[]
): Promise<void> {
  const { ticket } = config

  // Check if there are any tira quantities that trigger especial strips
  const hasTiras1 = quantities.tarifaAT1 > 0 || quantities.tarifa4T1 > 0
  const hasTiras2 = quantities.tarifaAT2 > 0 || quantities.tarifa4T2 > 0

  // Model 1 special strips
  if (ticket.TEmod1 === 'S' && hasTiras1) {
    const especialPrices = [ticket.T1especial, ticket.T2especial, ticket.T3especial]
    for (let idx = 0; idx < especialPrices.length; idx++) {
      const price = especialPrices[idx]
      if (price && price > 0) {
        const codigos: [string, string, string, string] = [
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++)
        ]
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ''}`
        const buffer = await renderStampEspecialStrip(codigos, '  -E', tarifa)
        pdfs.push({
          buffer,
          target: 'printer1',
          pdfType: 'stamp_especial',
          description: `Tira especial ${idx + 1} modelo1`
        })
      }
    }
  }

  // Model 2 special strips
  if (ticket.TEmod2 === 'S' && hasTiras2) {
    const especialPrices = [ticket.T1especial, ticket.T2especial, ticket.T3especial]
    for (let idx = 0; idx < especialPrices.length; idx++) {
      const price = especialPrices[idx]
      if (price && price > 0) {
        const codigos: [string, string, string, string] = [
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++)
        ]
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ''}`
        const buffer = await renderStampEspecialStrip(codigos, '  -E', tarifa)
        pdfs.push({
          buffer,
          target: 'printer2',
          pdfType: 'stamp_especial',
          description: `Tira especial ${idx + 1} modelo2`
        })
      }
    }
  }
}
