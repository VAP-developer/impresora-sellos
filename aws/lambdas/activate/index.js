const {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  ScanCommand
} = require('@aws-sdk/client-dynamodb')

const dynamo = new DynamoDBClient({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const { machineId, apiKey } = body

    if (!apiKey) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'apiKey es requerido' })
      }
    }

    if (!machineId) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'machineId es requerido' })
      }
    }

    // Buscar usuario por apiKey en DynamoDB
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
        body: JSON.stringify({ ok: false, error: 'API Key inválida' })
      }
    }

    const item = scanResult.Items[0]
    const username = item.username?.S || 'unknown'
    const isAdmin = item.isAdmin?.BOOL || false
    const maxMachines = parseInt(item.maxMachines?.N || '1', 10)
    const activeMachines = item.activeMachines?.L || []

    // Admin: siempre permitido
    if (isAdmin) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          ok: true,
          message: 'Licencia activa (admin)',
          isAdmin: true,
          activeMachines: activeMachines.length,
          maxMachines: maxMachines
        })
      }
    }

    // Comprobar si esta máquina ya está registrada
    const alreadyActive = activeMachines.some(
      (m) => m.M?.machineId?.S === machineId
    )

    if (alreadyActive) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          ok: true,
          message: 'Licencia activa (máquina ya registrada)',
          activeMachines: activeMachines.length,
          maxMachines: maxMachines
        })
      }
    }

    // Comprobar si hay slots disponibles
    if (activeMachines.length >= maxMachines) {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: `Licencia agotada. Máximo ${maxMachines} dispositivo(s). Contacta con soporte para liberar un slot.`,
          activeMachines: activeMachines.length,
          maxMachines: maxMachines
        })
      }
    }

    // Registrar la nueva máquina
    const now = new Date().toISOString()
    await dynamo.send(new UpdateItemCommand({
      TableName: process.env.USERS_TABLE,
      Key: { username: { S: username } },
      UpdateExpression: 'SET activeMachines = list_append(if_not_exists(activeMachines, :empty), :newMachine)',
      ExpressionAttributeValues: {
        ':empty': { L: [] },
        ':newMachine': {
          L: [{
            M: {
              machineId: { S: machineId },
              activatedAt: { S: now }
            }
          }]
        }
      }
    }))

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        message: 'Licencia activada correctamente',
        activeMachines: activeMachines.length + 1,
        maxMachines: maxMachines
      })
    }
  } catch (error) {
    console.error('Activate error:', error)
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, error: 'Error interno del servidor' })
    }
  }
}
