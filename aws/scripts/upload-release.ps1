# upload-release.ps1
# Sube un nuevo release (.exe + latest.yml) al bucket de releases en S3.
#
# Uso:
#   .\upload-release.ps1 -Version "6.0.0" -ExePath "..\..\dist\kiosko-setup-6.0.0.exe"
#
# Requisitos:
#   - AWS CLI instalado y configurado
#   - Variables en aws/.env

param(
  [Parameter(Mandatory=$true)]
  [string]$Version,

  [Parameter(Mandatory=$true)]
  [string]$ExePath
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

$bucketReleases = $env:S3_BUCKET_RELEASES

if (-not $bucketReleases) {
  Write-Error "ERROR: Variable S3_BUCKET_RELEASES no definida en aws/.env"
  exit 1
}

if (-not (Test-Path $ExePath)) {
  Write-Error "ERROR: No se encuentra el archivo: $ExePath"
  exit 1
}

$fileName = Split-Path $ExePath -Leaf

Write-Host "=== Subiendo release v$Version ===" -ForegroundColor Cyan

# Subir a carpeta de versión específica
Write-Host "Subiendo $fileName a releases/v$Version/..." -ForegroundColor Yellow
aws s3 cp $ExePath "s3://$bucketReleases/releases/v$Version/$fileName" `
  --content-type "application/octet-stream"

# Copiar también como latest
Write-Host "Actualizando releases/latest/..." -ForegroundColor Yellow
aws s3 cp $ExePath "s3://$bucketReleases/releases/latest/$fileName" `
  --content-type "application/octet-stream"

# Subir latest.yml si existe en la misma carpeta que el .exe
$exeDir = Split-Path $ExePath -Parent
$latestYml = Join-Path $exeDir "latest.yml"
if (Test-Path $latestYml) {
  Write-Host "Subiendo latest.yml..." -ForegroundColor Yellow
  aws s3 cp $latestYml "s3://$bucketReleases/releases/latest/latest.yml" `
    --content-type "text/yaml; charset=utf-8" `
    --cache-control "public, max-age=300"
  aws s3 cp $latestYml "s3://$bucketReleases/releases/v$Version/latest.yml" `
    --content-type "text/yaml; charset=utf-8"
} else {
  Write-Warning "No se encontró latest.yml en $(Split-Path $ExePath -Parent). Recuerda subirlo manualmente."
}

Write-Host ""
Write-Host "=== Release v$Version subida correctamente ===" -ForegroundColor Green
Write-Host "URL de descarga: https://<tu-dominio>/releases/latest/$fileName"
