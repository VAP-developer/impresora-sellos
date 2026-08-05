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
import { renderStampMultiPage, renderStampEspecialStrip } from './stamp-renderer'
import type { StampRenderParams, StampLayout } from './stamp-renderer'
import { genTicket, genTicketCaja, genTicketMaster, calcTicketHeightMm, calcTicketCajaHeightMm, calcTicketMasterHeightMm, calcActualTicketHeight, calcActualTicketCajaHeight, countActiveItems } from './ticket-renderer'
import type { TicketItem, TicketProduct } from './ticket-renderer'
import { ImagesRepository } from '../database/repositories/images.repository'
import { ImageSyncRepository } from '../database/repositories/image-sync.repository'
import { buildImageName } from '../images/sync-images'
import { groupLabels } from './label-grouping'
import { ConfigRepository } from '../database/repositories/config.repository'

// ─── Image Layer Types ────────────────────────────────────────────────────────

/**
 * Options for image layer composition in stamps/labels.
 * Controls which image layers are rendered and in what order.
 *
 * Layer ordering (bottom to top):
 * - Only sello:  [sello, texto]
 * - Only fondo:  [fondo, texto]
 * - Both:        [fondo, sello, texto]
 * - Neither:     [texto]
 */
export interface ImageLayerOptions {
  /** Whether to print the background image (fondo) — volatile, for testing */
  printFondo: boolean
  /** Whether to print the stamp image (sello) */
  printSello: boolean
  /** Whether to print the logo PNG on the right side of the stamp text fields */
  printLogoPng?: boolean
  /** Background image as Data URI or null */
  fondoImage: string | null
  /** Stamp image as Data URI or null */
  selloImage: string | null
  /** When true, use secondary_price for ticket amounts instead of local_price */
  useSecondaryPrice?: boolean
}

/**
 * Notification emitted when an image was expected but not available.
 */
export interface ImageLayerNotification {
  type: 'missing_image'
  imageType: 'fondo' | 'sello'
  message: string
}

/**
 * Resolves which background image(s) to use for a stamp based on ImageLayerOptions.
 * Returns the effective background image for the stamp renderer (single image or null),
 * plus any notifications about missing images.
 *
 * The stamp renderer only supports a single backgroundImage param, so when both
 * fondo and sello are active, we return sello (it renders on top of fondo which
 * must be composed separately). For the current stamp renderer architecture,
 * the background image param maps to the "bottom-most" layer below text.
 *
 * Layer composition strategy:
 * - sello only → backgroundImage = sello
 * - fondo only → backgroundImage = fondo
 * - both → backgroundImage = fondo (sello handled as overlay — see design note below)
 * - neither → backgroundImage = null
 *
 * Design note: When both are active, the current stamp renderer uses a single
 * background image slot. In this case, fondo goes as background and sello as
 * an additional overlay. This is handled via the `overlayImage` field in the result.
 */
export function resolveImageLayers(options: ImageLayerOptions): {
  backgroundImage: string | null
  overlayImage: string | null
  notifications: ImageLayerNotification[]
} {
  const notifications: ImageLayerNotification[] = []
  let backgroundImage: string | null = null
  let overlayImage: string | null = null

  const { printFondo, printSello, fondoImage, selloImage } = options

  if (printSello && !selloImage) {
    notifications.push({
      type: 'missing_image',
      imageType: 'sello',
      message: 'La imagen del sello está activada pero no fue encontrada para la feria activa'
    })
  }

  if (printFondo && !fondoImage) {
    notifications.push({
      type: 'missing_image',
      imageType: 'fondo',
      message: 'La imagen de fondo está activada pero no fue encontrada para la feria activa'
    })
  }

  if (printSello && printFondo) {
    // Both active: fondo as background, sello as overlay
    backgroundImage = fondoImage
    overlayImage = selloImage
  } else if (printSello) {
    // Only sello: use as background
    backgroundImage = selloImage
  } else if (printFondo) {
    // Only fondo: use as background
    backgroundImage = fondoImage
  }
  // Neither: both remain null

  return { backgroundImage, overlayImage, notifications }
}

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

