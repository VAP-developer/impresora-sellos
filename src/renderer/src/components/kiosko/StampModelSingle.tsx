/**
 * StampModelSingle.tsx
 *
 * Displays a single stamp model preview (A = modelo1, B = modelo2)
 * replicating the real stamp layout: background image with overlaid text
 * (tarifa, descripción, fecha, localidad, código).
 *
 * The title is the dynamic model name from config (not a static "SELLO A"/"SELLO B").
 */

import { useEffect, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { formatLabelCode } from '@renderer/lib/code-formatter'
import * as ipc from '@renderer/lib/ipc-client'

interface StampModelSingleProps {
  model: 'A' | 'B'
}

/**
 * Extracts month + year from a fecha string like "21-24 abril 2025" → "abril 2025"
 */
function formatFechaMonthYear(fecha: string): string {
  const match = fecha.match(
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}$/i
  )
  return match ? match[0] : fecha
}

/**
 * Transforms code to two-line display by splitting on space.
 * "JC26-VAP 0001-001" → { line1: "JC26-VAP", line2: "0001-001" }
 */
function formatCodigoLines(codigo: string): { line1: string; line2: string } {
  const spaceIdx = codigo.indexOf(' ')
  if (spaceIdx === -1) return { line1: codigo, line2: '' }

  const line1 = codigo.substring(0, spaceIdx)
  const line2 = codigo.substring(spaceIdx + 1)

  return { line1, line2 }
}

export default function StampModelSingle({ model }: StampModelSingleProps): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const modelName = model === 'A'
    ? (config?.sello?.modelo1 ?? '')
    : (config?.sello?.modelo2 ?? '')

  // Event data
  const activeEvento = config?.sello?.eventos?.[0]
  const fecha = activeEvento?.fecha ?? ''
  const localidad = activeEvento?.localidad ?? ''

  // Code
  const codeStr = config?.codigo ? formatLabelCode(config.codigo) : null
  const codeLines = codeStr ? formatCodigoLines(codeStr) : null

  // Fecha formatted (month + year only)
  const fechaDisplay = fecha ? formatFechaMonthYear(fecha) : ''

  useEffect(() => {
    let cancelled = false

    async function loadImage(): Promise<void> {
      if (!modelName) {
        setImageUrl(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await ipc.getImageByName(modelName)
        if (!cancelled) setImageUrl(result?.url ?? null)
      } catch {
        if (!cancelled) setImageUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadImage()
    return () => { cancelled = true }
  }, [modelName])

  return (
    <div className="flex flex-col items-center">
      {/* Dynamic title: model name from DB */}
      <p className="text-sm font-bold text-gray-700 mb-1 truncate max-w-[280px]">
        {modelName || (model === 'A' ? 'Sello A' : 'Sello B')}
      </p>

      {/* Stamp preview with overlaid text (replicating real stamp layout) */}
      <div className="relative w-[280px] h-[127px] rounded shadow-sm overflow-hidden">
        {/* Background layer */}
        {loading ? (
          <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
            <span className="text-gray-400 text-sm">Cargando...</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={modelName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center border border-gray-400">
            <span className="text-gray-600 text-sm font-medium">{modelName || 'Sin modelo'}</span>
          </div>
        )}

        {/* Overlay text — positioned to replicate stamp-renderer layout */}
        {/* Only show overlay text when the stamp has an image loaded */}
        {imageUrl && (
        <div className="absolute inset-0 flex flex-col justify-end p-2 pl-[11px] pointer-events-none">
          {/* Fecha (month + year) */}
          {fechaDisplay && (
            <p className="text-black text-xs leading-tight">
              {fechaDisplay}
            </p>
          )}

          {/* Localidad */}
          {localidad && (
            <p className="text-black text-xs leading-tight">
              {localidad}
            </p>
          )}

          {/* Código (2 lines) */}
          {codeLines && (
            <p className="text-black text-[10px] font-bold leading-tight">
              {codeLines.line1}
              {codeLines.line2 && <br />}
              {codeLines.line2}
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
