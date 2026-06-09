!macro customUninstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to delete all ClipMaster Pro user data (clipboard history, settings, and backups)?" IDNO +2
    RMDir /r "$APPDATA\ClipMaster Pro"
!macroend
