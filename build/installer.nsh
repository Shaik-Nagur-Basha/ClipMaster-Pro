!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh


!macro customInit
  nsExec::Exec 'taskkill /F /IM "ClipMaster Pro.exe"'
  nsExec::Exec 'taskkill /F /IM "clipboard-listener.exe"'
  nsExec::Exec 'taskkill /F /IM "launcher.exe"'
  nsExec::Exec 'taskkill /F /IM "paster.exe"'
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "ClipMaster Pro.exe"'
  nsExec::Exec 'taskkill /F /IM "clipboard-listener.exe"'
  nsExec::Exec 'taskkill /F /IM "launcher.exe"'
  nsExec::Exec 'taskkill /F /IM "paster.exe"'
!macroend

!ifdef BUILD_UNINSTALLER
Var DeleteUserDataCheckbox
Var DeleteUserDataState

Function un.ConfirmPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ; Set dialog title/text
  ${NSD_CreateLabel} 0 10u 100% 30u "Uninstall ClipMaster Pro$\r$\n$\r$\nAre you sure you want to completely remove ClipMaster Pro and all of its components?"
  Pop $1

  ; Checkbox for user data, default to unchecked (NO)
  ${NSD_CreateCheckbox} 0 50u 100% 12u "Delete ClipMaster Pro user data (clipboard history, settings, and backups)"
  Pop $DeleteUserDataCheckbox
  
  ; Ensure it is unchecked by default (Default Select NO)
  ${NSD_Uncheck} $DeleteUserDataCheckbox

  ; Change the Next button text to "Uninstall"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Uninstall"

  ; Disable the Back button
  GetDlgItem $0 $HWNDPARENT 3
  EnableWindow $0 0

  nsDialogs::Show
FunctionEnd

Function un.ConfirmPageLeave
  ${NSD_GetState} $DeleteUserDataCheckbox $DeleteUserDataState
FunctionEnd

Function un.CustomFinishPage
  ; Set wizard header text directly (MUI_HEADER_TEXT macro not available here)
  GetDlgItem $R0 $HWNDPARENT 1037
  SendMessage $R0 ${WM_SETTEXT} 0 "STR:Uninstall Complete"
  GetDlgItem $R0 $HWNDPARENT 1038
  SendMessage $R0 ${WM_SETTEXT} 0 "STR:"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ; Title label - bold and larger
  ${NSD_CreateLabel} 0 10u 100% 16u "ClipMaster Pro has been successfully removed."
  Pop $1
  CreateFont $2 "MS Shell Dlg" 9 700
  SendMessage $1 ${WM_SETFONT} $2 1

  ; Dynamic detail text based on checkbox state
  ${If} $DeleteUserDataState == ${BST_CHECKED}
    ${NSD_CreateLabel} 0 32u 100% 40u "All application data, clipboard history, and settings have been deleted.$\r$\n$\r$\nClick Finish to close."
  ${Else}
    ${NSD_CreateLabel} 0 32u 100% 40u "Your clipboard history, settings, and backups have been preserved.$\r$\n$\r$\nClick Finish to close."
  ${EndIf}
  Pop $3

  ; Change Next button text to "Finish"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Finish"

  ; Hide Back button
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 0

  ; Hide Cancel button
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 0

  nsDialogs::Show
FunctionEnd

; Skip the template's automatic MUI_UNPAGE_FINISH page (assistedInstaller.nsh line 81)
Function un.skipFinishPage
  Abort
FunctionEnd

!macro customUnWelcomePage
  UninstPage custom un.ConfirmPage un.ConfirmPageLeave
!macroend

!macro customUninstallPage
  ; Register our custom finish page
  UninstPage custom un.CustomFinishPage

  ; The template always inserts MUI_UNPAGE_FINISH after this macro.
  ; Set PRE callback to skip it so only our custom page is shown.
  !define MUI_PAGE_CUSTOMFUNCTION_PRE un.skipFinishPage
!macroend

!endif

