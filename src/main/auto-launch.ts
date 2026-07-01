import { app } from 'electron'

/**
 * Auto-launch module for Windows.
 *
 * Uses Electron's built-in `app.setLoginItemSettings()` API which manages
 * the Windows Registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
 * to start the application automatically when the user logs in.
 *
 * On Linux/macOS this is a no-op since the production target is Windows only.
 */

/**
 * Returns whether auto-launch is currently enabled.
 */
export function getAutoLaunchEnabled(): boolean {
  if (process.platform !== 'win32') {
    return false
  }

  const settings = app.getLoginItemSettings()
  return settings.openAtLogin
}

/**
 * Enable or disable auto-launch on Windows startup.
 *
 * When enabled, the app will start automatically when the user logs in.
 * The `--hidden` argument is passed so the app can optionally start minimized.
 */
export function setAutoLaunchEnabled(enabled: boolean): void {
  if (process.platform !== 'win32') {
    return
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    // Pass --hidden flag so the app knows it was auto-launched
    // and can optionally start minimized or in system tray
    args: enabled ? ['--hidden'] : []
  })
}
