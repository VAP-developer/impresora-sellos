import { ipcMain, BrowserWindow } from 'electron'
import { registerConfigHandlers } from './config.handlers'
import { registerOrdersHandlers } from './orders.handlers'
import { registerImagesHandlers } from './images.handlers'
import { registerPrinterHandlers } from './printer.handlers'
import { registerSaleHandlers } from './sale.handlers'
import { registerAutoLaunchHandlers } from './auto-launch.handlers'
import { registerEventosHandlers } from './eventos.handlers'

/**
 * Centralized IPC handler registry.
 *
 * Registers all ipcMain.handle() listeners for communication
 * between the renderer process and the main process.
 *
 * Each domain module exports a `registerXxxHandlers()` function
 * that sets up its own channels. This keeps handler logic organized
 * by domain while providing a single entry point for initialization.
 *
 * Call this once from the main process after the database is initialized.
 */
export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerOrdersHandlers()
  registerImagesHandlers()
  registerPrinterHandlers()
  registerSaleHandlers()
  registerAutoLaunchHandlers()
  registerEventosHandlers()
}

/**
 * Sends a config change notification to all renderer windows.
 * Used by config handlers to push updates reactively.
 */
export function notifyConfigChanged(config: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('config:changed', config)
  }
}

/**
 * Helper to register an IPC handler with consistent error handling.
 * Wraps the handler in a try/catch and returns a structured error
 * so the renderer can handle failures gracefully.
 */
export function handleIpc<T>(
  channel: string,
  handler: (...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[IPC] Error in channel "${channel}":`, message)
      throw new Error(message)
    }
  })
}
