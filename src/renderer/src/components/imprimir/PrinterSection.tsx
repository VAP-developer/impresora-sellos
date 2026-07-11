/**
 * PrinterSection.tsx
 *
 * Collapsible section for printer management in the Imprimir view.
 * Contains pause/resume controls and the printer selector.
 */

import { useState } from 'react'
import PrinterControls from './PrinterControls'
import PrinterSelector from '@renderer/components/kiosko/PrinterSelector'

export default function PrinterSection(): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <section aria-labelledby="printer-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-printers"
          type="checkbox"
          checked={expanded}
          onChange={() => setExpanded(!expanded)}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="printer-section-content"
        />
        <label
          htmlFor="toggle-printers"
          id="printer-section-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          IMPRESORAS
        </label>
      </div>

      {expanded && (
        <div
          id="printer-section-content"
          className="flex flex-col items-center gap-4 p-4"
          role="region"
          aria-labelledby="printer-section-heading"
        >
          <PrinterControls />
          <div className="w-full max-w-[500px]">
            <PrinterSelector />
          </div>
        </div>
      )}
    </section>
  )
}
