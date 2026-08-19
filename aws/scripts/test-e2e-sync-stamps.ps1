<#
.SYNOPSIS
    Test end-to-end del flujo de sincronización de sellos.

.DESCRIPTION
    Este script realiza un test completo del ciclo de sincronización:
    1. Sube imágenes de prueba al bucket S3
    2. Llama al API de sincronización
    3. Verifica que el catálogo contiene el sello subido
    4. Elimina la carpeta del bucket
    5. Re-sincroniza
    6. Verifica que el sello desaparece del catálogo
    7. Limpia datos de prueba

    REQUISITOS:
    - AWS CLI configurado con credenciales válidas
    - El usuario de prueba ("test") debe existir en DynamoDB con el apiKey y machineId correspondientes

.PARAMETER Username
    Nombre de usuario cuya carpeta S3 se usará. Default: "test"

.PARAMETER ApiKey
    API Key del usuario de prueba. Default: "sk_test_Ht3bN6wK9pYf2mA5"

.PARAMETER MachineId
    Machine ID registrado para el usuario. Default: "f1419567-2d6e-4fce-950a-160286b0634f"

.PARAMETER Bucket
    Nombre del bucket S3. Default: "svvs-kiosko-stamps"

.PARAMETER ApiEndpoint
    URL del endpoint de sincronización. Default: la URL de producción.

.EXAMPLE
    .\test-e2e-sync-stamps.ps1
    .\test-e2e-sync-stamps.ps1 -Username "test" -ApiKey "sk_test_..." -MachineId "..."
#>

param(
    [string]$Username = "test",
    [string]$ApiKey = "sk_test_Ht3bN6wK9pYf2mA5",
    [string]$MachineId = "f1419567-2d6e-4fce-950a-160286b0634f",
    [string]$Bucket = "svvs-kiosko-stamps",
    [string]$ApiEndpoint = "https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api/stamps/sync"
)

$ErrorActionPreference = "Stop"

# --- Minimal valid image data (base64) ---
# 1x1 pixel JPEG (107 bytes)
$jpegBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SgSPCQoWFBYXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC/RRRQAf/Z"

# 1x1 pixel PNG (67 bytes)
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

# --- Test metadata ---
$testYear = "2099"
$testStampName = "E2E-TestStamp"
$s3Prefix = "$Username/$testYear/$testStampName"
$fondoKey = "$s3Prefix/${testStampName}-fondo.jpg"
$logoKey = "$s3Prefix/${testStampName}-sello.png"

$passed = 0
$failed = 0
$results = @()

function Write-TestResult($name, $success, $detail = "") {
    if ($success) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "         $detail" -ForegroundColor Yellow }
        $script:failed++
    }
    $script:results += [PSCustomObject]@{ Name = $name; Success = $success; Detail = $detail }
}

function Cleanup-S3 {
    Write-Host "`n--- Limpieza S3 ---" -ForegroundColor Cyan
    try {
        aws s3 rm "s3://$Bucket/$s3Prefix/" --recursive --region eu-west-1 2>$null
        Write-Host "  Carpeta de prueba eliminada de S3" -ForegroundColor Gray
    } catch {
        Write-Host "  (Nada que limpiar o error menor)" -ForegroundColor Gray
    }
}

# ============================================================================
# STEP 1: Upload test images to S3
# ============================================================================
Write-Host "`n=== STEP 1: Subir imágenes de prueba a S3 ===" -ForegroundColor Cyan
Write-Host "  Bucket: $Bucket"
Write-Host "  Prefix: $s3Prefix"

# Create temp files from base64
$tempDir = Join-Path $env:TEMP "e2e-sync-stamps-test"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$fondoFile = Join-Path $tempDir "${testStampName}-fondo.jpg"
$logoFile = Join-Path $tempDir "${testStampName}-sello.png"

[System.IO.File]::WriteAllBytes($fondoFile, [System.Convert]::FromBase64String($jpegBase64))
[System.IO.File]::WriteAllBytes($logoFile, [System.Convert]::FromBase64String($pngBase64))

# Upload to S3
try {
    aws s3 cp $fondoFile "s3://$Bucket/$fondoKey" --region eu-west-1 | Out-Null
    aws s3 cp $logoFile "s3://$Bucket/$logoKey" --region eu-west-1 | Out-Null
    Write-TestResult "Imágenes subidas a S3" $true
} catch {
    Write-TestResult "Imágenes subidas a S3" $false $_.Exception.Message
    Cleanup-S3
    exit 1
}

# ============================================================================
# STEP 2: Call sync API
# ============================================================================
Write-Host "`n=== STEP 2: Llamar al API de sincronización ===" -ForegroundColor Cyan

