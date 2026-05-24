param(
    [string]$ApiUrl = "http://127.0.0.1:8000",
    [string]$PublicApiUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Checking local API health..." -ForegroundColor Cyan
$local = Invoke-RestMethod -Uri "$ApiUrl/api/health" -Method Get
Write-Host "Local status: $($local.status)" -ForegroundColor Green

if ($PublicApiUrl) {
    Write-Host "Checking public API health..." -ForegroundColor Cyan
    $public = Invoke-RestMethod -Uri "$PublicApiUrl/api/health" -Method Get
    Write-Host "Public status: $($public.status)" -ForegroundColor Green
}
