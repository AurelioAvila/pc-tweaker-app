@echo off
if not exist "uninstall.exe" exit /b 2
powershell.exe -NoLogo -NoProfile -NonInteractive -File ".Npackd\Guard.ps1" -Operation Uninstall
if errorlevel 1 exit /b %errorlevel%
"uninstall.exe" /S _?=%CD%
if errorlevel 1 exit /b %errorlevel%
if exist "PC Tweaker.exe" exit /b 5
exit /b 0
