/**
 * Stamp Upload Service
 *
 * Allows the user to upload their own stamp images (fondo + sello) to the
 * cloud (S3) via presigned POST URLs, and to delete stamps.
 *
 * Upload flow (per stamp = 2 files):
 * 1. Validate inputs (year 2020-2100, stampName, exactly 2 files with the
 *    required suffixes -fondo.jpg / -sello.png, size 10KB-2MB).
 * 2. Get apiKey (config.json) + machineId.
 * 3. For each file: POST /api/stamps/upload-url → presigned POST → upload to S3.
 * 4. Caller triggers a normal sync afterwards to refresh the local DB.
 *
 * Delete flow:
 * 1. POST /api/stamps/delete-stamp with { apiKey, machineId, year, stampName }.
 */

import { readFileSync, statSync } from 'fs'
import { basename } from 'path'
import * as https from 'https'
import { URL } from 'url'

import { getUserConfig } from '../user-config'
import { getMachineId } from '../license/machine-id'

// ============================================================================
// Types
// ============================================================================

export interface UploadStampInput {
  year: string
  stampName: string
  fondoPath: string
  logoPath: string
}

export interface UploadStampResult {
  ok: boolean
  error?: string
  blocked?: boolean
}

export interface DeleteStampInput {
  year: string
  stampName: string
}

export interface DeleteStampResult {
  ok: boolean
  deleted?: number
  error?: string
  blocked?: boolean
}

interface PresignedPost {
  url: string
  fields: Record<string, string>
}

interface UploadUrlResponse {
  ok: boolean
  upload?: PresignedPost
  key?: string
  error?: string
  reason?: string
}

interface DeleteApiResponse {
  ok: boolean
  deleted?: number
  error?: string
  reason?: string
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = 'https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api'
const UPLOAD_URL_ENDPOINT = `${API_BASE}/stamps/upload-url`
const DELETE_ENDPOINT = `${API_BASE}/stamps/delete`

// Límites (deben coincidir con las Lambdas)
const MIN_BYTES = 3 * 1024 // 3 KB
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const MIN_YEAR = 2020
const MAX_YEAR = 2100

const FONDO_SUFFIX = '-fondo.jpg'
const SELLO_SUFFIX = '-sello.png'

// ============================================================================
// Validation (shared with the renderer's rules)
// ============================================================================

/**
 * Validates the year is a 4-digit number in [MIN_YEAR, MAX_YEAR].
 */
function validateYear(year: string): string | null {
  if (!/^\d{4}$/.test(year)) return 'El año debe ser un número de 4 dígitos'
  const n = Number(year)
  if (n < MIN_YEAR || n > MAX_YEAR) {
    return `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`
  }
  return null
}

/**
 * Validates the stamp name is non-empty and has no path separators.
 */
function validateStampName(stampName: string): string | null {
  if (!stampName || !stampName.trim()) return 'El nombre del sello es obligatorio'
  if (/[\\/]/.test(stampName)) return 'El nombre del sello no puede contener / ni \\'
  return null
}

/**
 * Validates that the two selected files meet the security rules:
 * exactly one *-fondo.jpg and one *-sello.png, each within size limits.
 * Returns an error message or null if valid.
 */
export function validateUploadFiles(fondoPath: string, logoPath: string): string | null {
  const fondoName = basename(fondoPath).toLowerCase()
  const logoName = basename(logoPath).toLowerCase()

  if (!fondoName.endsWith(FONDO_SUFFIX)) {
    return `El archivo de fondo debe terminar en "${FONDO_SUFFIX}"`
  }
  if (!logoName.endsWith(SELLO_SUFFIX)) {
    return `El archivo de sello debe terminar en "${SELLO_SUFFIX}"`
  }

  for (const [label, p] of [['fondo', fondoPath], ['sello', logoPath]] as const) {
    let size: number
    try {
      size = statSync(p).size
    } catch {
      return `No se pudo leer el archivo de ${label}`
    }
    if (size < MIN_BYTES) {
      return `El archivo de ${label} es demasiado pequeño (mínimo 3 KB)`
    }
    if (size > MAX_BYTES) {
      return `El archivo de ${label} supera el máximo de 2 MB`
    }
  }

  return null
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Uploads a stamp (fondo + sello) to the cloud via presigned POST URLs.
 * Does NOT update the local DB; the caller should trigger a sync afterwards.
 */
export async function uploadStamp(input: UploadStampInput): Promise<UploadStampResult> {
  const { year, stampName, fondoPath, logoPath } = input

  // Step 1: Validate inputs
  const yearErr = validateYear(year)
  if (yearErr) return { ok: false, error: yearErr }

  const nameErr = validateStampName(stampName)
  if (nameErr) return { ok: false, error: nameErr }

  const filesErr = validateUploadFiles(fondoPath, logoPath)
  if (filesErr) return { ok: false, error: filesErr }

  // Step 2: Credentials
  const config = getUserConfig()
  const apiKey = (config.license as { apiKey?: string })?.apiKey || ''
  const machineId = getMachineId()

  if (!apiKey) {
    return { ok: false, error: 'No se encontró apiKey en la configuración' }
  }

  // Step 3: Upload each file (fondo + sello)
  try {
    await uploadOneFile(apiKey, machineId, year, stampName, 'fondo', fondoPath)
    await uploadOneFile(apiKey, machineId, year, stampName, 'sello', logoPath)
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: 'AUTH_FAILED', blocked: true }
    }
    const message = err instanceof Error ? err.message : 'Error subiendo el sello'
    return { ok: false, error: message }
  }

