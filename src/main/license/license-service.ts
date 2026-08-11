/**
 * License Service
 *
 * Validates the license on app startup by calling the activate endpoint.
 * 
 * Strategy (Option B - requires online activation at least once):
 * - First launch: MUST connect to internet to activate → saves local ticket
 * - Subsequent launches:
 *   - If online → validates against backend (catches remote deactivations)
 *   - If offline → checks local ticket → if exists, allows usage
 * - No ticket + no internet → BLOCKED (prevents piracy)
 */

import { app } from 'electron'
import { join } from 'path'
import { createHmac } from 'crypto'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { getUserConfig } from '../user-config'
import { getMachineId } from './machine-id'

// ============================================================================
// Types
// ============================================================================

export interface LicenseResult {
  ok: boolean
  message?: string
  error?: string
  isAdmin?: boolean
  activeMachines?: number
  maxMachines?: number
}

interface ActivationTicket {
  machineId: string
  username: string
  activatedAt: string
  lastValidatedAt: string
  isAdmin: boolean
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = 'https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api'

// ============================================================================
// State
// ============================================================================

let licenseStatus: LicenseResult = { ok: false, error: 'No validado aún' }
let authToken: string | null = null

// ============================================================================
// Public API
// ============================================================================

/**
 * Sets the auth token obtained during login/download.
 * The token is stored in config.json and read at startup.
 */
export function setAuthToken(token: string): void {
  authToken = token
}

/**
 * Gets the current auth token.
 */
export function getAuthToken(): string | null {
  return authToken
}

/**
 * Activates the license for this machine.
 * Should be called once at app startup.
 *
 * Flow:
 * 1. If no token configured → local mode (no license needed)
 * 2. Try to activate online
 *    - Success → save local ticket + allow
 *    - License exhausted → deny
 * 3. If offline → check local ticket
 *    - Ticket exists for this machine → allow
 *    - No ticket → deny (first activation requires internet)
 */
export async function activateLicense(): Promise<LicenseResult> {
  const config = getUserConfig()
  const machineId = getMachineId()

  const apiKey = authToken || (config.license as { apiKey?: string })?.apiKey || ''

  // Si no hay apiKey, comprobar si existe un ticket local válido
  if (!apiKey) {
    const ticket = loadActivationTicket()
    if (ticket && ticket.machineId === machineId) {
      // Check ticket expiry (14 days)
      const EXPIRY_DAYS = 14
      const lastValidated = new Date(ticket.lastValidatedAt || ticket.activatedAt).getTime()
      const now = Date.now()
      const daysSinceValidation = (now - lastValidated) / (1000 * 60 * 60 * 24)

      if (daysSinceValidation > EXPIRY_DAYS) {
        licenseStatus = {
          ok: false,
          error: `Licencia caducada. Han pasado más de ${EXPIRY_DAYS} días sin validar. Restaura el archivo config.json y conéctate a internet.`
        }
        return licenseStatus
      }

      // Tiene ticket válido y no caducado
      licenseStatus = { ok: true, message: 'Licencia activa (ticket local)', isAdmin: ticket.isAdmin }
      return licenseStatus
    }
    // No hay apiKey NI ticket válido → bloquear
    licenseStatus = { ok: false, error: 'No se encontró configuración de licencia. Reinstala la aplicación con el archivo config.json.' }
    return licenseStatus
  }

  try {
    // Try online activation
    const result = await httpPost(`${API_BASE}/activate`, {
      machineId,
      apiKey
    })

    if (result.ok) {
      // Success → save local activation ticket
      saveActivationTicket({
        machineId,
        username: config.user?.username || 'unknown',
        activatedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        isAdmin: result.isAdmin || false
      })
      licenseStatus = result
    } else {
      // License denied (exhausted) → remove local ticket if it existed
      removeActivationTicket()
      licenseStatus = result
    }

    return licenseStatus
  } catch (err) {
    console.error('[license] Activation failed (network error):', err)

    // Offline → check local ticket
    const ticket = loadActivationTicket()

    if (ticket && ticket.machineId === machineId) {
      // Check ticket expiry (14 days without online validation)
      const EXPIRY_DAYS = 14
      const lastValidated = new Date(ticket.lastValidatedAt || ticket.activatedAt).getTime()
      const now = Date.now()
      const daysSinceValidation = (now - lastValidated) / (1000 * 60 * 60 * 24)

      if (daysSinceValidation > EXPIRY_DAYS) {
        // Ticket expired
        licenseStatus = {
          ok: false,
          error: `Licencia caducada. Han pasado más de ${EXPIRY_DAYS} días sin conexión. Conéctate a internet y reinicia la aplicación.`
        }
        console.log(`[license] Offline mode: ticket expired (${Math.floor(daysSinceValidation)} days since last validation)`)
      } else {
        // Ticket valid and not expired → allow offline usage
        licenseStatus = {
          ok: true,
          message: `Licencia activa (modo offline, ${Math.floor(EXPIRY_DAYS - daysSinceValidation)} días restantes)`,
          isAdmin: ticket.isAdmin
        }
        console.log(`[license] Offline mode: valid ticket, ${Math.floor(EXPIRY_DAYS - daysSinceValidation)} days remaining`)
      }
    } else {
      // No ticket or wrong machine → block
      licenseStatus = {
        ok: false,
        error: 'Se requiere conexión a internet para activar la licencia por primera vez.'
      }
      console.log('[license] Offline mode: no valid ticket, blocking')
    }

    return licenseStatus
  }
}

/**
 * Deactivates the license for this machine, freeing the slot.
 * Also removes the local activation ticket.
 */
export async function deactivateLicense(): Promise<LicenseResult> {
  const config = getUserConfig()
  const machineId = getMachineId()
  const apiKey = authToken || (config.license as { apiKey?: string })?.apiKey || ''

  if (!apiKey) {
    return { ok: false, error: 'No hay apiKey configurada' }
  }

  try {
    const result = await httpPost(`${API_BASE}/deactivate`, {
      machineId,
      apiKey
    })

    if (result.ok) {
      // Remove local ticket so the app won't work offline anymore
      removeActivationTicket()
      licenseStatus = { ok: false, error: 'Equipo desactivado' }
    }

    return result
  } catch (err) {
    console.error('[license] Deactivation failed:', err)
    return { ok: false, error: 'Error de conexión. Se necesita internet para desactivar.' }
  }
}

/**
 * Returns the current license status (from last activation check).
 */
export function getLicenseStatus(): LicenseResult {
  return licenseStatus
}

// ============================================================================
// Activation Ticket (local persistence with HMAC signature)
// ============================================================================

/**
 * Secret used to sign the activation ticket.
 * Obfuscated in parts to make it harder to find via simple string search.
 */
const _S1 = 'SvvS'
const _S2 = 'K10sk0'
const _S3 = '!L1c#'
const _S4 = '2026xQ9'
const TICKET_SECRET = [_S1, _S2, _S3, _S4].join('-')

interface SignedTicket {
  data: ActivationTicket
  signature: string
}

function computeSignature(ticket: ActivationTicket): string {
  const payload = JSON.stringify(ticket)
  return createHmac('sha256', TICKET_SECRET).update(payload).digest('hex')
}

function getTicketPath(): string {
  return join(app.getPath('userData'), '.license-ticket')
}

function saveActivationTicket(ticket: ActivationTicket): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const signed: SignedTicket = {
      data: ticket,
      signature: computeSignature(ticket)
    }

