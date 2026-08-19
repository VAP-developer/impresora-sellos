/**
 * Lambda: sync-stamps
 * Sincroniza la base de datos de sellos desde S3/DynamoDB
 * con los clientes de SvvS Kiosko.
 *
 * Flujo:
 * 1. Verificar identidad (apiKey + machineId)
 * 2. Escanear bucket S3 del usuario (tarea 2.3)
 * 3. Sincronizar con DynamoDB (tarea 2.4)
 * 4. Generar presigned URLs y responder (tarea 2.5)
 */

const {
  DynamoDBClient,
  ScanCommand,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand
} = require('@aws-sdk/client-dynamodb')

const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} = require('@aws-sdk/client-s3')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

/**
 * Escanea el bucket S3 del usuario y devuelve un array de objetos sello
 * con información de completitud (fondo + logo).
 *
 * @param {string} username - Nombre de usuario cuya carpeta escanear
 * @returns {Promise<Array>} Array de objetos sello con stampId, year, stampName, fondoKey, logoKey, status
 */
async function scanUserBucket(username) {
  const bucket = process.env.STAMPS_BUCKET
  const prefix = `${username}/`
  const allKeys = []

  // Paginar ListObjectsV2 para obtener todas las keys del usuario
  let continuationToken = undefined
  do {
    const params = {
      Bucket: bucket,
      Prefix: prefix
    }
    if (continuationToken) {
      params.ContinuationToken = continuationToken
    }

    const response = await s3.send(new ListObjectsV2Command(params))

    if (response.Contents) {
      for (const obj of response.Contents) {
        allKeys.push(obj.Key)
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  // Agrupar archivos por {year}#{stampName}
  // Estructura esperada: {username}/{year}/{stampName}/{stampName}-fondo.jpg
  //                       {username}/{year}/{stampName}/{stampName}-sello.png
  const groups = {}

  for (const key of allKeys) {
    // Remover el prefix del username
    const relativePath = key.slice(prefix.length)
    const parts = relativePath.split('/')

    // Esperamos al menos 3 partes: year/stampName/archivo
    if (parts.length < 3) continue

    const year = parts[0]
    const stampName = parts[1]
    const fileName = parts[parts.length - 1]

    // Validar que year sea un número de 4 dígitos
    if (!/^\d{4}$/.test(year)) continue

    const groupKey = `${year}#${stampName}`

    if (!groups[groupKey]) {
      groups[groupKey] = {
        stampId: groupKey,
        year,
        stampName,
        fondoKey: null,
        logoKey: null
      }
    }

    // Detectar tipo de archivo por sufijo
    if (fileName.endsWith('-fondo.jpg')) {
      groups[groupKey].fondoKey = key
    } else if (fileName.endsWith('-sello.png')) {
      groups[groupKey].logoKey = key
    }
  }

  // Convertir a array y determinar status
  const stamps = Object.values(groups).map((group) => ({
    ...group,
    status: group.fondoKey && group.logoKey ? 'complete' : 'incomplete'
  }))

  return stamps
}

/**
 * Sincroniza los sellos detectados en S3 con los registros en DynamoDB.
 * Detecta altas (nuevos en S3), bajas (eliminados de S3) y modificaciones.
 *
 * @param {string} username - Nombre de usuario
 * @param {Array} s3Stamps - Array de sellos escaneados desde S3
 * @returns {Promise<{added: number, removed: number, existing: number}>} Resumen de la sincronización
 */
async function syncWithDynamoDB(username, s3Stamps) {
  const tableName = process.env.STAMP_CATALOG_TABLE
  const now = new Date().toISOString()

  // 1. Query de todos los registros existentes del usuario en DynamoDB
  const existingItems = []
  let lastEvaluatedKey = undefined

  do {
    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: {
        ':u': { S: username }
      }
    }
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey
    }

    const queryResult = await dynamo.send(new QueryCommand(queryParams))

    if (queryResult.Items) {
      existingItems.push(...queryResult.Items)
    }

    lastEvaluatedKey = queryResult.LastEvaluatedKey
  } while (lastEvaluatedKey)

  // 2. Crear un mapa de registros existentes por stampId
  const existingMap = {}
  for (const item of existingItems) {
    const stampId = item.stampId?.S
    if (stampId) {
      existingMap[stampId] = item
    }
  }

  // 3. Crear un mapa de sellos de S3 por stampId
  const s3Map = {}
  for (const stamp of s3Stamps) {
    s3Map[stamp.stampId] = stamp
  }

  let added = 0
  let removed = 0
  let existing = 0

  // 4. Detectar altas: sellos en S3 que no están en DynamoDB → PutItem
  for (const stamp of s3Stamps) {
    if (!existingMap[stamp.stampId]) {
      // Nuevo sello: crear registro
      await dynamo.send(new PutItemCommand({
        TableName: tableName,
        Item: {
          username: { S: username },
          stampId: { S: stamp.stampId },
          year: { S: stamp.year },
          stampName: { S: stamp.stampName },
          fondoKey: { S: stamp.fondoKey || '' },
          logoKey: { S: stamp.logoKey || '' },
          status: { S: stamp.status },
          createdAt: { S: now },
          updatedAt: { S: now }
        }
      }))
      added++
    } else {
      // Sello existente: comprobar si ha cambiado (fondoKey, logoKey o status)
      const dbItem = existingMap[stamp.stampId]
      const dbFondoKey = dbItem.fondoKey?.S || ''
      const dbLogoKey = dbItem.logoKey?.S || ''
      const dbStatus = dbItem.status?.S || ''

      const s3FondoKey = stamp.fondoKey || ''
      const s3LogoKey = stamp.logoKey || ''
      const s3Status = stamp.status || ''

      if (dbFondoKey !== s3FondoKey || dbLogoKey !== s3LogoKey || dbStatus !== s3Status) {
        // Algo cambió: actualizar registro completo con nuevo updatedAt
        await dynamo.send(new PutItemCommand({
          TableName: tableName,
          Item: {
            username: { S: username },
            stampId: { S: stamp.stampId },
            year: { S: stamp.year },
            stampName: { S: stamp.stampName },
            fondoKey: { S: s3FondoKey },
            logoKey: { S: s3LogoKey },
            status: { S: s3Status },
            createdAt: { S: dbItem.createdAt?.S || now },
            updatedAt: { S: now }
          }
        }))
      }
      existing++
    }
  }

  // 5. Detectar bajas: registros en DynamoDB sin carpeta en S3 → DeleteItem
  for (const stampId of Object.keys(existingMap)) {
    if (!s3Map[stampId]) {
      await dynamo.send(new DeleteItemCommand({
        TableName: tableName,
        Key: {
          username: { S: username },
          stampId: { S: stampId }
        }
      }))
      removed++
    }
  }

  return { added, removed, existing }
}

/**
 * Genera el catálogo con presigned URLs para cada sello.
 * Los sellos completos obtienen URLs tanto para fondo como para logo.
 * Los sellos incompletos tendrán null en los campos que falten.
 *
 * @param {Array} stamps - Array de sellos escaneados desde S3
 * @returns {Promise<Array>} Catálogo con presigned URLs
 */
async function generatePresignedCatalog(stamps) {
  const bucket = process.env.STAMPS_BUCKET
  const catalog = []

  for (const stamp of stamps) {
    const entry = {
      stampId: stamp.stampId,
      year: stamp.year,
      stampName: stamp.stampName,
      fondoUrl: null,
      logoUrl: null,
      status: stamp.status
    }

    if (stamp.fondoKey) {
      entry.fondoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: stamp.fondoKey }),
        { expiresIn: 300 }
      )
    }

    if (stamp.logoKey) {
      entry.logoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: stamp.logoKey }),
        { expiresIn: 300 }
      )
    }

    catalog.push(entry)
  }

  return catalog
}

