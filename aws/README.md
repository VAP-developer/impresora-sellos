# AWS - SvvS Kiosko

Guía paso a paso para desplegar la infraestructura de distribución del kiosko.

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

Tu usuario IAM necesita estos permisos para desplegar y gestionar la web. Tienes dos opciones:

### Opción A: Política administrador (rápido, menos seguro)

Si eres el único que va a usar la cuenta, puedes asignar la política gestionada:
```
arn:aws:iam::aws:policy/AdministratorAccess
```
Esto te da acceso a todo. Cómodo para empezar, pero no recomendado a largo plazo.

### Opción B: Política personalizada (mínimos privilegios, recomendado)

Crea una política IAM personalizada con exactamente lo que necesitas:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationDeploy",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListStacks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3BucketManagement",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:GetBucketVersioning",
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketTagging",
        "s3:GetBucketTagging",
        "s3:GetBucketLocation",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::svvs-kiosko-web",
        "arn:aws:s3:::svvs-kiosko-releases"
      ]
    },
    {
      "Sid": "S3ObjectManagement",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::svvs-kiosko-web/*",
        "arn:aws:s3:::svvs-kiosko-releases/*"
      ]
    },
    {
      "Sid": "CloudFrontManagement",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:ListDistributions",
        "cloudfront:CreateInvalidation",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:ListOriginAccessControls",
        "cloudfront:TagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ACMCertificates",
      "Effect": "Allow",
      "Action": [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:DeleteCertificate"
      ],
      "Resource": "*"
    }
  ]
}
```

### Cómo crear la política en AWS

1. Ve a la consola AWS → **IAM** → **Policies** → **Create policy**.
2. Pestaña **JSON** → pega el JSON de arriba.
3. Nombre: `SvvSKioskoDeployPolicy`.
4. Ve a **Users** → tu usuario → **Add permissions** → **Attach policies** → selecciona `SvvSKioskoDeployPolicy`.

### Resumen de para qué sirve cada permiso

| Permiso | Para qué lo necesitas |
|---------|----------------------|
| `cloudformation:*` | Desplegar el template que crea los buckets y CloudFront |
| `s3:CreateBucket`, `s3:PutBucketPolicy`... | Crear y configurar los buckets |
| `s3:PutObject`, `s3:GetObject` | Subir la web y los .exe |
| `cloudfront:CreateDistribution`... | Crear y gestionar la CDN con HTTPS |
| `cloudfront:CreateInvalidation` | Forzar refresco de caché tras un deploy |
| `acm:RequestCertificate` | Obtener certificado SSL si usas dominio propio |

---

## Paso 1: Desplegar la infraestructura (una sola vez)

El template de CloudFormation crea automáticamente:
- Bucket S3 para la web (`svvs-kiosko-web`)
- Bucket S3 para las releases (`svvs-kiosko-releases`)
- Distribución CloudFront con HTTPS

```powershell
# Desde la raíz del proyecto
aws cloudformation deploy `
  --template-file aws/infra/template.yml `
  --stack-name svvs-kiosko-infra `
  --region eu-west-1 `
  --capabilities CAPABILITY_IAM
```

Espera 5-10 minutos a que CloudFront se propague.

### Obtener los valores de salida

```powershell
aws cloudformation describe-stacks `
  --stack-name svvs-kiosko-infra `
  --query "Stacks[0].Outputs" `
  --output table
```

Esto te dará:
- `CloudFrontDomainName` → La URL de tu web (ej: `d1234abcdef.cloudfront.net`)
- `CloudFrontDistributionId` → Para invalidar caché
- `WebBucketName` → Nombre del bucket web
- `ReleasesBucketName` → Nombre del bucket de releases

**Copia estos valores a tu `aws/.env`:**
```env
S3_BUCKET_WEB=svvs-kiosko-web
S3_BUCKET_RELEASES=svvs-kiosko-releases
CLOUDFRONT_DISTRIBUTION_ID=E1XXXXXXXXXX
CLOUDFRONT_DOMAIN=d1234abcdef.cloudfront.net
```

---

## Paso 2: Subir la web

```powershell
.\aws\scripts\deploy-web.ps1
```

Tras ejecutarlo, tu web estará accesible en:
```
https://<CLOUDFRONT_DOMAIN>/
```

Si necesitas forzar el refresco de caché:
```powershell
.\aws\scripts\deploy-web.ps1 -Invalidate
```

---

## Paso 3: Subir un release (.exe)

Primero genera el build de Electron:
```powershell
npm run build:win
```

Esto crea el instalador en `dist/`. Luego:
```powershell
.\aws\scripts\upload-release.ps1 -Version "6.0.0" -ExePath ".\dist\kiosko-setup-6.0.0.exe"
```

La URL de descarga será:
```
https://<CLOUDFRONT_DOMAIN>/releases/latest/kiosko-setup-6.0.0.exe
```

---

## Paso 4 (opcional): Dominio personalizado

Si quieres usar un dominio como `descargas.tukiosko.com`:

1. **Registra o configura tu dominio** en Route 53 (o tu proveedor DNS).
2. **Solicita un certificado SSL** en ACM (debe ser en `us-east-1` para CloudFront):
   ```powershell
   aws acm request-certificate `
     --domain-name descargas.tukiosko.com `
     --validation-method DNS `
     --region us-east-1
   ```
3. **Valida el certificado** añadiendo el registro CNAME que te indique ACM en tu DNS.
4. **Descomenta las líneas** en `aws/infra/template.yml`:
   - Parámetros `DomainName` y `AcmCertificateArn`
   - Sección `Aliases` y `ViewerCertificate` con el ARN
5. **Redesplega el stack:**
   ```powershell
   aws cloudformation deploy `
     --template-file aws/infra/template.yml `
     --stack-name svvs-kiosko-infra `
     --region eu-west-1 `
     --parameter-overrides `
       DomainName=descargas.tukiosko.com `
       AcmCertificateArn=arn:aws:acm:us-east-1:123456789:certificate/xxx
   ```
6. **Añade un registro CNAME** en tu DNS:
   ```
   descargas.tukiosko.com → d1234abcdef.cloudfront.net
   ```

---

## Estructura de archivos

```
aws/
├── .env                  ← Credenciales y config (NO va a git)
├── .env.example          ← Plantilla de referencia
├── README.md             ← Esta guía
├── infra/
│   └── template.yml      ← CloudFormation (infraestructura)
├── scripts/
│   ├── deploy-web.ps1    ← Sube la web a S3
│   └── upload-release.ps1← Sube un .exe nuevo
└── web/
    ├── index.html         ← Página de descarga
    └── styles.css         ← Estilos
```

---

## Costes estimados

| Servicio | Uso | Coste |
|----------|-----|-------|
| S3 | Almacén web + releases | < 0.50€/mes |
| CloudFront | CDN + HTTPS | < 1€/mes (poco tráfico) |
| ACM | Certificado SSL | Gratis |
| **Total** | | **< 2€/mes** |

---

## Troubleshooting

### "Access Denied" al acceder a la web
- Verifica que el stack se desplegó correctamente: `aws cloudformation describe-stacks --stack-name svvs-kiosko-infra`
- Comprueba que subiste los archivos al bucket correcto.

### La web no se actualiza tras deploy
- CloudFront cachea. Usa `.\aws\scripts\deploy-web.ps1 -Invalidate` para forzar refresco.
- O espera ~5 minutos a que expire el TTL.

### Error al subir release
- Verifica que `S3_BUCKET_RELEASES` está definido en `.env`.
- Verifica que tu usuario IAM tiene permisos `s3:PutObject` en ese bucket.

---

## Próximos pasos

- [ ] Sistema de licencias (API Gateway + Lambda + DynamoDB)
- [ ] Auto-update con electron-updater apuntando a CloudFront
- [ ] Panel admin para gestionar ferias/sellos
- [ ] Sincronización de datos desde la app

# Web
Desplegamos la infra ejecutando:

 ``` bash
 aws cloudformation deploy --template-file aws/infra/template.yml --stack-name svvs-kiosko-infra --region eu-west-1
```

Ejecutamos para ver la salida:

``` bash
aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --region eu-west-1 --query "Stacks[0].Outputs" --output json

# Salida
E:\_SvvS Kiosko\v6-imp> aws cloudformation describe-stacks --stack-name svvs-kiosko-infra --region eu-west-1 --query "Stacks[0].Outputs" --output json
[                                                                           
    {
        "OutputKey": "WebBucketName",
        "OutputValue": "svvs-kiosko-web",
        "Description": "Nombre del bucket S3 para la web",
        "ExportName": "svvs-kiosko-web-bucket"
    },
    {
        "OutputKey": "ReleasesBucketName",
        "OutputValue": "svvs-kiosko-releases",
        "Description": "Nombre del bucket S3 para las releases",
        "ExportName": "svvs-kiosko-releases-bucket"
    },
    {
        "OutputKey": "CloudFrontDistributionId",
        "OutputValue": "E2J36X9R6JCRRE",
        "Description": "ID de la distribuci??n (para invalidaciones)",
        "ExportName": "svvs-kiosko-cloudfront-id"
    },
    {
        "OutputKey": "CloudFrontDomainName",
        "OutputValue": "d1m7hj56bdybto.cloudfront.net",
```

Cuando todo este creado y rellenemos los .env podemos ejecutar:
- Desplegar web: .\aws\scripts\deploy-web.ps1
- Subir release: .\aws\scripts\upload-release.ps1

En caso de actaulziar la web editando index.html o el styles.css volveriamos a ejectuar es script deploy-web.

El enlace de la web es: https://d1m7hj56bdybto.cloudfront.net

Para subir la aplicación debemos:

``` bash
# Ejecutar el build:
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"

# Generar el svvs-app.exe
.\aws\scripts\upload-release.ps1 -Version "1.0.0" -ExePath ".\dist\svvs-app.exe"

# Subir la versión actualizada
.\aws\scripts\deploy-web.ps1 -Invalidate
```



