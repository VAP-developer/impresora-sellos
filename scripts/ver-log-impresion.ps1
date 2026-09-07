# ver-log-impresion.ps1
#
# Muestra el log del proceso main de la aplicación, filtrando lo relevante
# para diagnosticar la impresión.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\ver-log-impresion.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\ver-log-impresion.ps1 -Seguir
#   powershell -ExecutionPolicy Bypass -File scripts\ver-log-impresion.ps1 -Todo

param(
    [switch]$Seguir,   # sigue el log en vivo (como tail -f)
    [switch]$Todo,     # muestra todas las líneas, sin filtrar
    [int]$Lineas = 80  # número de líneas finales a mostrar
)

$logPath = Join-Path $env:APPDATA 'stamp-sales-app\logs\main.log'

if (-not (Test-Path $logPath)) {
    Write-Host "No existe el log todavía: $logPath" -ForegroundColor Yellow
    Write-Host "Arranca la aplicación (version nueva) y vuelve a ejecutar este script."
    exit 1
}

Write-Host "Log: $logPath" -ForegroundColor Cyan
Write-Host ("Tamaño: {0:N0} bytes | Modificado: {1}" -f (Get-Item $logPath).Length, (Get-Item $logPath).LastWriteTime) -ForegroundColor Cyan
Write-Host ("-" * 100)

# Patrón de lo relevante para impresión
$patron = 'PrintQueue|WindowsBackend|PrinterManager|Services|Logger|startup|Sale|FATAL|ERROR|WARN'

function Show-Line($line) {
    if ($line -match '\[ERROR\]|\[FATAL\]|FAILED|THREW|WARNING') {
        Write-Host $line -ForegroundColor Red
    } elseif ($line -match '\[WARN\]') {
        Write-Host $line -ForegroundColor Yellow
    } elseif ($line -match ' OK | ENQUEUE | START ') {
        Write-Host $line -ForegroundColor Green
    } else {
        Write-Host $line
    }
}

if ($Seguir) {
    Write-Host "Siguiendo el log en vivo. Haz una venta en la app. Ctrl+C para salir.`n" -ForegroundColor Green
    Get-Content $logPath -Tail 5 -Wait | ForEach-Object {
        if ($Todo -or $_ -match $patron) { Show-Line $_ }
    }
} else {
    $content = Get-Content $logPath -Tail $Lineas
    if (-not $Todo) {
        $content = $content | Where-Object { $_ -match $patron }
    }
    if (-not $content) {
        Write-Host "(sin líneas que coincidan; prueba con -Todo)" -ForegroundColor Yellow
    } else {
        $content | ForEach-Object { Show-Line $_ }
    }
}
