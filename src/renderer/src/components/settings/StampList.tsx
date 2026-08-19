/**
 * StampList.tsx
 *
 * Displays the list of locally-synced stamps grouped by year (newest first).
 * Each year is a collapsible accordion section.
 * Each stamp entry shows its name and thumbnails for the fondo and logo images.
 *
 * Requirements: 5.2, 5.3
 */

import { useEffect, useState } from 'react'

interface StampRecord {
  id: number
  stampId: string
  year: string
  stampName: string
  fondoPath: string | null
  logoPath: string | null
  status: string
  syncedAt: string
  createdAt: string
}

/** Groups stamps by year, sorted descending (newest first). */
function groupByYear(stamps: StampRecord[]): Map<string, StampRecord[]> {
  const groups = new Map<string, StampRecord[]>()

  for (const stamp of stamps) {
    const existing = groups.get(stamp.year)
    if (existing) {
      existing.push(stamp)
    } else {
      groups.set(stamp.year, [stamp])
    }
  }

  // Sort the map keys descending
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
  )

  return sorted
}

/** Converts an absolute filesystem path to a file:// URL usable in <img> tags. */
function toFileUrl(path: string | null): string | null {
  if (!path) return null
  return `file:///${path.replace(/\\/g, '/')}`
}

export function StampList(): JSX.Element {
  const [stamps, setStamps] = useState<StampRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadStamps()
  }, [])

  async function loadStamps(): Promise<void> {
    try {
      const all = await window.electronAPI.stamps.getAll()
      setStamps(all)
      // Auto-expand the first (newest) year if there are stamps
      if (all.length > 0) {
        const years = [...new Set(all.map((s) => s.year))].sort((a, b) => b.localeCompare(a))
        if (years[0]) {
          setExpandedYears(new Set([years[0]]))
        }
      }
    } catch {
      // Silent fail — the list will remain empty
    } finally {
      setLoading(false)
    }
  }

  function toggleYear(year: string): void {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) {
        next.delete(year)
      } else {
        next.add(year)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        Cargando sellos...
      </div>
    )
  }

  if (stamps.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        No hay sellos sincronizados. Pulsa &quot;Sincronizar con la nube&quot; para descargar el catálogo.
      </div>
    )
  }

  const grouped = groupByYear(stamps)

  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([year, yearStamps]) => {
        const isExpanded = expandedYears.has(year)

        return (
          <div key={year} className="border border-gray-200 rounded overflow-hidden">
            {/* Year header — click to expand/collapse */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100
                         text-left focus:outline-none focus:ring-2 focus:ring-yellow-400"
              onClick={() => toggleYear(year)}
              aria-expanded={isExpanded}
              aria-controls={`stamp-year-${year}`}
            >
              <span className="font-semibold text-gray-800">
                {year}
              </span>
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <span>{yearStamps.length} sellos</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {/* Stamp list for this year */}
            {isExpanded && (
              <div
                id={`stamp-year-${year}`}
                className="divide-y divide-gray-100"
                role="region"
                aria-label={`Sellos del año ${year}`}
              >
                {yearStamps.map((stamp) => (
                  <StampEntry key={stamp.stampId} stamp={stamp} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** A single stamp entry showing name + thumbnails */
function StampEntry({ stamp }: { stamp: StampRecord }): JSX.Element {
  const fondoUrl = toFileUrl(stamp.fondoPath)
  const logoUrl = toFileUrl(stamp.logoPath)

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
      {/* Fondo thumbnail */}
      <div className="w-16 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-200 border border-gray-300">
        {fondoUrl ? (
          <img
            src={fondoUrl}
            alt={`Fondo de ${stamp.stampName}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">
            Sin fondo
          </div>
        )}
      </div>

      {/* Logo thumbnail */}
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-200 border border-gray-300">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`Logo de ${stamp.stampName}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">
            Sin logo
          </div>
        )}
      </div>

      {/* Stamp name */}
      <span className="text-sm text-gray-800 font-medium truncate">
        {stamp.stampName}
      </span>

      {/* Status badge if incomplete */}
      {stamp.status === 'incomplete' && (
        <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
          Incompleto
        </span>
      )}
    </div>
  )
}
