# Autoservicio de sellos: subida y borrado por el cliente

Documento de diseño y análisis previo. Describe cómo permitir que los clientes suban y eliminen ellos mismos las imágenes de fondo y sello al bucket `svvs-kiosko-stamps`, actualizando el catálogo en DynamoDB, y qué límites de coste y seguridad conviene aplicar antes de implementarlo.

> Estado: **propuesta / no implementado**. Este documento no cambia la infraestructura; sirve para decidir el enfoque.

---

## 1. Punto de partida (cómo funciona hoy)

Actualmente la subida de sellos es una **operación manual del administrador**:

- El admin usa `aws/scripts/upload-stamps.ps1` (AWS CLI) para copiar los `.jpg`/`.png` al bucket.
- La estructura en S3 es `{username}/{año}/{nombre-sello}/{nombre}-fondo.jpg` y `...-sello.png`.
- El cliente solo hace **lectura** mediante `POST /api/stamps/sync` (Lambda `sync-stamps`):
  - Se identifica con `apiKey` + `machineId`.
  - La Lambda busca al usuario en `svvs-kiosko-users` con un `Scan` + `FilterExpression` sobre `apiKey`.
  - Escanea el prefijo `{username}/` en S3, sincroniza el catálogo en `svvs-kiosko-stamp-catalog` y devuelve presigned URLs de **lectura** (`GetObject`, expiran en 5 min).
- El rol `LambdaExecutionRole` ya tiene sobre el bucket de sellos: `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`.

Lo que se quiere añadir: que el **cliente** pueda **subir** y **borrar** sus propios sellos desde la app, y que el catálogo se actualice en consecuencia.

---

## 2. Análisis de coste

### 2.1. Precios de referencia (región `eu-west-1`, aproximados)

