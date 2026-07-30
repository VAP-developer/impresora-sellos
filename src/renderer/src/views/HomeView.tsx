import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * HomeView — Main menu screen with navigation to all main application sections.
 *
 * Provides navigation cards to:
 * - /informes (Informes: reportes y exportación)
 * - /settings (Configuración: ajustes generales)
 * - /maquina (Máquina: código etiqueta, ticket, rollos)
 * - /imprimir (Eventos: perfil, evento, tarifas)
 * - /kiosko (Kiosko: venta directa)
 */
export default function HomeView(): JSX.Element {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-8">
      <h1 className="text-3xl font-bold text-[#212F5D] mb-12">{t('nav.home').toUpperCase()}</h1>

      {/* Navigation grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl w-full">
        {/* Informes */}
        <NavigationCard
          onClick={() => navigate('/informes')}
          icon={<ReportsIcon />}
          title={t('nav.reports')}
          description="Reportes y exportación de datos"
          ariaLabel="Ir a Informes"
        />

        {/* Settings */}
        <NavigationCard
          onClick={() => navigate('/settings')}
          icon={<SettingsIcon />}
          title={t('nav.settings')}
          description="Configuración general y tarifas"
          ariaLabel="Ir a Configuración"
        />

        {/* Máquina */}
        <NavigationCard
          onClick={() => navigate('/maquina')}
          icon={<MaquinaIcon />}
          title={t('nav.machine')}
          description="Código etiqueta, ticket y rollos"
          ariaLabel="Ir a Máquina"
        />

        {/* Eventos (Imprimir) */}
        <NavigationCard
          onClick={() => navigate('/imprimir')}
          icon={<PrintIcon />}
          title={t('nav.print')}
          description="Gestión de eventos y configuración de impresión"
          ariaLabel="Ir a Eventos"
        />

        {/* Kiosko */}
        <NavigationCard
          onClick={() => navigate('/kiosko')}
          icon={<KioskoIcon />}
          title={t('nav.kiosko')}
          description="Punto de venta automático"
          ariaLabel="Ir a Kiosko"
        />
      </div>
    </div>
  )
}

/* ─── Navigation Card Component ──────────────────────────────────────────── */

interface NavigationCardProps {
  onClick: () => void
  icon: JSX.Element
  title: string
  description: string
  ariaLabel: string
}

function NavigationCard({ onClick, icon, title, description, ariaLabel }: NavigationCardProps): JSX.Element {
  return (
    <button
      className="flex flex-col items-center justify-center bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-[#212F5D] hover:shadow-lg transition-all cursor-pointer group"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <div className="mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h2 className="text-xl font-bold text-[#212F5D] mb-2">{title}</h2>
      <p className="text-sm text-gray-600 text-center">{description}</p>
    </button>
  )
}

/* ─── Inline SVG Icons (large, matching design) ─────────────────────────── */

function ReportsIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function SettingsIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function PrintIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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

function MaquinaIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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
      className="w-20 h-20 text-[#212F5D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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
