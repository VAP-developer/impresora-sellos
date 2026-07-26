@echo off
REM ============================================================================
REM  deploy-windows.bat - Script de despliegue para Stamp Sales en Windows
REM
REM  Uso: Ejecutar desde la raíz del proyecto en una terminal con permisos
REM       de administrador (necesario para reglas de firewall).
REM
REM  Pasos que ejecuta:
REM    1. Verifica requisitos (Node.js 20+, npm)
REM    2. Instala dependencias
REM    3. Reconstruye módulos nativos para Electron
REM    4. Genera el build de producción
REM    5. Genera el instalador .exe (NSIS)
REM    6. Muestra la ruta del instalador generado
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================
echo   STAMP SALES - Despliegue Windows
echo ============================================
echo.

REM --- 1. Verificar Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado. Instala Node.js 20+ desde https://nodejs.org/
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_RAW=%%a
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% lss 20 (
    echo [ERROR] Se requiere Node.js 20+. Version actual: %NODE_RAW%
    echo         Descarga desde https://nodejs.org/
    exit /b 1
)
echo [OK] Node.js version: 
node -v

REM --- 2. Verificar npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm no encontrado.
    exit /b 1
)
echo [OK] npm version: 
npm -v

REM --- 3. Instalar dependencias ---
echo.
echo [1/4] Instalando dependencias...
echo.
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al instalar dependencias.
    exit /b 1
)
echo [OK] Dependencias instaladas.

REM --- 4. Reconstruir modulos nativos para Electron ---
echo.
echo [2/4] Reconstruyendo modulos nativos (better-sqlite3)...
echo.
call npm run rebuild
if %errorlevel% neq 0 (
    echo [WARN] Fallo en rebuild. Intentando con npx directamente...
    call npx @electron/rebuild -f -w better-sqlite3
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo reconstruir better-sqlite3 para Electron.
        exit /b 1
    )
)
echo [OK] Modulos nativos reconstruidos.

REM --- 5. Build de produccion (electron-vite) ---
echo.
echo [3/4] Generando build de produccion...
echo.
call npx electron-vite build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo en el build de produccion.
    exit /b 1
)
echo [OK] Build de produccion completado.

REM --- 6. Generar instalador Windows (.exe NSIS) ---
echo.
echo [4/4] Generando instalador Windows...
echo.
call npx electron-builder --win --x64
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al generar el instalador.
    exit /b 1
)

REM --- 7. Resultado ---
echo.
echo ============================================
echo   DESPLIEGUE COMPLETADO
echo ============================================
echo.
echo Instalador generado en:
echo   dist\StampSales-Setup-1.0.0.exe
echo.
echo Para instalar en la maquina de produccion:
echo   1. Copiar el .exe a la maquina destino
echo   2. Ejecutar como administrador
echo   3. Seguir el asistente de instalacion
echo.

if exist "dist\StampSales-Setup-1.0.0.exe" (
    echo [OK] Archivo encontrado: dist\StampSales-Setup-1.0.0.exe
    for %%I in ("dist\StampSales-Setup-1.0.0.exe") do echo     Tamano: %%~zI bytes
) else (
    echo [WARN] No se encontro el archivo esperado. Revisa la carpeta dist\
    dir dist\*.exe 2>nul
)

echo.
pause