Precios orientativos según la [tarifa pública de Amazon S3](https://aws.amazon.com/s3/pricing/) y [DynamoDB](https://aws.amazon.com/dynamodb/pricing/on-demand/). Contenido reformulado para cumplir con las restricciones de licencia.

| Concepto | Coste aproximado |
|----------|------------------|
| S3 PUT / POST / LIST | ~0,0054 USD por cada 1.000 peticiones |
| S3 GET | ~0,00043 USD por cada 1.000 peticiones |
| S3 DELETE | gratis |
| Almacenamiento S3 | ~0,024 USD por GB/mes |
| Transferencia de salida (egress) a Internet | ~0,09 USD por GB |
| DynamoDB escritura (on-demand) | ~1,25 USD por millón de escrituras |
| DynamoDB lectura (on-demand) | ~0,25 USD por millón de lecturas |
| Lambda + API Gateway | fracciones de céntimo a este volumen |

### 2.2. Escenario realista

Supongamos 50 usuarios, cada uno cambiando 10 sellos al día (cada sello = 2 archivos → 2 PUT + operaciones en DynamoDB), durante 30 días:

- S3 PUT: 50 × 10 × 2 × 30 = 30.000 PUT/mes → **~0,16 USD**
- Sincronizaciones (`sync-stamps`): LIST + GET + escrituras en DynamoDB → **céntimos**
- Almacenamiento: imágenes de cientos de KB → **muy por debajo de 1 USD/mes**
- **Total en uso normal: sigue siendo del orden de 1-2 USD/mes.**

**Conclusión: en condiciones normales, el coste es prácticamente irrelevante.** El coste no es el riesgo principal.

### 2.3. Dónde SÍ se dispara el coste (el riesgo real)

El peligro no es el uso normal, sino el **abuso o el fallo**:

1. **Archivos enormes**: si la subida no limita el tamaño, un cliente (o una `apiKey` filtrada) puede subir ficheros de varios GB. Coste de almacenamiento + transferencia se disparan.
2. **Bucle infinito en el cliente**: un reintento mal controlado puede generar miles de PUT/GET y sincronizaciones.
3. **Uso del bucket como CDN**: el egress (~0,09 USD/GB) es de lo más caro de AWS. Si alguien descarga masivamente, ahí se va la factura.
4. **Scan de DynamoDB en cada petición**: la Lambda `sync-stamps` hace un `Scan` de toda la tabla de usuarios para validar la `apiKey`. Con escritura de por medio y más tráfico, ese coste y esa latencia crecen con el número de usuarios.

---

## 3. Límites propuestos para controlar el gasto

En orden de prioridad:

### 3.1. Presigned POST URLs para subir (lo más importante)

No dar credenciales de escritura al cliente. En su lugar, una Lambda genera una **presigned POST URL** con condiciones embebidas del lado servidor:

- `content-length-range`: p. ej. 3 KB – 2 MB. **Fija el tamaño máximo por archivo**; el cliente no puede saltárselo.
- `Content-Type` restringido a `image/jpeg` / `image/png`.
- Expiración corta (60–120 s).
- Key **forzada** al prefijo del usuario autenticado (`{username}/{año}/{nombre}/...`), nunca derivada de un parámetro libre del cliente.

Con esto el coste por archivo está acotado por diseño y el cliente nunca tiene un permiso genérico sobre el bucket.

### 3.2. Rate limiting en API Gateway (Usage Plans)

Configurar **Usage Plan + throttling**:

- `RateLimit` (p. ej. 5 req/s) y `BurstLimit` (p. ej. 10).
- **Cuota diaria por usuario** (p. ej. 100 peticiones/día) usando API keys de API Gateway.

Esto corta de raíz el bucle infinito y el abuso por volumen de peticiones.

### 3.3. AWS Budgets con alertas

Crear un presupuesto (p. ej. 10 USD/mes) con alertas por email al 50 / 80 / 100 %. No frena el gasto, pero avisa antes de que escale. Es gratis.

### 3.4. Límites lógicos de negocio

- Máximo de sellos por usuario (p. ej. N), validado en la Lambda antes de emitir la presigned URL (consultando el catálogo en DynamoDB).
- Regla de **lifecycle** en el bucket para limpiar subidas multipart incompletas.

### 3.5. WAF / CloudFront (opcional, solo si crece)

Con el volumen actual no es necesario. Si se abre a muchos usuarios, AWS WAF con reglas basadas en rate añade una capa extra contra abuso masivo.

---

## 4. Seguridad y permisos

Puntos a revisar **antes** de dar capacidad de escritura/borrado:

### 4.1. La `apiKey` se valida con `Scan` (mejorar a GSI)

Hoy `sync-stamps` busca al usuario con `ScanCommand` + `FilterExpression` sobre `apiKey`, lo que lee **toda la tabla** en cada petición. Recomendación: crear un **GSI sobre `apiKey`** en `svvs-kiosko-users` y usar `Query`. Con más operaciones de por medio, esto pasa de "mejorable" a "importante" (coste, latencia y escalabilidad).

### 4.2. La `apiKey` es un secreto de larga duración

Viaja en el body y no rota. Si se filtra, permite subir/borrar en nombre del usuario. Mitigaciones:

- Mantener la validación `apiKey` + `machineId` (ya existe).
- Valorar migrar la autorización de estos endpoints a **tokens de Cognito** (JWT de corta duración), aprovechando que Cognito ya está desplegado.

### 4.3. Aislamiento entre usuarios (crítico)

La Lambda debe **derivar el prefijo `{username}/` de la identidad verificada**, nunca de un parámetro enviado por el cliente. Esto aplica tanto a subida como a borrado. Si el cliente pudiera indicar la ruta, un usuario podría escribir/borrar en la carpeta de otro.

### 4.4. Borrado controlado por Lambda (no dar `DeleteObject` al cliente)

El borrado en S3 es gratis, así que no hay motivo de coste para exponerlo. Que el cliente llame a un endpoint (`POST /api/stamps/delete`), la Lambda valide identidad + propiedad del prefijo y borre ella. Así se mantiene control y se puede registrar auditoría.

### 4.5. Ajuste del rol IAM

El rol actual permite `PutObject` en todo el bucket de sellos, lo cual es aceptable porque **la Lambda es la confianza**. La clave es que las condiciones (tamaño, tipo, prefijo) vayan **embebidas en la presigned URL**, no confiando únicamente en el rol. Para el borrado, añadir `s3:DeleteObject` al rol de la Lambda (no al cliente).

---

## 5. Arquitectura propuesta

Encaja con lo que ya existe (misma tabla, mismo bucket, mismo patrón de identidad):

```
1. POST /api/stamps/upload-url
   → Lambda valida identidad (apiKey + machineId)
   → comprueba cuota (nº de sellos del usuario)
   → devuelve presigned POST URL acotada (tamaño/tipo/prefijo, expira 60 s)

2. El cliente sube directamente a S3 con esa URL
   (el binario no pasa por Lambda → no se paga ni se satura Lambda)

3. POST /api/stamps/sync   (ya existe)
   → reconstruye el catálogo en DynamoDB y devuelve presigned URLs de lectura

4. POST /api/stamps/delete
   → Lambda valida identidad + propiedad del prefijo → borra en S3 → actualiza catálogo

   Todo detrás de un Usage Plan (throttling + cuota diaria) + Budget con alertas.
```

Ventajas:

- Coste acotado por diseño (tamaño máximo por archivo + cuota de peticiones).
- Aislamiento por usuario garantizado en servidor.
- Sin credenciales S3 en el cliente.

---

## 6. Cambios que implicaría en la infraestructura

Cuando se decida implementar, estos son los puntos a tocar (referencia, no ejecutado aún):

- **`template.yml`**:
  - Nuevas Lambdas `upload-url` y `delete-stamp` (+ recursos, métodos y permisos en API Gateway).
  - `s3:DeleteObject` en la política `S3StampsAccess` del rol.
  - GSI sobre `apiKey` en `UsersTable`.
  - Usage Plan + API keys + throttling en el stage `prod`.
  - Configuración CORS del bucket para permitir POST directo desde la web/app.
- **AWS Budgets**: presupuesto con alertas (se puede crear fuera del stack o añadir como recurso `AWS::Budgets::Budget`).
- **App cliente**: llamar a `upload-url`, subir a S3, y luego `sync`; y flujo de borrado vía `delete`.

---

## 7. Pasos para construir la arquitectura

Guía de implementación paso a paso. Sigue los mismos patrones que ya existen en el proyecto (validación `apiKey` + `machineId`, empaquetado con `Compress-Archive`, despliegue con `aws lambda update-function-code`).

> **Orden recomendado**: primero el GSI y las políticas IAM (paso 1-2), luego el código de las Lambdas (paso 3-4), después el `template.yml` de API Gateway (paso 5), el Usage Plan y CORS (paso 6-7), y por último el Budget (paso 8) y la app cliente (paso 9).

### [x] - Paso 1: Añadir el GSI sobre `apiKey` en la tabla de usuarios

Para dejar de escanear toda la tabla en cada petición. En `template.yml`, dentro de `UsersTable`:

```yaml
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub '${ProjectName}-users'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: username
          AttributeType: S
        - AttributeName: apiKey          # nuevo
          AttributeType: S               # nuevo
      KeySchema:
        - AttributeName: username
          KeyType: HASH
      GlobalSecondaryIndexes:            # nuevo
        - IndexName: apiKey-index
          KeySchema:
            - AttributeName: apiKey
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      Tags:
        - Key: Project
          Value: !Ref ProjectName
```

Con esto, las Lambdas pueden usar `QueryCommand` sobre `apiKey-index` en lugar de `ScanCommand`.

### [x] - Paso 2: Ampliar la política IAM del rol de Lambda

En `LambdaExecutionRole`, añadir permiso de borrado en S3 y de consulta al GSI:

```yaml
        - PolicyName: S3StampsAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:ListBucket
                Resource: !GetAtt StampsBucket.Arn
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                  - s3:DeleteObject          # nuevo (para el borrado)
                Resource: !Sub '${StampsBucket.Arn}/*'
        - PolicyName: DynamoDBAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:Query
                  - dynamodb:PutItem
                  - dynamodb:UpdateItem
                  - dynamodb:Scan
                Resource:
                  - !GetAtt UsersTable.Arn
                  - !Sub '${UsersTable.Arn}/index/apiKey-index'   # nuevo (consultar el GSI)
```

### [x] - Paso 3: Crear la Lambda `upload-url`

Genera una presigned POST URL acotada. Crea `aws/lambdas/upload-url/index.js`:

```javascript
/**
 * Lambda: upload-url
 * Genera una presigned POST URL para que el cliente suba UN archivo de sello
 * directamente a S3, con tamaño/tipo/prefijo forzados del lado servidor.
 */
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb')
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

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB por archivo
const MIN_BYTES = 3 * 1024        // 3 KB
const MAX_STAMPS_PER_USER = 500   // límite de negocio

// Valida usuario por apiKey (Query al GSI) + machineId registrado
async function authenticate(apiKey, machineId) {
  const res = await dynamo.send(new QueryCommand({
    TableName: process.env.USERS_TABLE,
    IndexName: 'apiKey-index',
    KeyConditionExpression: 'apiKey = :k',
    ExpressionAttributeValues: { ':k': { S: apiKey } }
  }))
  if (!res.Items || res.Items.length === 0) return null
  const user = res.Items[0]
  const machines = user.activeMachines?.L || []
  const ok = machines.some((m) => m.M?.machineId?.S === machineId)
  if (!ok) return null
  return user.username?.S || null
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' }
  }
  try {
    const body = JSON.parse(event.body || '{}')
    const { apiKey, machineId, year, stampName, fileType } = body

    if (!apiKey || !machineId) {
      return resp(401, { ok: false, error: 'AUTH_FAILED', reason: 'apiKey y machineId requeridos' })
    }
    // Validar entradas del catálogo
    if (!/^\d{4}$/.test(year || '')) {
      return resp(400, { ok: false, error: 'BAD_INPUT', reason: 'year debe ser 4 dígitos' })
    }
    if (!stampName || /[\\/]/.test(stampName)) {
      return resp(400, { ok: false, error: 'BAD_INPUT', reason: 'stampName inválido' })
    }
    // fileType: 'fondo' (jpg) o 'sello' (png)
    const map = {
      fondo: { suffix: '-fondo.jpg', contentType: 'image/jpeg' },
      sello: { suffix: '-sello.png', contentType: 'image/png' }
    }
    const cfg = map[fileType]
    if (!cfg) {
      return resp(400, { ok: false, error: 'BAD_INPUT', reason: 'fileType debe ser fondo o sello' })
    }

    const username = await authenticate(apiKey, machineId)
    if (!username) {
      return resp(401, { ok: false, error: 'AUTH_FAILED', reason: 'Credenciales inválidas' })
    }

    // (Opcional) comprobar cuota de sellos del usuario consultando stamp-catalog
    // Omitido aquí por brevedad; ver MAX_STAMPS_PER_USER.

    // La KEY se deriva SIEMPRE del username autenticado, nunca de un input libre
    const key = `${username}/${year}/${stampName}/${stampName}${cfg.suffix}`

    const presigned = await createPresignedPost(s3, {
      Bucket: process.env.STAMPS_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', MIN_BYTES, MAX_BYTES],
        ['eq', '$Content-Type', cfg.contentType]
      ],
      Fields: { 'Content-Type': cfg.contentType },
      Expires: 60 // segundos
    })

    return resp(200, { ok: true, upload: presigned, key })
  } catch (err) {
    console.error('upload-url error:', err)
    return resp(500, { ok: false, error: 'INTERNAL_ERROR', reason: 'Error interno' })
  }
}

function resp(statusCode, obj) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(obj) }
}
```

Y su `aws/lambdas/upload-url/package.json`:

```json
{
  "name": "upload-url",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-presigned-post": "^3.0.0"
  }
}
```

> Nota: `createPresignedPost` con `content-length-range` es lo que **fija el tamaño máximo del lado servidor**. El cliente no puede subir más que `MAX_BYTES` aunque lo intente.

### [x] - Paso 4: Crear la Lambda `delete-stamp`

Borra un sello (la carpeta `{username}/{año}/{nombre}/`) validando propiedad. Crea `aws/lambdas/delete-stamp/index.js`:

```javascript
/**
 * Lambda: delete-stamp
 * Borra los archivos de un sello del usuario autenticado y su registro en el catálogo.
 */
const { DynamoDBClient, QueryCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

async function authenticate(apiKey, machineId) {
  const res = await dynamo.send(new QueryCommand({
    TableName: process.env.USERS_TABLE,
    IndexName: 'apiKey-index',
    KeyConditionExpression: 'apiKey = :k',
    ExpressionAttributeValues: { ':k': { S: apiKey } }
  }))
  if (!res.Items || res.Items.length === 0) return null
  const user = res.Items[0]
  const machines = user.activeMachines?.L || []
  const ok = machines.some((m) => m.M?.machineId?.S === machineId)
  if (!ok) return null
  return user.username?.S || null
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' }
  }
  try {
    const body = JSON.parse(event.body || '{}')
    const { apiKey, machineId, year, stampName } = body

    if (!apiKey || !machineId) {
      return resp(401, { ok: false, error: 'AUTH_FAILED', reason: 'apiKey y machineId requeridos' })
    }
    if (!/^\d{4}$/.test(year || '') || !stampName || /[\\/]/.test(stampName)) {
      return resp(400, { ok: false, error: 'BAD_INPUT', reason: 'year o stampName inválidos' })
    }

    const username = await authenticate(apiKey, machineId)
    if (!username) {
      return resp(401, { ok: false, error: 'AUTH_FAILED', reason: 'Credenciales inválidas' })
    }

    const bucket = process.env.STAMPS_BUCKET
    // El prefijo se deriva del username autenticado → aislamiento garantizado
    const prefix = `${username}/${year}/${stampName}/`

    // Listar y borrar todos los objetos bajo ese prefijo
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
    const objects = (list.Contents || []).map((o) => ({ Key: o.Key }))
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects }
      }))
    }

    // Borrar el registro del catálogo (stampId = {year}#{stampName})
    await dynamo.send(new DeleteItemCommand({
      TableName: process.env.STAMP_CATALOG_TABLE,
      Key: {
        username: { S: username },
        stampId: { S: `${year}#${stampName}` }
      }
    }))

    return resp(200, { ok: true, deleted: objects.length })
  } catch (err) {
    console.error('delete-stamp error:', err)
    return resp(500, { ok: false, error: 'INTERNAL_ERROR', reason: 'Error interno' })
  }
}

