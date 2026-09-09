param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [int]$WidthMm = 55,
    [int]$HeightMm = 25
)

# set-stamp-paper-size.ps1
#
# Deja el tamaño de papel del driver listo para imprimir sellos.
#
# ┌──────────────────────────────────────────────────────────────────────────┐
# │  EL TAMAÑO ES 55x25mm — el de la etiqueta física. NO PONER 55x55.        │
# │                                                                          │
# │  Verificado en papel en la TD-4520TN:                                    │
# │    - Con 55x25 imprime.                                                  │
# │    - Con 55x55 NO imprime NADA: la impresora lleva sensor de huecos y     │
# │      espera etiquetas de 25mm; si se le declara un papel de 55mm de alto  │
# │      intenta avanzar 55mm, no encuentra el hueco y descarta el trabajo    │
# │      (el spooler informa de "impreso correctamente" y no sale papel).     │
# │                                                                          │
# │  La aplicación genera la página del PDF también a 55x25mm y compensa el   │
# │  giro de 90° que aplica la impresora — ver applyPrinterRotation() en      │
# │  src/main/printing/stamp-renderer.ts                                     │
# └──────────────────────────────────────────────────────────────────────────┘
#
# POR QUÉ EL PRINTTICKET Y NO EL REGISTRO
#   La versión anterior de este script escribía bytes en el DevMode por-usuario
#   (HKCU\Printers\DevModePerUser). Eso resultó poco fiable:
#     - SumatraPDF sólo respeta ese DevMode de forma inconsistente, así que el
#       mismo trabajo imprimía o no de forma aleatoria.
#     - La configuración EFECTIVA del driver seguía siendo la de fábrica de las
#       TD-4520TN (4"x6" = 101.6x152.4mm), como se comprobó con
#       Get-PrintConfiguration.
#     - Escribir bytes crudos en un DEVMODE grande (8232 bytes en la TD-4520TN,
#       frente a 496 en la TD-4100N) dejaba su sección privada incoherente y la
#       impresora descartaba el trabajo en silencio: el spooler informaba de
#       "impreso correctamente" y no salía papel.
#
#   Set-PrintConfiguration actúa sobre el PrintTicket, que es la configuración
#   que el driver usa realmente, y el propio driver valida la estructura.
#
# Idempotente: si el tamaño ya es el correcto, no hace nada.

$ErrorActionPreference = 'Stop'

$wMicron = $WidthMm * 1000
$hMicron = $HeightMm * 1000

function Get-MediaSize([string]$xml) {
    $m = [regex]::Matches($xml, 'MediaSize(Width|Height)"><psf:Value[^>]*>(\d+)')
    $w = ($m | Where-Object { $_.Groups[1].Value -eq 'Width' }  | Select-Object -First 1)
    $h = ($m | Where-Object { $_.Groups[1].Value -eq 'Height' } | Select-Object -First 1)
    if (-not $w -or -not $h) { return $null }
    return @{ W = [int]$w.Groups[2].Value; H = [int]$h.Groups[2].Value }
}

try {
    $cfg = Get-PrintConfiguration -PrinterName $PrinterName
} catch {
    Write-Host "ERROR: no se pudo leer la configuracion de '$PrinterName': $($_.Exception.Message)"
    exit 1
}

$pt = $cfg.PrintTicketXML
$cur = Get-MediaSize $pt

if ($cur) {
    Write-Host "Actual: $([math]::Round($cur.W/1000,1))x$([math]::Round($cur.H/1000,1))mm"
    if ($cur.W -eq $wMicron -and $cur.H -eq $hMicron) {
        Write-Host "OK: '$PrinterName' ya esta en ${WidthMm}x${HeightMm}mm (sin cambios)"
        exit 0
    }
} else {
    Write-Host 'Actual: (no se pudo leer MediaSize)'
}

# Sustituir MediaSizeWidth / MediaSizeHeight y forzar tamaño personalizado para
# que el driver no reimponga un formulario predefinido (p.ej. el 4"x6").
$new = [regex]::Replace($pt, '(MediaSizeWidth"><psf:Value[^>]*>)(\d+)',  "`${1}$wMicron")
$new = [regex]::Replace($new, '(MediaSizeHeight"><psf:Value[^>]*>)(\d+)', "`${1}$hMicron")
$new = [regex]::Replace(
    $new,
    '<psf:Feature name="psk:PageMediaSize"><psf:Option name="[^"]*">',
    '<psf:Feature name="psk:PageMediaSize"><psf:Option name="psk:CustomMediaSize">'
)

try {
    Set-PrintConfiguration -PrinterName $PrinterName -PrintTicketXML $new
} catch {
    Write-Host "ERROR al aplicar la configuracion: $($_.Exception.Message)"
    exit 1
}

# Verificar releyendo del sistema
$after = Get-MediaSize (Get-PrintConfiguration -PrinterName $PrinterName).PrintTicketXML
if ($after -and $after.W -eq $wMicron -and $after.H -eq $hMicron) {
    Write-Host "OK: '$PrinterName' configurado a ${WidthMm}x${HeightMm}mm"
    exit 0
} else {
    $shown = if ($after) { "$([math]::Round($after.W/1000,1))x$([math]::Round($after.H/1000,1))mm" } else { 'desconocido' }
    Write-Host "AVISO: el driver no acepto el tamano (sigue en $shown). Configuralo desde Preferencias de impresion."
    exit 2
}
