@echo off
if not defined NPACKD_PACKAGE_BINARY exit /b 2
if not exist "%NPACKD_PACKAGE_BINARY%" exit /b 2
powershell.exe -NoLogo -NoProfile -NonInteractive -File ".Npackd\Guard.ps1" -Operation Install
if errorlevel 1 exit /b %errorlevel%
"%NPACKD_PACKAGE_BINARY%" /S /D=%CD%
if errorlevel 1 exit /b %errorlevel%
if not exist "PC Tweaker.exe" exit /b 3
if not exist "uninstall.exe" exit /b 4
exit /b 0
