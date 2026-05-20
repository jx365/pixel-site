param(
    [string]$SiteOrigin = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example — please edit SECRET_KEY before public use." -ForegroundColor Yellow
}

if ($SiteOrigin) {
    $content = Get-Content ".env" -Raw
    if ($content -match "CORS_ORIGINS=") {
        $content = $content -replace "CORS_ORIGINS=.*", "CORS_ORIGINS=$SiteOrigin"
    } else {
        $content += "`nCORS_ORIGINS=$SiteOrigin`n"
    }
    Set-Content ".env" $content -NoNewline
    Write-Host "CORS_ORIGINS set to: $SiteOrigin" -ForegroundColor Cyan
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Install Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "Building and starting production stack (port 80)..." -ForegroundColor Cyan
docker compose down
docker compose up --build -d

Start-Sleep -Seconds 5
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1/api/health" -Method Get
    Write-Host "Health: $($h.status)" -ForegroundColor Green
} catch {
    Write-Host "Waiting for services... open http://127.0.0.1/ in browser shortly." -ForegroundColor Yellow
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "Local:  http://127.0.0.1/" -ForegroundColor Green
if ($ip) {
    Write-Host "LAN:    http://${ip}/  (share this with other users on same network)" -ForegroundColor Green
}
Write-Host "Stop:   docker compose down" -ForegroundColor Gray