function resp(statusCode, obj) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(obj) }
}
```

Con su `package.json` (dependencias `@aws-sdk/client-dynamodb` y `@aws-sdk/client-s3`).

### Paso 5: Añadir las Lambdas y endpoints al `template.yml`

Siguiendo el mismo patrón que `SyncStampsFunction` (función + recurso + método POST + método OPTIONS + permiso de invocación):

```yaml
  # Lambda: upload-url
  UploadUrlFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-upload-url'
      Runtime: nodejs20.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 10
      MemorySize: 128
      Environment:
        Variables:
          USERS_TABLE: !Ref UsersTable
          STAMPS_BUCKET: !Ref StampsBucket
      Code:
        ZipFile: |
          exports.handler = async () => ({ statusCode: 200, body: 'upload-url placeholder' });
      Tags:
        - Key: Project
          Value: !Ref ProjectName

  # Lambda: delete-stamp
  DeleteStampFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-delete-stamp'
      Runtime: nodejs20.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 15
      MemorySize: 256
      Environment:
        Variables:
          USERS_TABLE: !Ref UsersTable
          STAMPS_BUCKET: !Ref StampsBucket
          STAMP_CATALOG_TABLE: !Ref StampCatalogTable
      Code:
        ZipFile: |
          exports.handler = async () => ({ statusCode: 200, body: 'delete-stamp placeholder' });
      Tags:
        - Key: Project
          Value: !Ref ProjectName

  # /api/stamps/upload-url
  StampsUploadUrlResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref KioskoApi
      ParentId: !Ref StampsResource
      PathPart: upload-url

  UploadUrlMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref KioskoApi
      ResourceId: !Ref StampsUploadUrlResource
      HttpMethod: POST
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${UploadUrlFunction.Arn}/invocations'

  UploadUrlOptionsMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref KioskoApi
      ResourceId: !Ref StampsUploadUrlResource
      HttpMethod: OPTIONS
      AuthorizationType: NONE
      Integration:
        Type: MOCK
        IntegrationResponses:
          - StatusCode: '200'
            ResponseParameters:
              method.response.header.Access-Control-Allow-Headers: "'Content-Type,Authorization'"
              method.response.header.Access-Control-Allow-Methods: "'POST,OPTIONS'"
              method.response.header.Access-Control-Allow-Origin: "'*'"
            ResponseTemplates:
              application/json: ''
        RequestTemplates:
          application/json: '{"statusCode": 200}'
      MethodResponses:
        - StatusCode: '200'
          ResponseParameters:
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true
            method.response.header.Access-Control-Allow-Origin: true

  # /api/stamps/delete
  StampsDeleteResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref KioskoApi
      ParentId: !Ref StampsResource
      PathPart: delete

  DeleteStampMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref KioskoApi
      ResourceId: !Ref StampsDeleteResource
      HttpMethod: POST
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${DeleteStampFunction.Arn}/invocations'

  DeleteStampOptionsMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref KioskoApi
      ResourceId: !Ref StampsDeleteResource
      HttpMethod: OPTIONS
      AuthorizationType: NONE
      Integration:
        Type: MOCK
        IntegrationResponses:
          - StatusCode: '200'
            ResponseParameters:
              method.response.header.Access-Control-Allow-Headers: "'Content-Type,Authorization'"
              method.response.header.Access-Control-Allow-Methods: "'POST,OPTIONS'"
              method.response.header.Access-Control-Allow-Origin: "'*'"
            ResponseTemplates:
              application/json: ''
        RequestTemplates:
          application/json: '{"statusCode": 200}'
      MethodResponses:
        - StatusCode: '200'
          ResponseParameters:
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true
            method.response.header.Access-Control-Allow-Origin: true

  UploadUrlFunctionPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref UploadUrlFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${KioskoApi}/*/POST/api/stamps/upload-url'

  DeleteStampFunctionPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref DeleteStampFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${KioskoApi}/*/POST/api/stamps/delete'
