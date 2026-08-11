const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider')

const {
  DynamoDBClient,
  GetItemCommand
} = require('@aws-sdk/client-dynamodb')

const cognito = new CognitoIdentityProviderClient({})
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
    const { username, password } = body

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Se requiere username y password' })
      }
    }

    // Autenticar contra Cognito
    const authResult = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    }))

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

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        success: true,
        token: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        user: {
          username,
          displayName,
          welcomeMessage
        }
      })
    }
  } catch (error) {
    console.error('Login error:', error)

    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Usuario o contraseña incorrectos' })
      }
    }

    if (error.name === 'UserNotConfirmedException') {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Usuario no confirmado' })
      }
    }

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    }
  }
}
