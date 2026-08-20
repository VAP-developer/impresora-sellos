param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    
    [Parameter(Mandatory=$true)]
    [string]$PdfFile,
    
    [int]$WidthTenthsMm = 0,
    [int]$HeightTenthsMm = 0,
    [int]$CutInterval = 0,
    [string]$DpiSetting = "",
    [string]$SumatraPath = ""
)

# print-pdf.ps1
#
# Prints a PDF to a Windows printer with full per-job control over paper size
# and cut interval, overriding the printer driver's default settings.
#
# Strategy:
# 1. Read the per-user DevMode directly from HKCU registry (the authoritative
#    source that SumatraPDF reads when creating a print job)
# 2. Modify the relevant fields (paper size in standard DEVMODE, cut interval
#    in Brother-specific private DEVMODE section)
# 3. Write modified DevMode back to registry
# 4. Notify Windows of the change (WM_SETTINGCHANGE)
# 5. Invoke SumatraPDF (which now picks up the modified per-user defaults)
# 6. After printing, restore the original DevMode
#
# This approach avoids DocumentProperties validation which resets private
# DEVMODE fields (like Brother's cut interval) to driver defaults.

$ErrorActionPreference = "Stop"

# ─── Registry paths ───────────────────────────────────────────────────────────
$regPath = "HKCU:\Printers\DevModePerUser"

# ─── Helper: notify the system that printer settings changed ───────────────
$notifyCode = @"
using System;
using System.Runtime.InteropServices;
public class WinNotify {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SendMessageTimeout(
        IntPtr hWnd, int Msg, IntPtr wParam, string lParam,
        int fuFlags, int uTimeout, out IntPtr lpdwResult);
}
"@
try { Add-Type -TypeDefinition $notifyCode -ErrorAction Stop } catch { }

function Notify-PrinterChange {
    $HWND_BROADCAST = [IntPtr]::new(0xFFFF)
    $WM_SETTINGCHANGE = 0x001A
    $SMTO_ABORTIFHUNG = 0x0002
    $result = [IntPtr]::Zero
    [WinNotify]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [IntPtr]::Zero, "Printers", $SMTO_ABORTIFHUNG, 1000, [ref]$result) | Out-Null
}

# ─── Read current per-user DevMode from registry ──────────────────────────
if (-not (Test-Path $regPath)) {
    Write-Error "Registry path not found: $regPath"
    exit 1
}

$currentDm = (Get-ItemProperty $regPath).$PrinterName
if (-not $currentDm -or $currentDm.Length -lt 100) {
    Write-Error "No per-user DevMode found for printer '$PrinterName'"
    exit 1
}

# Save original for restoration
$originalDm = $currentDm.Clone()
$modified = $false

# ─── Modify paper size (standard DEVMODE fields) ──────────────────────────
if ($WidthTenthsMm -gt 0 -and $HeightTenthsMm -gt 0) {
    # DEVMODEW offsets:
    #   dmFields: DWORD at offset 72
    #   dmPaperSize: SHORT at offset 78
    #   dmPaperLength: SHORT at offset 80 (tenths of mm)
    #   dmPaperWidth: SHORT at offset 82 (tenths of mm)

    # Set DMPAPER_USER (256)
    [BitConverter]::GetBytes([int16]256).CopyTo($currentDm, 78)
    # Set paper length (height)
    [BitConverter]::GetBytes([int16]$HeightTenthsMm).CopyTo($currentDm, 80)
    # Set paper width
    [BitConverter]::GetBytes([int16]$WidthTenthsMm).CopyTo($currentDm, 82)

    # Set dmFields: add DM_PAPERSIZE(2) | DM_PAPERLENGTH(4) | DM_PAPERWIDTH(8)
    $curFields = [BitConverter]::ToInt32($currentDm, 72)
    $newFields = $curFields -bor 0x2 -bor 0x4 -bor 0x8
    [BitConverter]::GetBytes([int32]$newFields).CopyTo($currentDm, 72)

    $modified = $true
    Write-Host "Paper: $([math]::Round($WidthTenthsMm/10))mm x $([math]::Round($HeightTenthsMm/10))mm"
}

# ─── Modify cut interval (Brother private DEVMODE) ────────────────────────
if ($CutInterval -gt 0) {
    # Brother TD-4100N private DEVMODE layout (discovered empirically):
    #   dmSize (offset 68) = 220 for this driver
    #   Cut flags at dmSize + 266 = offset 486: 0x0101 means cut_at_end + cut_every
    #   Cut interval at dmSize + 268 = offset 488: Int16 value (number of labels)
    $dmSizeField = [BitConverter]::ToInt16($currentDm, 68)
    $cutFlagsOffset = $dmSizeField + 266
    $cutIntervalOffset = $dmSizeField + 268

    if ($currentDm.Length -gt ($cutIntervalOffset + 2)) {
        # Set cut flags: 0x0101 = cut_at_end ON + cut_every ON
        [BitConverter]::GetBytes([int16]0x0101).CopyTo($currentDm, $cutFlagsOffset)
        # Set cut interval
        [BitConverter]::GetBytes([int16]$CutInterval).CopyTo($currentDm, $cutIntervalOffset)
        $modified = $true
        Write-Host "Cut interval: $CutInterval"
    } else {
        Write-Host "WARN: DevMode too small for cut fields (size=$($currentDm.Length))"
    }
}

# ─── Write modified DevMode to registry and notify ─────────────────────────
if ($modified) {
    Set-ItemProperty -Path $regPath -Name $PrinterName -Value $currentDm -Type Binary
    Notify-PrinterChange
    Start-Sleep -Milliseconds 500
    Write-Host "Registry updated, system notified"
}

# ─── Print the PDF using SumatraPDF ───────────────────────────────────────
$sumatraExe = ""
if ($SumatraPath -and (Test-Path $SumatraPath)) {
    $sumatraExe = $SumatraPath
} elseif ($env:SUMATRA_PATH -and (Test-Path $env:SUMATRA_PATH)) {
    $sumatraExe = $env:SUMATRA_PATH
}

if (-not $sumatraExe) {
    # Try to find SumatraPDF relative to this script
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $candidates = @(
        (Join-Path $scriptDir "SumatraPDF-3.4.6-32.exe"),
        (Join-Path $scriptDir "..\node_modules\pdf-to-printer\dist\SumatraPDF-3.4.6-32.exe")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $sumatraExe = $c; break }
    }
}

if (-not $sumatraExe) {
    Write-Error "SumatraPDF not found. Pass -SumatraPath or set SUMATRA_PATH env variable."
    exit 1
}

# Build print settings
$settings = "noscale"
if ($DpiSetting) {
    $settings += ",$DpiSetting"
}

Write-Host "Printing: $PdfFile -> $PrinterName (settings: $settings)"
$printArgs = @("-print-to", $PrinterName, "-print-settings", $settings, "-silent", $PdfFile)
$proc = Start-Process -FilePath $sumatraExe -ArgumentList $printArgs -Wait -PassThru -NoNewWindow
$exitCode = $proc.ExitCode

# ─── Restore original DevMode after printing ──────────────────────────────
# Wait for the spooler to capture the job with the modified settings
Start-Sleep -Milliseconds 2000

if ($modified) {
    Set-ItemProperty -Path $regPath -Name $PrinterName -Value $originalDm -Type Binary
    Notify-PrinterChange
    Write-Host "Original DevMode restored"
}

if ($exitCode -eq 0) {
    Write-Host "OK: Print job submitted"
} else {
    Write-Host "WARN: SumatraPDF exited with code $exitCode"
}

exit $exitCode
