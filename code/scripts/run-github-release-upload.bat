@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0github-release-upload.ps1"
echo.
echo If this window shows an error, keep it open and send Codex a screenshot.
pause