```

Y añadir los nuevos métodos a la lista `DependsOn` del recurso `ApiDeployment`:

```yaml
  ApiDeployment:
    Type: AWS::ApiGateway::Deployment
    DependsOn:
      - LoginMethod
      - DownloadMethod
      # ... los existentes ...
      - SyncStampsMethod
      - SyncStampsOptionsMethod
      - UploadUrlMethod            # nuevo
      - UploadUrlOptionsMethod     # nuevo
      - DeleteStampMethod          # nuevo
      - DeleteStampOptionsMethod   # nuevo
```

### [x] - Paso 6: Throttling en API Gateway (Opción A — implementada)

Objetivo: limitar la tasa de peticiones para controlar el coste ante ráfagas o bucles, que es el principal riesgo de gasto.

**Por qué Opción A y no un Usage Plan.** Un `AWS::ApiGateway::UsagePlan` con `Throttle` y `Quota` **solo se aplica a peticiones identificadas con una API key** de API Gateway (cabecera `x-api-key`), asociada al plan. Sin API keys, el Usage Plan se crea pero **no limita nada**: se verificó lanzando 40 peticiones seguidas y todas devolvieron 200, ninguna 429. Como en este proyecto la identidad real se valida **dentro de cada Lambda** (`apiKey` + `machineId` en el body), no se usan API keys de API Gateway, así que un Usage Plan daría una falsa sensación de protección.

**Solución aplicada:** throttling efectivo **a nivel de stage** mediante `MethodSettings`, que sí limita a todos los clientes sin necesitar API keys. Se añade dentro del recurso `ApiStage`:

```yaml
  ApiStage:
    Type: AWS::ApiGateway::Stage
    Properties:
      RestApiId: !Ref KioskoApi
      DeploymentId: !Ref ApiDeployment
      StageName: prod
      MethodSettings:
        - ResourcePath: '/*'          # todos los recursos
          HttpMethod: '*'             # todos los métodos
          ThrottlingRateLimit: 5      # req/s sostenidas
          ThrottlingBurstLimit: 10    # ráfaga máxima (token bucket)
