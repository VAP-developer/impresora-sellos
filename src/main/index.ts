import { app, shell, BrowserWindow } from 'electron'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './database/connection'
import { ConfigRepository } from './database/repositories/config.repository'
import { registerAllHandlers } from './ipc/handlers'
import { initServices, shutdownServices } from './services'
import { syncImages } from './images/sync-images'
import { setLastSyncResult } from './ipc/images.handlers'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stamp-sales')

  // Initialize database and run pending migrations
  initDatabase()

  // Seed default configuration if not present
  const configRepo = new ConfigRepository()
  configRepo.initConfig()

  // Synchronize fair images from bbdd-ferias/ folder into SQLite
  try {
    let basePath: string
    if (app.isPackaged) {
      // In packaged mode, check first next to the executable (user-managed),
      // then fall back to extraResources inside the package
      const exeDirPath = join(dirname(app.getPath('exe')), 'bbdd-ferias')
      const resourcesPath = join(process.resourcesPath, 'bbdd-ferias')
      basePath = existsSync(exeDirPath) ? exeDirPath : resourcesPath
    } else {
      // Dev mode: use project root
      basePath = join(app.getAppPath(), 'bbdd-ferias')
    }
    console.log('[sync-images] Starting image synchronization from:', basePath)
    const syncResult = syncImages(basePath)
    setLastSyncResult(syncResult)
    console.log(
      `[sync-images] Sync complete — inserted: ${syncResult.inserted}, updated: ${syncResult.updated}, deleted: ${syncResult.deleted}, unchanged: ${syncResult.unchanged}`
    )
    if (syncResult.errors.length > 0) {
      console.warn(`[sync-images] Sync finished with ${syncResult.errors.length} error(s):`)
      for (const err of syncResult.errors) {
        console.warn(`  - ${err.path}: ${err.error}`)
      }
    }
  } catch (err) {
    console.error('[sync-images] Image synchronization failed (non-blocking):', err)
  }

  // Register all IPC handlers for renderer communication
  registerAllHandlers()

  // Initialize services (start print queue background processing)
  initServices()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  shutdownServices()
  closeDatabase()
})
