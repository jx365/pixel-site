param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$siteUrl = "http://127.0.0.1:5173"

if (-not (Test-Path $backendDir)) {
    Write-Host "Backend folder not found: $backendDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $frontendDir)) {
    Write-Host "Frontend folder not found: $frontendDir" -ForegroundColor Red
    exit 1
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py -3"
} else {
    Write-Host "Python 3 not found. Please install Python first." -ForegroundColor Red
    exit 1
}

# Verify uvicorn is available in selected interpreter to avoid silent backend window exit
try {
    Invoke-Expression "$pythonCmd -c `"import uvicorn`"" | Out-Null
} catch {
    Write-Host "uvicorn is missing for selected Python. Run: cd backend; python -m pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}

$npmCmd = "npm"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $nodeNpm = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $nodeNpm) {
        $npmCmd = "`"$nodeNpm`""
    } else {
        Write-Host "npm not found. Please install Node.js LTS first." -ForegroundColor Red
        exit 1
    }
}

# Start backend in a dedicated window
$backendCommand = "$pythonCmd -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @(
    "-NoExit",
    "-Command",
    $backendCommand
)

# Start frontend in a dedicated window
$frontendCommand = "$npmCmd run dev -- --host 127.0.0.1 --port 5173"
Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList @(
    "-NoExit",
    "-Command",
    $frontendCommand
)

Write-Host "Backend and frontend are starting..." -ForegroundColor Cyan
Write-Host "Frontend: $siteUrl" -ForegroundColor Green
Write-Host "Backend : http://127.0.0.1:8000" -ForegroundColor Green

if (-not $NoBrowser) {
    Start-Sleep -Seconds 2
    Start-Process $siteUrl
}