```

**Verificación (real):** bajo carga concurrente (10 procesos × 15 peticiones = 150 en paralelo), API Gateway devolvió **88 × 200 y 62 × 429** (`Too Many Requests`). El límite se aplica de verdad. Con peticiones secuenciales desde PowerShell no se llega a disparar el 429 porque la latencia de ida/vuelta mantiene la tasa por debajo del límite; hace falta concurrencia real para observarlo.

> **Nota (Incidencia #1):** modificar el `ApiStage` regenera su asociación de deployment; tras desplegar este cambio hubo que ejecutar de nuevo `aws apigateway create-deployment ... --stage-name prod` para que las rutas volvieran a responder (si no, devuelven 403 `Missing Authentication Token`).

**Cuota por usuario (futuro, Opción B).** Si algún día se necesita una cuota **diaria por cliente** (p. ej. 200 req/día por usuario), habría que emitir una `AWS::ApiGateway::ApiKey` por cliente, marcar los métodos con `ApiKeyRequired: true`, crear un `UsagePlan` con `Quota` y que la app envíe `x-api-key` en cada petición. Se descartó por ahora porque añade otra credencial que gestionar además de la `apiKey` del body y obliga a cambiar la app.

### Paso 7: Configurar CORS en el bucket de sellos (implementado)

**Qué es y por qué hace falta.** CORS es un mecanismo de seguridad de los **navegadores**. Cuando una web servida desde un origen (el dominio de CloudFront) hace una petición a otro origen (el endpoint de S3), el navegador bloquea la respuesta salvo que el destino declare que ese origen tiene permiso. En el flujo de subida (paso 3), la web pide la presigned a la Lambda y luego hace un **POST directo al bucket S3**: esa segunda llamada es cross-origin y, sin CORS en el bucket, el navegador la bloquea aunque la presigned sea válida.

> **Solo afecta a navegadores.** La app de escritorio (Electron), `curl` o los tests de PowerShell no aplican CORS, por eso el test del paso 5 funcionó sin CORS configurado. Es imprescindible únicamente si la subida se hace desde la web.

**Configuración aplicada** en `StampsBucket`. Se restringe al dominio de CloudFront (más seguro que `*`, que permitiría subir desde cualquier web):

```yaml
  StampsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${ProjectName}-stamps'
      # ... configuración existente ...
      CorsConfiguration:
        CorsRules:
          - AllowedMethods: [POST, GET, PUT]
            AllowedOrigins:
              - !Sub 'https://${WebDistribution.DomainName}'   # p.ej. https://d1m7hj56bdybto.cloudfront.net
            AllowedHeaders: ['*']
            ExposedHeaders: [ETag]
            MaxAge: 3000
