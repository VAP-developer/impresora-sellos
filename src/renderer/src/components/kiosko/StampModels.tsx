/**
 * StampModels.tsx
 *
 * Displays the two stamp model previews (modelo1 = Sello A, modelo2 = Sello B)
 * with their background images and label code overlay.
 * No printer controls — those are now in the Imprimir tab.
 */

import { useEffect, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { formatLabelCode } from '@renderer/lib/code-formatter'
import * as ipc from '@renderer/lib/ipc-client'

// ─── Sub-component: Single Model Preview ──────────────────────────────────────

interface ModelPreviewProps {
  modelName: string
  label: string
  fecha: string
  localidad: string
  codePreview: string | null
}

function ModelPreview({
  modelName,
  label,
  fecha,
  localidad,
  codePreview
}: ModelPreviewProps): JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      <p className="text-sm font-bold text-gray-700 mb-1">{label}</p>
      <div className="relative">
        {loading ? (
          <div className="w-[280px] h-[127px] bg-gray-200 animate-pulse rounded flex items-center justify-center">
            <span className="text-gray-400 text-sm">Cargando...</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-[280px] h-auto rounded shadow-sm"
          />
        ) : (
          <div className="w-[280px] h-[127px] bg-gray-300 rounded flex items-center justify-center border border-gray-400">
            <span className="text-gray-600 text-sm font-medium">{modelName || 'Sin modelo'}</span>
          </div>
        )}
      </div>

      {/* Event info overlay */}
      <div className="mt-1 text-center">
        <p className="text-black text-xs font-bold leading-tight">{fecha}</p>
        <p className="text-black text-xs font-bold leading-tight">{localidad}</p>
        {codePreview && (
          <p className="text-black text-[10px] font-bold mt-0.5">{codePreview}</p>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-0.5">{modelName || '—'}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StampModels(): JSX.Element {
  const config = useConfigStore((state) => state.config)

  // modelo1/modelo2 are set at top-level sello when user saves from Imprimir
  const modelo1Name = config?.sello?.modelo1 ?? ''
  const modelo2Name = config?.sello?.modelo2 ?? ''
  // Active event info is stored in eventos[0] when saving from Imprimir
  const activeEvento = config?.sello?.eventos?.[0]
  const fecha = activeEvento?.fecha ?? ''
  const localidad = activeEvento?.localidad ?? ''
  const codePreview = config?.codigo ? formatLabelCode(config.codigo) : null

  return (
    <div className="flex items-start justify-center gap-8 bg-white rounded px-4 py-2">
      {/* Sello A (Modelo 1 / printer 1) */}
      <ModelPreview
        modelName={modelo1Name}
        label="SELLO A"
        fecha={fecha}
        localidad={localidad}
        codePreview={codePreview}
      />

      {/* Sello B (Modelo 2 / printer 2) */}
      <ModelPreview
        modelName={modelo2Name}
        label="SELLO B"
        fecha={fecha}
        localidad={localidad}
        codePreview={codePreview}
      />
    </div>
  )
}
