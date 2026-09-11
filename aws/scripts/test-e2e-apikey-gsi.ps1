<#
.SYNOPSIS
    Test end-to-end del GSI 'apiKey-index' en la tabla de usuarios (Paso 1).

.DESCRIPTION
    Verifica que el Global Secondary Index sobre 'apiKey' funciona tras desplegar
    el template. Es el índice que usarán las nuevas Lambdas (upload-url, delete-stamp)
    para validar la identidad con Query en lugar de Scan.

    Pasos del test:
    1. (Opcional) Despliega el stack para aplicar el cambio del template.
    2. Verifica que el GSI 'apiKey-index' existe y está ACTIVE.
    3. Ejecuta un Query por apiKey y comprueba que devuelve el usuario correcto.
    4. Ejecuta un Query con una apiKey inexistente y comprueba que devuelve 0 items.

    REQUISITOS:
    - AWS CLI configurado con credenciales válidas.
    - El usuario de prueba debe existir en DynamoDB con su apiKey.

.PARAMETER Deploy
    Si se indica, ejecuta 'cloudformation deploy' antes de los tests para aplicar
    el cambio del template. Sin este flag, el test solo verifica el estado actual.

.PARAMETER TableName
    Nombre de la tabla de usuarios. Default: "svvs-kiosko-users"

.PARAMETER IndexName
    Nombre del GSI a verificar. Default: "apiKey-index"

.PARAMETER ApiKey
    API Key existente que debe resolver a un usuario. Default: la del usuario "test".

.PARAMETER ExpectedUsername
    Username que debe devolver el Query para esa apiKey. Default: "test"

.EXAMPLE
    # Solo verificar (asume que ya se desplegó):
    .\test-e2e-apikey-gsi.ps1

    # Desplegar el cambio y luego verificar:
    .\test-e2e-apikey-gsi.ps1 -Deploy
#>

param(
    [switch]$Deploy,
    [string]$StackName = "svvs-kiosko-infra",
    [string]$TableName = "svvs-kiosko-users",
    [string]$IndexName = "apiKey-index",
    [string]$Region = "eu-west-1",
    [string]$ApiKey = "sk_test_Ht3bN6wK9pYf2mA5",
    [string]$ExpectedUsername = "test"
)

$ErrorActionPreference = "Stop"

$passed = 0
$failed = 0

function Write-TestResult($name, $success, $detail = "") {
    if ($success) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "         $detail" -ForegroundColor Yellow }
        $script:failed++
    }
}

