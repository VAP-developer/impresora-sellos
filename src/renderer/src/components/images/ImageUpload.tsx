/**
 * ImageUpload.tsx
 *
 * Component for uploading stamp background images with drag & drop support
 * and image cropping. Images are stored as Base64 data URIs in the database.
 *
 * Features:
 * - Drag and drop image files onto a drop zone
 * - Click to select files via a file dialog
 * - Preview the selected image
 * - Crop the image to appropriate aspect ratio for stamp backgrounds (55x25mm = 11:5)
 * - Upload the cropped image via IPC
 *
 * Validates: Requirement 14.1 (store image as data URI with unique name)
 */

import { useCallback, useRef, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageUploadProps {
  /** Name/identifier for the uploaded image (e.g., "Modelo1", "Modelo2") */
  imageName: string
  /** Callback fired after the image is cropped and ready to upload */
  onUpload: (name: string, dataUri: string, type: string, size: number) => Promise<void>
  /** Optional: callback fired when upload completes successfully */
  onSuccess?: () => void
  /** Optional: callback fired when upload fails */
  onError?: (error: Error) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a cropped image from the source and the crop area.
 * Returns a data URI (PNG) of the cropped region.
 */
async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return canvas.toDataURL('image/png')
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageUpload({
  imageName,
  onUpload,
  onSuccess,
  onError
}: ImageUploadProps): JSX.Element {
  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragReject, setIsDragReject] = useState(false)

  // Image & crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── File handling ────────────────────────────────────────────────────────

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatusMessage('El archivo seleccionado no es una imagen válida.')
      setStatusError(true)
      return
    }

    setStatusMessage('')
    setStatusError(false)

    const reader = new FileReader()
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        setImageSrc(result)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files.length > 0) {
        processFile(files[0])
      }
      // Reset so the same file can be selected again
      event.target.value = ''
    },
    [processFile]
  )

  // ─── Drag & Drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
    setIsDragReject(false)

    if (event.dataTransfer?.items) {
      const item = event.dataTransfer.items[0]
      if (item && item.type && !item.type.startsWith('image/')) {
        setIsDragReject(true)
      }
    }
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    setIsDragReject(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragOver(false)
      setIsDragReject(false)

      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (!file.type.startsWith('image/')) {
          setStatusMessage('El archivo seleccionado no es una imagen válida.')
          setStatusError(true)
          return
        }
        processFile(file)
      }
    },
    [processFile]
  )

  // ─── Cropper callbacks ────────────────────────────────────────────────────

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx)
  }, [])

  // ─── Save / Cancel ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return

    setUploading(true)
    setStatusMessage('')
    setStatusError(false)

    try {
      const croppedDataUri = await getCroppedImage(imageSrc, croppedAreaPixels)
      const size = Math.round((croppedDataUri.length * 3) / 4) // Approximate base64 decoded size
      await onUpload(imageName, croppedDataUri, 'image/png', size)
      setStatusMessage(`Imagen "${imageName}" subida correctamente.`)
      setStatusError(false)
      setImageSrc(null)
      onSuccess?.()
    } catch (err) {
      console.error('[ImageUpload] Error uploading image:', err)
      setStatusMessage('Error al subir la imagen. Inténtalo de nuevo.')
      setStatusError(true)
      onError?.(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setUploading(false)
    }
  }, [imageSrc, croppedAreaPixels, imageName, onUpload, onSuccess, onError])

  const handleCancel = useCallback(() => {
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setStatusMessage('')
    setStatusError(false)
  }, [])

  // ─── Render: Crop Dialog ──────────────────────────────────────────────────

  if (imageSrc) {
    return (
      <div className="flex flex-col w-full">
        <h3 className="text-lg font-bold mb-3">Editar y recortar</h3>

        {/* Crop area */}
        <div className="relative w-full h-[300px] bg-gray-100 rounded overflow-hidden mb-4">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={11 / 5}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 mb-4 px-2">
          <label htmlFor="zoom-slider" className="text-sm font-medium text-gray-700">
            Zoom:
          </label>
          <input
            id="zoom-slider"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            aria-label="Ajustar zoom de imagen"
          />
          <span className="text-sm text-gray-500 w-10 text-right">{zoom.toFixed(1)}x</span>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold
                       hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold
                       hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                       disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={uploading || !croppedAreaPixels}
          >
            {uploading ? 'Subiendo...' : 'Guardar Imagen'}
          </button>
        </div>

        {/* Status message */}
        {statusMessage && (
          <p
            className={`mt-3 text-center font-semibold ${statusError ? 'text-red-600' : 'text-green-600'}`}
          >
            {statusMessage}
          </p>
        )}
      </div>
    )
  }

  // ─── Render: Drop Zone ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full">
      {/* Drop zone */}
      <div
        className={`border-[4px] border-dashed rounded-lg text-center p-8 cursor-pointer
                    transition-colors ${
                      isDragReject
                        ? 'border-red-400 bg-red-50'
                        : isDragOver
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                    }`}
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            triggerFileInput()
          }
        }}
        aria-label={`Subir imagen para ${imageName}. Haz click o arrastra un archivo.`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
          aria-hidden="true"
        />
        <div className="text-gray-600">
          {/* Upload icon */}
          <div className="flex justify-center mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-gray-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-lg font-medium">Haz click para seleccionar el archivo</p>
          <p className="my-2 text-gray-500">
            <strong>o si lo prefieres</strong>
          </p>
          <p className="text-lg font-medium">También puedes arrastrar el archivo aquí</p>
          {isDragReject && (
            <p className="mt-2 text-red-500 text-sm font-medium">
              Solo se aceptan archivos de imagen
            </p>
          )}
        </div>
      </div>

      {/* Status message */}
      {statusMessage && (
        <p
          className={`mt-4 text-center font-semibold ${statusError ? 'text-red-600' : 'text-green-600'}`}
        >
          {statusMessage}
        </p>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <p className="mt-4 text-center text-blue-600 font-semibold">Subiendo imagen...</p>
      )}
    </div>
  )
}