/** Dynamic quantities keyed by `tariff_${id}_s${model}` */
export type DynamicSaleQuantities = Record<string, number>

/** Dynamic tariff definition for PDF generation */
export interface DynamicTariffDef {
  /** Tariff ID (from tariff_groups table) */
  id: number
  /** Display name for the stamp label */
  name: string
  /** Description text for the stamp label */
  description: string
  /** Price (local, for ticket generation) */
  price: number
  /** Secondary/complementary price */
  secondaryPrice?: number
  /** Position ordering */
  position: number
}

/** Context for dynamic tariff group PDF generation */
export interface DynamicTariffContext {
  /** Tariff group ID */
  groupId: number
  /** Group title */
  title: string
  /** Event name (optional, for ticket header) */
  eventName?: string
  /** Event date for stamp labels (e.g., "21-24 abril 2025") */
  eventFecha?: string
  /** Event locality for stamp labels (e.g., "Madrid") */
  eventLocalidad?: string
  /** Event fair code part 1 (max 4 chars, e.g., "J26") */
  eventCodigoFeria1?: string
  /** Event fair code part 2 (max 3 chars, e.g., "8GI") */
  eventCodigoFeria2?: string
  /** Layout template for modelo1 stamps */
  eventLayoutModelo1?: string
  /** Layout template for modelo2 stamps */
  eventLayoutModelo2?: string
  /** Currency code */
  currency: string
  /** Currency symbol (e.g., '€', '$') */
  currencySymbol: string
  /** Active tariffs in this group */
  tariffs: DynamicTariffDef[]
  /** Active strips in this group */
  strips?: Array<{
    id: number
    name: string
    price: number
    secondaryPrice: number
    position: number
    tariff_ids: number[]
  }>
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
  /** Notifications about missing images or other non-fatal issues */
  notifications: ImageLayerNotification[]
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
 *
 * New pattern: {codigoFeria1}-{codigoFeria2} {cliente4dígitos}-{producto3dígitos}
 * Example:     "J26-8GI 0001-001"
 *
 * When codigoFeria1/codigoFeria2 are empty, falls back to legacy pattern using maquina.
 *
 * @param config - App configuration
 * @param productoId - The product/stamp counter value to encode (increments per stamp)
 * @param codigoFeria1Override - Optional override for codigo_feria_1 (from event)
 * @param codigoFeria2Override - Optional override for codigo_feria_2 (from event)
 */
function buildLabelCode(config: AppConfig, productoId: number, codigoFeria1Override?: string, codigoFeria2Override?: string): string {
  const { codigo } = config
  const cliente = formatCliente(codigo.cliente)
  const producto = formatProducto(productoId)

  // Use overrides if provided, otherwise use config values
  const feria1 = codigoFeria1Override ?? codigo.codigo_feria_1 ?? ''
  const feria2 = codigoFeria2Override ?? codigo.codigo_feria_2 ?? ''

  // New format: {codigoFeria1}-{codigoFeria2} {cliente}-{producto}
  if (feria1 || feria2) {
    return `${feria1}-${feria2} ${cliente}-${producto}`
  }

  // Legacy fallback when no feria codes configured
  const modo = codigo.modo
  const mes = formatMes(codigo.mes)
  const pais = codigo.pais
  const annio = formatAnnio(codigo.annio)
  const maquina = codigo.maquina
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
 * Falls back to searching by fair name from the bbdd-ferias sync if direct lookup fails.
 */
function getModelBackground(
  modelName: string,
  imagesRepo: ImagesRepository,
  syncRepo?: ImageSyncRepository
): string | null {
  if (!modelName) return null

  // Direct lookup by exact name
  const image = imagesRepo.getByName(modelName)
  if (image) return image.url

  // Fallback: search by fair name in image_sync table
  if (syncRepo) {
    const fairs = syncRepo.getFairList()
    const matchedFair = fairs.find(
      (f) => f.fairName.toLowerCase() === modelName.toLowerCase()
    )
    if (matchedFair) {
      const fondoName = buildImageName(matchedFair.year, matchedFair.fairName, 'fondo')
      const fondoImage = imagesRepo.getByName(fondoName)
      return fondoImage?.url ?? null
    }
  }

  return null
}

/**
 * Resolves the logo PNG image for a given model name.
 *
 * Each fair folder holds two images: a JPG background (`-fondo`) and a PNG
 * stamp/logo (`-sello`). The logo PNG is the `-sello` one, so this resolves the
 * model name to its fair and returns that image, verifying it really is a PNG.
 *
 * Falls back to `fallbackLogo` (the active fair's sello) when the model cannot
 * be resolved, so enabling "Logo PNG" still prints something sensible.
 */
function getModelLogoPng(
  modelName: string,
  imagesRepo: ImagesRepository,
  syncRepo: ImageSyncRepository | undefined,
  fallbackLogo: string | null
): string | null {
  const isPng = (record: { type: string | null; data: string } | null): boolean => {
    if (!record) return false
    if (record.type) return record.type.toLowerCase() === 'image/png'
    // No stored mime type — infer from the data URI prefix
    return record.data.startsWith('data:image/png')
  }

  console.log(`[getModelLogoPng] modelName="${modelName}", syncRepo=${!!syncRepo}, fallbackLogo length=${fallbackLogo?.length ?? 0}`)

  if (modelName && syncRepo) {
    try {
      const fairs = syncRepo.getFairList()
      console.log(`[getModelLogoPng] Fair list: ${JSON.stringify(fairs.map(f => f.fairName))}`)
      const matchedFair = fairs.find(
        (f) => f.fairName.toLowerCase() === modelName.toLowerCase()
      )
      if (matchedFair) {
        const selloName = buildImageName(matchedFair.year, matchedFair.fairName, 'sello')
        const record = imagesRepo.getFullByName(selloName)
        console.log(`[getModelLogoPng] Matched fair "${matchedFair.fairName}", selloName="${selloName}", record exists=${!!record}, isPng=${isPng(record)}`)
        if (isPng(record)) return record!.data
      } else {
        console.log(`[getModelLogoPng] No fair matched for modelName="${modelName}"`)
      }
    } catch (err) {
      console.log(`[getModelLogoPng] syncRepo error: ${err}`)
      // image_sync unavailable — fall through to the fallback below
    }
  }

  // Direct lookup: the model name may already point at a PNG image record
  if (modelName) {
    try {
      const direct = imagesRepo.getFullByName(modelName)
      console.log(`[getModelLogoPng] Direct lookup "${modelName}": found=${!!direct}, isPng=${isPng(direct)}`)
      if (isPng(direct)) return direct!.data
    } catch {
      // ignore and fall back
    }
  }

  // If fallback is available, use it
  if (fallbackLogo) {
    console.log(`[getModelLogoPng] Returning fallback (length=${fallbackLogo.length})`)
    return fallbackLogo
  }

  // Last resort: if syncRepo is available, grab the sello from the first available fair
  if (syncRepo) {
    try {
      const fairs = syncRepo.getFairList()
      for (const fair of fairs) {
        const selloName = buildImageName(fair.year, fair.fairName, 'sello')
        const record = imagesRepo.getFullByName(selloName)
        if (record) {
          console.log(`[getModelLogoPng] Last resort: using sello from fair "${fair.fairName}" (${record.data.length} chars)`)
          return record.data
        }
      }
    } catch {
      // ignore
    }
  }

  console.log(`[getModelLogoPng] Returning null — no logo found`)
  return null
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

// ─── Main orchestration ─────────────────────────────────────────────────────── AQUI TODOS LOS PDF ------------

/**
 * Generates all PDFs for a sale.
 *
 * Given the app configuration, quantities selected by the vendor, and the active profile,
 * this function produces all stamp label PDFs and ticket PDFs needed, each tagged with
 * the target printer for routing.
 *
 * @param config - Current app configuration (includes codigo, ticket, sello, precios)
 * @param quantities - Quantities per tariff/model selected in the kiosko (legacy or dynamic)
 * @param profile - Active profile name (e.g. "FERIA", "Filatelia", "Protocolo", "SPDE")
 * @param imagesRepo - Optional ImagesRepository instance (for testability)
 * @param imageLayerOptions - Optional image layer options for fondo/sello composition
 * @param dynamicTariffCtx - Optional dynamic tariff context (when using tariff groups)
 * @returns SaleGenerationResult with all PDFs, counts, and image notifications
 */
export async function generateSalePdfs(
  config: AppConfig,
  quantities: SaleQuantities | DynamicSaleQuantities,
  profile: string,
  imagesRepo?: ImagesRepository,
  imageLayerOptions?: ImageLayerOptions,
  dynamicTariffCtx?: DynamicTariffContext
): Promise<SaleGenerationResult> {
  const repo = imagesRepo ?? new ImagesRepository()
  const pdfs: GeneratedPdf[] = []
  const notifications: ImageLayerNotification[] = []

  // Read cut number from config for label grouping
  let cutNumber: number
  try {
    const configRepo = new ConfigRepository()
    cutNumber = configRepo.getCutNumber()
  } catch {
    // DB not available (e.g. in unit tests) — use default
    cutNumber = 4
  }

  // Product counter starts at 1 for each new sale (resets per client/order)
  let productoCounter = 1

  // Get active event data for stamp text and model backgrounds
  // When using dynamic tariffs, get fecha/localidad from dynamicTariffCtx (sourced from eventos table)
  // Otherwise, use legacy config.sello.eventos array (indexed by elevento)
  let stampFecha: string
  let stampEvento: string
  let model1Name: string
  let model2Name: string

  if (dynamicTariffCtx) {
    // Dynamic: use event data from the eventos table (passed via dynamicTariffCtx)
    stampFecha = dynamicTariffCtx.eventFecha ?? ''
    stampEvento = dynamicTariffCtx.eventLocalidad ?? ''
    // For dynamic tariffs, modelo1/modelo2 are managed by the fair image system
    // so we use fallback to config.sello values
    model1Name = config.sello.modelo1 ?? ''
    model2Name = config.sello.modelo2 ?? ''
  } else {
    // Legacy: use event data from config.sello.eventos array
    const eventoIndex = config.sello.elevento
    const evento = config.sello.eventos?.[eventoIndex]
    stampFecha = evento?.fecha ?? ''
    stampEvento = evento?.localidad ?? ''
    model1Name = evento?.motivoi ?? config.sello.modelo1 ?? ''
    model2Name = evento?.motivod ?? config.sello.modelo2 ?? ''
  }

  // Determine which feria codes to use for the stamp label code (line 1).
  // - Profile 'filatelia' (Oficina button): uses codes from general config (config.codigo)
  // - Profile 'normal' (cart button): uses codes from the active event (dynamicTariffCtx)
  // - Fallback: if no event codes available, uses config codes
  let codigoFeria1: string | undefined
  let codigoFeria2: string | undefined

  const profileLower = profile.toLowerCase()
  if (profileLower === 'filatelia') {
    // Oficina button: use general configuration codes
    codigoFeria1 = config.codigo.codigo_feria_1 ?? ''
    codigoFeria2 = config.codigo.codigo_feria_2 ?? ''
  } else if (dynamicTariffCtx) {
    // Normal sale with dynamic event: use event-specific codes
    codigoFeria1 = dynamicTariffCtx.eventCodigoFeria1 ?? ''
    codigoFeria2 = dynamicTariffCtx.eventCodigoFeria2 ?? ''
  } else {
    // Legacy fallback: no override, buildLabelCode will use config codes or legacy format
    codigoFeria1 = undefined
    codigoFeria2 = undefined
  }

  // Determine layout templates for each model from the event
  const layoutModelo1 = dynamicTariffCtx?.eventLayoutModelo1 ?? 'derecha'
  const layoutModelo2 = dynamicTariffCtx?.eventLayoutModelo2 ?? 'derecha'

  // Resolve image layers: when ImageLayerOptions is provided, use the layer
  // composition logic; otherwise fall back to legacy model-based background.
  let bg1: string | null = null
  let bg2: string | null = null
  let overlay1: string | null = null
  let overlay2: string | null = null
  let logoPng1: string | null = null
  let logoPng2: string | null = null
  let printLogoPng = false

  if (imageLayerOptions) {
    // Use fair-based image layer composition
    const layerResult = resolveImageLayers(imageLayerOptions)
    bg1 = layerResult.backgroundImage
    bg2 = layerResult.backgroundImage
    overlay1 = layerResult.overlayImage
    overlay2 = layerResult.overlayImage
    notifications.push(...layerResult.notifications)

    // Handle printLogoPng flag: when true, draw the model's PNG logo to the
    // right of the fecha/localidad text instead of the right-half overlay.
    printLogoPng = imageLayerOptions.printLogoPng ?? false
    if (printLogoPng) {
      let syncRepo: ImageSyncRepository | undefined
      try {
        syncRepo = new ImageSyncRepository()
      } catch {
        // DB not available (e.g. in unit tests) — fall back to the active fair sello
      }
      logoPng1 = getModelLogoPng(model1Name, repo, syncRepo, imageLayerOptions.selloImage)
      logoPng2 = getModelLogoPng(model2Name, repo, syncRepo, imageLayerOptions.selloImage)
    }
  } else {
    // Legacy: load background from images repository by model name
    // Create syncRepo for fair name fallback (may not be available in test environments)
    let syncRepo: ImageSyncRepository | undefined
    try {
      syncRepo = new ImageSyncRepository()
    } catch {
      // DB not available (e.g. in unit tests) — skip fair name fallback
    }
    bg1 = getModelBackground(model1Name, repo, syncRepo)
    bg2 = getModelBackground(model2Name, repo, syncRepo)
  }

  // Determine if we use blank stamps (modes MD/FI don't print background)
  const usesBlankBackground = config.codigo.modo === 'MD' || config.codigo.modo === 'FI'

  // ─── Generate stamp PDFs ───────────────────────────────────────────────────

  if (dynamicTariffCtx) {
    // ─── Dynamic tariff stamp generation ─────────────────────────────────────
    // Generate stamps based on the active tariff group's tariffs
    const dynQty = quantities as DynamicSaleQuantities

    for (const tariff of dynamicTariffCtx.tariffs) {
      // Model 1 (printer1)
      const key1 = `tariff_${tariff.id}_s1`
      const qty1 = dynQty[key1] ?? 0
      if (qty1 > 0) {
        const background = usesBlankBackground ? null : bg1
        const overlay = usesBlankBackground ? null : overlay1
        const stamps: StampRenderParams[] = []
        for (let i = 0; i < qty1; i++) {
          stamps.push({
            tarifa: tariff.name,
            tarifaDescripcion: tariff.description,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng1,
            layout: layoutModelo1 as StampLayout
          })
          productoCounter++
        }
        // Group stamps by cutNumber — each group becomes a separate PDF with cut marks between groups - AQUI VER INDIVIDUAL ------
        const groups = groupLabels(stamps, cutNumber)
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group)
          pdfs.push({
            buffer: pdfBuffer,
            target: 'printer1',
            pdfType: 'stamp_simple',
            description: `${tariff.name} modelo1 x${group.length}`
          })
        }
      }

      // Model 2 (printer2)
      const key2 = `tariff_${tariff.id}_s2`
      const qty2 = dynQty[key2] ?? 0
      if (qty2 > 0) {
        const background = usesBlankBackground ? null : bg2
        const overlay = usesBlankBackground ? null : overlay2
        const stamps: StampRenderParams[] = []
        for (let i = 0; i < qty2; i++) {
          stamps.push({
            tarifa: tariff.name,
            tarifaDescripcion: tariff.description,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng2,
            layout: layoutModelo2 as StampLayout
          })
          productoCounter++
        }
        // Group stamps by cutNumber — each group becomes a separate PDF with cut marks between groups
        const groups = groupLabels(stamps, cutNumber)
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group)
          pdfs.push({
            buffer: pdfBuffer,
            target: 'printer2',
            pdfType: 'stamp_simple',
            description: `${tariff.name} modelo2 x${group.length}`
          })
        }
      }
    }

