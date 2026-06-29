/**
 * PerfilesSection.tsx
 *
 * Collapsible section for editing profile names (1-6).
 * Replicates the "EDITAR PERFILES" section from the legacy ImprimirView.vue.
 *
 * In the legacy system, only profile 4 is editable; profiles 1, 2, 3, 5, 6
 * have fixed names (Filatelia, Esporádicos, SPDE, Abono/Envío, FERIA).
 *
 * Validates: Requirement 13.1 (support up to 6 profiles with editable names)
 */

import { useState } from 'react'
import type { SelloConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerfilesSectionProps {
  /** Current sello configuration containing profile name data. */
  sello: SelloConfig
  /** Callback when the user edits a profile name. Only profile 4 is editable. */
  onProfileNameChange: (profileIndex: number, value: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Profile indices that are read-only (cannot be edited by the user). */
const READONLY_PROFILES = new Set([1, 2, 3, 5, 6])

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerfilesSection({
  sello,
  onProfileNameChange
}: PerfilesSectionProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  /** Get profile name from sello config by index (1-based). */
  const getProfileName = (index: number): string => {
    switch (index) {
      case 1:
        return sello.nperfil1 || ''
      case 2:
        return sello.nperfil2 || ''
      case 3:
        return sello.nperfil3 || ''
      case 4:
        return sello.nperfil4 || ''
      case 5:
        return sello.nperfil5 || ''
      case 6:
        return sello.nperfil6 || ''
      default:
        return ''
    }
  }

  const handleToggle = (): void => {
    setExpanded((prev) => !prev)
  }

  const handleInputChange = (
    profileIndex: number,
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    onProfileNameChange(profileIndex, e.target.value)
  }

  return (
    <section aria-labelledby="perfiles-section-heading" className="mb-6">
      {/* Section header with collapsible toggle */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-perfiles"
          type="checkbox"
          checked={expanded}
          onChange={handleToggle}
          className="cursor-pointer"
          aria-expanded={expanded}
          aria-controls="perfiles-section-content"
        />
        <label
          htmlFor="toggle-perfiles"
          id="perfiles-section-heading"
          className="text-black text-lg font-bold cursor-pointer"
        >
          EDITAR PERFILES
        </label>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <div
          id="perfiles-section-content"
          className="flex flex-col items-center gap-2 p-4"
          role="region"
          aria-labelledby="perfiles-section-heading"
        >
          {[1, 2, 3, 4, 5, 6].map((index) => {
            const isReadonly = READONLY_PROFILES.has(index)
            const value = getProfileName(index)

            return (
              <div key={index} className="w-[250px]">
                <label
                  htmlFor={`perfil-name-${index}`}
                  className="block text-sm text-gray-600"
                >
                  Perfil {index}
                </label>
                <input
                  id={`perfil-name-${index}`}
                  type="text"
                  value={value}
                  onChange={(e) => handleInputChange(index, e)}
                  disabled={isReadonly}
                  className={`w-full border border-gray-300 rounded p-2 ${
                    isReadonly ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  aria-label={`Nombre del perfil ${index}`}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
