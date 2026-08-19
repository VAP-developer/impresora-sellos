import { handleIpc } from './handlers'
import { syncStamps, StampSyncResult } from '../stamps/stamp-sync-service'
import { StampsRepository, StampRecord } from '../database/repositories/stamps.repository'
import { AppStateRepository } from '../database/repositories/app-state.repository'

interface StampSyncStatus {
  totalStamps: number
  lastSyncAt: string | null
  isBlocked: boolean
}

/**
 * Registers IPC handlers for stamp synchronization.
 *
 * Channels:
 * - stamps:sync — Trigger cloud sync
 * - stamps:getAll — Get all local stamps
 * - stamps:getStatus — Get sync status info
 */
export function registerStampsHandlers(): void {
  handleIpc('stamps:sync', async (): Promise<StampSyncResult> => {
    return await syncStamps()
  })

  handleIpc('stamps:getAll', (): StampRecord[] => {
    const repo = new StampsRepository()
    return repo.getAll()
  })

  handleIpc('stamps:getStatus', (): StampSyncStatus => {
    const stampsRepo = new StampsRepository()
    const appStateRepo = new AppStateRepository()
    const stamps = stampsRepo.getAll()
    const lastSync = stamps.length > 0 ? stamps[0].syncedAt : null
    return {
      totalStamps: stamps.length,
      lastSyncAt: lastSync,
      isBlocked: appStateRepo.isBlocked()
    }
  })
}
