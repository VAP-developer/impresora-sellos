# setup-users.ps1
# Crea los usuarios iniciales en Cognito y DynamoDB.
#
# Las contraseñas NUNCA se guardan en este script. Se resuelven en este orden:
#   1. Parametro explicito:  .\setup-users.ps1 -AdminPassword (Read-Host -AsSecureString)
#   2. Variable en aws/.env: ADMIN_SVVS_PASSWORD / TEST_PASSWORD  (fichero ignorado por git)
#   3. Prompt interactivo (entrada oculta)
#
# Uso:
#   .\setup-users.ps1                      # pide las contraseñas por prompt si no estan en .env
#   .\setup-users.ps1 -SkipTest            # crea solo admin.svvs
#
# Requisitos:
#   - AWS CLI configurado
#   - Stack svvs-kiosko-infra desplegado (Cognito + DynamoDB creados)
#   - Variables en aws/.env (USER_POOL_ID, USERS_TABLE)

[CmdletBinding()]
param(
  [System.Security.SecureString]$AdminPassword,
  [System.Security.SecureString]$TestPassword,
  [switch]$SkipTest
)

$ErrorActionPreference = "Stop"

# Politica del User Pool (ver aws/infra/template.yml): minimo 8 caracteres
$MinPasswordLength = 8

# ============================================================================
# Helpers
# ============================================================================

function ConvertFrom-SecureStringPlain {
  param([System.Security.SecureString]$Secure)
  return (New-Object System.Net.NetworkCredential('', $Secure)).Password
}

function Resolve-Password {
  <#
    Devuelve la contraseña en claro para un usuario, buscando en:
    parametro -> variable de entorno (.env) -> prompt interactivo.
  #>
  param(
    [string]$Username,
    [System.Security.SecureString]$FromParam,
    [string]$EnvVarName
  )

  $plain = $null
  $source = $null

  if ($FromParam) {
    $plain = ConvertFrom-SecureStringPlain $FromParam
    $source = "parametro"
  }

  if (-not $plain) {
    $fromEnv = [System.Environment]::GetEnvironmentVariable($EnvVarName, "Process")
    if ($fromEnv) {
      $plain = $fromEnv
      $source = "aws/.env ($EnvVarName)"
    }
  }

  if (-not $plain) {
    Write-Host "  Contraseña para '$Username' no encontrada en $EnvVarName." -ForegroundColor Gray
    $secure = Read-Host -Prompt "  Introduce la contraseña para '$Username'" -AsSecureString
    $plain = ConvertFrom-SecureStringPlain $secure
    $source = "prompt"
  }

  if (-not $plain) {
    throw "No se ha proporcionado contraseña para '$Username'."
  }

  if ($plain.Length -lt $MinPasswordLength) {
    throw "La contraseña de '$Username' tiene $($plain.Length) caracteres. El User Pool exige un minimo de $MinPasswordLength."
  }

  Write-Host "  Contraseña obtenida de: $source" -ForegroundColor DarkGray
  return $plain
}

