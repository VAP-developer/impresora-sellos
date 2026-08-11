/**
 * LicenseBlockScreen — Full-screen overlay that blocks the app
 * when the license is invalid or exhausted.
 */

import { useState, useEffect } from 'react'

export function LicenseBlockScreen(): JSX.Element | null {
  const [blocked, setBlocked] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    // Listen for license block event from main process
    const unsubscribe = window.electronAPI.license.onBlocked((blockReason) => {
      setBlocked(true)
      setReason(blockReason)
    })

    // Also check current status on mount
    window.electronAPI.license.status().then((status) => {
      if (!status.ok && status.error && status.error !== 'No validado aún') {
        setBlocked(true)
        setReason(status.error)
      }
    })

    return unsubscribe
  }, [])

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#212F5D]">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-[#212F5D] mb-2">
          Licencia no válida
        </h2>

        <p className="text-gray-600 mb-6">
          {reason}
        </p>

        <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-500 space-y-2">
          <p><strong>¿Qué puedo hacer?</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Verifica tu conexión a internet si es la primera vez.</li>
            <li>Contacta con soporte si crees que es un error.</li>
            <li>Si cambiaste de equipo, solicita la liberación del anterior.</li>
          </ul>
        </div>

        <button
          onClick={() => window.close()}
          className="mt-6 px-6 py-2 bg-[#212F5D] text-white rounded-lg font-semibold
                     hover:bg-[#2d3f7a] transition-colors"
        >
          Cerrar aplicación
        </button>
      </div>
    </div>
  )
}
