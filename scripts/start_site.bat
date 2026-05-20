@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%start_site.ps1"

if not exist "%PS1%" (
  echo [ERROR] Missing script: %PS1%
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%PS1%"
exit /b %errorlevel%