function New-TemporaryPassword {
  # Contraseña temporal aleatoria de un solo uso: se reemplaza acto seguido
  # por la definitiva con admin-set-user-password --permanent.
  $chars = (48..57) + (65..90) + (97..122)
  $random = -join ($chars | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  return "Tmp!$random"
}

function New-AppUser {
  param(
    [string]$Username,
    [string]$Password,
    [string]$ItemFile
  )

  Write-Host "--- Creando usuario: $Username ---" -ForegroundColor Yellow

  $itemPath = Join-Path $PSScriptRoot $ItemFile
  if (-not (Test-Path $itemPath)) {
    throw "No se encuentra el fichero de datos '$itemPath'."
  }

  # Crear en Cognito (si ya existe, se ignora el error)
  Write-Host "  Cognito: creando usuario..." -ForegroundColor Gray
  aws cognito-idp admin-create-user `
    --user-pool-id $userPoolId `
    --username $Username `
    --temporary-password (New-TemporaryPassword) `
    --message-action SUPPRESS `
    --region $region `
    --no-cli-pager 2>$null | Out-Null

  # Establecer contraseña permanente
  Write-Host "  Cognito: estableciendo contraseña permanente..." -ForegroundColor Gray
  aws cognito-idp admin-set-user-password `
    --user-pool-id $userPoolId `
    --username $Username `
    --password $Password `
    --permanent `
    --region $region `
    --no-cli-pager
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo al establecer la contraseña de '$Username' en Cognito."
  }

  # Insertar en DynamoDB desde el fichero de datos (incluye licencia y apiKey)
  Write-Host "  DynamoDB: insertando datos de usuario ($ItemFile)..." -ForegroundColor Gray
  aws dynamodb put-item `
    --table-name $usersTable `
    --item "file://$itemPath" `
    --region $region `
    --no-cli-pager
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo al insertar el item de '$Username' en DynamoDB."
  }

  Write-Host "  OK: $Username creado" -ForegroundColor Green
  Write-Host ""
}

# ============================================================================
# Cargar variables de entorno desde .env
# ============================================================================

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
  }
}

$userPoolId = $env:USER_POOL_ID
$usersTable = $env:USERS_TABLE
$region = $env:AWS_REGION
if (-not $region) { $region = "eu-west-1" }

if (-not $userPoolId) {
  Write-Error "ERROR: Variable USER_POOL_ID no definida en aws/.env. Ejecuta 'aws cloudformation describe-stacks' para obtenerla."
  exit 1
}

if (-not $usersTable) {
  Write-Error "ERROR: Variable USERS_TABLE no definida en aws/.env."
  exit 1
}

Write-Host "=== Creando usuarios iniciales ===" -ForegroundColor Cyan
Write-Host "User Pool: $userPoolId" -ForegroundColor Gray
Write-Host "DynamoDB Table: $usersTable" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Resolver contraseñas antes de tocar AWS (falla rapido si falta alguna)
# ============================================================================

Write-Host "--- Resolviendo contraseñas ---" -ForegroundColor Yellow
$adminPlain = Resolve-Password -Username "admin.svvs" -FromParam $AdminPassword -EnvVarName "ADMIN_SVVS_PASSWORD"
if (-not $SkipTest) {
  $testPlain = Resolve-Password -Username "test" -FromParam $TestPassword -EnvVarName "TEST_PASSWORD"
}
Write-Host ""

# ============================================================================
# Crear usuarios
# ============================================================================

try {
  New-AppUser -Username "admin.svvs" -Password $adminPlain -ItemFile "admin-item.json"

  if (-not $SkipTest) {
    New-AppUser -Username "test" -Password $testPlain -ItemFile "test-item.json"
  }
}
finally {
  # Limpiar las contraseñas en claro de la memoria del script
  $adminPlain = $null
  $testPlain = $null
  [System.GC]::Collect()
}

# ============================================================================
# Resumen
# ============================================================================
Write-Host "=== Usuarios creados correctamente ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Usuario        | Display Name | Contraseña" -ForegroundColor White
Write-Host "  -------------- | ------------ | -----------------------" -ForegroundColor Gray
Write-Host "  admin.svvs     | VJC          | (la que has facilitado)" -ForegroundColor White
if (-not $SkipTest) {
  Write-Host "  test           | Test         | (la que has facilitado)" -ForegroundColor White
}
Write-Host ""
Write-Host "Puedes verificar en la consola de AWS:" -ForegroundColor Gray
Write-Host "  Cognito: https://console.aws.amazon.com/cognito/v2/idp/user-pools/$userPoolId/users" -ForegroundColor Gray
Write-Host "  DynamoDB: https://console.aws.amazon.com/dynamodbv2/home#item-explorer?table=$usersTable" -ForegroundColor Gray
