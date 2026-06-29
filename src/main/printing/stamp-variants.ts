/**
 * stamp-variants.ts
 *
 * High-level stamp generation functions that resolve background images
 * from the database and delegate to the low-level renderStamp/renderStampBlank.
 *
 * These replicate the legacy Python functions:
 *   - genStampI(mod1, tarifa, fecha, evento, codigo, c)  → stamp with left model image
 *   - genStampD(mod2, tarifa, fecha, evento, codigo, c)  → stamp with right model image
 *   - genStampImdcc / genStampDmdcc                       → stamp without motif (blank bg)
 *
 * In the new architecture:
 *   - genStampI / genStampD accept a model name and resolve the image from the DB
 *   - genStamp is the mdcc variant (no motif background, uses fondoetiqueta-nada.png)
 *   - The "I" (izquierdo/left) vs "D" (derecho/right) distinction is only about which
 *     model image to use; the rendering logic is identical.
 *
 * Usage (from pdf-generator.ts / orchestrator):
 *   - Check machine name: if starts with "MD" → use genStamp (mdcc)
 *   - Otherwise → use genStampI for modelo1, genStampD for modelo2
 */

import { renderStamp, renderStampBlank, renderStampEspecialStrip, StampRenderParams } from './stamp-renderer'
import { ImagesRepository } from '../database/repositories/images.repository'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Parameters for high-level stamp generation (shared by genStampI/genStampD) */
export interface GenStampParams {
  /** Model/motif name (e.g. "FeriaMadrid2025_izq"). Used to look up image in DB. */
  modelName: string
  /** Tarifa display text, e.g. "Tarifa A", "Tarifa B" */
  tarifa: string
  /** Date text for the stamp, e.g. "21-24 abril 2025" */
  fecha: string
  /** Event/locality text, e.g. "Madrid" */
  evento: string
  /** Formatted label code, e.g. "P4ES25 CH17-0001-001" */
  codigo: string
}

/** Parameters for the mdcc variant (no custom motif background) */
export interface GenStampMdccParams {
  /** Tarifa display text */
  tarifa: string
  /** Date text for the stamp */
  fecha: string
  /** Event/locality text */
  evento: string
  /** Formatted label code */
  codigo: string
}

/** Dependency injection interface for image resolution */
export interface ImageResolver {
  getByName(name: string): { name: string; url: string } | null
}

// ─────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────

/**
 * Resolves the background image for a model name.
 * Looks up the image in the database (stored as base64 data URI).
 * Returns null if the image is not found.
 */
