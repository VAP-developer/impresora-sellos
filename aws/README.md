# AWS - SvvS Kiosko

Guía paso a paso para desplegar la infraestructura de distribución y autenticación del kiosko.

---

## Requisitos previos

1. **Cuenta AWS** creada con un correo dedicado al proyecto.
2. **AWS CLI** instalado y configurado:
   ```powershell
   # Instalar AWS CLI (descarga desde https://aws.amazon.com/cli/)
   # Configurar credenciales:
   aws configure
   # Te pedirá:
   #   AWS Access Key ID: (de tu usuario IAM)
   #   AWS Secret Access Key: (de tu usuario IAM)
   #   Default region: eu-west-1
   #   Output format: json
   ```
3. **Usuario IAM** con los permisos necesarios (ver sección "Permisos IAM" más abajo).
4. Copiar `aws/.env.example` a `aws/.env` y rellenar con tus valores.

---

## Permisos IAM necesarios

### Opción A: Política administrador (rápido para empezar)

```
arn:aws:iam::aws:policy/AdministratorAccess
```

### Opción B: Política personalizada (mínimos privilegios)

Crea una política IAM con permisos para: CloudFormation, S3, CloudFront, ACM, Cognito, DynamoDB, Lambda, API Gateway, IAM (crear roles).

Necesitarás añadir estos permisos adicionales respecto a la versión básica:

```json
{
  "Sid": "CognitoManagement",
  "Effect": "Allow",
  "Action": [
    "cognito-idp:CreateUserPool",
    "cognito-idp:DeleteUserPool",
    "cognito-idp:CreateUserPoolClient",
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminSetUserPassword",
    "cognito-idp:AdminGetUser"
  ],
  "Resource": "*"
},
{
  "Sid": "DynamoDBManagement",
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DeleteTable",
    "dynamodb:DescribeTable",
    "dynamodb:PutItem",
    "dynamodb:GetItem"
  ],
  "Resource": "*"
},
{
  "Sid": "LambdaManagement",
  "Effect": "Allow",
  "Action": [
    "lambda:CreateFunction",
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "lambda:DeleteFunction",
    "lambda:GetFunction",
    "lambda:AddPermission",
    "lambda:RemovePermission"
  ],
  "Resource": "*"
},
{
  "Sid": "APIGatewayManagement",
  "Effect": "Allow",
  "Action": [
    "apigateway:*"
  ],
  "Resource": "*"
},
{
  "Sid": "IAMRoles",
  "Effect": "Allow",
  "Action": [
    "iam:CreateRole",
    "iam:DeleteRole",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:GetRole",
    "iam:PassRole"
  ],
  "Resource": "arn:aws:iam::*:role/svvs-kiosko-*"
}
```

---

## Paso 1: Desplegar la infraestructura

El template de CloudFormation crea:
- 2 Buckets S3 (web + releases)
- Distribución CloudFront con HTTPS
- Cognito User Pool (autenticación)
- DynamoDB tabla `users` (datos por usuario)
- API Gateway + 2 Lambdas (login + download)

```powershell
aws cloudformation deploy `
  --template-file aws/infra/template.yml `
  --stack-name svvs-kiosko-infra `
  --region eu-west-1 `
  --capabilities CAPABILITY_NAMED_IAM
```

Espera 5-10 minutos. Luego obtén los outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name svvs-kiosko-infra `
  --query "Stacks[0].Outputs" `
  --output json
