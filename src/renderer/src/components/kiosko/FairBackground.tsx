/**
 * FairBackground.tsx
 *
 * Displays the background image (Imagen_Fondo) of the active fair in the
 * kiosko preview area. If no image is available, shows a placeholder with
 * the fair name. Maintains aspect ratio without distortion.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 3.3
 */

import { useEffect } from 'react'
import { useImagesStore } from '@renderer/stores/images.store'

export default function FairBackground(): JSX.Element {
  const { activeFair, fondoImage, loading, loadFairList, fairList } = useImagesStore()

  // Ensure fair list is loaded (in case user navigates directly to kiosko)
  useEffect(() => {
    if (fairList.length === 0) {
      loadFairList()
    }
  }, [fairList.length, loadFairList])

  // No active fair selected
  if (!activeFair) {
    return (
      <div className="w-full flex items-center justify-center py-2">
        <div
          className="w-full max-w-[400px] h-[80px] bg-gray-100 rounded border border-dashed
                     border-gray-300 flex items-center justify-center"
          role="img"
          aria-label="Sin feria seleccionada"
        >
          <span className="text-gray-400 text-xs italic">
            Sin feria seleccionada
          </span>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-2">
        <div className="w-full max-w-[400px] h-[80px] bg-gray-100 animate-pulse rounded flex items-center justify-center">
          <span className="text-gray-400 text-xs">Cargando imagen...</span>
        </div>
      </div>
    )
  }

  // Image available: display it proportionally
  if (fondoImage) {
    return (
      <div className="w-full flex items-center justify-center py-2">
        <img
          src={fondoImage}
          alt={`Fondo de feria: ${activeFair.year} — ${activeFair.fairName}`}
          className="max-w-[400px] max-h-[100px] w-auto h-auto object-contain rounded shadow-sm"
        />
      </div>
    )
  }

  // No image available: placeholder with fair name
  return (
    <div className="w-full flex items-center justify-center py-2">
      <div
        className="w-full max-w-[400px] h-[80px] bg-gray-200 rounded border border-gray-300
                   flex flex-col items-center justify-center gap-1"
        role="img"
        aria-label={`Sin imagen de fondo para ${activeFair.year} — ${activeFair.fairName}`}
      >
        <span className="text-gray-500 text-xs font-medium">
          {activeFair.year} — {activeFair.fairName}
        </span>
        <span className="text-gray-400 text-xs italic">
          Sin imagen de fondo
        </span>
      </div>
    </div>
  )
}
