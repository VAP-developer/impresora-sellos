/**
 * stamp-html-renderer.ts
 *
 * Genera las etiquetas (sellos) como HTML en lugar de PDF, para imprimirlas con
 * `webContents.print()` de Electron.
 *
 * ── ¿Por qué HTML y no PDF? ──────────────────────────────────────────────────
 * Verificado en papel sobre una Brother TD-4520TN (etiqueta 55x25mm):
 *
 *  · SumatraPDF (método antiguo): imprime el contenido bien, pero NO controla el
 *    tamaño de papel ni la orientación (sólo dice "noscale") y auto-rota la
 *    página. Con el driver en A4 la etiqueta salía girada y recortada a ~25mm.
 *
 *  · Electron cargando un PDF: la geometría es correcta (el pageSize viaja en el
 *    DEVMODE de cada trabajo), pero Chromium abre el PDF en su VISOR interno y
 *    al imprimir manda la página del visor —fondo gris oscuro, que en monocromo
 *    sale negro— en vez del documento. Resultado: etiqueta totalmente negra.
 *
 *  · Electron con HTML: correcto. Chromium imprime HTML de forma nativa,
 *    respetando `@page { size: 55mm 25mm; margin: 0 }`.
 *
 * Requisitos que NO son opcionales:
 *   1. `printBackground: true` en las opciones de impresión (con false Chromium
 *      no pinta nada y la etiqueta sale en blanco).
 *   2. El HTML debe pintar su PROPIO fondo blanco, para no heredar el gris del
 *      navegador al imprimir en monocromo.
 *
 * Sistema de coordenadas: milímetros, origen en la esquina superior izquierda de
 * la etiqueta de 55x25mm. Directo, sin las rotaciones que necesitaba el PDF.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  getSelloLayout,
  getFontsPath,
  getImagesPath,
  formatFechaMonthYear,
  formatCodigoLines,
  STAMP_WIDTH_MM,
  STAMP_PAGE_HEIGHT_MM
} from './stamp-renderer'
import type { StampRenderParams, SelloFieldSource } from './stamp-renderer'

// ─────────────────────────────────────────────
// Fuentes embebidas
// ─────────────────────────────────────────────

/** Cache de las fuentes en base64 para no leer el disco en cada etiqueta */
let _fontCssCache: string | null = null

/**
 * Construye las reglas @font-face con las fuentes Franklin Gothic embebidas en
 * base64. Se embeben (en lugar de enlazar por file://) para que funcione igual
 * en desarrollo y en la app empaquetada, sin problemas de rutas ni de permisos.
 */
export function buildFontFaceCss(): string {
  if (_fontCssCache !== null) return _fontCssCache

  const fontsPath = getFontsPath()
  const faces: Array<{ family: string; file: string; weight: string }> = [
    { family: 'FranklinGothic', file: 'franklin_gothic.ttf', weight: 'normal' },
    { family: 'FranklinGothic', file: 'franklin_gothic_bold.ttf', weight: 'bold' },
    { family: 'FranklinGothicCondensed', file: 'franklin_gothic_condensed.ttf', weight: 'normal' }
  ]

  const css: string[] = []
  for (const face of faces) {
    const full = join(fontsPath, face.file)
    if (!existsSync(full)) continue
    try {
      const b64 = readFileSync(full).toString('base64')
      css.push(
        `@font-face{font-family:'${face.family}';font-weight:${face.weight};font-style:normal;` +
          `src:url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');}`
      )
    } catch {
      // Si una fuente no se puede leer, se cae al fallback sans-serif
    }
  }

  _fontCssCache = css.join('\n')
  return _fontCssCache
}

/** Permite invalidar la caché de fuentes (útil en tests) */
export function resetFontCssCache(): void {
  _fontCssCache = null
}

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────

