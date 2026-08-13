$ErrorActionPreference = "Stop"

Write-Host "Mplace clean-install verification"

Push-Location "$PSScriptRoot/../apps/api"
npm ci
npm run prisma:generate
npm run build
npm test -- --runInBand
npm run test:security
Pop-Location

Push-Location "$PSScriptRoot/../apps/web"
npm ci
npm run lint
npm run build
Pop-Location

Write-Host "Clean install/build/lint verification completed."
