/**
 * Lambda: upload-url
 * Genera una presigned POST URL para que el cliente suba UN archivo de sello
 * (fondo o sello) directamente a S3, con tamaño/tipo/prefijo forzados del lado
 * servidor.
 *
 * Flujo:
 * 1. Validar identidad (apiKey + machineId) usando Query sobre el GSI apiKey-index
 * 2. Validar entradas (year, stampName, fileType)
 * 3. (Opcional) Comprobar cuota de sellos del usuario
 * 4. Generar presigned POST URL acotada (tamaño, tipo y key derivada del usuario)
 */

const {
  DynamoDBClient,
  QueryCommand
} = require('@aws-sdk/client-dynamodb')

const { S3Client } = require('@aws-sdk/client-s3')
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post')

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

// Límites de coste/seguridad
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB por archivo
const MIN_BYTES = 3 * 1024 // 3 KB
const MAX_STAMPS_PER_USER = 500 // límite de negocio (nº de sellos distintos)
const PRESIGN_EXPIRY_SECONDS = 60

// Mapa de tipo de archivo → sufijo y content-type esperado
const FILE_TYPES = {
  fondo: { suffix: '-fondo.jpg', contentType: 'image/jpeg' },
  sello: { suffix: '-sello.png', contentType: 'image/png' }
}

/**
 * Valida al usuario por apiKey (Query sobre el GSI) y comprueba que el
 * machineId está registrado en activeMachines.
 *
 * @param {string} apiKey
 * @param {string} machineId
 * @returns {Promise<string|null>} username si es válido, null si no
 */
async function authenticate(apiKey, machineId) {
  const res = await dynamo.send(new QueryCommand({
    TableName: process.env.USERS_TABLE,
    IndexName: 'apiKey-index',
    KeyConditionExpression: 'apiKey = :k',
    ExpressionAttributeValues: {
      ':k': { S: apiKey }
    }
  }))

  if (!res.Items || res.Items.length === 0) return null

  const user = res.Items[0]
  const machines = user.activeMachines?.L || []
  const registered = machines.some((m) => m.M?.machineId?.S === machineId)
  if (!registered) return null

  return user.username?.S || null
}

/**
 * Cuenta cuántos sellos distintos tiene el usuario en el catálogo.
 *
 * @param {string} username
 * @returns {Promise<number>}
 */
async function countUserStamps(username) {
  let count = 0
  let lastEvaluatedKey

  do {
    const params = {
      TableName: process.env.STAMP_CATALOG_TABLE,
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: { ':u': { S: username } },
      Select: 'COUNT'
    }
    if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey

    const res = await dynamo.send(new QueryCommand(params))
    count += res.Count || 0
    lastEvaluatedKey = res.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return count
}

function resp(statusCode, obj) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(obj) }
}

exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { apiKey, machineId, year, stampName, fileType } = body

    // --- Validación de entradas ---

    if (!apiKey || !machineId) {
      return resp(401, {
        ok: false,
        error: 'AUTH_FAILED',
        reason: 'apiKey y machineId son requeridos'
      })
    }

    if (!/^\d{4}$/.test(year || '')) {
      return resp(400, {
        ok: false,
        error: 'BAD_INPUT',
        reason: 'year debe ser un número de 4 dígitos'
      })
    }

    // stampName no puede contener separadores de ruta (evita escapar del prefijo)
    if (!stampName || /[\\/]/.test(stampName)) {
      return resp(400, {
        ok: false,
        error: 'BAD_INPUT',
        reason: 'stampName inválido'
      })
    }

    const cfg = FILE_TYPES[fileType]
    if (!cfg) {
      return resp(400, {
        ok: false,
        error: 'BAD_INPUT',
        reason: "fileType debe ser 'fondo' o 'sello'"
      })
    }

    // --- Autenticación ---

    const username = await authenticate(apiKey, machineId)
    if (!username) {
      return resp(401, {
        ok: false,
        error: 'AUTH_FAILED',
        reason: 'Credenciales inválidas'
      })
    }

    // --- Cuota de negocio ---
    // Solo bloquea si el sello es NUEVO y ya se alcanzó el máximo.
    const stampId = `${year}#${stampName}`
    const existing = await dynamo.send(new QueryCommand({
      TableName: process.env.STAMP_CATALOG_TABLE,
      KeyConditionExpression: 'username = :u AND stampId = :s',
      ExpressionAttributeValues: {
        ':u': { S: username },
        ':s': { S: stampId }
      },
      Select: 'COUNT'
    }))

    if ((existing.Count || 0) === 0) {
      const total = await countUserStamps(username)
      if (total >= MAX_STAMPS_PER_USER) {
        return resp(403, {
          ok: false,
          error: 'QUOTA_EXCEEDED',
          reason: `Límite de ${MAX_STAMPS_PER_USER} sellos alcanzado`
        })
      }
    }

    // --- Generar presigned POST ---
    // La KEY se deriva SIEMPRE del username autenticado, nunca de un input libre.
    const key = `${username}/${year}/${stampName}/${stampName}${cfg.suffix}`

    const presigned = await createPresignedPost(s3, {
      Bucket: process.env.STAMPS_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', MIN_BYTES, MAX_BYTES],
        ['eq', '$Content-Type', cfg.contentType]
      ],
      Fields: {
        'Content-Type': cfg.contentType
      },
      Expires: PRESIGN_EXPIRY_SECONDS
    })

    return resp(200, {
      ok: true,
      upload: presigned, // { url, fields }
      key,
      constraints: {
        minBytes: MIN_BYTES,
        maxBytes: MAX_BYTES,
        contentType: cfg.contentType,
        expiresIn: PRESIGN_EXPIRY_SECONDS
      }
    })
  } catch (err) {
    console.error('upload-url error:', err)
    return resp(500, {
      ok: false,
      error: 'INTERNAL_ERROR',
      reason: 'Error interno del servidor'
    })
  }
}
