import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const togglePopup = useCallback(() => {
    setShowPopup((prev) => !prev)
  }, [])

  // Close popup on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent): void {
      if (showPopup && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [showPopup])

  const isActive = (path: string): boolean => location.pathname === path

  return (
    <>
      <div className="w-full h-px bg-black" />
      <nav className="h-[100px] bg-[rgb(255,192,0)] flex items-center px-4 shrink-0">
        {/* Left: Home link */}
        <Link
          to="/home"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/home') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label="Inicio"
        >
          <HomeIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">Inicio</span>
        </Link>

        <div className="flex-1" />

        {/* Imprimir config link */}
        <Link
          to="/imprimir"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/imprimir') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label="Configuración de impresión"
        >
          <PrinterIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">Imprimir</span>
        </Link>

        <div className="flex-1" />

        {/* Info popup */}
        <div className="relative inline-block" ref={popupRef}>
          <button
            onClick={togglePopup}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-yellow-500/30 transition-colors"
            aria-label="Información del kiosko"
            aria-expanded={showPopup}
          >
            <InfoIcon />
          </button>
          {showPopup && (
            <div
              className="absolute z-10 w-[650px] bg-gray-600 text-white text-center rounded-md py-2 px-4 left-1/2 -translate-x-1/2 top-full mt-2 text-sm leading-relaxed animate-fadeIn"
              role="tooltip"
            >
              <p className="font-bold mb-1">Logotipo FILATELIA a PERFIL FILATELIA</p>
              <p className="mb-2">
                • Pruebas al colocar los rollos
                <br />
                • Cambios por etiquetas defectuosas
                <br />
                (para DESTRUCCIÓN)
              </p>
              <hr className="border-gray-400 my-1" />
              <p className="mb-2">
                MOTIVO 1 a PERFIL PROTOCOLO
                <br />
                <br />
                MOTIVO 2 a PERFIL SPDE
              </p>
              <hr className="border-gray-400 my-1" />
              <p className="font-bold mb-1">CARRO ANULACIÓN VENTA</p>
              <p className="mb-2">para cuando las IMPRESORAS NO FUNCIONAN</p>
              <p className="text-left pl-4">
                Pasos a seguir antes de pulsarlo:
                <br />
                1º Apagar/Encender Impresoras
                <br />
                2º Abrir los spool de impresión y reiniciar impresión si hubiera pendientes
                <br />
                3º PULSAR BOTÓN de ANULACIÓN CESTA ANTERIOR
                <br />
                (se restablecerán las cantidades de etiquetas, tickets e ID)
                <br />
                4º Cerrar y Abrir la Aplicación
                <br />
                5º APAGAR, esperar y Reiniciar el Equipo
              </p>
              <hr className="border-gray-400 my-1" />
              <p className="font-bold text-red-300">
                IMPORTANTE en los campos CANTIDAD:
                <br />
                NUNCA DEJAR NINGUNO EN BLANCO
                <br />
                <span className="font-normal text-white">
                  (HACE VENTA pero no imprime, pulsar CARRO ANULACIÓN y reiniciar la aplicación)
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Maquina config link */}
        <Link
          to="/maquina"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/maquina') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label="Configuración de máquina"
        >
          <MachineIcon />
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">Máquina</span>
        </Link>

        <div className="flex-1" />
        <div className="flex-1" />

        {/* Right: Kiosko link */}
        <Link
          to="/kiosko"
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded transition-colors',
            isActive('/kiosko') ? 'bg-yellow-500/50' : 'hover:bg-yellow-500/30'
          )}
          aria-label="Kiosko de venta"
        >
          <span className="text-sm font-semibold text-gray-800 hidden sm:inline">Kiosko</span>
          <KioskoIcon />
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

function InfoIcon(): JSX.Element {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
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
