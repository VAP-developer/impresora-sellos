#Requires -Version 5.1
<#
.SYNOPSIS
    Script de despliegue de Stamp Sales para Windows.

.DESCRIPTION
    Compila la aplicación Electron y genera el instalador NSIS (.exe).
    Incluye verificación de requisitos, build de producción y generación
    del artefacto final.

.NOTES
    Ejecutar desde la raíz del proyecto.
    Requiere: Node.js 20+, npm.
    Recomendado: Ejecutar como Administrador (para reglas de firewall en la instalación posterior).

.EXAMPLE
    .\scripts\deploy-windows.ps1
    .\scripts\deploy-windows.ps1 -SkipInstall
#>

param(
    [switch]$SkipInstall,      # Omitir npm install (si ya están las dependencias)
    [switch]$SkipRebuild,      # Omitir rebuild de módulos nativos
    [switch]$OpenDist          # Abrir carpeta dist al finalizar
)

$ErrorActionPreference = "Stop"

# --- Colores y helpers ---
function Write-Step($step, $total, $msg) {
    Write-Host "`n[$step/$total] " -ForegroundColor Cyan -NoNewline
    Write-Host $msg
}

function Write-Ok($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Err($msg) {
    Write-Host "  [ERROR] $msg" -ForegroundColor Red
}

function Write-Warn($msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}

# --- Banner ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  STAMP SALES - Despliegue Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$totalSteps = 4
if ($SkipInstall) { $totalSteps-- }
if ($SkipRebuild) { $totalSteps-- }
$currentStep = 0

# --- 1. Verificar requisitos ---
Write-Host "Verificando requisitos..." -ForegroundColor White

# Node.js
$nodeVersion = $null
try {
    $nodeVersion = (node -v 2>$null)
} catch {}

if (-not $nodeVersion) {
    Write-Err "Node.js no encontrado. Instala Node.js 20+ desde https://nodejs.org/"
    exit 1
}

$major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($major -lt 20) {
    Write-Err "Se requiere Node.js 20+. Version actual: $nodeVersion"
    exit 1
}
Write-Ok "Node.js $nodeVersion"

# npm
$npmVersion = $null
try {
    $npmVersion = (npm -v 2>$null)
} catch {}

if (-not $npmVersion) {
    Write-Err "npm no encontrado."
    exit 1
}
Write-Ok "npm v$npmVersion"

# Verificar que estamos en la raíz del proyecto
if (-not (Test-Path "package.json")) {
    Write-Err "No se encuentra package.json. Ejecuta este script desde la raiz del proyecto."
    exit 1
}
Write-Ok "Directorio del proyecto correcto"

# --- 2. Instalar dependencias ---
if (-not $SkipInstall) {
    $currentStep++
    Write-Step $currentStep $totalSteps "Instalando dependencias..."

    npm install 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Fallo al instalar dependencias."
        exit 1
    }
    Write-Ok "Dependencias instaladas"
}

# --- 3. Rebuild módulos nativos ---
if (-not $SkipRebuild) {
    $currentStep++
    Write-Step $currentStep $totalSteps "Reconstruyendo modulos nativos (better-sqlite3 para Electron)..."

    npm run rebuild 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "npm run rebuild fallo. Intentando con npx directamente..."
        npx @electron/rebuild -f -w better-sqlite3 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Err "No se pudo reconstruir better-sqlite3."
            exit 1
        }
    }
    Write-Ok "Modulos nativos reconstruidos"
}

# --- 4. Build de producción ---
$currentStep++
Write-Step $currentStep $totalSteps "Generando build de produccion (electron-vite)..."

npx electron-vite build 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Err "Fallo en el build de produccion."
    exit 1
}
Write-Ok "Build de produccion completado"

# --- 5. Generar instalador ---
$currentStep++
Write-Step $currentStep $totalSteps "Generando instalador Windows (NSIS)..."

npx electron-builder --win --x64 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Err "Fallo al generar el instalador."
    exit 1
}
Write-Ok "Instalador generado"

# --- Resultado ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$installerPath = "dist\StampSales-Setup-1.0.0.exe"
if (Test-Path $installerPath) {
    $fileInfo = Get-Item $installerPath
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "  Instalador: " -NoNewline
    Write-Host $installerPath -ForegroundColor Yellow
    Write-Host "  Tamano:     $sizeMB MB"
    Write-Host "  Fecha:      $($fileInfo.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
} else {
    Write-Warn "No se encontro el instalador esperado. Buscando en dist\..."
    Get-ChildItem dist\*.exe 2>$null | ForEach-Object {
        Write-Host "  Encontrado: $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)"
    }
}

Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor White
Write-Host "  1. Copiar el .exe a la maquina de produccion"
Write-Host "  2. Ejecutar como administrador"
Write-Host "  3. Seguir el asistente de instalacion"
Write-Host ""

if ($OpenDist) {
    explorer.exe dist
}
