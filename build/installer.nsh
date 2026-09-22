; Custom NSIS installer script for Stamp Sales Desktop App
; This file is included by electron-builder during NSIS installer generation

!macro customHeader
  !system "echo 'Building Stamp Sales Installer'"
!macroend

!macro customInit
  ; Ensure only one instance of the installer runs at a time
  System::Call 'kernel32::CreateMutex(p 0, i 0, t "StampSalesInstallerMutex") p .r1 ?e'
  Pop $R0
  ${If} $R0 != 0
    MessageBox MB_ICONSTOP "El instalador ya se está ejecutando."
    Abort
  ${EndIf}
!macroend

!macro customInstall
  ; Create a firewall rule for IPP printing (port 631)
  ; This is needed for network printer communication
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Stamp Sales IPP" dir=out action=allow protocol=tcp remoteport=631 program="$INSTDIR\Stamp Sales.exe"'

  ; NOTE: Auto-start on Windows login is intentionally NOT enabled by the
  ; installer. The app must NOT launch automatically by default. Users can opt
  ; in from the app's own settings (which uses app.setLoginItemSettings to
  ; write/remove the HKCU\...\Run\StampSales registry key at runtime).
  ;
  ; Remove any legacy auto-start entry left behind by previous installer
  ; versions that used to force auto-launch on install. This guarantees the
  ; default state is "does not start automatically" for existing machines too.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StampSales"
!macroend

!macro customUnInstall
  ; Remove firewall rule on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Stamp Sales IPP"'

  ; Remove auto-start registry entry on uninstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StampSales"
!macroend
