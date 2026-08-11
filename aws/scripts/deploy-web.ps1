# deploy-web.ps1
# Sube la web estática al bucket S3 y opcionalmente invalida la caché de CloudFront.
#
# Uso:
#   .\deploy-web.ps1
#   .\deploy-web.ps1 -Invalidate  (para forzar refresco de CloudFront)
#
# Requisitos:
#   - AWS CLI instalado y configurado (aws configure)
#   - Variables en aws/.env o configuradas en el entorno

param(
  [switch]$Invalidate
)

$ErrorActionPreference = "Stop"

# Cargar variables de entorno desde .env
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
  }
}

# Configuración
$bucketWeb = $env:S3_BUCKET_WEB
$distributionId = $env:CLOUDFRONT_DISTRIBUTION_ID
$webDir = Join-Path $PSScriptRoot "..\web"

if (-not $bucketWeb) {
  Write-Error "ERROR: Variable S3_BUCKET_WEB no definida en aws/.env"
  exit 1
}

if (-not (Test-Path $webDir)) {
  Write-Error "ERROR: No se encuentra la carpeta aws/web/"
  exit 1
}

Write-Host "=== Desplegando web a s3://$bucketWeb ===" -ForegroundColor Cyan

# Subir archivos HTML (sin caché agresiva para que se actualice rápido)
Write-Host "Subiendo HTML..." -ForegroundColor Yellow
aws s3 cp "$webDir\index.html" "s3://$bucketWeb/index.html" `
  --content-type "text/html; charset=utf-8" `
  --cache-control "public, max-age=300"

# Subir CSS (caché más larga, se puede usar versionado si se quiere)
Write-Host "Subiendo CSS..." -ForegroundColor Yellow
aws s3 cp "$webDir\styles.css" "s3://$bucketWeb/styles.css" `
  --content-type "text/css; charset=utf-8" `
  --cache-control "public, max-age=86400"

# Subir JS
Write-Host "Subiendo JS..." -ForegroundColor Yellow
$jsFile = Join-Path $webDir "app.js"
if (Test-Path $jsFile) {
  aws s3 cp "$jsFile" "s3://$bucketWeb/app.js" `
    --content-type "application/javascript; charset=utf-8" `
    --cache-control "public, max-age=300"
}

# Subir cualquier otro asset (imágenes, JS, etc.)
$assetsDir = Join-Path $webDir "assets"
if (Test-Path $assetsDir) {
  Write-Host "Subiendo assets..." -ForegroundColor Yellow
  aws s3 sync "$assetsDir" "s3://$bucketWeb/assets/" `
    --cache-control "public, max-age=604800"
}

Write-Host "Subida completada." -ForegroundColor Green

# Invalidar caché de CloudFront si se pide
if ($Invalidate) {
  if (-not $distributionId) {
    Write-Warning "CLOUDFRONT_DISTRIBUTION_ID no definido. Saltando invalidación."
  } else {
    Write-Host "Invalidando caché de CloudFront ($distributionId)..." -ForegroundColor Yellow
    aws cloudfront create-invalidation `
      --distribution-id $distributionId `
      --paths "/*"
    Write-Host "Invalidación solicitada." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "=== Deploy completado ===" -ForegroundColor Cyan
