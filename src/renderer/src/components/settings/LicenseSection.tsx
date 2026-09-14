/**
 * LicenseSection — Shows license info and allows deactivating this machine.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface LicenseInfo {
  ok: boolean
  message?: string
  error?: string
  isAdmin?: boolean
  activeMachines?: number
  maxMachines?: number
}

export function LicenseSection(): JSX.Element {
  const { t } = useTranslation()
  const [status, setStatus] = useState<LicenseInfo | null>(null)
  const [machineId, setMachineId] = useState<string>('')

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
      setStatus({ ok: false, error: t('license.statusError') })
    }
  }

  return (
    <div className="space-y-4">
      {/* Info de la licencia */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-gray-700">{t('license.statusLabel')}</span>
          <span className={`ml-2 font-bold ${status?.ok ? 'text-green-600' : 'text-red-600'}`}>
            {status?.ok ? t('license.active') : t('license.inactive')}
          </span>
        </div>
        <div>
          <span className="font-semibold text-gray-700">{t('license.typeLabel')}</span>
          <span className="ml-2">
            {status?.isAdmin ? t('license.typeAdmin') : t('license.typeStandard')}
          </span>
        </div>
        {!status?.isAdmin && (
          <div>
            <span className="font-semibold text-gray-700">{t('license.devicesLabel')}</span>
            <span className="ml-2">
              {status?.activeMachines ?? '?'} / {status?.maxMachines ?? '?'}
            </span>
          </div>
        )}
        <div>
          <span className="font-semibold text-gray-700">{t('license.machineIdLabel')}</span>
          <span className="ml-2 font-mono text-xs text-gray-500">
            {machineId ? machineId.substring(0, 16) + '...' : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
