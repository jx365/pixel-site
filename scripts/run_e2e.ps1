param(
    [string]$ApiUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$smokeScript = Join-Path $scriptDir "e2e_smoke_test.py"

if (-not (Test-Path $smokeScript)) {
    Write-Host "Smoke script not found: $smokeScript" -ForegroundColor Red
    exit 1
}

if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
    $pythonArgs = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
    $pythonArgs = @()
} else {
    Write-Host "Python 3 not found. Please install Python first." -ForegroundColor Red
    exit 1
}

Push-Location $repoRoot
try {
    $env:PIXEL_API_URL = $ApiUrl
    Write-Host "Running E2E smoke test: $smokeScript" -ForegroundColor Cyan
    & $pythonCmd @pythonArgs $smokeScript
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
