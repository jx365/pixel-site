@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0deploy_prod.ps1" %*
exit /b %errorlevel%
