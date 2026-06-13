!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh

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

!macro customUnWelcomePage
  UninstPage custom un.ConfirmPage un.ConfirmPageLeave
!macroend

Function un.SkipFinishPage
  Abort
FunctionEnd

!macro customUninstallPage
  !define MUI_PAGE_CUSTOMFUNCTION_PRE un.SkipFinishPage
!macroend
!endif

!macro customInstall
  DetailPrint "Configuring manual-launch scheduled task with highest privileges..."
  nsExec::ExecToLog 'schtasks /create /tn "ClipMasterProManualLaunch" /tr "\"$INSTDIR\ClipMaster Pro.exe\"" /sc once /sd 01/01/1910 /st 00:00 /rl highest /f'
  Pop $0
  DetailPrint "  ├─ Manual scheduled task creation status: $0"
  nsExec::ExecToLog 'powershell -Command "Set-ScheduledTask -TaskName \"ClipMasterProManualLaunch\" -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"'
  Pop $0
  DetailPrint "  ├─ Manual task policy set to Parallel status: $0"

  DetailPrint "Configuring auto-launch scheduled task with highest privileges..."
  nsExec::ExecToLog 'schtasks /create /tn "ClipMasterProAutoLaunch" /tr "\"$INSTDIR\ClipMaster Pro.exe\" --hidden" /sc onlogon /rl highest /f'
  Pop $0
  DetailPrint "  ├─ Auto-launch scheduled task creation status: $0"
  nsExec::ExecToLog 'powershell -Command "Set-ScheduledTask -TaskName \"ClipMasterProAutoLaunch\" -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"'
  Pop $0
  DetailPrint "  ├─ Auto-launch task policy set to Parallel status: $0"

  DetailPrint "Copying launcher executable to installation folder..."
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\out\main\launcher.exe" "$INSTDIR\launcher.exe"

  DetailPrint "Re-creating UAC-free shortcuts..."
  CreateShortcut "$DESKTOP\ClipMaster Pro.lnk" "$INSTDIR\launcher.exe" "" "$INSTDIR\ClipMaster Pro.exe" 0
  CreateShortcut "$SMPROGRAMS\ClipMaster Pro\ClipMaster Pro.lnk" "$INSTDIR\launcher.exe" "" "$INSTDIR\ClipMaster Pro.exe" 0
  DetailPrint "  └─ Shortcuts updated to run UAC-free... ✓"
!macroend

!macro customUnInstall
  DetailPrint "Removing auto-launch scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "ClipMasterProAutoLaunch" /f'
  Pop $0
  DetailPrint "  ├─ Auto scheduled task removal finished with status: $0"

  DetailPrint "Removing manual launch scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "ClipMasterProManualLaunch" /f'
  Pop $0
  DetailPrint "  ├─ Manual scheduled task removal finished with status: $0"

  DetailPrint "Removing launcher executable..."
  Delete "$INSTDIR\launcher.exe"

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

  DetailPrint "Cleaning up registry..."
  DetailPrint "  → Deleting registry key: HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster Pro"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster Pro"
  DetailPrint "  └─ Registry entries removed... ✓"

  !ifdef BUILD_UNINSTALLER
  ${If} $DeleteUserDataState == 1 ; 1 corresponds to BST_CHECKED
    DetailPrint "Deleting user data..."
    DetailPrint "  → Removing user data directory: $APPDATA\ClipMaster Pro"
    RMDir /r "$APPDATA\ClipMaster Pro"
    DetailPrint "  └─ Database, settings, and backups deleted... ✓"
  ${Else}
    DetailPrint "Skipped deleting user data (retained settings and history)."
  ${EndIf}
  !endif

  DetailPrint "─────────────────────────────────────────────────"
  DetailPrint "✅ ClipMaster Pro has been uninstalled successfully!"
  DetailPrint "─────────────────────────────────────────────────"
  MessageBox MB_OK|MB_ICONINFORMATION "ClipMaster Pro has been successfully uninstalled from your computer."
!macroend
