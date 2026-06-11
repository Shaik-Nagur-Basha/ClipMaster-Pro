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

!macro customUninstall
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
!macroend
