@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "SMOKE_SCRIPT=%SCRIPT_DIR%e2e_smoke_test.py"

if not exist "%SMOKE_SCRIPT%" (
  echo [ERROR] Missing script: %SMOKE_SCRIPT%
  exit /b 1
)

set "API_URL=%~1"
if "%API_URL%"=="" set "API_URL=http://127.0.0.1:8000"
set "PIXEL_API_URL=%API_URL%"

where py >nul 2>nul
if %errorlevel%==0 (
  pushd "%REPO_ROOT%"
  py -3 "%SMOKE_SCRIPT%"
  set "CODE=%errorlevel%"
  popd
  exit /b %CODE%
)

where python >nul 2>nul
if %errorlevel%==0 (
  pushd "%REPO_ROOT%"
  python "%SMOKE_SCRIPT%"
  set "CODE=%errorlevel%"
  popd
  exit /b %CODE%
)

echo [ERROR] Python not found. Please install Python 3 first.
exit /b 1