  return { ok: true }
}

/**
 * Deletes a stamp from the cloud (S3 + catalog).
 * Does NOT update the local DB; the caller should trigger a sync afterwards.
 */
export async function deleteStamp(input: DeleteStampInput): Promise<DeleteStampResult> {
  const { year, stampName } = input

  const yearErr = validateYear(year)
  if (yearErr) return { ok: false, error: yearErr }
  const nameErr = validateStampName(stampName)
  if (nameErr) return { ok: false, error: nameErr }

  const config = getUserConfig()
  const apiKey = (config.license as { apiKey?: string })?.apiKey || ''
  const machineId = getMachineId()

  if (!apiKey) {
    return { ok: false, error: 'No se encontró apiKey en la configuración' }
  }

  let response: DeleteApiResponse
  try {
    response = await httpPostJson<DeleteApiResponse>(DELETE_ENDPOINT, {
      apiKey,
      machineId,
      year,
      stampName
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de conexión'
    return { ok: false, error: message }
  }

  if (!response.ok && response.error === 'AUTH_FAILED') {
    return { ok: false, error: 'AUTH_FAILED', blocked: true }
  }
  if (!response.ok) {
    return { ok: false, error: response.error || 'Error desconocido del servidor' }
  }

  return { ok: true, deleted: response.deleted ?? 0 }
}

// ============================================================================
// Internal: upload a single file via presigned POST
// ============================================================================

class AuthError extends Error {}

async function uploadOneFile(
  apiKey: string,
  machineId: string,
  year: string,
  stampName: string,
  fileType: 'fondo' | 'sello',
  filePath: string
): Promise<void> {
  // 1. Get presigned POST
  const presignedResp = await httpPostJson<UploadUrlResponse>(UPLOAD_URL_ENDPOINT, {
    apiKey,
    machineId,
    year,
    stampName,
    fileType
  })

  if (!presignedResp.ok && presignedResp.error === 'AUTH_FAILED') {
    throw new AuthError('AUTH_FAILED')
  }
  if (!presignedResp.ok || !presignedResp.upload) {
    throw new Error(presignedResp.reason || presignedResp.error || 'No se pudo obtener la URL de subida')
  }

  // 2. Upload the file to S3 with the presigned POST (multipart/form-data)
  const contentType = fileType === 'fondo' ? 'image/jpeg' : 'image/png'
  const fileBuffer = readFileSync(filePath)
  await postMultipartToS3(presignedResp.upload, fileBuffer, basename(filePath), contentType)
}

// ============================================================================
// Internal: HTTP helpers (same native https pattern as stamp-sync-service.ts)
// ============================================================================

function httpPostJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
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
          resolve(JSON.parse(responseData) as T)
        } catch {
          reject(new Error(`Respuesta inválida del servidor: ${responseData.slice(0, 200)}`))
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.write(bodyStr)
    req.end()
  })
}

/**
 * Uploads a file buffer to S3 using a presigned POST (multipart/form-data).
 * The presigned "fields" MUST be written before the "file" field, and the
 * file field must be last (S3 requirement).
 */
function postMultipartToS3(
  presigned: PresignedPost,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(presigned.url)
    const boundary = `----svvsFormBoundary${Date.now().toString(16)}`

    const parts: Buffer[] = []

    // Fields first, in order
    for (const [name, value] of Object.entries(presigned.fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
            `${value}\r\n`
        )
      )
    }

    // File field last
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: ${contentType}\r\n\r\n`
      )
    )
    parts.push(fileBuffer)
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

    const requestBody = Buffer.concat(parts)

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': requestBody.length
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => {
        responseData += chunk.toString()
      })
      res.on('end', () => {
        // S3 returns 2xx (usually 204) on success
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
        } else {
          reject(
            new Error(
              `S3 rechazó la subida (HTTP ${res.statusCode}). ${responseData.slice(0, 200)}`
            )
          )
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.write(requestBody)
    req.end()
  })
}
