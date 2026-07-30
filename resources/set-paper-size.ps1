param(
    [string]$PrinterName = "Brother TD-4100N TICKETS",
    [int]$WidthTenthsMm = 780,
    [int]$HeightTenthsMm = 1770
)

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinPrinter {
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
$ret = [WinPrinter]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
if ($ret -eq 0 -or $hPrinter -eq [IntPtr]::Zero) {
    Write-Error "Cannot open printer '$PrinterName'"
    exit 1
}

try {
    # Get DEVMODE size
    $dmSize = [WinPrinter]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, [IntPtr]::Zero, [IntPtr]::Zero, 0)
    if ($dmSize -le 0) {
        Write-Error "DocumentProperties failed to get size"
        exit 1
    }
    Write-Host "DEVMODE size: $dmSize bytes"

    # Allocate buffer and get current DEVMODE
    $pDevMode = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($dmSize)
    $r = [WinPrinter]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, $pDevMode, [IntPtr]::Zero, 2)

    # DEVMODEW layout (Unicode, CharSet.Auto on Windows = Unicode):
    #   dmDeviceName: WCHAR[32] = 64 bytes (offset 0)
    #   dmSpecVersion: WORD (offset 64)
    #   dmDriverVersion: WORD (offset 66)
    #   dmSize: WORD (offset 68)
    #   dmDriverExtra: WORD (offset 70)
    #   dmFields: DWORD (offset 72)
    #   dmOrientation: SHORT (offset 76)
    #   dmPaperSize: SHORT (offset 78)
    #   dmPaperLength: SHORT (offset 80)  -- in tenths of mm
    #   dmPaperWidth: SHORT (offset 82)   -- in tenths of mm

    $oFields = 72
    $oPaperSize = 78
    $oPaperLength = 80
    $oPaperWidth = 82

    # Read current values
    $curFields = [System.Runtime.InteropServices.Marshal]::ReadInt32($pDevMode, $oFields)
    $curPaperSize = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperSize)
    $curLength = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperLength)
    $curWidth = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperWidth)
    Write-Host "Current: fields=0x$($curFields.ToString('X')), paperSize=$curPaperSize, length=$curLength(0.1mm), width=$curWidth(0.1mm)"

    # Set custom paper size (dmPaperSize = 256 = DMPAPER_USER)
    [System.Runtime.InteropServices.Marshal]::WriteInt16($pDevMode, $oPaperSize, 256)
    # dmPaperLength in tenths of mm (= ticket height)
    [System.Runtime.InteropServices.Marshal]::WriteInt16($pDevMode, $oPaperLength, $HeightTenthsMm)
    # dmPaperWidth in tenths of mm (= ticket width)
    [System.Runtime.InteropServices.Marshal]::WriteInt16($pDevMode, $oPaperWidth, $WidthTenthsMm)

    # Set dmFields flags: DM_PAPERSIZE(2) | DM_PAPERLENGTH(4) | DM_PAPERWIDTH(8)
    $newFields = $curFields -bor 0x2 -bor 0x4 -bor 0x8
    [System.Runtime.InteropServices.Marshal]::WriteInt32($pDevMode, $oFields, $newFields)

    # Validate via DocumentProperties (DM_IN_BUFFER | DM_OUT_BUFFER = 10)
    $r2 = [WinPrinter]::DocumentProperties([IntPtr]::Zero, $hPrinter, $PrinterName, $pDevMode, $pDevMode, 10)
    Write-Host "DocumentProperties(set) returned: $r2"

    # Read back after validation to confirm driver accepted the values
    $newPaperSize = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperSize)
    $newLength = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperLength)
    $newWidth = [System.Runtime.InteropServices.Marshal]::ReadInt16($pDevMode, $oPaperWidth)
    Write-Host "After validation: paperSize=$newPaperSize, length=$newLength(0.1mm), width=$newWidth(0.1mm)"

    # Persist to printer using SetPrinter level 9 (PRINTER_INFO_9 = pointer to DEVMODE)
    $pInfo = [System.Runtime.InteropServices.Marshal]::AllocHGlobal([IntPtr]::Size)
    [System.Runtime.InteropServices.Marshal]::WriteIntPtr($pInfo, $pDevMode)
    $ok = [WinPrinter]::SetPrinter($hPrinter, 9, $pInfo, 0)
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pInfo)

    if ($ok) {
        Write-Host "OK: SetPrinter succeeded. Paper = $([math]::Round($WidthTenthsMm/10))mm x $([math]::Round($HeightTenthsMm/10))mm"
    } else {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Error "SetPrinter failed with error $err"
    }

    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pDevMode)
} finally {
    [WinPrinter]::ClosePrinter($hPrinter) | Out-Null
}
