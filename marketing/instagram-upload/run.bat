@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" auto-upload.js >> auto-upload.log 2>&1
