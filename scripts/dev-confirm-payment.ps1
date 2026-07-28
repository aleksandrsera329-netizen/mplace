# LOCAL ONLY: confirm a dev payment without putting the secret in the browser.
# Usage:
#   $env:DEV_PAYMENT_SECRET = "mplace_dev_payment_secret_change_me"
#   .\scripts\dev-confirm-payment.ps1 -OrderId "..." -PaymentToken "..."
#
# Requires: PAYMENT_PROVIDER=dev, ALLOW_DEV_PAYMENTS=true, NODE_ENV=development

param(
  [Parameter(Mandatory = $true)][string]$OrderId,
  [Parameter(Mandatory = $true)][string]$PaymentToken,
  [string]$ApiBase = "http://127.0.0.1:3000/api",
  [string]$Secret = $env:DEV_PAYMENT_SECRET
)

if (-not $Secret) {
  Write-Error "Set DEV_PAYMENT_SECRET env var (same as apps/api/.env). Never commit it into frontend."
  exit 1
}

$body = @{
  orderId       = $OrderId
  paymentToken  = $PaymentToken
  idempotencyKey = "cli_$OrderId_$(Get-Date -UFormat %s)"
} | ConvertTo-Json

$headers = @{
  "Content-Type"           = "application/json"
  "X-Dev-Payment-Secret"   = $Secret
  "X-Order-Access-Token"   = $PaymentToken
}

$result = Invoke-RestMethod -Method POST -Uri "$ApiBase/payments/dev-confirm" -Headers $headers -Body $body
$result | ConvertTo-Json -Depth 6
