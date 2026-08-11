import { handleIpc } from './handlers'
import {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  getMachineId
} from '../license'

/**
 * Registers IPC handlers for license management.
 *
 * Channels:
 * - license:activate — Validate license for this machine
 * - license:deactivate — Release this machine's slot
 * - license:status — Get current license status
 * - license:machineId — Get this machine's unique ID
 */
export function registerLicenseHandlers(): void {
  handleIpc('license:activate', async () => {
    return await activateLicense()
  })

  handleIpc('license:deactivate', async () => {
    return await deactivateLicense()
  })

  handleIpc('license:status', () => {
    return getLicenseStatus()
  })

  handleIpc('license:machineId', () => {
    return getMachineId()
  })
}
