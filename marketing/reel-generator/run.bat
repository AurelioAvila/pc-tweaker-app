@echo off
cd /d "%~dp0"
python main.py --count 1 >> generate.log 2>&1
