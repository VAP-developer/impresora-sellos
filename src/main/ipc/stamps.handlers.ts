import { dialog, BrowserWindow } from 'electron'
import { basename } from 'path'
import { handleIpc } from './handlers'
import { syncStamps, StampSyncResult } from '../stamps/stamp-sync-service'
import {
  uploadStamp,
  deleteStamp,
  UploadStampResult,
  DeleteStampResult
} from '../stamps/stamp-upload-service'
import { StampsRepository, StampRecord } from '../database/repositories/stamps.repository'
import { AppStateRepository } from '../database/repositories/app-state.repository'

interface StampSyncStatus {
  totalStamps: number
  lastSyncAt: string | null
  isBlocked: boolean
}

interface PickedStampFiles {
  fondoPath: string | null
  logoPath: string | null
  error?: string
}

interface UploadStampArgs {
  year: string
  stampName: string
  fondoPath: string
  logoPath: string
}

interface DeleteStampArgs {
  year: string
  stampName: string
}

const FONDO_SUFFIX = '-fondo.jpg'
const SELLO_SUFFIX = '-sello.png'

/**
 * Registers IPC handlers for stamp synchronization and self-service upload/delete.
 *
 * Channels:
 * - stamps:sync — Trigger cloud sync
 * - stamps:getAll — Get all local stamps
 * - stamps:getStatus — Get sync status info
 * - stamps:pickFiles — Open a file dialog to select the 2 stamp images
 * - stamps:existsInYear — Check if a stampName already exists for a year
 * - stamps:upload — Upload a stamp (fondo + sello) to the cloud
 * - stamps:delete — Delete a stamp from the cloud
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

  // Opens a dialog to select exactly two images and validates the suffix rules.
  // Assigns each picked file to fondo/sello based on its suffix, regardless of
  // the order the user selected them.
  handleIpc('stamps:pickFiles', async (): Promise<PickedStampFiles> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Seleccione el fondo (-fondo.jpg) y el sello (-sello.png)',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Imágenes de sello', extensions: ['jpg', 'png'] }]
        })
      : await dialog.showOpenDialog({
          title: 'Seleccione el fondo (-fondo.jpg) y el sello (-sello.png)',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Imágenes de sello', extensions: ['jpg', 'png'] }]
        })

    if (result.canceled || result.filePaths.length === 0) {
      return { fondoPath: null, logoPath: null }
    }

    if (result.filePaths.length !== 2) {
      return {
        fondoPath: null,
        logoPath: null,
        error: 'Debe seleccionar exactamente 2 archivos: uno -fondo.jpg y otro -sello.png'
      }
    }

    let fondoPath: string | null = null
    let logoPath: string | null = null

    for (const p of result.filePaths) {
      const name = basename(p).toLowerCase()
      if (name.endsWith(FONDO_SUFFIX)) fondoPath = p
      else if (name.endsWith(SELLO_SUFFIX)) logoPath = p
    }

    if (!fondoPath || !logoPath) {
      return {
        fondoPath: null,
        logoPath: null,
        error: 'Los archivos deben ser uno "-fondo.jpg" y otro "-sello.png"'
      }
    }

    return { fondoPath, logoPath }
  })

  // Checks if a stamp already exists locally for the given year (to warn about
  // overwrite before uploading).
  handleIpc('stamps:existsInYear', (...args: unknown[]): boolean => {
    const { year, stampName } = args[0] as { year: string; stampName: string }
    const repo = new StampsRepository()
    const stampId = `${year}#${stampName}`
    return repo.getByYear(year).some((s) => s.stampId === stampId)
  })

  handleIpc('stamps:upload', async (...args: unknown[]): Promise<UploadStampResult> => {
    return await uploadStamp(args[0] as UploadStampArgs)
  })

  handleIpc('stamps:delete', async (...args: unknown[]): Promise<DeleteStampResult> => {
    return await deleteStamp(args[0] as DeleteStampArgs)
  })
}