function resolveModelImage(modelName: string, imageResolver: ImageResolver): string | null {
  if (!modelName) return null

  const image = imageResolver.getByName(modelName)
  if (image && image.url) {
    return image.url // data URI (base64)
  }

  return null
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generates a stamp PDF for modelo1 (left/izquierdo) with its motif background.
 *
 * Replicates legacy `genStampI(mod1, tarifa, fecha, evento, codigo, c)`.
 * Resolves the model image from the database and renders the stamp.
 *
 * @param params - Stamp parameters including model name
 * @param imageResolver - Image repository instance (defaults to new ImagesRepository)
 * @returns Buffer containing the generated PDF
 */
export async function genStampI(
  params: GenStampParams,
  imageResolver?: ImageResolver
): Promise<Buffer> {
  const resolver = imageResolver ?? new ImagesRepository()
  const backgroundImage = resolveModelImage(params.modelName, resolver)

  const renderParams: StampRenderParams = {
    tarifa: params.tarifa,
    fecha: params.fecha,
    evento: params.evento,
    codigo: params.codigo,
    backgroundImage
  }

  return renderStamp(renderParams)
}

/**
 * Generates a stamp PDF for modelo2 (right/derecho) with its motif background.
 *
 * Replicates legacy `genStampD(mod2, tarifa, fecha, evento, codigo, c)`.
 * Functionally identical to genStampI — the only difference is which model name
 * is passed (modelo1 vs modelo2), which determines the background image.
 *
 * @param params - Stamp parameters including model name
 * @param imageResolver - Image repository instance (defaults to new ImagesRepository)
 * @returns Buffer containing the generated PDF
 */
export async function genStampD(
  params: GenStampParams,
  imageResolver?: ImageResolver
): Promise<Buffer> {
  const resolver = imageResolver ?? new ImagesRepository()
  const backgroundImage = resolveModelImage(params.modelName, resolver)

  const renderParams: StampRenderParams = {
    tarifa: params.tarifa,
    fecha: params.fecha,
    evento: params.evento,
    codigo: params.codigo,
    backgroundImage
  }

  return renderStamp(renderParams)
}

/**
 * Generates a stamp PDF without a custom motif background (mdcc mode).
 *
 * Replicates legacy `genStampImdcc` / `genStampDmdcc`.
 * Used when the machine name starts with "MD" — these machines don't print
 * a personalized background logo on the stamps.
 * Uses the default blank background (fondoetiqueta-nada.png).
 *
 * @param params - Stamp parameters (no model name needed)
 * @returns Buffer containing the generated PDF
 */
export async function genStamp(params: GenStampMdccParams): Promise<Buffer> {
  const renderParams: StampRenderParams = {
    tarifa: params.tarifa,
    fecha: params.fecha,
    evento: params.evento,
    codigo: params.codigo,
    backgroundImage: null // renderStampBlank will use fondoetiqueta-nada.png
  }

  return renderStampBlank(renderParams)
}

/**
 * Determines whether a machine should use the mdcc (no background) variant.
 *
 * In the legacy system, machines whose name starts with "MD" do not print
 * a personalized motif background on stamps.
 *
 * @param machineName - The machine identifier (e.g. "CH17", "MD25", "FI01")
 * @returns true if the machine should use genStamp (mdcc), false for genStampI/genStampD
 */
export function isMdccMachine(machineName: string): boolean {
  return machineName.toUpperCase().startsWith('MD')
}

// ─────────────────────────────────────────────
// Special Strips (Tiras Especiales)
// ─────────────────────────────────────────────

/** Special suffix for modelo 1 strips (two spaces before -E) */
export const ESPECIAL_SUFFIX_MOD1 = '  -E'
/** Special suffix for modelo 2 strips (just -E, no spaces) */
export const ESPECIAL_SUFFIX_MOD2 = '-E'

/** Parameters for high-level special strip generation */
export interface GenStampEspecialParams {
  /** Array of 4 formatted codes, one per stamp in the strip (E1, E2, E3, E4) */
  codigos: [string, string, string, string]
  /** Tarifa text for E2 and E3 pages (e.g. "Tarifa A3") */
  tarifa: string
}

/**
 * Determines how many special strips to generate based on total sale amount.
 *
 * Replicates the legacy Python logic for `vecesEspecial`:
 * - If a threshold is 0, it defaults to 500 (legacy: "if T1especial == 0: T1especial = 500")
 * - Compares totalImporte against thresholds from highest to lowest
 * - Returns 3 if amount > T3, 2 if amount > T2, 1 if amount > T1, 0 otherwise
 *
 * @param totalImporte - Total sale amount
 * @param T1especial - First threshold (1 strip). 0 means default to 500.
 * @param T2especial - Second threshold (2 strips). 0 means default to 500.
 * @param T3especial - Third threshold (3 strips). 0 means default to 500.
 * @returns Number of special strips to generate (0-3)
 */
export function calcVecesEspecial(
  totalImporte: number,
  T1especial: number,
  T2especial: number,
  T3especial: number
): number {
  const t1 = T1especial === 0 ? 500 : T1especial
  const t2 = T2especial === 0 ? 500 : T2especial
  const t3 = T3especial === 0 ? 500 : T3especial

  if (totalImporte > t3) return 3
  if (totalImporte > t2) return 2
  if (totalImporte > t1) return 1
  return 0
}

/**
 * Generates a full special strip PDF (4 pages: E1+E2+E3+E4) for modelo 1 (left printer).
 *
 * Uses the modelo 1 especial suffix ("  -E" — two spaces before the dash).
 * Wraps `renderStampEspecialStrip` with the modelo 1 suffix hardcoded.
 *
 * @param params - Strip parameters with 4 códigos and tarifa
 * @returns Buffer containing a 4-page PDF
 */
export async function genStampE1(params: GenStampEspecialParams): Promise<Buffer> {
  return renderStampEspecialStrip(params.codigos, ESPECIAL_SUFFIX_MOD1, params.tarifa)
}

/**
 * Generates a full special strip PDF (4 pages: E1+E2+E3+E4) for modelo 2 (right printer).
 *
 * Uses the modelo 2 especial suffix ("-E" — no spaces before the dash).
 * Wraps `renderStampEspecialStrip` with the modelo 2 suffix hardcoded.
 *
 * @param params - Strip parameters with 4 códigos and tarifa
 * @returns Buffer containing a 4-page PDF
 */
export async function genStampE2(params: GenStampEspecialParams): Promise<Buffer> {
  return renderStampEspecialStrip(params.codigos, ESPECIAL_SUFFIX_MOD2, params.tarifa)
}