```

Copia los valores a tu `aws/.env`:
```env
S3_BUCKET_WEB=svvs-kiosko-web
S3_BUCKET_RELEASES=svvs-kiosko-releases
CLOUDFRONT_DISTRIBUTION_ID=E2J36X9R6JCRRE
CLOUDFRONT_DOMAIN=d1m7hj56bdybto.cloudfront.net
USER_POOL_ID=eu-west-1_XXXXXXXXX
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
USERS_TABLE=svvs-kiosko-users
API_GATEWAY_URL=https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod
```

---

## Paso 2: Crear usuarios iniciales

Tras desplegar la infraestructura, ejecuta el script para crear los usuarios en Cognito y DynamoDB:

```powershell
.\aws\scripts\setup-users.ps1
```

Esto crea:

| Usuario | Contraseña | Mensaje de bienvenida |
|---------|-----------|----------------------|
| admin.svvs | Sv#vjc!vS.2026 | Bienvenido VJC |
| test | test_123 | Bienvenido Test |

---

## Paso 3: Desplegar las Lambdas

Las Lambdas se crean con placeholder code en el template. Para actualizar con el código real:

```powershell
# Lambda de login
cd aws\lambdas\login
npm install
Compress-Archive -Path * -DestinationPath ..\login.zip -Force
cd ..\..\..
aws lambda update-function-code `
  --function-name svvs-kiosko-login `
  --zip-file fileb://aws/lambdas/login.zip `
  --region eu-west-1

# Lambda de download
cd aws\lambdas\download
npm install
Compress-Archive -Path * -DestinationPath ..\download.zip -Force
cd ..\..\..
aws lambda update-function-code `
  --function-name svvs-kiosko-download `
  --zip-file fileb://aws/lambdas/download.zip `
  --region eu-west-1
```

---

## Paso 4: Subir la web

```powershell
.\aws\scripts\deploy-web.ps1 -Invalidate
```

La web estará en: `https://<CLOUDFRONT_DOMAIN>/`

---

## Paso 5: Subir un release (.exe)

```powershell
npm run build:win
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"
```

---

## Flujo completo del usuario

```
1. Usuario abre https://<CLOUDFRONT_DOMAIN>/
2. Ve formulario de login → introduce usuario/contraseña
3. POST /api/login → Cognito valida → devuelve token + datos
4. Se muestra "Bienvenido VJC" + botón de descarga
5. Pulsa descargar → GET /api/download con token
6. Lambda genera config.json + presigned URL del .exe
7. Se descargan ambos archivos:
   - svvs-app.exe (instalador)
   - config.json (configuración personal)
8. Usuario instala → copia config.json junto al .exe
9. Al abrir la app → lee config.json → muestra "Bienvenido VJC"
```

---

## Estructura de archivos

```
aws/
├── .env                          ← Credenciales y config (NO va a git)
├── .env.example                  ← Plantilla de referencia
├── README.md                     ← Esta guía
├── infra/
│   └── template.yml              ← CloudFormation (toda la infraestructura)
├── lambdas/
│   ├── login/
│   │   ├── index.js              ← Lambda: autenticación con Cognito
│   │   └── package.json
│   └── download/
│       ├── index.js              ← Lambda: genera config + presigned URL
│       └── package.json
├── scripts/
│   ├── deploy-web.ps1            ← Sube la web a S3
│   ├── upload-release.ps1        ← Sube un .exe nuevo
│   └── setup-users.ps1           ← Crea usuarios en Cognito + DynamoDB
└── web/
    ├── index.html                ← Página con login + descarga
    ├── styles.css                ← Estilos
    └── app.js                    ← Lógica de login y descarga

Electron (cambios en la app):
├── config.json                   ← Config por usuario (NO va a git)
├── src/main/user-config/
│   └── index.ts                  ← Lee config.json al arrancar
├── src/main/ipc/
│   └── user-config.handlers.ts   ← IPC handler para el renderer
└── src/renderer/src/views/
    └── HomeView.tsx              ← Muestra welcomeMessage
```

---

## Costes estimados

| Servicio | Uso | Coste/mes (sin free tier) |
|----------|-----|--------------------------|
| S3 | Web + releases | < 0.50€ |
| CloudFront | CDN + HTTPS | < 1€ |
| Cognito | Autenticación | < 0.30€ (50 usuarios) |
| DynamoDB | Datos usuarios | < 0.01€ |
| Lambda | Login + download | < 0.01€ |
| API Gateway | 2 endpoints | < 0.01€ |
| **Total** | | **~1-2€/mes** |

---

## Troubleshooting

### "Access Denied" al acceder a la web
- Verifica que el stack se desplegó: `aws cloudformation describe-stacks --stack-name svvs-kiosko-infra`
- Comprueba que subiste los archivos con `deploy-web.ps1`.