exports.handler = async (event) => {
  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: ''
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { apiKey, machineId } = body

    // --- Verificación de identidad ---

    if (!apiKey) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'AUTH_FAILED',
          reason: 'apiKey es requerido'
        })
      }
    }

    if (!machineId) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'AUTH_FAILED',
          reason: 'machineId es requerido'
        })
      }
    }

    // Buscar usuario por apiKey en la tabla de usuarios
    const scanResult = await dynamo.send(new ScanCommand({
      TableName: process.env.USERS_TABLE,
      FilterExpression: 'apiKey = :key',
      ExpressionAttributeValues: {
        ':key': { S: apiKey }
      }
    }))

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'AUTH_FAILED',
          reason: 'API Key inválida'
        })
      }
    }

    const userItem = scanResult.Items[0]
    const username = userItem.username?.S || 'unknown'
    const activeMachines = userItem.activeMachines?.L || []

    // Verificar que el machineId está registrado en activeMachines
    const machineRegistered = activeMachines.some(
      (m) => m.M?.machineId?.S === machineId
    )

    if (!machineRegistered) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'AUTH_FAILED',
          reason: 'machineId no registrado para este usuario'
        })
      }
    }

    // --- Verificación exitosa ---
    // Escanear bucket S3 del usuario
    const stamps = await scanUserBucket(username)

    // Sincronizar con DynamoDB (detectar altas, bajas y modificaciones)
    const syncResult = await syncWithDynamoDB(username, stamps)

    // Generar presigned URLs y construir respuesta final
    const catalog = await generatePresignedCatalog(stamps)

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        catalog,
        summary: {
          total: stamps.length,
          added: syncResult.added,
          removed: syncResult.removed
        }
      })
    }
  } catch (error) {
    console.error('sync-stamps error:', error)
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'INTERNAL_ERROR',
        reason: 'Error interno del servidor'
      })
    }
  }
}
