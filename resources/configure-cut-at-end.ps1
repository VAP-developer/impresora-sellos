param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName
)

# configure-cut-at-end.ps1
#
# Configures the Brother TD-4100N printer driver to ONLY cut at the end of
# each print job (not every N labels). This is required because the application
# controls cut groups by generating separate PDF files — one per cut group.
#
# The driver needs:
#   - "Cut at End" = ON (cuts when the job finishes)
#   - "Cut Every N" = OFF (don't cut within a job)
#
# This script modifies the per-user DevMode in HKCU registry directly.
# Brother TD-4100N private DEVMODE layout (empirically discovered):
#   Offset 486 (dmSize+266): Cut flags as Int16
#     - 0x0001 = Cut at End only
#     - 0x0100 = Cut Every N only
#     - 0x0101 = Both (Cut at End + Cut Every N)
#     - 0x0000 = No cutting
#   Offset 488 (dmSize+268): Cut interval (Int16, only used if Cut Every is ON)
#
# Run this ONCE per printer to configure the cut mode. The application
# handles grouping (number of labels per cut) by generating separate PDFs.

$ErrorActionPreference = "Stop"

$regPath = "HKCU:\Printers\DevModePerUser"

if (-not (Test-Path $regPath)) {
    Write-Error "Registry path not found: $regPath"
    exit 1
}

$dm = (Get-ItemProperty $regPath).$PrinterName
if (-not $dm -or $dm.Length -lt 100) {
    Write-Error "No per-user DevMode found for printer '$PrinterName'"
    exit 1
}

$dmSizeField = [BitConverter]::ToInt16($dm, 68)
$cutFlagsOffset = $dmSizeField + 266
$cutIntervalOffset = $dmSizeField + 268

if ($dm.Length -le ($cutIntervalOffset + 2)) {
    Write-Error "DevMode too small for cut fields"
    exit 1
}

# Read current values
$currentFlags = [BitConverter]::ToInt16($dm, $cutFlagsOffset)
$currentInterval = [BitConverter]::ToInt16($dm, $cutIntervalOffset)
Write-Host "Current: flags=0x$($currentFlags.ToString('X4')), interval=$currentInterval"

# Set to "Cut at End only" (0x0001)
# This means the printer cuts when a print job ends, but NOT every N labels within a job.
[BitConverter]::GetBytes([int16]0x0001).CopyTo($dm, $cutFlagsOffset)

# Write back
Set-ItemProperty -Path $regPath -Name $PrinterName -Value $dm -Type Binary

# Verify
$dm2 = (Get-ItemProperty $regPath).$PrinterName
$newFlags = [BitConverter]::ToInt16($dm2, $cutFlagsOffset)
Write-Host "After: flags=0x$($newFlags.ToString('X4')) (Cut at End only)"
Write-Host ""
Write-Host "OK: Printer '$PrinterName' configured for 'Cut at End' mode."
Write-Host "The application controls cut groups by generating separate PDF files."
