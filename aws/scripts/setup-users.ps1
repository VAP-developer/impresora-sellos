# setup-users.ps1
# Crea los usuarios iniciales en Cognito y DynamoDB.
#
# Uso:
#   .\setup-users.ps1
#
# Requisitos:
#   - AWS CLI configurado
#   - Stack svvs-kiosko-infra desplegado (Cognito + DynamoDB creados)
#   - Variables en aws/.env (USER_POOL_ID, USERS_TABLE)

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
# Usuario 1: admin.svvs
# ============================================================================
Write-Host "--- Creando usuario: admin.svvs ---" -ForegroundColor Yellow

# Crear en Cognito
Write-Host "  Cognito: creando usuario..." -ForegroundColor Gray
aws cognito-idp admin-create-user `
  --user-pool-id $userPoolId `
  --username "admin.svvs" `
  --temporary-password "TempPass1!" `
  --message-action SUPPRESS `
  --region $region 2>$null

# Establecer contraseña permanente
Write-Host "  Cognito: estableciendo contraseña permanente..." -ForegroundColor Gray
aws cognito-idp admin-set-user-password `
  --user-pool-id $userPoolId `
  --username "admin.svvs" `
  --password "Sv#vjc!vS.2026" `
  --permanent `
  --region $region

# Insertar en DynamoDB
Write-Host "  DynamoDB: insertando datos de usuario..." -ForegroundColor Gray
$adminItem = '{"username":{"S":"admin.svvs"},"userId":{"S":"usr_admin_svvs"},"displayName":{"S":"VJC"},"welcomeMessage":{"S":"Bienvenido VJC"}}'

aws dynamodb put-item `
  --table-name $usersTable `
  --item $adminItem `
  --region $region

Write-Host "  OK: admin.svvs creado" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Usuario 2: test
# ============================================================================
Write-Host "--- Creando usuario: test ---" -ForegroundColor Yellow

# Crear en Cognito
Write-Host "  Cognito: creando usuario..." -ForegroundColor Gray
aws cognito-idp admin-create-user `
  --user-pool-id $userPoolId `
  --username "test" `
  --temporary-password "TempPass1!" `
  --message-action SUPPRESS `
  --region $region 2>$null

# Establecer contraseña permanente
Write-Host "  Cognito: estableciendo contraseña permanente..." -ForegroundColor Gray
aws cognito-idp admin-set-user-password `
  --user-pool-id $userPoolId `
  --username "test" `
  --password "test_123" `
  --permanent `
  --region $region

# Insertar en DynamoDB
Write-Host "  DynamoDB: insertando datos de usuario..." -ForegroundColor Gray
$testItem = '{"username":{"S":"test"},"userId":{"S":"usr_test"},"displayName":{"S":"Test"},"welcomeMessage":{"S":"Bienvenido Test"}}'

aws dynamodb put-item `
  --table-name $usersTable `
  --item $testItem `
  --region $region

Write-Host "  OK: test creado" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Resumen
# ============================================================================
Write-Host "=== Usuarios creados correctamente ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Usuario        | Password        | Display Name" -ForegroundColor White
Write-Host "  -------------- | --------------- | ------------" -ForegroundColor Gray
Write-Host "  admin.svvs     | Sv#vjc!vS.2026  | VJC" -ForegroundColor White
Write-Host "  test           | test_123        | Test" -ForegroundColor White
Write-Host ""
Write-Host "Puedes verificar en la consola de AWS:" -ForegroundColor Gray
Write-Host "  Cognito: https://console.aws.amazon.com/cognito/v2/idp/user-pools/$userPoolId/users" -ForegroundColor Gray
Write-Host "  DynamoDB: https://console.aws.amazon.com/dynamodbv2/home#item-explorer?table=$usersTable" -ForegroundColor Gray