$body = @{
    apiKey = $ApiKey
    machineId = $MachineId
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $ApiEndpoint -Method POST -Body $body -ContentType "application/json"
    Write-TestResult "API respondió OK" ($response1.ok -eq $true)
} catch {
    Write-TestResult "API respondió OK" $false $_.Exception.Message
    Cleanup-S3
    exit 1
}

# ============================================================================
# STEP 3: Verify stamp is in catalog with status "complete"
# ============================================================================
Write-Host "`n=== STEP 3: Verificar sello en catálogo ===" -ForegroundColor Cyan

$expectedStampId = "$testYear#$testStampName"
$foundStamp = $response1.catalog | Where-Object { $_.stampId -eq $expectedStampId }

Write-TestResult "Sello encontrado en catálogo" ($null -ne $foundStamp)

if ($foundStamp) {
    Write-TestResult "Status es 'complete'" ($foundStamp.status -eq "complete") "Got: $($foundStamp.status)"
    Write-TestResult "Tiene fondoUrl" ($null -ne $foundStamp.fondoUrl -and $foundStamp.fondoUrl -ne "")
    Write-TestResult "Tiene logoUrl" ($null -ne $foundStamp.logoUrl -and $foundStamp.logoUrl -ne "")
    Write-TestResult "stampName correcto" ($foundStamp.stampName -eq $testStampName) "Got: $($foundStamp.stampName)"
    Write-TestResult "year correcto" ($foundStamp.year -eq $testYear) "Got: $($foundStamp.year)"
} else {
    Write-TestResult "Status es 'complete'" $false "Sello no encontrado"
    Write-TestResult "Tiene fondoUrl" $false "Sello no encontrado"
    Write-TestResult "Tiene logoUrl" $false "Sello no encontrado"
    Write-TestResult "stampName correcto" $false "Sello no encontrado"
    Write-TestResult "year correcto" $false "Sello no encontrado"
}

# ============================================================================
# STEP 4: Remove test stamp from S3
# ============================================================================
Write-Host "`n=== STEP 4: Eliminar carpeta del bucket ===" -ForegroundColor Cyan

try {
    aws s3 rm "s3://$Bucket/$s3Prefix/" --recursive --region eu-west-1 | Out-Null
    Write-TestResult "Carpeta eliminada de S3" $true
} catch {
    Write-TestResult "Carpeta eliminada de S3" $false $_.Exception.Message
}

# ============================================================================
# STEP 5: Re-sync
# ============================================================================
Write-Host "`n=== STEP 5: Re-sincronizar ===" -ForegroundColor Cyan

try {
    $response2 = Invoke-RestMethod -Uri $ApiEndpoint -Method POST -Body $body -ContentType "application/json"
    Write-TestResult "Segunda sincronización OK" ($response2.ok -eq $true)
} catch {
    Write-TestResult "Segunda sincronización OK" $false $_.Exception.Message
    Cleanup-S3
    exit 1
}

# ============================================================================
# STEP 6: Verify stamp is no longer in catalog
# ============================================================================
Write-Host "`n=== STEP 6: Verificar que el sello ya no está ===" -ForegroundColor Cyan

$removedStamp = $response2.catalog | Where-Object { $_.stampId -eq $expectedStampId }
Write-TestResult "Sello eliminado del catálogo" ($null -eq $removedStamp) $(if ($removedStamp) { "Sello todavía presente" } else { "" })

# Verify summary reports removal
if ($response2.summary) {
    Write-TestResult "Summary reporta eliminación" ($response2.summary.removed -ge 1) "removed=$($response2.summary.removed)"
}

# ============================================================================
# STEP 7: Cleanup
# ============================================================================
Write-Host "`n=== STEP 7: Limpieza final ===" -ForegroundColor Cyan

# Remove temp files
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
    Write-Host "  Archivos temporales eliminados" -ForegroundColor Gray
}

# Final S3 cleanup (in case anything remains)
Cleanup-S3

# ============================================================================
# RESULTS SUMMARY
# ============================================================================
Write-Host "`n============================================" -ForegroundColor White
Write-Host "  RESULTADOS E2E SYNC-STAMPS" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host "  Total:   $($passed + $failed)" -ForegroundColor White
Write-Host "  Pasaron: $passed" -ForegroundColor Green
Write-Host "  Fallaron: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "============================================`n" -ForegroundColor White

if ($failed -gt 0) {
    Write-Host "RESULTADO: FAIL" -ForegroundColor Red
    exit 1
} else {
    Write-Host "RESULTADO: PASS" -ForegroundColor Green
    exit 0
}
