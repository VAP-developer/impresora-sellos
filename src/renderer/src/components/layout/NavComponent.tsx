import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'

/**
 * NavComponent — Navigation bar replicating the legacy NavComponent.vue layout.
 *
 * Structure (left to right):
 * - Home link (logo/left area)
 * - Imprimir link (config icon)
 * - Info popup (help tooltip)
 * - Maquina link (machine icon)
 * - Kiosko link (logo/right area)
 *
 * Background: rgb(255, 192, 0) — golden bar matching the legacy design.
 */
export default function NavComponent(): JSX.Element {
  const location = useLocation()
  const { t } = useTranslation()

  const isActive = (path: string): boolean => location.pathname === path

  return (
    <>
      <div className="w-full h-px bg-black" />
      <nav className="h-[100px] bg-[rgb(255,192,0)] flex items-center px-4 shrink-0">
        {/* 1. Home */}
        <Link
          to="/home"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/home') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.home')}
        >
          <HomeIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">{t('nav.home')}</span>
        </Link>

        <div className="flex-1" />

        {/* 2. Informes */}
        <Link
          to="/informes"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/informes') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.reports')}
        >
          <ReportsIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">
            {t('nav.reports')}
          </span>
        </Link>

        <div className="flex-1" />

        {/* 3. Configuración (Settings) */}
        <Link
          to="/settings"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/settings') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.settings')}
        >
          <SettingsIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">
            {t('nav.settings')}
          </span>
        </Link>

        <div className="flex-1" />

        {/* 4. Máquina */}
        <Link
          to="/maquina"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/maquina') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.machine')}
        >
          <MachineIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">{t('nav.machine')}</span>
        </Link>

        <div className="flex-1" />

        {/* 5. Eventos */}
        <Link
          to="/imprimir"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/imprimir') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.print')}
        >
          <PrinterIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">{t('nav.print')}</span>
        </Link>

        <div className="flex-1" />

        {/* 6. Kiosko */}
        <Link
          to="/kiosko"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/kiosko') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label={t('nav.kiosko')}
        >
          <KioskoIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">{t('nav.kiosko')}</span>
        </Link>
      </nav>
    </>
  )
}

/* ─── Inline SVG Icons ──────────────────────────────────────────────────── */

function HomeIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function PrinterIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function MachineIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  )
}

function KioskoIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M6 8h.01M9 8h.01" />
    </svg>
  )
}

function SettingsIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function ReportsIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 text-gray-800"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Chart bar icon representing reports */}
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
