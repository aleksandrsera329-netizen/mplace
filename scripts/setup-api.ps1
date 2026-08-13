# Setup Mplace API: Docker Postgres/Redis → migrate → seed → print URLs
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Checking Docker..."
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker engine is not ready."
  Write-Host "1) Open Docker Desktop and wait until it says Running"
  Write-Host "2) Re-run: powershell -File scripts\setup-api.ps1"
  exit 1
}

Write-Host "==> docker compose up -d"
docker compose up -d

Write-Host "==> Waiting for Postgres..."
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  docker exec mplace-postgres pg_isready -U mplace -d mplace 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Start-Sleep 2
}
if (-not $ok) { throw "Postgres did not become ready" }

Set-Location "$Root\apps\api"
if (-not (Test-Path .env)) {
  Copy-Item "$Root\.env.example" .env
  Write-Host "Created apps/api/.env from .env.example"
}

Write-Host "==> prisma migrate deploy"
npx prisma migrate deploy
Write-Host "==> prisma db seed"
npx prisma db seed

Write-Host ""
Write-Host "OK. Start API:"
Write-Host "  cd apps\api"
Write-Host "  npm run start:dev"
Write-Host "API:  http://127.0.0.1:3000/api/health"
Write-Host "Demo: superadmin@demo.com / <DEMO_PASSWORD>"
