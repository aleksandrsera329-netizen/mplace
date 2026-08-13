# Start Mplace: API + static UI
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location "$Root\apps\api"

if (-not (Test-Path "node_modules")) {
  Write-Host "npm install..."
  npm install
}

if (-not (Test-Path "dev.db")) {
  Write-Host "migrate + seed..."
  npx prisma migrate dev --name init --skip-seed
  npx prisma db seed
} else {
  Write-Host "seed (refresh demo data)..."
  npx prisma db seed
}

Write-Host "Starting API on :3000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\apps\api'; npm run start:dev"

Start-Sleep 3
Write-Host "Starting UI on :8080 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; py -m http.server 8080"

Write-Host ""
Write-Host "Open:  http://127.0.0.1:8080/"
Write-Host "Login: http://127.0.0.1:8080/login.html"
Write-Host "API:   http://127.0.0.1:3000/api/health"
Write-Host ""
Write-Host "Admin:    superadmin@demo.com / <DEMO_PASSWORD>"
Write-Host "Merchant: merchant@demo.com / <DEMO_PASSWORD>"
Write-Host "Customer: customer@demo.com / <DEMO_PASSWORD>"