# ============================================================================
# STEP 0 (opcional): Desplegar el cambio del template
# ============================================================================
if ($Deploy) {
    Write-Host "`n=== STEP 0: Desplegar stack (aplica el GSI) ===" -ForegroundColor Cyan
    $templatePath = Join-Path $PSScriptRoot "..\infra\template.yml"
    aws cloudformation deploy `
        --template-file $templatePath `
        --stack-name $StackName `
        --region $Region `
        --capabilities CAPABILITY_NAMED_IAM `
        --no-cli-pager
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: el deploy falló. Abortando." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Deploy completado" -ForegroundColor Gray
}

# ============================================================================
# STEP 1: Verificar que el GSI existe y está ACTIVE
# ============================================================================
Write-Host "`n=== STEP 1: Verificar que el GSI '$IndexName' existe y está ACTIVE ===" -ForegroundColor Cyan

try {
    $describeRaw = aws dynamodb describe-table `
        --table-name $TableName `
        --region $Region `
        --output json --no-cli-pager
    $describe = $describeRaw | ConvertFrom-Json
} catch {
    Write-TestResult "describe-table respondió" $false $_.Exception.Message
    Write-Host "`nRESULTADO: FAIL" -ForegroundColor Red
    exit 1
}

$gsi = $describe.Table.GlobalSecondaryIndexes | Where-Object { $_.IndexName -eq $IndexName }

Write-TestResult "El GSI '$IndexName' existe" ($null -ne $gsi)

if ($gsi) {
    # Un GSI recién creado tarda un poco en poblarse. Esperar a que pase a ACTIVE.
    if ($gsi.IndexStatus -ne "ACTIVE") {
        Write-Host "  GSI en estado '$($gsi.IndexStatus)', esperando a ACTIVE..." -ForegroundColor Gray
        $maxWaitSeconds = 300
        $waited = 0
        while ($gsi.IndexStatus -ne "ACTIVE" -and $waited -lt $maxWaitSeconds) {
            Start-Sleep -Seconds 10
            $waited += 10
            $describe = (aws dynamodb describe-table --table-name $TableName --region $Region --output json --no-cli-pager) | ConvertFrom-Json
            $gsi = $describe.Table.GlobalSecondaryIndexes | Where-Object { $_.IndexName -eq $IndexName }
            Write-Host "  ...$waited s (status: $($gsi.IndexStatus))" -ForegroundColor DarkGray
        }
    }

    Write-TestResult "El GSI está ACTIVE" ($gsi.IndexStatus -eq "ACTIVE") "Status: $($gsi.IndexStatus)"

    $hashKey = $gsi.KeySchema | Where-Object { $_.KeyType -eq "HASH" }
    Write-TestResult "La clave HASH del GSI es 'apiKey'" ($hashKey.AttributeName -eq "apiKey") "Got: $($hashKey.AttributeName)"
} else {
    Write-TestResult "El GSI está ACTIVE" $false "GSI no encontrado"
    Write-TestResult "La clave HASH del GSI es 'apiKey'" $false "GSI no encontrado"
}

# ============================================================================
# STEP 2: Query por apiKey → debe devolver el usuario esperado
# ============================================================================
Write-Host "`n=== STEP 2: Query por apiKey existente ===" -ForegroundColor Cyan

# El JSON de --expression-attribute-values se pasa vía archivo temporal para
# evitar problemas de escapado de comillas entre PowerShell, cmd y el AWS CLI.
$attrValuesFile = Join-Path $env:TEMP "gsi-test-attrvalues.json"

try {
    @{ ":k" = @{ S = $ApiKey } } | ConvertTo-Json -Compress | Set-Content -Path $attrValuesFile -Encoding ascii

    $queryRaw = aws dynamodb query `
        --table-name $TableName `
        --index-name $IndexName `
        --key-condition-expression "apiKey = :k" `
        --expression-attribute-values "file://$attrValuesFile" `
        --region $Region `
        --output json --no-cli-pager
    $query = $queryRaw | ConvertFrom-Json

    Write-TestResult "Query devolvió exactamente 1 item" ($query.Count -eq 1) "Count: $($query.Count)"

    if ($query.Count -ge 1) {
        $returnedUser = $query.Items[0].username.S
        Write-TestResult "El item devuelto es el usuario esperado" ($returnedUser -eq $ExpectedUsername) "Got: $returnedUser / Expected: $ExpectedUsername"
    } else {
        Write-TestResult "El item devuelto es el usuario esperado" $false "Query no devolvió items"
    }
} catch {
    Write-TestResult "Query por apiKey existente" $false $_.Exception.Message
}

# ============================================================================
# STEP 3: Query por apiKey inexistente → debe devolver 0 items
# ============================================================================
Write-Host "`n=== STEP 3: Query por apiKey inexistente ===" -ForegroundColor Cyan

$fakeKey = "sk_nonexistent_0000000000000000"
try {
    @{ ":k" = @{ S = $fakeKey } } | ConvertTo-Json -Compress | Set-Content -Path $attrValuesFile -Encoding ascii

    $queryFakeRaw = aws dynamodb query `
        --table-name $TableName `
        --index-name $IndexName `
        --key-condition-expression "apiKey = :k" `
        --expression-attribute-values "file://$attrValuesFile" `
        --region $Region `
        --output json --no-cli-pager
    $queryFake = $queryFakeRaw | ConvertFrom-Json

    Write-TestResult "Query con apiKey inexistente devuelve 0 items" ($queryFake.Count -eq 0) "Count: $($queryFake.Count)"
} catch {
    Write-TestResult "Query por apiKey inexistente" $false $_.Exception.Message
}

# Limpiar archivo temporal
if (Test-Path $attrValuesFile) { Remove-Item $attrValuesFile -Force }

# ============================================================================
# RESULTADOS
# ============================================================================
Write-Host "`n============================================" -ForegroundColor White
Write-Host "  RESULTADOS E2E APIKEY-GSI" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host "  Total:    $($passed + $failed)" -ForegroundColor White
Write-Host "  Pasaron:  $passed" -ForegroundColor Green
Write-Host "  Fallaron: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "============================================`n" -ForegroundColor White

if ($failed -gt 0) {
    Write-Host "RESULTADO: FAIL" -ForegroundColor Red
    exit 1
} else {
    Write-Host "RESULTADO: PASS" -ForegroundColor Green
    exit 0
}
