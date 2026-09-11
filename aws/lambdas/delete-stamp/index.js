/**
 * Lambda: delete-stamp
 * Borra los archivos de un sello (la carpeta {username}/{year}/{stampName}/)
 * del usuario autenticado y su registro en el catálogo de DynamoDB.
 *
 * Flujo:
 * 1. Validar identidad (apiKey + machineId) usando Query sobre el GSI apiKey-index
 * 2. Validar entradas (year, stampName)
 * 3. Listar y borrar los objetos bajo el prefijo del usuario en S3
 * 4. Borrar el registro del catálogo (stampId = {year}#{stampName})
 */

const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand
} = require('@aws-sdk/client-dynamodb')

const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require('@aws-sdk/client-s3')

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
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
 * Lista todas las keys bajo un prefijo (paginando) y las borra en lotes.
 *
 * @param {string} bucket
 * @param {string} prefix
 * @returns {Promise<number>} número de objetos borrados
 */
async function deletePrefix(bucket, prefix) {
  let deleted = 0
  let continuationToken

  do {
    const listParams = { Bucket: bucket, Prefix: prefix }
    if (continuationToken) listParams.ContinuationToken = continuationToken

    const list = await s3.send(new ListObjectsV2Command(listParams))
    const objects = (list.Contents || []).map((o) => ({ Key: o.Key }))

    // DeleteObjects admite hasta 1000 keys por llamada
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects }
      }))
      deleted += objects.length
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (continuationToken)

  return deleted
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
    const { apiKey, machineId, year, stampName } = body

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

    // --- Autenticación ---

    const username = await authenticate(apiKey, machineId)
    if (!username) {
      return resp(401, {
        ok: false,
        error: 'AUTH_FAILED',
        reason: 'Credenciales inválidas'
      })
    }

    // --- Borrado ---
    // El prefijo se deriva SIEMPRE del username autenticado → aislamiento garantizado.
    const bucket = process.env.STAMPS_BUCKET
    const prefix = `${username}/${year}/${stampName}/`

    const deleted = await deletePrefix(bucket, prefix)

    // Borrar el registro del catálogo (stampId = {year}#{stampName})
    await dynamo.send(new DeleteItemCommand({
      TableName: process.env.STAMP_CATALOG_TABLE,
      Key: {
        username: { S: username },
        stampId: { S: `${year}#${stampName}` }
      }
    }))

    return resp(200, {
      ok: true,
      deleted,
      stampId: `${year}#${stampName}`
    })
  } catch (err) {
    console.error('delete-stamp error:', err)
    return resp(500, {
      ok: false,
      error: 'INTERNAL_ERROR',
      reason: 'Error interno del servidor'
    })
  }
}
