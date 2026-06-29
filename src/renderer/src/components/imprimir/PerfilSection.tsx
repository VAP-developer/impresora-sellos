/**
 * PerfilSection.tsx
 *
 * Section for selecting the active sales profile (1-6).
 * Replicates the "PERFIL - MODO DE VENTA" section from the legacy ImprimirView.vue.
 *
 * The profile determines the selling mode (Filatelia, Esporádicos, SPDE, etc.)
 * and affects the ticket title and importe limit used during sales.
 *
 * Validates: Requirement 13.1 (support up to 6 profiles)
 * Validates: Requirement 13.4 (changing active profile adjusts Límite_Importe)
 */

import type { SelloConfig } from '@renderer/types/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerfilSectionProps {
  /** Current sello configuration containing profile data. */
  sello: SelloConfig
  /** Currently selected profile number (1-6). */
  selectedPerfil: number
  /** Callback when the user changes the selected profile. */
  onPerfilChange: (perfil: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerfilSection({
  sello,
  selectedPerfil,
  onPerfilChange
}: PerfilSectionProps): JSX.Element {
  /** Build profile options from the sello config (nperfil1..nperfil6). */
  const profiles: { value: number; label: string }[] = [
    { value: 1, label: sello.nperfil1 || 'Perfil 1' },
    { value: 2, label: sello.nperfil2 || 'Perfil 2' },
    { value: 3, label: sello.nperfil3 || 'Perfil 3' },
    { value: 4, label: sello.nperfil4 || 'Perfil 4' },
    { value: 5, label: sello.nperfil5 || 'Perfil 5' },
    { value: 6, label: sello.nperfil6 || 'Perfil 6' }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1 && value <= 6) {
      onPerfilChange(value)
    }
  }

  return (
    <section aria-labelledby="perfil-section-heading" className="mb-6">
      {/* Section header */}
      <div className="bg-[rgb(255,192,0)] p-2 mb-2 rounded shadow">
        <h3 id="perfil-section-heading" className="text-black font-bold m-0">
          PERFIL - MODO DE VENTA
        </h3>
      </div>

      {/* Profile selector */}
      <div className="flex flex-col items-center p-4">
        <label
          htmlFor="perfil-selector"
          className="text-red-600 text-lg font-bold mb-2"
        >
          Ir a Menú MÁQUINA y GUARDAR
        </label>
        <select
          id="perfil-selector"
          value={selectedPerfil}
          onChange={handleChange}
          className="w-[250px] text-blue-700 text-lg border border-gray-300 rounded p-2
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Seleccionar perfil de venta activo"
        >
          {profiles.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
