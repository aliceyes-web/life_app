@echo off
rem Start the local test server for Life Helper (no Python needed)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