```

**Cómo funciona la comprobación:** antes del POST real, el navegador manda un *preflight* `OPTIONS` al bucket preguntando si puede hacer POST desde ese origen. S3 responde según el `CorsConfiguration`.

**Verificación (real):**

- Preflight desde el origen permitido (`https://d1m7hj56bdybto.cloudfront.net`) → **200** con `Access-Control-Allow-Origin` y `Access-Control-Allow-Methods: POST, GET, PUT`.
- Preflight desde un origen no autorizado (`https://sitio-malicioso.com`) → **403 AccessForbidden** (`This CORS request is not allowed`). La restricción funciona.

> Si en el futuro se necesita probar la subida desde `http://localhost:<puerto>` en desarrollo, hay que añadir ese origen a `AllowedOrigins`.

### Paso 8: Crear el presupuesto de gasto (AWS Budgets)

Se puede añadir como recurso del stack (avisa por email, no frena el gasto):

```yaml
  CostBudget:
    Type: AWS::Budgets::Budget
    Properties:
      Budget:
        BudgetName: !Sub '${ProjectName}-monthly-budget'
        BudgetType: COST
        TimeUnit: MONTHLY
        BudgetLimit:
          Amount: 10
          Unit: USD
      NotificationsWithSubscribers:
        - Notification:
            NotificationType: ACTUAL
            ComparisonOperator: GREATER_THAN
            Threshold: 80          # alerta al 80% del presupuesto
            ThresholdType: PERCENTAGE
          Subscribers:
            - SubscriptionType: EMAIL
              Address: tu-correo@ejemplo.com   # cambiar por el real
```

