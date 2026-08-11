import { handleIpc } from './handlers'
import { getUserConfig } from '../user-config'

/**
 * Registers IPC handlers for user-config access.
 *
 * Channels:
 * - userConfig:get — Returns the loaded user config (read-only)
 */
export function registerUserConfigHandlers(): void {
  handleIpc('userConfig:get', () => {
    return getUserConfig()
  })
}
