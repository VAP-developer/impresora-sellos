/**
 * SubirImagenView.tsx
 *
 * Vista para gestión de imágenes de fondo de sellos.
 * Permite subir, previsualizar y cambiar las imágenes de Modelo 1 y Modelo 2.
 * Las imágenes se almacenan como data URI (Base64) en la base de datos via IPC.
 *
 * Validates: Requirement 14.1 (store image as data URI with unique name)
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ImageUpload from '@renderer/components/images/ImageUpload'
import { uploadImage, getImageByName, removeImage } from '@renderer/lib/ipc-client'
import { useConfigStore } from '@renderer/stores/config.store'

export default function SubirImagenView(): JSX.Element {
  const navigate = useNavigate()
  const config = useConfigStore((s) => s.config)

  // Current active event's model image names
  const activeEvento = config?.sello.elevento ?? 0
  const eventos = config?.sello.eventos ?? []
  const currentEvento = eventos[activeEvento]
  const modelo1Name = currentEvento?.motivoi || 'Modelo1'
  const modelo2Name = currentEvento?.motivod || 'Modelo2'

  // Image preview URLs (loaded from DB)
  const [modelo1Url, setModelo1Url] = useState<string | null>(null)
  const [modelo2Url, setModelo2Url] = useState<string | null>(null)

  // Which model is currently selected for upload
  const [selectedModel, setSelectedModel] = useState<'modelo1' | 'modelo2' | null>(null)

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<'modelo1' | 'modelo2' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<{ message: string; error: boolean } | null>(
    null
  )

  // Load existing images on mount and when model names change
  useEffect(() => {
    async function loadImages(): Promise<void> {
      try {
        const img1 = await getImageByName(modelo1Name)
        setModelo1Url(img1?.url ?? null)
      } catch {
        setModelo1Url(null)
      }

      try {
        const img2 = await getImageByName(modelo2Name)
        setModelo2Url(img2?.url ?? null)
      } catch {
        setModelo2Url(null)
      }
    }

    loadImages()
  }, [modelo1Name, modelo2Name])

  // Handle image upload via IPC
  const handleUpload = useCallback(
    async (name: string, dataUri: string, type: string, size: number): Promise<void> => {
      await uploadImage(name, dataUri, type, size)
    },
    []
  )

  // On successful upload, refresh the preview
  const handleSuccess = useCallback(async () => {
    // Reload images to show the new one
    try {
      const img1 = await getImageByName(modelo1Name)
      setModelo1Url(img1?.url ?? null)
    } catch {
      setModelo1Url(null)
    }

    try {
      const img2 = await getImageByName(modelo2Name)
      setModelo2Url(img2?.url ?? null)
    } catch {
      setModelo2Url(null)
    }

    setSelectedModel(null)
  }, [modelo1Name, modelo2Name])

  // Handle image deletion via IPC
  const handleDelete = useCallback(
    async (model: 'modelo1' | 'modelo2') => {
      const name = model === 'modelo1' ? modelo1Name : modelo2Name
      setDeleting(true)
      setDeleteStatus(null)

      try {
        await removeImage(name)
        // Update UI state to reflect deletion
        if (model === 'modelo1') {
          setModelo1Url(null)
        } else {
          setModelo2Url(null)
        }
        setDeleteStatus({ message: `Imagen "${name}" eliminada correctamente.`, error: false })
      } catch (err) {
        console.error('[SubirImagenView] Error deleting image:', err)
        setDeleteStatus({ message: 'Error al eliminar la imagen. Inténtalo de nuevo.', error: true })
      } finally {
        setDeleting(false)
        setConfirmDelete(null)
      }
    },
    [modelo1Name, modelo2Name]
  )

  // Determine the imageName to pass to the uploader
  const uploadImageName = selectedModel === 'modelo1' ? modelo1Name : modelo2Name

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div>
          <h1 className="text-black text-[25px] font-bold">Subir Imagen</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de imágenes de fondo para sellos
          </p>
        </div>
        <button
          type="button"
          className="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
          onClick={() => navigate('/maquina')}
        >
          Volver
        </button>
      </div>

      <div className="flex justify-center mt-4">
        <div className="w-full max-w-4xl px-4">
          {/* Model selection with previews */}
          {!selectedModel && (
            <div className="flex gap-8 justify-center mb-6">
              {/* Modelo 1 */}
              <div className="flex flex-col items-center">
                <h3 className="text-base font-bold mb-2">Modelo 1</h3>
                {modelo1Url ? (
                  <div className="border-2 border-gray-300 rounded p-2 mb-2">
                    <img
                      src={modelo1Url}
                      alt="Modelo 1"
                      className="max-w-[200px] max-h-[200px] object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mb-2">Sin imagen</p>
                )}
                <p className="text-xs text-gray-500 mb-2">{modelo1Name}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
                    onClick={() => setSelectedModel('modelo1')}
                  >
                    {modelo1Url ? 'Cambiar' : 'Subir'} Imagen
                  </button>
                  {modelo1Url && (
                    <button
                      type="button"
                      className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setConfirmDelete('modelo1')}
                      disabled={deleting}
                      aria-label={`Eliminar imagen ${modelo1Name}`}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {/* Modelo 2 */}
              <div className="flex flex-col items-center">
                <h3 className="text-base font-bold mb-2">Modelo 2</h3>
                {modelo2Url ? (
                  <div className="border-2 border-gray-300 rounded p-2 mb-2">
                    <img
                      src={modelo2Url}
                      alt="Modelo 2"
                      className="max-w-[200px] max-h-[200px] object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mb-2">Sin imagen</p>
                )}
                <p className="text-xs text-gray-500 mb-2">{modelo2Name}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
                    onClick={() => setSelectedModel('modelo2')}
                  >
                    {modelo2Url ? 'Cambiar' : 'Subir'} Imagen
                  </button>
                  {modelo2Url && (
                    <button
                      type="button"
                      className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setConfirmDelete('modelo2')}
                      disabled={deleting}
                      aria-label={`Eliminar imagen ${modelo2Name}`}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation dialog */}
          {confirmDelete && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                <h3 className="text-lg font-bold mb-3">Confirmar eliminación</h3>
                <p className="text-gray-600 mb-4">
                  ¿Estás seguro de que quieres eliminar la imagen &quot;
                  {confirmDelete === 'modelo1' ? modelo1Name : modelo2Name}&quot;?
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold
                               hover:bg-gray-300 transition-colors"
                    onClick={() => setConfirmDelete(null)}
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-red-600 text-white font-semibold
                               hover:bg-red-700 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDelete(confirmDelete)}
                    disabled={deleting}
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete status message */}
          {deleteStatus && !selectedModel && (
            <p
              className={`text-center font-semibold mb-4 ${deleteStatus.error ? 'text-red-600' : 'text-green-600'}`}
            >
              {deleteStatus.message}
            </p>
          )}

          {/* Upload component (shown when a model is selected) */}
          {selectedModel && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  Subir imagen para {selectedModel === 'modelo1' ? 'Modelo 1' : 'Modelo 2'}
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({uploadImageName})
                  </span>
                </h3>
                <button
                  type="button"
                  className="bg-gray-300 text-gray-700 px-3 py-1 rounded font-semibold hover:bg-gray-400 text-sm"
                  onClick={() => setSelectedModel(null)}
                >
                  ← Volver a modelos
                </button>
              </div>
              <ImageUpload
                imageName={uploadImageName}
                onUpload={handleUpload}
                onSuccess={handleSuccess}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
