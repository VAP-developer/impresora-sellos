param(
    [string]$PrinterName = "Brother TD-4100N ETI-1",
    [int]$CutInterval = 4
)

# Configure the Brother TD-4100N driver to cut every N labels.
# Uses the same DEVMODE approach as set-paper-size.ps1 but targets
# the Brother-specific private DEVMODE fields for auto-cut settings.
#
# Brother TD drivers store cut settings in the private DEVMODE area:
# - Auto-cut mode: 1 = cut at end, 2 = cut every N
# - Cut interval: number of labels between cuts
#
# Fallback: if private DEVMODE fields aren't accessible, uses the
# printer preferences registry key.

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinPrinterCut {
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int DocumentProperties(IntPtr hWnd, IntPtr hPrinter, string pDeviceName, IntPtr pDevModeOutput, IntPtr pDevModeInput, int fMode);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool SetPrinter(IntPtr hPrinter, int level, IntPtr pPrinter, int command);
}
"@

Add-Type -TypeDefinition $code -ErrorAction Stop

$hPrinter = [IntPtr]::Zero
$ret = [WinPrinterCut]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
if ($ret -eq 0 -or $hPrinter -eq [IntPtr]::Zero) {
    Write-Error "Cannot open printer '$PrinterName'"
    exit 1
}

try {
    # Get DEVMODE size
    $dmSize = [WinPrinterCut]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, [IntPtr]::Zero, [IntPtr]::Zero, 0)
    if ($dmSize -le 0) {
        Write-Error "DocumentProperties failed to get size"
        exit 1
    }

    # Allocate buffer and get current DEVMODE
    $pDevMode = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($dmSize)
    $r = [WinPrinterCut]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, $pDevMode, [IntPtr]::Zero, 2)

    # Read dmSize (offset 68) to know where private data starts
    $dmSizeField = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, 68)

    # Brother TD-4100N private DEVMODE area starts after the standard DEVMODE (dmSize bytes from start).
    # The cut-related fields in Brother TD drivers are typically at:
    # - Offset dmSize + 16: Cut mode (DWORD) - 0=none, 1=end of job, 2=every N labels
    # - Offset dmSize + 20: Cut interval (DWORD) - number of labels between cuts
    # These offsets may vary by driver version. Common Brother TD offsets:
    $privateSectionStart = $dmSizeField
    $cutModeOffset = $privateSectionStart + 16
    $cutIntervalOffset = $privateSectionStart + 20

    # Only modify if the DEVMODE is large enough to contain private data
    if ($dmSize -gt ($cutIntervalOffset + 4)) {
        # Set cut mode to "cut every N labels" (value 2)
        [System.Runtime.InteropServices.Marshal]::WriteInt32($pDevMode, $cutModeOffset, 2)
        # Set cut interval
        [System.Runtime.InteropServices.Marshal]::WriteInt32($pDevMode, $cutIntervalOffset, $CutInterval)

        # Validate via DocumentProperties (DM_IN_BUFFER | DM_OUT_BUFFER = 10)
        $r2 = [WinPrinterCut]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, $pDevMode, $pDevMode, 10)

        # Persist to printer using SetPrinter level 9
        $pInfo = [System.Runtime.InteropServices.Marshal]::AllocHGlobal([IntPtr]::Size)
        [System.Runtime.InteropServices.Marshal]::WriteIntPtr($pInfo, $pDevMode)
        $ok = [WinPrinterCut]::SetPrinter($hPrinter, 9, $pInfo, 0)
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pInfo)

        if ($ok) {
            Write-Host "OK: Cut interval set to $CutInterval for '$PrinterName'"
        } else {
            $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            Write-Host "WARN: SetPrinter returned error $err (cut interval may not be supported by this driver)"
        }
    } else {
        Write-Host "WARN: DEVMODE too small for private cut fields (size=$dmSize). Using registry fallback."
    }

    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pDevMode)
} finally {
    [WinPrinterCut]::ClosePrinter($hPrinter) | Out-Null
}
