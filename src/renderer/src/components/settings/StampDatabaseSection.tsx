/**
 * StampDatabaseSection — Shows stamp database status (total stamps, last sync).
 * If the local DB is empty, shows a message prompting the user to sync.
 *
 * Requirements: 5.1, 5.5, 5.7
 */

import { useState, useEffect } from 'react'
import { useOnlineStatus } from '@renderer/lib/useOnlineStatus'
import { SyncButton } from './SyncButton'
import { StampList } from './StampList'

interface StampStatus {
  totalStamps: number
  lastSyncAt: string | null
  isBlocked: boolean
}

export function StampDatabaseSection(): JSX.Element {
  const [status, setStatus] = useState<StampStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const { isOnline } = useOnlineStatus()

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus(): Promise<void> {
    try {
      const result = await window.electronAPI.stamps.getStatus()
      setStatus(result)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Cargando estado...</div>
    )
  }

  if (!status) {
    return (
      <div className="text-sm text-red-600">Error al obtener el estado de la base de datos.</div>
    )
  }

  const isEmpty = status.totalStamps === 0 && status.lastSyncAt === null

  return (
    <div className="space-y-4">
      {isEmpty ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          No hay sellos sincronizados. Pulse &apos;Sincronizar con la nube&apos; para descargar la base de datos.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-700">Total sellos:</span>
            <span className="ml-2 font-bold text-gray-900">{status.totalStamps}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Última sincronización:</span>
            <span className="ml-2">
              {status.lastSyncAt ? formatDate(status.lastSyncAt) : 'Nunca'}
            </span>
          </div>
        </div>
      )}

      {!isEmpty && <StampList key={refreshKey} />}

      <SyncButton
        disabled={!isOnline}
        offlineReason={!isOnline ? 'Se requiere conexión a internet' : undefined}
        onSyncComplete={() => {
          loadStatus()
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