    writeFileSync(getTicketPath(), JSON.stringify(signed), 'utf-8')
    console.log('[license] Activation ticket saved (signed)')
  } catch (err) {
    console.error('[license] Failed to save activation ticket:', err)
  }
}

function loadActivationTicket(): ActivationTicket | null {
  try {
    const path = getTicketPath()
    if (!existsSync(path)) {
      return null
    }
    const raw = readFileSync(path, 'utf-8')
    const signed = JSON.parse(raw) as SignedTicket

    if (!signed.data || !signed.signature) {
      console.warn('[license] Ticket has invalid structure')
      return null
    }

    // Verify HMAC signature
    const expectedSignature = computeSignature(signed.data)
    if (signed.signature !== expectedSignature) {
      console.warn('[license] Ticket signature mismatch — file has been tampered with')
      return null
    }

    return signed.data
  } catch {
    return null
  }
}

function removeActivationTicket(): void {
  try {
    const path = getTicketPath()
    if (existsSync(path)) {
      unlinkSync(path)
      console.log('[license] Activation ticket removed')
    }
  } catch (err) {
    console.error('[license] Failed to remove activation ticket:', err)
  }
}

// ============================================================================
// Internal HTTP helper using Node.js https module
// ============================================================================

import * as https from 'https'
import { URL } from 'url'

function httpPost(url: string, body: Record<string, unknown>): Promise<LicenseResult> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const parsedUrl = new URL(url)

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk.toString()
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData) as LicenseResult
          resolve(parsed)
        } catch {
          reject(new Error(`Invalid response: ${responseData}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.write(bodyStr)
    req.end()
  })
}
