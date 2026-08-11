const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
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

    // Buscar usuario por apiKey
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
    const activeMachines = item.activeMachines?.L || []

    // Filtrar la máquina a desactivar
    const updatedMachines = activeMachines.filter(
      (m) => m.M?.machineId?.S !== machineId
    )

    if (updatedMachines.length === activeMachines.length) {
      return {
        statusCode: 404,
        headers: HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'Esta máquina no está registrada en tu licencia'
        })
      }
    }

    // Guardar la lista actualizada
    const updatedItem = { ...item }
    updatedItem.activeMachines = { L: updatedMachines }

    await dynamo.send(new PutItemCommand({
      TableName: process.env.USERS_TABLE,
      Item: updatedItem
    }))

    const maxMachines = parseInt(item.maxMachines?.N || '1', 10)

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        message: 'Equipo desactivado. Slot liberado.',
        activeMachines: updatedMachines.length,
        maxMachines: maxMachines
      })
    }
  } catch (error) {
    console.error('Deactivate error:', error)
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, error: 'Error interno del servidor' })
    }
  }
}