    // ─── Dynamic strip (tira) stamp generation ─────────────────────────────── AQUI TIRA DINÁMICA ----------------
    // A strip is a fixed sequence of individual tariffs printed as one job.
    // Each unit sold produces one multi-page PDF with one page per tariff in
    // the strip, in the order defined by `tariff_ids` (repetitions included).
    for (const strip of dynamicTariffCtx.strips ?? []) {
      // Resolve the tariff definitions referenced by the strip, preserving order
      // and repetitions. Unknown ids are skipped (tariff may have been deleted).
      const stripTariffs = strip.tariff_ids
        .map((tid) => dynamicTariffCtx.tariffs.find((t) => t.id === tid))
        .filter((t): t is DynamicTariffDef => t != null)

      if (stripTariffs.length === 0) continue

      for (const model of [1, 2] as const) {
        const qty = dynQty[`tariff_${strip.id}_s${model}`] ?? 0
        if (qty <= 0) continue

        const background = usesBlankBackground ? null : model === 1 ? bg1 : bg2
        const overlay = usesBlankBackground ? null : model === 1 ? overlay1 : overlay2
        const logo = model === 1 ? logoPng1 : logoPng2
        const target: PrinterTarget = model === 1 ? 'printer1' : 'printer2'

        for (let i = 0; i < qty; i++) {
          const stamps: StampRenderParams[] = []
          for (const stripTariff of stripTariffs) {
            stamps.push({
              tarifa: stripTariff.name,
              tarifaDescripcion: stripTariff.description,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
              backgroundImage: background,
              overlayImage: overlay,
              printLogoPng,
              logoPngImage: logo,
              layout: (model === 1 ? layoutModelo1 : layoutModelo2) as StampLayout
            })
            productoCounter++
          }

          // A strip is a single physical unit: it is never split by cutNumber.
          const pdfBuffer = await renderStampMultiPage(stamps)
          pdfs.push({
            buffer: pdfBuffer,
            target,
            pdfType: 'stamp_tira',
            description: `Tira ${strip.name} modelo${model} #${i + 1} x${stamps.length}`
          })
        }
      }
    }
  } else {
    // ─── Legacy static tariff stamp generation ───────────────────────────────
    const legacyQty = quantities as SaleQuantities

    for (const tariff of TARIFF_DEFS) {
      const qty = legacyQty[tariff.qtyKey]
      if (qty <= 0) continue

      const background = usesBlankBackground
        ? null
        : tariff.model === 1
          ? bg1
          : bg2

      const overlay = usesBlankBackground
        ? null
        : tariff.model === 1
          ? overlay1
          : overlay2

      // Logo PNG of the model this tariff prints on
      const logo = tariff.model === 1 ? logoPng1 : logoPng2

      if (tariff.isTira) {
        // Tiras: each unit generates a 4-page PDF (4 stamps in one print job)
        for (let i = 0; i < qty; i++) {
          const stamps: StampRenderParams[] = []

          if (tariff.qtyKey.startsWith('tarifa4T')) {
            // "Tira 4 Tarifas" — 4 different tariffs: A, A2, B, C
            const tariffLabels = ['Tarifa AJ', 'Tarifa A2J', 'Tarifa BJ', 'Tarifa CJ']
            for (const tLabel of tariffLabels) {
              stamps.push({
                tarifa: tLabel,
                fecha: stampFecha,
                evento: stampEvento,
                codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
                backgroundImage: background,
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo,
                layout: (tariff.model === 1 ? layoutModelo1 : layoutModelo2) as StampLayout
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
                codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
                backgroundImage: background,
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo,
                layout: (tariff.model === 1 ? layoutModelo1 : layoutModelo2) as StampLayout
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
        // Simple stamps: group all stamps of same tariff/model, then split by cutNumber.
        // Each group becomes a separate multi-page PDF (with cut marks between groups).
        const stamps: StampRenderParams[] = []
        for (let i = 0; i < qty; i++) {
          stamps.push({
            tarifa: tariff.label,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter, codigoFeria1, codigoFeria2),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logo,
            layout: (tariff.model === 1 ? layoutModelo1 : layoutModelo2) as StampLayout
          })
          productoCounter++
        }

        // Group stamps by cutNumber — each group becomes a separate PDF --------------NO --------- AQUI INDIVIDUAL ---CORTE------
        const groups = groupLabels(stamps, cutNumber)
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group)
          pdfs.push({
            buffer: pdfBuffer,
            target: tariff.target,
            pdfType: 'SELLO_simple',
            description: `${tariff.label} modelo${tariff.model} x${group.length}`
          })
        }
      }
    }
  }

  // ─── Generate special strips (tiras especiales) ────────────────────────────

  // Special strips only apply to legacy tariffs (they use tiras which dynamic tariffs don't have)
  if (!dynamicTariffCtx) {
    const counterRef = { value: productoCounter }
    await generateEspecialStrips(config, quantities as SaleQuantities, counterRef, pdfs)
    productoCounter = counterRef.value
  }

  // ─── Generate ticket PDFs ──────────────────────────────────────────────────

  let items: TicketItem[]
  let productos: TicketProduct[]

  if (dynamicTariffCtx) {
    // Dynamic ticket data from tariff group
    const dynQty = quantities as DynamicSaleQuantities
    items = []
    productos = []

    for (const tariff of dynamicTariffCtx.tariffs) {
      // Model 1
      const key1 = `tariff_${tariff.id}_s1`
      const qty1 = dynQty[key1] ?? 0
      const prodId1 = `D${tariff.id}S1`
      items.push({ idProducto: prodId1, cantidad: qty1 })
      productos.push({ idProducto: prodId1, modo: 'S', precio: tariff.price, nombre_ticket: tariff.name })

      // Model 2
      const key2 = `tariff_${tariff.id}_s2`
      const qty2 = dynQty[key2] ?? 0
      const prodId2 = `D${tariff.id}S2`
      items.push({ idProducto: prodId2, cantidad: qty2 })
      productos.push({ idProducto: prodId2, modo: 'S', precio: tariff.price, nombre_ticket: tariff.name })
    }

    // Strips (tiras) are billed as a single product line per model
    for (const strip of dynamicTariffCtx.strips ?? []) {
      const stripKey1 = `tariff_${strip.id}_s1`
      const stripQty1 = dynQty[stripKey1] ?? 0
      const stripProdId1 = `D${strip.id}S1`
      items.push({ idProducto: stripProdId1, cantidad: stripQty1 })
      productos.push({ idProducto: stripProdId1, modo: 'T', precio: strip.price, nombre_ticket: strip.name })

      const stripKey2 = `tariff_${strip.id}_s2`
      const stripQty2 = dynQty[stripKey2] ?? 0
      const stripProdId2 = `D${strip.id}S2`
      items.push({ idProducto: stripProdId2, cantidad: stripQty2 })
      productos.push({ idProducto: stripProdId2, modo: 'T', precio: strip.price, nombre_ticket: strip.name })
    }
  } else {
    // Legacy ticket data
    const result = buildTicketData(quantities as SaleQuantities, config.precios)
    items = result.items
    productos = result.productos
  }

  const hasAnyItems = items.some((item) => item.cantidad > 0)

  if (hasAnyItems) {
    const fechaTicket = getTicketDateTime(config)
    // Build ticket title: just the base title (e.g. "Factura Simplificada")
    // The feria code is appended by the ticket-renderer when codigoFeria1/2 are provided
    const baseTitle = buildTicketTitle(profile, config.ticket.titulo)
    const modoTicket = baseTitle
    const modelo1Ticket = model1Name || 'Modelo 1'
    const modelo2Ticket = model2Name || 'Modelo 2'

    // Determine ticket header: use event name when dynamic tariff is active
    const ticketFeria = dynamicTariffCtx
      ? (dynamicTariffCtx.eventName || dynamicTariffCtx.title || config.ticket.feria)
      : config.ticket.feria
    const ticketLugar = dynamicTariffCtx
      ? (config.sello.eventos?.[0]?.localidad || config.ticket.lugar)
      : config.ticket.lugar

    // Apply secondary pricing if flag is set (swap prices in productos)
    if (imageLayerOptions?.useSecondaryPrice && dynamicTariffCtx) {
      for (const producto of productos) {
        // Find the matching tariff to get its secondary_price
        const tariffId = parseInt(producto.idProducto.replace(/^D/, '').replace(/S[12]$/, ''), 10)
        const matchingTariff = dynamicTariffCtx.tariffs.find((t) => t.id === tariffId)
        if (matchingTariff && matchingTariff.secondaryPrice != null) {
          producto.precio = matchingTariff.secondaryPrice
          continue
        }
        // Strips share the same id space as tariffs, so resolve them too
        const matchingStrip = dynamicTariffCtx.strips?.find((s) => s.id === tariffId)
        if (matchingStrip && matchingStrip.secondaryPrice != null) {
          producto.precio = matchingStrip.secondaryPrice
        }
      }
    }

    // Calculate actual ticket heights based on content
    const ticketMasterHeightMm = calcTicketMasterHeightMm(countActiveItems(items))

    // Main ticket
    const mainTicketParams = {
      fechaTicket,
      modoTicket,
      modelo1Ticket,
      modelo2Ticket,
      items,
      idCliente: config.codigo.cliente,
      nombreMaquina: config.codigo.maquina,
      productos,
      feria: ticketFeria,
      lugar: ticketLugar,
      empresa: config.ticket.empresa,
      cif: config.ticket.cif,
      cp: config.ticket.cp,
      l1: config.ticket.l1,
      l2: config.ticket.l2,
      l3: config.ticket.l3,
      codigoFeria1: codigoFeria1 ?? '',
      codigoFeria2: codigoFeria2 ?? ''
    }
    const ticketHeightMm = calcActualTicketHeight(mainTicketParams)
    const ticketBuffer = await genTicket(mainTicketParams)
    pdfs.push({
      buffer: ticketBuffer,
      target: 'ticket',
      pdfType: 'ticket',
      description: 'Ticket principal (Factura Simplificada)',
      ticketHeightMm
    })

    // Copy ticket (ticket caja) — when configured
    if (config.ticket.ImprimeCopiaTicket === 'S') {
      const ticketCajaParams = {
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        productos,
        feria: ticketFeria,
        modoTicket: config.ticket.tituloCopia || 'COPIA Factura Simplificada',
        modelo1Ticket,
        modelo2Ticket
      }
      const ticketCajaHeightMm = calcActualTicketCajaHeight(ticketCajaParams)
      const ticketCajaBuffer = await genTicketCaja(ticketCajaParams)
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
        feria: ticketFeria,
        lugar: ticketLugar,
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
        ticketHeightMm: ticketMasterHeightMm
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

            const singleTiraParams = {
              fechaTicket,
              modoTicket,
              modelo1Ticket,
              modelo2Ticket,
              items: singleTiraItems,
              idCliente: config.codigo.cliente,
              nombreMaquina: config.codigo.maquina,
              productos,
              feria: ticketFeria,
              lugar: ticketLugar,
              empresa: config.ticket.empresa,
              cif: config.ticket.cif,
              cp: config.ticket.cp,
              l1: config.ticket.l1,
              l2: config.ticket.l2,
              l3: config.ticket.l3,
              codigoFeria1: codigoFeria1 ?? '',
              codigoFeria2: codigoFeria2 ?? ''
            }
            const singleTiraHeightMm = calcActualTicketHeight(singleTiraParams)
            const singleTiraBuffer = await genTicket(singleTiraParams)
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

  // ─── Count results ───────────────────────────────────────────────────────── AQUI NOMBRE PDF

  const stampCount = pdfs.filter(
    (p) => p.pdfType === 'stamp_simple' || p.pdfType === 'stamp_tira' || p.pdfType === 'stamp_especial'
  ).length
  const ticketCount = pdfs.filter(
    (p) => p.pdfType === 'ticket' || p.pdfType === 'ticket_caja' || p.pdfType === 'ticket_master' || p.pdfType === 'ticket_tira'
  ).length

  return { pdfs, stampCount, ticketCount, nextProducto: productoCounter, notifications }
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