!macro customInstall
  ; Resolve the currently logged-in user for Task Scheduler /ru principal.
  ; USERNAME expands to the actual interactive user even when the installer runs
  ; elevated (UAC). Without /ru, schtasks may default to SYSTEM or a wrong
  ; principal and the tasks will silently fail to create a visible window.
  ReadEnvStr $R9 USERNAME

  DetailPrint "Configuring manual-launch scheduled task with highest privileges..."
  nsExec::ExecToLog 'schtasks /create /tn "ClipMasterProManualLaunch" /tr "\"$INSTDIR\ClipMaster Pro.exe\"" /sc once /sd 01/01/1910 /st 00:00 /rl highest /ru $R9 /f'
  Pop $0
  DetailPrint "  ├─ Manual scheduled task creation status: $0"
  nsExec::ExecToLog 'powershell -NoProfile -Command "Set-ScheduledTask -TaskName \"ClipMasterProManualLaunch\" -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances Parallel -StartWhenAvailable -ExecutionTimeLimit ([System.TimeSpan]::Zero))"'
  Pop $0
  DetailPrint "  ├─ Manual task settings applied: $0"
  nsExec::ExecToLog 'schtasks /change /tn "ClipMasterProManualLaunch" /enable'
  Pop $0

  DetailPrint "Configuring auto-launch scheduled task with highest privileges..."
  nsExec::ExecToLog 'schtasks /create /tn "ClipMasterProAutoLaunch" /tr "\"$INSTDIR\ClipMaster Pro.exe\" --hidden" /sc onlogon /rl highest /ru $R9 /f'
  Pop $0
  DetailPrint "  ├─ Auto-launch scheduled task creation status: $0"
  nsExec::ExecToLog 'powershell -NoProfile -Command "Set-ScheduledTask -TaskName \"ClipMasterProAutoLaunch\" -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances Parallel -StartWhenAvailable -ExecutionTimeLimit ([System.TimeSpan]::Zero))"'
  Pop $0
  DetailPrint "  ├─ Auto-launch task settings applied: $0"
  nsExec::ExecToLog 'schtasks /change /tn "ClipMasterProAutoLaunch" /enable'
  Pop $0
  DetailPrint "  └─ Auto-launch task enabled. ✓"

  DetailPrint "Copying native executables to installation folder..."
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\out\main\launcher.exe" "$INSTDIR\launcher.exe"
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\out\main\watchdog-service.exe" "$INSTDIR\watchdog-service.exe"

  DetailPrint "Writing registry entries..."
  ; HKLM: install path so the watchdog service can find the exe after reboots
  WriteRegStr HKLM "SOFTWARE\ClipMaster Pro" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "SOFTWARE\ClipMaster Pro" "ExePath"     "$INSTDIR\ClipMaster Pro.exe"
  ; NOTE: HKCU Run key is intentionally NOT written here. The AutoLaunch Task
  ; Scheduler task (elevated, --hidden) and the watchdog service handle all
  ; startup scenarios. The Run key caused the main window to open silently on
  ; system startup because it launched as a standard user and lost the --hidden
  ; flag during the elevation handoff.
  DetailPrint "  └─ Registry entries written. ✓"

  DetailPrint "Installing ClipMaster Pro Watchdog service..."
  ; sc create requires: binPath= (space after =), path in quotes for spaces support
  nsExec::ExecToLog 'sc create ClipMasterProWatchdog binPath= "\"$INSTDIR\watchdog-service.exe\"" DisplayName= "ClipMaster Pro Watchdog" start= delayed-auto obj= LocalSystem'
  Pop $0
  DetailPrint "  ├─ Watchdog service creation status: $0"
  nsExec::ExecToLog 'sc description ClipMasterProWatchdog "Keeps ClipMaster Pro clipboard manager running for clipboard monitoring."'
  Pop $0
  ; Auto-recovery: restart on failure after 5s / 10s / 30s
  nsExec::ExecToLog 'sc failure ClipMasterProWatchdog reset= 86400 actions= restart/5000/restart/10000/restart/30000'
  Pop $0
  nsExec::ExecToLog 'sc start ClipMasterProWatchdog'
  Pop $0
  DetailPrint "  └─ Watchdog service installed and started. ✓"

  DetailPrint "Re-creating UAC-free shortcuts..."
  CreateShortcut "$DESKTOP\ClipMaster Pro.lnk" "$INSTDIR\launcher.exe" "" "$INSTDIR\ClipMaster Pro.exe" 0
  CreateShortcut "$SMPROGRAMS\ClipMaster Pro\ClipMaster Pro.lnk" "$INSTDIR\launcher.exe" "" "$INSTDIR\ClipMaster Pro.exe" 0
  DetailPrint "  └─ Shortcuts updated to run UAC-free... ✓"
