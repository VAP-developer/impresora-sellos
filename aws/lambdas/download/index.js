const {
  CognitoIdentityProviderClient,
  GetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider')

const {
  DynamoDBClient,
  GetItemCommand
} = require('@aws-sdk/client-dynamodb')

const {
  S3Client,
  GetObjectCommand
} = require('@aws-sdk/client-s3')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const cognito = new CognitoIdentityProviderClient({})
const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
}

exports.handler = async (event) => {
  try {
    // Extraer token del header Authorization o del query parameter
    const authHeader = event.headers?.Authorization || event.headers?.authorization || ''
    const queryToken = event.queryStringParameters?.token || ''
    const token = authHeader.replace('Bearer ', '') || queryToken

    if (!token) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Token de autorización requerido' })
      }
    }

    // Validar token contra Cognito y obtener username
    let username
    try {
      const userInfo = await cognito.send(new GetUserCommand({
        AccessToken: token
      }))
      username = userInfo.Username
    } catch (err) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Token inválido o expirado' })
      }
    }

    // Obtener datos del usuario desde DynamoDB
    const userData = await dynamo.send(new GetItemCommand({
      TableName: process.env.USERS_TABLE,
      Key: {
        username: { S: username }
      }
    }))

    const item = userData.Item || {}
    const displayName = item.displayName?.S || username
    const welcomeMessage = item.welcomeMessage?.S || `Bienvenido ${displayName}`

    // Generar config.json para este usuario
    const config = {
      version: 1,
      user: {
        id: item.userId?.S || `usr_${username}`,
        username: username,
        displayName: displayName
      },
      app: {
        welcomeMessage: welcomeMessage
      },
      license: {
        apiKey: item.apiKey?.S || '',
        maxMachines: parseInt(item.maxMachines?.N || '1', 10),
        isAdmin: item.isAdmin?.BOOL || false
      },
      database: {
        // Se poblará en Fase 3
      }
    }

    // Generar presigned URL para descargar el .exe desde S3
    const exeUrl = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.RELEASES_BUCKET,
      Key: 'releases/latest/svvs-app.exe'
    }), { expiresIn: 600 }) // 10 minutos

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        success: true,
        config: config,
        downloadUrl: exeUrl,
        fileName: 'svvs-app.exe'
      })
    }
  } catch (error) {
    console.error('Download error:', error)

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    }
  }
}
