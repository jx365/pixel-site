param()

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$backupDir = Join-Path $repoRoot "backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$containerId = docker compose -f (Join-Path $repoRoot "docker-compose.yml") ps -q api
if (-not $containerId) {
    throw "api 容器未运行，请先执行 docker compose up -d"
}

$tmpDir = Join-Path $env:TEMP ("pixel_backup_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpDir | Out-Null

docker cp "$containerId`:/app/data/pixel_art.db" (Join-Path $tmpDir "pixel_art.db")
docker cp "$containerId`:/app/uploads" (Join-Path $tmpDir "uploads")

$zipPath = Join-Path $backupDir ("pixel_backup_" + $timestamp + ".zip")
Compress-Archive -Path (Join-Path $tmpDir "*") -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $tmpDir

Write-Host "备份完成: $zipPath" -ForegroundColor Green
