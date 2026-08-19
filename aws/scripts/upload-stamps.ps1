# upload-stamps.ps1
# Sube imágenes de sellos (fondo + sello) al bucket S3 de un usuario.
#
# Uso (archivos individuales):
#   .\upload-stamps.ps1 -Username "admin.svvs" -Year "2026" -StampName "Boston 2026" `
#     -FondoPath "..\..\bbdd-ferias\2026\Boston 2026\Boston 2026-fondo.jpg" `
#     -LogoPath "..\..\bbdd-ferias\2026\Boston 2026\Boston 2026-sello.png"
#
# Uso (carpeta bulk):
#   .\upload-stamps.ps1 -Username "admin.svvs" -Year "2026" -StampName "Boston 2026" `
#     -BulkFolder "..\..\bbdd-ferias\2026\Boston 2026"
#
#   En modo bulk, busca automáticamente:
#     {BulkFolder}\{StampName}-fondo.jpg
#     {BulkFolder}\{StampName}-sello.png
#
# Requisitos:
#   - AWS CLI instalado y configurado
#   - Variables en aws/.env (S3_BUCKET_STAMPS opcional, por defecto "svvs-kiosko-stamps")

param(
  [Parameter(Mandatory=$true)]
  [string]$Username,

  [Parameter(Mandatory=$true)]
  [string]$Year,

  [Parameter(Mandatory=$true)]
  [string]$StampName,

  [Parameter(Mandatory=$false)]
  [string]$FondoPath,

  [Parameter(Mandatory=$false)]
  [string]$LogoPath,

  [Parameter(Mandatory=$false)]
  [string]$BulkFolder
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

$bucket = $env:S3_BUCKET_STAMPS
if (-not $bucket) { $bucket = "svvs-kiosko-stamps" }

$region = $env:AWS_REGION
if (-not $region) { $region = "eu-west-1" }

# ============================================================================
# Resolver rutas de archivos
# ============================================================================

if ($BulkFolder) {
  # Modo bulk: buscar archivos dentro de la carpeta
  if (-not (Test-Path $BulkFolder)) {
    Write-Error "ERROR: La carpeta no existe: $BulkFolder"
    exit 1
  }
  $FondoPath = Join-Path $BulkFolder "$StampName-fondo.jpg"
  $LogoPath = Join-Path $BulkFolder "$StampName-sello.png"
} else {
  # Modo individual: ambos archivos son obligatorios
  if (-not $FondoPath -or -not $LogoPath) {
    Write-Error "ERROR: Debes proporcionar -FondoPath y -LogoPath, o usar -BulkFolder."
    exit 1
  }
}

# ============================================================================
# Validaciones
# ============================================================================

Write-Host "=== Subiendo sello: $StampName ===" -ForegroundColor Cyan
Write-Host "  Usuario: $Username" -ForegroundColor Gray
Write-Host "  Año:     $Year" -ForegroundColor Gray
Write-Host "  Bucket:  $bucket" -ForegroundColor Gray
Write-Host "  Región:  $region" -ForegroundColor Gray
Write-Host ""

# Validar existencia de archivos
if (-not (Test-Path $FondoPath)) {
  Write-Error "ERROR: No se encuentra el archivo de fondo: $FondoPath"
  exit 1
}

if (-not (Test-Path $LogoPath)) {
  Write-Error "ERROR: No se encuentra el archivo de logo: $LogoPath"
  exit 1
}

# Validar extensiones
$fondoExt = [System.IO.Path]::GetExtension($FondoPath).ToLower()
$logoExt = [System.IO.Path]::GetExtension($LogoPath).ToLower()

if ($fondoExt -ne ".jpg") {
  Write-Error "ERROR: El archivo de fondo debe ser .jpg (recibido: $fondoExt)"
  exit 1
}

if ($logoExt -ne ".png") {
  Write-Error "ERROR: El archivo de logo debe ser .png (recibido: $logoExt)"
  exit 1
}

Write-Host "  Fondo: $FondoPath" -ForegroundColor Gray
Write-Host "  Logo:  $LogoPath" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Subida a S3
# ============================================================================

$s3Prefix = "$Username/$Year/$StampName"
$s3FondoKey = "$s3Prefix/$StampName-fondo.jpg"
$s3LogoKey = "$s3Prefix/$StampName-sello.png"

# Subir fondo
Write-Host "Subiendo fondo..." -ForegroundColor Yellow
aws s3 cp $FondoPath "s3://$bucket/$s3FondoKey" `
  --content-type "image/jpeg" `
  --region $region

Write-Host "  OK: $s3FondoKey" -ForegroundColor Green

# Subir logo/sello
Write-Host "Subiendo sello..." -ForegroundColor Yellow
aws s3 cp $LogoPath "s3://$bucket/$s3LogoKey" `
  --content-type "image/png" `
  --region $region

Write-Host "  OK: $s3LogoKey" -ForegroundColor Green

# ============================================================================
# Resumen
# ============================================================================

Write-Host ""
Write-Host "=== Sello subido correctamente ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Rutas S3:" -ForegroundColor White
Write-Host "    s3://$bucket/$s3FondoKey" -ForegroundColor Gray
Write-Host "    s3://$bucket/$s3LogoKey" -ForegroundColor Gray
Write-Host ""
Write-Host "  Verificar en consola:" -ForegroundColor White
Write-Host "    https://s3.console.aws.amazon.com/s3/buckets/$bucket?prefix=$Username/$Year/$StampName/" -ForegroundColor Gray
