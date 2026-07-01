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

  ; Add auto-start registry entry so the app launches on Windows login.
  ; Uses HKCU (current user) so no admin elevation is needed for this part.
  ; The --hidden flag signals the app that it was auto-launched.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StampSales" '"$INSTDIR\Stamp Sales.exe" --hidden'
!macroend

!macro customUnInstall
  ; Remove firewall rule on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Stamp Sales IPP"'

  ; Remove auto-start registry entry on uninstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StampSales"
!macroend
