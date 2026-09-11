<#
.SYNOPSIS
    Test end-to-end de los endpoints /api/stamps/upload-url y /api/stamps/delete.

.DESCRIPTION
    Prueba el flujo completo vía HTTP contra la API desplegada:
    1. POST /api/stamps/upload-url  -> obtiene presigned POST
    2. Sube un archivo real a S3 con esa presigned POST
    3. Verifica que el objeto existe en S3
    4. Intenta subir un archivo > 2 MB -> S3 debe rechazarlo (límite de coste)
    5. POST /api/stamps/delete -> borra el sello
    6. Verifica que el objeto ya no existe en S3
    7. Comprueba el aislamiento: stampName con "/" -> 400

    REQUISITOS: AWS CLI configurado + usuario "test" con apiKey/machineId.

.EXAMPLE
    .\test-e2e-upload-delete.ps1
#>

param(
    [string]$ApiBase = "https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod",
    [string]$ApiKey = "sk_test_Ht3bN6wK9pYf2mA5",
    [string]$MachineId = "f1419567-2d6e-4fce-950a-160286b0634f",
    [string]$Username = "test",
    [string]$Bucket = "svvs-kiosko-stamps",
    [string]$Region = "eu-west-1"
)

$ErrorActionPreference = "Stop"

# PowerShell 5.1 usa por defecto TLS antiguo; forzar TLS 1.2 para hablar con API Gateway/S3.
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$uploadUrlEndpoint = "$ApiBase/api/stamps/upload-url"
$deleteEndpoint = "$ApiBase/api/stamps/delete"

$testYear = "2099"
$testStamp = "E2E-UploadDelete"
$s3Prefix = "$Username/$testYear/$testStamp"
$fondoKey = "$s3Prefix/$testStamp-fondo.jpg"

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

function Cleanup {
    try { aws s3 rm "s3://$Bucket/$s3Prefix/" --recursive --region $Region 2>$null | Out-Null } catch {}
}

# Sube un archivo a una presigned POST de S3 usando HttpClient (compatible con PS 5.1).
# Devuelve el código de estado HTTP; lanza si hay error de red.
function Invoke-PresignedPost($url, $fields, $filePath, $fileContentType) {
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    try {
        $content = New-Object System.Net.Http.MultipartFormDataContent
        # Los fields de la presigned deben ir ANTES del campo file, y en orden.
        foreach ($p in $fields.PSObject.Properties) {
            $sc = New-Object System.Net.Http.StringContent($p.Value)
            $content.Add($sc, '"' + $p.Name + '"')
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $fileContent = New-Object System.Net.Http.ByteArrayContent(, $bytes)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($fileContentType)
        $content.Add($fileContent, '"file"', [System.IO.Path]::GetFileName($filePath))

        $resp = $client.PostAsync($url, $content).GetAwaiter().GetResult()
        return [int]$resp.StatusCode
    } finally {
        $client.Dispose()
    }
}

# ============================================================================
# STEP 1: Pedir presigned POST URL
# ============================================================================
Write-Host "`n=== STEP 1: POST /api/stamps/upload-url ===" -ForegroundColor Cyan

$body = @{
    apiKey = $ApiKey
    machineId = $MachineId
    year = $testYear
    stampName = $testStamp
    fileType = "fondo"
} | ConvertTo-Json

try {
    $r1 = Invoke-RestMethod -Uri $uploadUrlEndpoint -Method POST -Body $body -ContentType "application/json"
    Write-TestResult "upload-url responde ok" ($r1.ok -eq $true) "resp: $($r1 | ConvertTo-Json -Compress)"
    Write-TestResult "Devuelve upload.url" ($null -ne $r1.upload.url)
    Write-TestResult "Devuelve upload.fields" ($null -ne $r1.upload.fields)
    Write-TestResult "La key se deriva del usuario" ($r1.key -eq $fondoKey) "key: $($r1.key)"
} catch {
    Write-TestResult "upload-url responde ok" $false $_.Exception.Message
    Cleanup
    exit 1
}

# ============================================================================
# STEP 2: Subir un archivo real a S3 con la presigned POST
# ============================================================================
Write-Host "`n=== STEP 2: Subir archivo válido (< 2 MB) a S3 ===" -ForegroundColor Cyan

$tempDir = Join-Path $env:TEMP "e2e-upload-delete"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Archivo JPEG de prueba pequeño (~50 KB de contenido dummy)
$smallFile = Join-Path $tempDir "small.jpg"
[System.IO.File]::WriteAllBytes($smallFile, (New-Object byte[] 51200))

try {
    $status = Invoke-PresignedPost $r1.upload.url $r1.upload.fields $smallFile "image/jpeg"
    # S3 responde 204 (o 201) en un POST correcto
    Write-TestResult "Subida a S3 aceptada" ($status -ge 200 -and $status -lt 300) "HTTP $status"
} catch {
    Write-TestResult "Subida a S3 aceptada" $false $_.Exception.Message
}

# ============================================================================
# STEP 3: Verificar que el objeto existe
# ============================================================================
Write-Host "`n=== STEP 3: Verificar objeto en S3 ===" -ForegroundColor Cyan

Start-Sleep -Seconds 2
$exists = $false
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    aws s3api head-object --bucket $Bucket --key $fondoKey --region $Region 2>$null | Out-Null
    $exists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $prev
} catch { $exists = $false }
Write-TestResult "El objeto subido existe en S3" $exists

