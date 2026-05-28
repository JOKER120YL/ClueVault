@echo off
setlocal
set "APP_DIR=%~dp0"
set "APP_EXE=%APP_DIR%ClueVault.Desktop.exe"

if not exist "%APP_EXE%" (
  echo ClueVault.Desktop.exe was not found in this folder.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('DesktopDirectory'); $shortcut=Join-Path $desktop 'ClueVault.lnk'; $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut($shortcut); $link.TargetPath='%APP_EXE%'; $link.WorkingDirectory='%APP_DIR%'; $link.IconLocation='%APP_EXE%,0'; $link.Save(); Write-Host 'Desktop shortcut created:' $shortcut"

pause