### La web no se actualiza tras deploy
- Usa `.\aws\scripts\deploy-web.ps1 -Invalidate` para forzar refresco.

### Login falla con "Usuario o contraseña incorrectos"
- Verifica que ejecutaste `setup-users.ps1` correctamente.
- Comprueba en Cognito que el usuario existe y está confirmado.

### La app no muestra el mensaje de bienvenida
- Verifica que `config.json` está junto al ejecutable (en la carpeta de instalación).
- En modo dev, debe estar en la raíz del proyecto.

### Error al desplegar Lambdas
- Asegúrate de ejecutar `npm install` dentro de cada carpeta de lambda antes de comprimir.
- El zip debe contener los archivos en la raíz (no dentro de una subcarpeta).

---

## Próximos pasos

- [ ] **Fase 2:** Sistema de licencias (validar licencia al arrancar, limitar por máquina)
- [ ] **Fase 3:** Base de datos por usuario (sync de ferias/sellos desde AWS)
- [ ] **Fase 4:** Panel admin web (gestionar usuarios, licencias, ferias)
- [ ] **Fase 5:** Auto-update con electron-updater apuntando a CloudFront

---

## Dominio personalizado (opcional)

Si quieres usar un dominio como `descargas.tukiosko.com`:

1. Solicita un certificado SSL en ACM (región `us-east-1`):
   ```powershell
   aws acm request-certificate `
     --domain-name descargas.tukiosko.com `
     --validation-method DNS `
     --region us-east-1
   ```
2. Valida el certificado añadiendo el CNAME en tu DNS.
3. Descomenta las líneas de `DomainName` y `AcmCertificateArn` en `template.yml`.
4. Redesplega el stack con los parámetros adicionales.
5. Añade un CNAME: `descargas.tukiosko.com → d1m7hj56bdybto.cloudfront.net`.


# Resumen

## Fase 1: Creación de web
Primero vamos a crear una web para que los usuarios puedan descargar la aplicación.

Para eso vamos a necesitar los servicios:
- Cloudfornt: Para maner un url público
- S3: Para almacenar la web y los release de la app

Primero tenemos que ejecutar este comando para desplegar la infraestructura
``` bash
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1

# Si da error
aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --region eu-west-1 --query "Stacks[0].Outputs" --output json


# Borrar
aws cloudformation delete-stack --stack-name svvs-kiosko-infra --region eu-west-1
```

Cuando todo este bien subimos la web
``` bash
.\aws\scripts\deploy-web.ps1
```
### WEB
La url de la web es: https://d1m7hj56bdybto.cloudfront.net/

## Fase 2: Autenticación
Para la autenticación vamos a convertir la web pública a que tenga un login. Y según el usuario que se autentique personalizar la descarga.

Para ello vamos a utilizar los servicios:
- Cognito User Pool: Autenticar usuarios
- DynamoDB: Configuración por usuarios
- Lambda: Generar el zip personalizado
- API Gateway: Generar los endpoints

Ahora los pasos para desplegarlos son:

``` bash
# Validate
aws cloudformation validate-template --template-body file://aws/infra/template.yml --region eu-west-1

# 1. Redesplegar infraestructura (añade Cognito, DynamoDB, API, Lambdas)
aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1 --capabilities CAPABILITY_NAMED_IAM

# 2. Obtener outputs y actualizar .env
aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --query "Stacks[0].Outputs" --output json --no-cli-pager

# 3. Crear usuarios
.\aws\scripts\setup-users.ps1

# 4. Desplegar código de Lambdas (npm install + zip + update)
Compress-Archive -Path "aws\lambdas\login\*" -DestinationPath "aws\lambdas\login.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-login --zip-file fileb://aws/lambdas/login.zip --region eu-west-1 --no-cli-pager

Compress-Archive -Path "aws\lambdas\download\*" -DestinationPath "aws\lambdas\download.zip" -Force
aws lambda update-function-code --function-name svvs-kiosko-download --zip-file fileb://aws/lambdas/download.zip --region eu-west-1 --no-cli-pager


# 5. Subir la web actualizada
.\aws\scripts\deploy-web.ps1 -Invalidate

# 6. Subir el .exe
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"
```
