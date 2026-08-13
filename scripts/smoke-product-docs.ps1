$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3001/api'

# wait health
for ($i = 1; $i -le 30; $i++) {
  try {
    Invoke-RestMethod "$base/health" -TimeoutSec 3 | Out-Null
    break
  } catch {
    Start-Sleep 3
  }
}

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body (@{email="merchant@demo.com"; password=$env:DEMO_PASSWORD} | ConvertTo-Json)
$token = $login.accessToken
$h = @{ Authorization = "Bearer $token" }

$prods = Invoke-RestMethod -Uri "$base/products?limit=1" -Headers $h
$productId = $prods.items[0].id
Write-Output "productId=$productId"

$pngPath = Join-Path $PSScriptRoot '..\uploads\_doc_test.png'
New-Item -ItemType Directory -Force -Path (Split-Path $pngPath) | Out-Null
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))

$up = & curl.exe -s -X POST "$base/products/$productId/documents" -H "Authorization: Bearer $token" -F "file=@$pngPath;type=image/png" -F 'name=Test Certificate' -F 'docType=certificate'
Write-Output "UPLOAD=$up"
$doc = $up | ConvertFrom-Json
if (-not $doc.id) { throw "upload failed: $up" }
$docId = $doc.id
Write-Output "docId=$docId filePath=$($doc.filePath)"

$list = Invoke-RestMethod -Uri "$base/products/$productId/documents"
Write-Output "list count=$($list.Count)"

$del = & curl.exe -s -X DELETE "$base/products/$productId/documents/$docId" -H "Authorization: Bearer $token"
Write-Output "DELETE=$del"

$list2 = Invoke-RestMethod -Uri "$base/products/$productId/documents"
Write-Output "list after delete=$($list2.Count)"
Write-Output 'OK'
