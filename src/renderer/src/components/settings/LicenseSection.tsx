/**
 * LicenseSection — Shows license info and allows deactivating this machine.
 */

import { useState, useEffect } from 'react'

interface LicenseInfo {
  ok: boolean
  message?: string
  error?: string
  isAdmin?: boolean
  activeMachines?: number
  maxMachines?: number
}

export function LicenseSection(): JSX.Element {
  const [status, setStatus] = useState<LicenseInfo | null>(null)
  const [machineId, setMachineId] = useState<string>('')
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateResult, setDeactivateResult] = useState<string | null>(null)

  useEffect(() => {
    loadLicenseInfo()
  }, [])

  async function loadLicenseInfo(): Promise<void> {
    try {
      const [licStatus, mId] = await Promise.all([
        window.electronAPI.license.status(),
        window.electronAPI.license.machineId()
      ])
      setStatus(licStatus)
      setMachineId(mId)
    } catch {
      setStatus({ ok: false, error: 'Error al obtener estado de licencia' })
    }
  }

  async function handleDeactivate(): Promise<void> {
    if (!confirm('¿Estás seguro? Se liberará la licencia de este equipo y la app dejará de funcionar hasta que se reactive.')) {
      return
    }

    setDeactivating(true)
    setDeactivateResult(null)

    try {
      const result = await window.electronAPI.license.deactivate()
      if (result.ok) {
        setDeactivateResult('Equipo desactivado. Reinicia la app para aplicar.')
        setStatus({ ok: false, error: 'Equipo desactivado' })
      } else {
        setDeactivateResult(result.error || 'Error al desactivar')
      }
    } catch {
      setDeactivateResult('Error de conexión')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Info de la licencia */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-gray-700">Estado:</span>
          <span className={`ml-2 font-bold ${status?.ok ? 'text-green-600' : 'text-red-600'}`}>
            {status?.ok ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div>
          <span className="font-semibold text-gray-700">Tipo:</span>
          <span className="ml-2">
            {status?.isAdmin ? 'Admin (sin límite)' : `Estándar`}
          </span>
        </div>
        {!status?.isAdmin && (
          <div>
            <span className="font-semibold text-gray-700">Dispositivos:</span>
            <span className="ml-2">
              {status?.activeMachines ?? '?'} / {status?.maxMachines ?? '?'}
            </span>
          </div>
        )}
        <div>
          <span className="font-semibold text-gray-700">ID de equipo:</span>
          <span className="ml-2 font-mono text-xs text-gray-500">
            {machineId ? machineId.substring(0, 16) + '...' : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