### Paso 9: Desplegar

Con los mismos comandos que ya usas en el proyecto:

```powershell
# 1. Redesplegar infraestructura (GSI, IAM, nuevas Lambdas, endpoints, Usage Plan, CORS, Budget)
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1 --capabilities CAPABILITY_NAMED_IAM

# 2. Instalar dependencias y empaquetar la Lambda upload-url
cd aws\lambdas\upload-url; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\upload-url\*" -DestinationPath "aws\lambdas\upload-url.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-upload-url --zip-file fileb://aws/lambdas/upload-url.zip --region eu-west-1 --no-cli-pager

# 3. Instalar dependencias y empaquetar la Lambda delete-stamp
cd aws\lambdas\delete-stamp; npm install; cd ..\..\..
Compress-Archive -Path "aws\lambdas\delete-stamp\*" -DestinationPath "aws\lambdas\delete-stamp.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-delete-stamp --zip-file fileb://aws/lambdas/delete-stamp.zip --region eu-west-1 --no-cli-pager

# 4. IMPORTANTE: forzar un nuevo deployment del stage para exponer los nuevos endpoints
#    (ver Incidencia #1). Sin esto, /upload-url y /delete devuelven 403.
aws apigateway create-deployment --rest-api-id <API_ID> --stage-name prod --region eu-west-1
```

> Obtén `<API_ID>` del output `ApiGatewayUrl` del stack (el subdominio antes de `.execute-api`), o con:
> `aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text`

### [x] - Paso 10: Integrar en la app cliente (implementado)

Implementado en la app Electron, dentro de **Configuración → apartado "BASE DE DATOS SELLOS"**, junto al botón "Sincronizar con la nube" (que se mantiene).

**Flujo de llamadas (base):**

```
Subir (por cada sello se hacen 2 subidas: fondo + sello):
1. POST /api/stamps/upload-url  { apiKey, machineId, year, stampName, fileType: 'fondo' }
   → recibe { upload: { url, fields }, key }
2. POST multipart/form-data a upload.url con los fields + el archivo
3. Repetir 1-2 con fileType: 'sello'
4. POST /api/stamps/sync  → actualiza el catálogo local

Borrar:
1. POST /api/stamps/delete  { apiKey, machineId, year, stampName }
2. POST /api/stamps/sync    → refresca el catálogo local
```

**Archivos de la app:**

- `src/main/stamps/stamp-upload-service.ts` — `uploadStamp()` (presigned + POST multipart a S3 con `https` nativo) y `deleteStamp()`. Reutiliza `apiKey` de `config.json` y `machineId`, igual que `stamp-sync-service.ts`.
- `src/main/ipc/stamps.handlers.ts` — canales IPC: `stamps:pickFiles` (diálogo Electron), `stamps:existsInYear` (duplicados), `stamps:upload`, `stamps:delete`.
- `src/preload/index.ts` — expone los cuatro métodos nuevos en `electronAPI.stamps`.
- `src/renderer/src/components/settings/UploadStampButton.tsx` — campos año + nombre, selector de archivos, botón "Subir sello".
- `src/renderer/src/components/settings/DeleteStampButton.tsx` — selector de sellos existentes + botón "Borrar sello".
- `src/renderer/src/components/settings/StampDatabaseSection.tsx` — integra ambos y muestra el recuadro de normas.

**Reglas de seguridad implementadas (visibles en la app):**

- Deben subirse **exactamente 2 archivos**: uno terminado en `-fondo.jpg` y otro en `-sello.png`. Si no, **no se sube nada**. Se valida en tres capas: al elegir archivos (el diálogo asigna cada uno por su sufijo), en el renderer antes de subir, y de nuevo en el servicio del main.
- El **año** es un campo numérico limitado a **2020–2100**.
- El **nombre** es un campo de texto; es el que define el registro en la base de datos.
- Si el nombre **ya existe** para ese año, se avisa al usuario y este decide si **sobrescribir** (`window.confirm`).
- Cada archivo debe ocupar entre **3 KB y 2 MB** (coincide con el `content-length-range` de la presigned).

