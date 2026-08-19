/**
 * PrintRotationSection.tsx
 *
 * Checkbox component for enabling 180° print rotation.
 * When enabled, the PDF generation (text + logo) will be rotated 180°
 * to support special printers that print labels upside down.
 */

import { useSettingsStore } from '@renderer/stores/settings.store'

export function PrintRotationSection(): JSX.Element {
  const { printRotation180, setPrintRotation } = useSettingsStore()

  async function handleToggle(): Promise<void> {
    try {
      await setPrintRotation(!printRotation180)
    } catch {
      // Store handles error state internally
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id="print-rotation-checkbox"
          type="checkbox"
          checked={printRotation180}
          onChange={handleToggle}
          className="h-5 w-5 rounded border-gray-300 text-blue-600
                     focus:ring-2 focus:ring-blue-400 cursor-pointer"
          aria-describedby="print-rotation-description"
        />
        <label
          htmlFor="print-rotation-checkbox"
          className="text-sm font-medium text-gray-700 cursor-pointer select-none"
        >
          Activar rotación 180°
        </label>
      </div>

      <p
        id="print-rotation-description"
        className="text-xs text-gray-500 ml-8"
      >
        Rota la impresión del sello (texto y logo) 180° para impresoras que imprimen las etiquetas
        al revés.
      </p>
    </div>
  )
}