/** Escapa texto para insertarlo en HTML sin riesgo de inyección */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Normaliza una imagen a algo que el HTML pueda usar en `src`.
 * Acepta data URI (se usa tal cual) o ruta de fichero (se convierte a data URI
 * para evitar depender del acceso a file:// desde la página).
 */
export function imageToSrc(image: string | null | undefined): string | null {
  if (!image) return null
  if (image.startsWith('data:')) return image
  if (!existsSync(image)) return null
  try {
    const lower = image.toLowerCase()
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/jpeg'
    return `data:${mime};base64,${readFileSync(image).toString('base64')}`
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────

export interface StampHtmlOptions {
  /** Ancho de la etiqueta en mm (por defecto 55) */
  widthMm?: number
  /** Alto de la etiqueta en mm (por defecto 25) */
  heightMm?: number
  /** Girar 180° el contenido (impresoras que alimentan la etiqueta invertida) */
  rotate180?: boolean
  /** Formato Correo ESP: sólo se imprime el nombre de la tarifa */
  formatoCorreoEsp?: boolean
  /** Dibuja un borde de depuración alrededor de la etiqueta */
  debugBorder?: boolean
}

/** Genera el bloque de capas de imagen (fondo / sello / logo) de una etiqueta */
function renderImageLayers(stamp: StampRenderParams): string {
  const parts: string[] = []

  const fondo = imageToSrc(stamp.backgroundImage)
  if (fondo) {
    parts.push(`<img class="layer" src="${fondo}" alt="">`)
  }

  // El logo a toda la etiqueta tiene prioridad sobre el overlay, igual que en
  // el renderizador PDF (printLogoPng sustituye al overlay).
  if (stamp.printLogoPng && stamp.logoPngImage) {
    const logo = imageToSrc(stamp.logoPngImage)
    if (logo) parts.push(`<img class="layer" src="${logo}" alt="">`)
  } else {
    const overlay = imageToSrc(stamp.overlayImage)
    if (overlay) parts.push(`<img class="layer" src="${overlay}" alt="">`)
  }

  return parts.join('')
}

/**
 * Resuelve el texto de un campo según su `source` y los datos del sello.
 * Devuelve '' cuando el dato no aplica (el campo no se pinta).
 */
function resolveFieldText(stamp: StampRenderParams, source: SelloFieldSource): string {
  const { line1, line2 } = formatCodigoLines(stamp.codigo)
  switch (source) {
    case 'tarifa':
      return stamp.tarifa
    case 'descripcion':
      return stamp.tarifaDescripcion ?? ''
    case 'fecha':
      return formatFechaMonthYear(stamp.fecha)
    case 'localidad':
      return stamp.evento
    case 'codigoLinea1':
      return line1
    case 'codigoLinea2':
      return line2
    case 'codigoCompleto':
      return stamp.codigo
    default:
      return ''
  }
}

/**
 * Genera los campos de texto de una etiqueta recorriendo el layout activo.
 * El layout (default o Correo ESP) lo elige getSelloLayout según el check de
 * configuración. Para cambiar qué campos aparecen o dónde, editar los layouts
 * en stamp-renderer.ts (SELLO_LAYOUT_DEFAULT / SELLO_LAYOUT_CORREO_ESP).
 */
function renderTextFields(stamp: StampRenderParams, formatoCorreoEsp: boolean): string {
  const layout = getSelloLayout(formatoCorreoEsp)

  return layout
    .map((f) => {
      const text = resolveFieldText(stamp, f.source)
      if (!text) return ''
      return (
        `<div class="f" style="left:${f.x}mm;top:${f.y}mm;font-size:${f.size}pt">` +
        `${escapeHtml(text)}</div>`
      )
    })
    .join('')
}

/**
 * Genera un documento HTML completo con una etiqueta por página.
 *
 * Cada etiqueta ocupa exactamente widthMm x heightMm y se separa con
 * `page-break-after`, de forma que Chromium genera una página de impresión por
 * etiqueta (equivalente a las páginas del PDF multi-página).
 */
export function renderStampsHtml(
  stamps: StampRenderParams[],
  options: StampHtmlOptions = {}
): string {
  const widthMm = options.widthMm ?? STAMP_WIDTH_MM
  const heightMm = options.heightMm ?? STAMP_PAGE_HEIGHT_MM
  const formatoCorreoEsp = options.formatoCorreoEsp ?? false
  const rotate180 = options.rotate180 ?? false

  const labels = stamps
    .map((stamp) => {
      const inner = renderImageLayers(stamp) + renderTextFields(stamp, formatoCorreoEsp)
      return `<div class="label"><div class="inner">${inner}</div></div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiquetas</title>
<style>
${buildFontFaceCss()}
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  /* Fondo blanco explícito: sin esto, al imprimir en monocromo se hereda el
     gris del navegador y la etiqueta sale negra. */
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.label {
  position: relative;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
  ${options.debugBorder ? 'outline: 0.2mm solid #000; outline-offset: -0.2mm;' : ''}
}
.label:last-child { page-break-after: auto; break-after: auto; }
.inner {
  position: absolute;
  inset: 0;
  ${rotate180 ? 'transform: rotate(180deg);' : ''}
}
/* Capas de imagen: cubren la etiqueta completa */
.layer {
  position: absolute;
  left: 0;
  top: 0;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  object-fit: fill;
}
/* Campos de texto posicionados en mm desde la esquina superior izquierda */
.f {
  position: absolute;
  margin: 0;
  padding: 0;
  color: #000;
  font-family: 'FranklinGothic', Arial, Helvetica, sans-serif;
  font-weight: normal;
  line-height: 1;
  white-space: nowrap;
}
</style>
</head>
<body>
${labels}
</body>
</html>`
}

/** Atajo para una sola etiqueta */
export function renderStampHtml(
  stamp: StampRenderParams,
  options: StampHtmlOptions = {}
): string {
  return renderStampsHtml([stamp], options)
}

// ─────────────────────────────────────────────
// Tiras especiales (E1-E4)
// ─────────────────────────────────────────────

/**
 * Layout de las tiras especiales, en mm desde la esquina superior izquierda de
 * la etiqueta 55x25. Equivale al de renderStampEspecialStrip pero en el sistema
 * directo de HTML (sin la rotación que necesitaba el PDF).
 *
 * Cada tira son 4 etiquetas (E1..E4) con fondo propio:
 *   - E1, E4: sólo código (izquierda) + sufijo especial (derecha)
 *   - E2, E3: además nombre de tarifa arriba
 */
export const ESPECIAL_LAYOUT = {
  codigo: { x: 1.5, y: 19.5, size: 6 },
  especial: { x: 23.3, y: 19.5, size: 6 },
  tarifa: { x: 1.5, y: 3, size: 12 }
} as const

/** Nombres de fichero de los fondos de tira especial, indexados por página 0..3 */
const ESPECIAL_BG_FILES = [
  'TiraEspecial1.png',
  'TiraEspecial2.png',
  'TiraEspecial3.png',
  'TiraEspecial4.png'
] as const

export interface EspecialStripHtmlParams {
  /** 4 códigos, uno por etiqueta de la tira */
  codigos: [string, string, string, string]
  /** Sufijo especial (p. ej. "  -E") */
  especial: string
  /** Tarifa mostrada en E2 y E3 */
  tarifa: string
}

/**
 * Genera el HTML de una tira especial completa (4 etiquetas E1-E4).
 * Cada etiqueta lleva su fondo TiraEspecialN.png (embebido) y el texto encima.
 */
export function renderEspecialStripHtml(
  params: EspecialStripHtmlParams,
  options: StampHtmlOptions = {}
): string {
  const widthMm = options.widthMm ?? STAMP_WIDTH_MM
  const heightMm = options.heightMm ?? STAMP_PAGE_HEIGHT_MM
  const rotate180 = options.rotate180 ?? false
  const imagesPath = getImagesPath()
  const L = ESPECIAL_LAYOUT

  const field = (
    text: string,
    pos: { x: number; y: number; size: number }
  ): string => {
    if (!text) return ''
    return (
      `<div class="f" style="left:${pos.x}mm;top:${pos.y}mm;font-size:${pos.size}pt">` +
      `${escapeHtml(text)}</div>`
    )
  }

  const labels = [0, 1, 2, 3]
    .map((page) => {
      const bgFull = join(imagesPath, ESPECIAL_BG_FILES[page])
      const bgSrc = imageToSrc(bgFull)
      const bg = bgSrc ? `<img class="layer" src="${bgSrc}" alt="">` : ''

      // Tarifa sólo en E2 (page 1) y E3 (page 2)
      const showTarifa = page === 1 || page === 2
      const inner =
        bg +
        (showTarifa ? field(params.tarifa, L.tarifa) : '') +
        field(params.codigos[page], L.codigo) +
        field(params.especial, L.especial)

      return `<div class="label"><div class="inner">${inner}</div></div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Tira Especial</title>
<style>
${buildFontFaceCss()}
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.label {
  position: relative;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
}
.label:last-child { page-break-after: auto; break-after: auto; }
.inner { position: absolute; inset: 0; ${rotate180 ? 'transform: rotate(180deg);' : ''} }
.layer { position: absolute; left: 0; top: 0; width: ${widthMm}mm; height: ${heightMm}mm; object-fit: fill; }
.f { position: absolute; margin: 0; padding: 0; color: #000; font-family: 'FranklinGothic', Arial, Helvetica, sans-serif; font-weight: normal; line-height: 1; white-space: nowrap; }
</style>
</head>
<body>
${labels}
</body>
</html>`
}
