param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [int]$WidthMm = 55,
    [int]$HeightMm = 55
)

# set-driver-mediasize.ps1
#
# Configura el tamaño de papel EFECTIVO del driver (no el DevMode por-usuario
# del registro) usando el PrintTicket de Windows.
#
# Por qué el PrintTicket y no el registro:
#   El DevMode del registro (HKCU\Printers\DevModePerUser) sólo lo respeta
#   SumatraPDF de forma inconsistente. La configuración que realmente usa el
#   driver es la del PrintTicket / PrintConfiguration. Si ahí sigue puesto el
#   4"x6" (101.6x152.4mm) con el que vienen de fábrica las TD-4520TN, los
#   trabajos salen en blanco o directamente no salen, aunque el spooler informe
#   de "impreso correctamente".
#
# ┌──────────────────────────────────────────────────────────────────────────┐
# │  IMPORTANTE — EL TAMAÑO ES 55x55mm, **NO** 55x25mm. NO CAMBIAR A 25.     │
# │                                                                          │
# │  La etiqueta FÍSICA mide 55x25mm, pero el tamaño de página debe ser      │
# │  55x55mm porque la app genera así el PDF del sello:                      │
# │                                                                          │
# │    src/main/printing/stamp-renderer.ts                                   │
# │      STAMP_WIDTH_MM  = 55                                                │
# │      STAMP_HEIGHT_MM = 55   <- lienzo cuadrado                           │
# │      LABEL_HEIGHT_MM = 25   <- franja que la impresora imprime           │
# │                                                                          │
# │  El contenido (tarifa, fecha, localidad, código) se dibuja con           │
# │  coordenadas medidas DESDE ABAJO sobre el lienzo de 55mm, por lo que      │
# │  queda en la franja SUPERIOR de 25mm. La impresora sólo marca esa        │
# │  franja; el resto del lienzo queda fuera del papel.                      │
# │                                                                          │
# │  Si se pone 55x25 aquí, el PDF de 55x55 se comprime/desplaza y el        │
# │  contenido sale cortado por la mitad. Verificado empíricamente.          │
# └──────────────────────────────────────────────────────────────────────────┘

$ErrorActionPreference = 'Stop'

$wMicron = $WidthMm * 1000
$hMicron = $HeightMm * 1000

Write-Host "Impresora: $PrinterName"
Write-Host "Objetivo:  ${WidthMm}x${HeightMm}mm ($wMicron x $hMicron micrones)"

$cfg = Get-PrintConfiguration -PrinterName $PrinterName
$pt = $cfg.PrintTicketXML

function Show-Media([string]$xml, [string]$etiqueta) {
    $m = [regex]::Matches($xml, 'MediaSize(Width|Height)"><psf:Value[^>]*>(\d+)')
    $vals = $m | ForEach-Object { "$($_.Groups[1].Value)=$([math]::Round([int]$_.Groups[2].Value/1000,1))mm" }
    Write-Host "$etiqueta $($vals -join ' ')"
}

Show-Media $pt 'ANTES: '

# Sustituir los valores de MediaSizeWidth / MediaSizeHeight
$new = [regex]::Replace($pt, '(MediaSizeWidth"><psf:Value[^>]*>)(\d+)', "`${1}$wMicron")
$new = [regex]::Replace($new, '(MediaSizeHeight"><psf:Value[^>]*>)(\d+)', "`${1}$hMicron")

# Forzar la opción de tamaño personalizado para que el driver no reimponga un
# formulario predefinido (p.ej. UserForm285 = 4"x6")
$new = [regex]::Replace(
    $new,
    '<psf:Feature name="psk:PageMediaSize"><psf:Option name="[^"]*">',
    '<psf:Feature name="psk:PageMediaSize"><psf:Option name="psk:CustomMediaSize">'
)

Show-Media $new 'ENVIO: '

try {
    Set-PrintConfiguration -PrinterName $PrinterName -PrintTicketXML $new
    Write-Host 'Set-PrintConfiguration aplicado.'
} catch {
    Write-Host "ERROR al aplicar: $($_.Exception.Message)"
    exit 1
}

# Verificar releyendo del sistema
$after = (Get-PrintConfiguration -PrinterName $PrinterName).PrintTicketXML
Show-Media $after 'DESPUES:'

$m = [regex]::Matches($after, 'MediaSize(Width|Height)"><psf:Value[^>]*>(\d+)')
$w = ($m | Where-Object { $_.Groups[1].Value -eq 'Width' }  | Select-Object -First 1).Groups[2].Value
$h = ($m | Where-Object { $_.Groups[1].Value -eq 'Height' } | Select-Object -First 1).Groups[2].Value

if ([int]$w -eq $wMicron -and [int]$h -eq $hMicron) {
    Write-Host "OK: el driver quedo en ${WidthMm}x${HeightMm}mm"
    exit 0
} else {
    Write-Host "AVISO: el driver NO acepto el tamano (sigue en $([math]::Round([int]$w/1000,1))x$([math]::Round([int]$h/1000,1))mm)."
    Write-Host "       Habra que definirlo desde las Preferencias de impresion del driver Brother."
    exit 2
}
