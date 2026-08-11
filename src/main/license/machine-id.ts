/**
 * Machine ID Module
 *
 * Generates a unique, persistent identifier for the current machine.
 * Used to bind licenses to specific hardware.
 */

import { machineIdSync } from 'node-machine-id'

let cachedMachineId: string | null = null

/**
 * Returns a unique hash for this machine.
 * The ID is based on the machine's hardware UUID and is consistent
 * across reboots, reinstalls, and app updates.
 */
export function getMachineId(): string {
  if (!cachedMachineId) {
    cachedMachineId = machineIdSync({ original: false }) // SHA-256 hashed
  }
  return cachedMachineId
}