# ============================================================================
# STEP 4: Intentar subir un archivo > 2 MB (debe fallar por content-length-range)
# ============================================================================
Write-Host "`n=== STEP 4: Rechazo de archivo > 2 MB ===" -ForegroundColor Cyan

# Se necesita una presigned NUEVA (la anterior es de un solo uso lógico).
$r4 = Invoke-RestMethod -Uri $uploadUrlEndpoint -Method POST -Body $body -ContentType "application/json"

$bigFile = Join-Path $tempDir "big.jpg"
[System.IO.File]::WriteAllBytes($bigFile, (New-Object byte[] (3 * 1024 * 1024)))  # 3 MB

$bigStatus = 0
try {
    $bigStatus = Invoke-PresignedPost $r4.upload.url $r4.upload.fields $bigFile "image/jpeg"
} catch {
    $bigStatus = 403
}
# S3 rechaza con 4xx (típicamente 403) por exceder content-length-range
Write-TestResult "S3 rechaza archivo > 2 MB" ($bigStatus -ge 400) "HTTP $bigStatus (esperado 4xx por content-length-range)"

# ============================================================================
# STEP 5: Borrar el sello vía /api/stamps/delete
# ============================================================================
Write-Host "`n=== STEP 5: POST /api/stamps/delete ===" -ForegroundColor Cyan

$delBody = @{
    apiKey = $ApiKey
    machineId = $MachineId
    year = $testYear
    stampName = $testStamp
} | ConvertTo-Json

try {
    $r5 = Invoke-RestMethod -Uri $deleteEndpoint -Method POST -Body $delBody -ContentType "application/json"
    Write-TestResult "delete responde ok" ($r5.ok -eq $true) "resp: $($r5 | ConvertTo-Json -Compress)"
    Write-TestResult "Reporta objetos borrados" ($r5.deleted -ge 1) "deleted=$($r5.deleted)"
} catch {
    Write-TestResult "delete responde ok" $false $_.Exception.Message
}

# ============================================================================
# STEP 6: Verificar que ya no existe
# ============================================================================
Write-Host "`n=== STEP 6: Verificar que el objeto desapareció ===" -ForegroundColor Cyan

Start-Sleep -Seconds 2
# head-object escribe al stderr si el objeto no existe; con ErrorActionPreference=Stop
# eso abortaría el script, así que lo ejecutamos tolerando el error y miramos el exit code.
$stillExists = $true
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    aws s3api head-object --bucket $Bucket --key $fondoKey --region $Region 2>$null | Out-Null
    $stillExists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $prev
} catch {
    $stillExists = $false
}
Write-TestResult "El objeto ya no existe en S3" (-not $stillExists)

# ============================================================================
# STEP 7: Aislamiento - stampName con "/" debe dar 400
# ============================================================================
Write-Host "`n=== STEP 7: Rechazo de stampName malicioso ===" -ForegroundColor Cyan

$evilBody = @{
    apiKey = $ApiKey
    machineId = $MachineId
    year = $testYear
    stampName = "../otro-usuario"
    fileType = "fondo"
} | ConvertTo-Json

$got400 = $false
try {
    Invoke-RestMethod -Uri $uploadUrlEndpoint -Method POST -Body $evilBody -ContentType "application/json" | Out-Null
} catch {
    $got400 = ($_.Exception.Response.StatusCode.value__ -eq 400)
}
Write-TestResult "stampName con '/' rechazado (400)" $got400

# ============================================================================
# Limpieza y resultados
# ============================================================================
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
Cleanup

Write-Host "`n============================================" -ForegroundColor White
Write-Host "  RESULTADOS E2E UPLOAD-DELETE" -ForegroundColor White
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
