@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" security-check.js >> auto-upload.log 2>&1
if errorlevel 1 exit /b 1
"C:\Program Files\nodejs\node.exe" auto-upload.js >> auto-upload.log 2>&1
