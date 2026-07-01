import { handleIpc } from './handlers'
import { getAutoLaunchEnabled, setAutoLaunchEnabled } from '../auto-launch'

/**
 * Registers IPC handlers for auto-launch settings.
 *
 * Channels:
 * - `autoLaunch:get` — Returns whether auto-launch is enabled
 * - `autoLaunch:set` — Enable or disable auto-launch
 */
export function registerAutoLaunchHandlers(): void {
  handleIpc('autoLaunch:get', () => {
    return getAutoLaunchEnabled()
  })

  handleIpc('autoLaunch:set', (enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('autoLaunch:set expects a boolean argument')
    }
    setAutoLaunchEnabled(enabled)
    return getAutoLaunchEnabled()
  })
}