!macroend

!macro customUnInstall
  DetailPrint "Stopping and removing Watchdog service..."
  nsExec::ExecToLog 'sc stop ClipMasterProWatchdog'
  Pop $0
  Sleep 2000
  nsExec::ExecToLog 'sc delete ClipMasterProWatchdog'
  Pop $0
  DetailPrint "  └─ Watchdog service removed. ✓"

  DetailPrint "Removing auto-launch scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "ClipMasterProAutoLaunch" /f'
  Pop $0
  DetailPrint "  ├─ Auto scheduled task removal finished with status: $0"

  DetailPrint "Removing manual launch scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "ClipMasterProManualLaunch" /f'
  Pop $0
  DetailPrint "  ├─ Manual scheduled task removal finished with status: $0"

  DetailPrint "Removing launcher and watchdog executables..."
  Delete "$INSTDIR\launcher.exe"
  Delete "$INSTDIR\watchdog-service.exe"

  DetailPrint "Cleaning up registry entries..."
  ; Remove HKCU auto-start Run key
  DeleteRegValue HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "ClipMaster Pro"
  ; Remove HKLM install-path key written by the app and installer
  DeleteRegKey HKLM "SOFTWARE\ClipMaster Pro"
  ; Remove legacy Electron uninstall key if present
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster Pro"
  DetailPrint "  └─ Registry entries removed. ✓"

  DetailPrint "Cleaning up system shortcuts..."
  DetailPrint "  → Deleting Start Menu shortcut: $SMPROGRAMS\ClipMaster Pro\ClipMaster Pro.lnk"
  Delete "$SMPROGRAMS\ClipMaster Pro\ClipMaster Pro.lnk"
  DetailPrint "  → Deleting Uninstall shortcut: $SMPROGRAMS\ClipMaster Pro\Uninstall.lnk"
  Delete "$SMPROGRAMS\ClipMaster Pro\Uninstall.lnk"
  DetailPrint "  → Removing Start Menu folder: $SMPROGRAMS\ClipMaster Pro"
  RMDir "$SMPROGRAMS\ClipMaster Pro"
  DetailPrint "  → Deleting Desktop shortcut: $DESKTOP\ClipMaster Pro.lnk"
  Delete "$DESKTOP\ClipMaster Pro.lnk"
  DetailPrint "  └─ Desktop and Start Menu shortcuts removed... ✓"

  !ifdef BUILD_UNINSTALLER
  ${If} $DeleteUserDataState == 1 ; 1 corresponds to BST_CHECKED
    DetailPrint "Deleting user data..."
    DetailPrint "  → Removing user data directory: $APPDATA\ClipMaster Pro"
    RMDir /r "$APPDATA\ClipMaster Pro"
    ; Remove the watchdog service log from %ProgramData%
    ; $COMMONAPPDATA/$PROGRAMDATA are not available in NSIS 3.0.4.1 —
    ; read the path from the environment variable directly instead.
    ReadEnvStr $R8 PROGRAMDATA
    RMDir /r "$R8\ClipMaster Pro"
    DetailPrint "  └─ Database, settings, and backups deleted... ✓"
  ${Else}
    DetailPrint "Skipped deleting user data (retained settings and history)."
  ${EndIf}
  !endif

  DetailPrint "─────────────────────────────────────────────────"
  DetailPrint "✅ ClipMaster Pro has been uninstalled successfully!"
  DetailPrint "─────────────────────────────────────────────────"
!macroend
