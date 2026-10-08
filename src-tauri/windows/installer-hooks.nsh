; Up to 1.16.1 PC Tweaker was installed under its build name, "pc-tweaker-app": that was the
; folder, the Installed apps entry and the shortcut names. Before this version is copied, the
; old installation is removed by its own uninstaller in update mode. Update mode keeps the
; settings, recovery records and app data, which live under the unchanged identifier
; com.aurel.pc-tweaker-app. Its shortcuts are replaced with "PC Tweaker" ones, and a taskbar
; pin is pointed at the new program so it keeps working.
Var PctLegacyDir
Var PctLegacyStart
Var PctLegacyDesktop

!define PCT_LEGACY_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\pc-tweaker-app"
!define PCT_LEGACY_DIRKEY "Software\Aurelio Avila\pc-tweaker-app"
!define PCT_PINNED "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\pc-tweaker-app.lnk"

!macro NSIS_HOOK_PREINSTALL
  StrCpy $PctLegacyDir ""
  StrCpy $PctLegacyStart 0
  StrCpy $PctLegacyDesktop 0
  ReadRegStr $R9 HKCU "${PCT_LEGACY_UNINSTKEY}" "UninstallString"
  ReadRegStr $R8 HKCU "${PCT_LEGACY_DIRKEY}" ""
  ${If} $R9 != ""
  ${AndIf} $R8 != ""
  ${AndIf} ${FileExists} "$R8\uninstall.exe"
    StrCpy $PctLegacyDir $R8
    ${If} ${FileExists} "$SMPROGRAMS\pc-tweaker-app.lnk"
      StrCpy $PctLegacyStart 1
    ${EndIf}
    ${If} ${FileExists} "$DESKTOP\pc-tweaker-app.lnk"
      StrCpy $PctLegacyDesktop 1
    ${EndIf}
    DetailPrint "Moving the previous installation to the PC Tweaker name..."
    ExecWait '"$R8\uninstall.exe" /S /UPDATE _?=$R8'
    ; Run in place, the old uninstaller cannot delete itself or its folder.
    Delete "$R8\uninstall.exe"
    RMDir "$R8"
    Delete "$SMPROGRAMS\pc-tweaker-app.lnk"
    Delete "$DESKTOP\pc-tweaker-app.lnk"
    DeleteRegKey HKCU "${PCT_LEGACY_UNINSTKEY}"
    DeleteRegKey HKCU "${PCT_LEGACY_DIRKEY}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $PctLegacyDir != ""
    ; An update skips shortcut creation, so put back the ones the old name had.
    ${If} $PctLegacyStart = 1
    ${AndIfNot} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}
    ${If} $PctLegacyDesktop = 1
    ${AndIfNot} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
    ${If} ${FileExists} "${PCT_PINNED}"
      !insertmacro SetShortcutTarget "${PCT_PINNED}" "$INSTDIR\${MAINBINARYNAME}.exe"
    ${EndIf}
  ${EndIf}
!macroend
