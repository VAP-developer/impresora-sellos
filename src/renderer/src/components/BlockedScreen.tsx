/**
 * BlockedScreen — Full-screen overlay that blocks the app
 * when the stamp-sync service has flagged the machine as blocked.
 * Checked via stamps.getStatus().isBlocked.
 */

import { useState, useEffect } from 'react'

export function BlockedScreen(): JSX.Element | null {
  const [blocked, setBlocked] = useState(false)
  const [machineId, setMachineId] = useState('')

  useEffect(() => {
    window.electronAPI.stamps.getStatus().then((status) => {
      if (status.isBlocked) {
        setBlocked(true)
        window.electronAPI.license.machineId().then((id) => {
          setMachineId(id)
        })
      }
    })
  }, [])

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#212F5D]">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        {/* Warning Icon */}
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-[#212F5D] mb-2">
          Aplicación bloqueada
        </h2>

        <p className="text-gray-600 mb-6">
          Aplicación bloqueada. Contacte con soporte.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 mb-6">
          <p className="font-mono">ID de equipo: {machineId}</p>
        </div>

        <button
          onClick={() => window.close()}
          className="px-6 py-2 bg-[#212F5D] text-white rounded-lg font-semibold
                     hover:bg-[#2d3f7a] transition-colors"
        >
          Cerrar aplicación
        </button>
      </div>
    </div>
  )
}
