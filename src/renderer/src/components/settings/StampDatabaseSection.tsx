/**
 * StampDatabaseSection — Shows stamp database status (total stamps, last sync).
 * If the local DB is empty, shows a message prompting the user to sync.
 *
 * Requirements: 5.1, 5.5, 5.7
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@renderer/lib/useOnlineStatus'
import { SyncButton } from './SyncButton'
import { StampList } from './StampList'
import { UploadStampButton } from './UploadStampButton'
import { DeleteStampButton } from './DeleteStampButton'

interface StampStatus {
  totalStamps: number
  lastSyncAt: string | null
  isBlocked: boolean
}

export function StampDatabaseSection(): JSX.Element {
  const { t, i18n } = useTranslation()
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

  // Shared refresh after sync/upload/delete: reload status and remount the list.
  function refresh(): void {
    loadStatus()
    setRefreshKey((k) => k + 1)
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString(i18n.language === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">{t('stampDb.loading')}</div>
    )
  }

  if (!status) {
    return (
      <div className="text-sm text-red-600">{t('stampDb.statusError')}</div>
    )
  }

  const isEmpty = status.totalStamps === 0 && status.lastSyncAt === null

  return (
    <div className="space-y-4">
      {isEmpty ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          {t('stampDb.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-700">{t('stampDb.totalStamps')}</span>
            <span className="ml-2 font-bold text-gray-900">{status.totalStamps}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">{t('stampDb.lastSync')}</span>
            <span className="ml-2">
              {status.lastSyncAt ? formatDate(status.lastSyncAt) : t('stampDb.never')}
            </span>
          </div>
        </div>
      )}

      {!isEmpty && <StampList key={refreshKey} />}

      <SyncButton
        disabled={!isOnline}
        offlineReason={!isOnline ? t('stampDb.offlineReason') : undefined}
        onSyncComplete={refresh}
      />

      {/* Normas de subida (visibles para el usuario) */}
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="mb-1 font-semibold">{t('stampDb.rulesTitle')}</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>{t('stampDb.rule1Pre')}<code>-fondo.jpg</code>{t('stampDb.rule1Mid')}<code>-sello.png</code>{t('stampDb.rule1Post')}</li>
          <li>{t('stampDb.rule2')}</li>
          <li>{t('stampDb.rule3')}</li>
          <li>{t('stampDb.rule4')}</li>
          <li>{t('stampDb.rule5')}</li>
        </ul>
      </div>

      <UploadStampButton
        disabled={!isOnline}
        onUploadComplete={refresh}
      />

      <DeleteStampButton
        disabled={!isOnline}
        onDeleteComplete={refresh}
      />
    </div>
  )
}
