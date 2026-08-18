@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" generate-captions.js >> generate-captions.log 2>&1