**Verificación:** `npm run build` (main + preload + renderer) compila correctamente. El backend de subida/borrado se validó contra AWS en el paso 5 (test `test-e2e-upload-delete.ps1`, 11/11). Pendiente de prueba manual en la UI en ejecución: flujo completo de subida desde el diálogo, aparición tras el sync, y aviso de duplicado.

> **Nota sobre el manejo del 429 (throttling, paso 6):** ante ráfagas, API Gateway puede responder 429. La app trata el error como "Error de conexión" genérico; una mejora futura sería reintentar con *backoff* al recibir 429. Con el volumen esperado es muy improbable que se dispare.

### Checklist de validación tras desplegar

- [ ] La subida rechaza archivos > 2 MB (probar con un fichero grande → debe fallar con error de S3).
- [ ] Un usuario no puede subir/borrar en el prefijo de otro (la key se deriva del `username` autenticado).
- [ ] `apiKey` inválida o `machineId` no registrado → 401.
- [ ] Tras subir + `sync`, el sello aparece en el catálogo; tras `delete` + `sync`, desaparece.
- [ ] El throttling responde 429 al superar el `BurstLimit` (requiere peticiones concurrentes; con llamadas secuenciales no se dispara por la latencia).
- [ ] Llega el email de AWS Budgets si se configuró un umbral bajo de prueba.

---

## 8. Incidencias conocidas (encontradas durante la implementación)

### Incidencia #1: API Gateway devuelve 403 en los endpoints nuevos tras `cloudformation deploy`

**Síntoma:** tras desplegar el stack con las nuevas Lambdas y métodos, `POST /api/stamps/upload-url` y `POST /api/stamps/delete` devuelven **403 con body vacío**, aunque los recursos, métodos, integración y permisos de invocación son correctos. El endpoint `OPTIONS` (MOCK) sí responde 200.

**Causa:** el recurso `AWS::ApiGateway::Deployment` (`ApiDeployment`) captura un **snapshot inmutable** de la API en el momento de su creación. Añadir métodos nuevos al template **no** regenera ese snapshot automáticamente, así que el stage `prod` sigue sirviendo la versión antigua de la API, sin los endpoints nuevos.

**Solución aplicada:** forzar un nuevo deployment del stage tras el `cloudformation deploy`:

```powershell
aws apigateway create-deployment --rest-api-id <API_ID> --stage-name prod --region eu-west-1
```

**Para el futuro:** cada vez que se añadan o cambien métodos/recursos de la API vía este template, hay que hacer este redeploy del stage. La alternativa "CloudFormation puro" es cambiar el **nombre lógico** del recurso `ApiDeployment` en cada cambio (p. ej. `ApiDeploymentV2`, `ApiDeploymentV3`...), lo que fuerza a CloudFormation a crear un snapshot nuevo, pero deja recursos huérfanos y es más frágil. El `create-deployment` manual es más simple y es el que se documenta aquí.

### Incidencia #2: 403 al llamar a la API desde Windows PowerShell 5.1

**Síntoma:** `Invoke-RestMethod` / `Invoke-WebRequest` en Windows PowerShell 5.1 devuelven **403** contra los endpoints, mientras que `curl.exe` con la misma petición devuelve 200. Es un falso negativo: la infraestructura está bien.

**Causa:** Windows PowerShell 5.1 **no negocia TLS 1.2 por defecto**, y API Gateway (y S3) rechazan protocolos antiguos.

**Solución aplicada:** forzar TLS 1.2 al inicio de cualquier script de PowerShell 5.1 que llame a la API:

```powershell
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
```

**Nota adicional:** el multipart de la subida a S3 con presigned POST tampoco funciona con `Invoke-RestMethod -Form` en PS 5.1 (esa opción es de PowerShell 6+). En el test `test-e2e-upload-delete.ps1` se construye el multipart con `System.Net.Http.HttpClient` + `MultipartFormDataContent`, que sí es compatible con 5.1.

---

## 9. Resumen ejecutivo

- **Coste en uso normal**: insignificante (~1-2 USD/mes con 50 usuarios activos).
- **Riesgo real**: abuso o fallos (archivos gigantes, bucles, egress), no el uso legítimo.
- **Control de gasto** (por prioridad): presigned URLs con `content-length-range` → throttling + cuota en API Gateway → AWS Budgets → límites de negocio.
- **Seguridad**: derivar siempre el prefijo del usuario autenticado, borrar vía Lambda (no dar `DeleteObject` al cliente), migrar la validación de `apiKey` de `Scan` a un GSI, y valorar tokens Cognito de corta duración frente a la `apiKey` permanente.
