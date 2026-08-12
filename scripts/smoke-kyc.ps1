$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3001/api'
for ($i = 1; $i -le 30; $i++) {
  try { Invoke-RestMethod "$base/health" -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep 3 }
}

$mLogin = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"merchant@demo.com","password":"123456"}'
$mToken = $mLogin.accessToken
$shopId = $mLogin.user.shopId
Write-Output "shopId=$shopId"

$pngPath = Join-Path $PSScriptRoot '..\uploads\_kyc_test.png'
New-Item -ItemType Directory -Force -Path (Split-Path $pngPath) | Out-Null
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))

$up = & curl.exe -s -X POST "$base/shops/$shopId/kyc" -H "Authorization: Bearer $mToken" -F "file=@$pngPath;type=image/png" -F 'docType=PASSPORT'
Write-Output "UPLOAD=$up"
$doc = $up | ConvertFrom-Json
if (-not $doc.id) { throw "upload failed: $up" }
$docId = $doc.id
if ($doc.filePath) { throw "filePath must be null for private KYC, got $($doc.filePath)" }
if (-not $doc.mediaAsset) { Write-Output "WARN: mediaAsset missing in response (ok if stripped)" }

# --- Stage 2 ACL / signed download ---
try {
  Invoke-RestMethod -Uri "$base/kyc/documents/$docId/download" -TimeoutSec 5 | Out-Null
  throw 'expected 401 without JWT'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -ne 401) { throw "expected 401 without JWT, got $code" }
  Write-Output 'no-jwt → 401 OK'
}

$dl = Invoke-RestMethod -Uri "$base/kyc/documents/$docId/download" -Headers @{ Authorization = "Bearer $mToken" }
Write-Output "download url=$($dl.url) expiresIn=$($dl.expiresIn)"
if (-not $dl.url) { throw 'missing signed url' }
if ($dl.url -match '/uploads/kyc') { throw 'signed url must not be public /uploads/kyc' }

# Fetch signed stream (local HMAC or S3)
$signedFull = if ($dl.url.StartsWith('http')) { $dl.url } else { "http://127.0.0.1:3001$($dl.url)" }
$bytes = & curl.exe -s -o - $signedFull
if (-not $bytes -or $bytes.Length -lt 10) { throw 'signed download returned empty body' }
Write-Output "signed stream bytes=$($bytes.Length) OK"

$list = Invoke-RestMethod -Uri "$base/shops/$shopId/kyc" -Headers @{ Authorization = "Bearer $mToken" }
Write-Output "list count=$($list.Count) status0=$($list[0].status)"

$aLogin = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"superadmin@demo.com","password":"123456"}'
$aToken = $aLogin.accessToken
$aH = @{ Authorization = "Bearer $aToken"; 'Content-Type' = 'application/json' }

$rev = Invoke-RestMethod -Uri "$base/kyc/$docId/status" -Method PATCH -Headers $aH -Body '{"status":"APPROVED","notes":"smoke ok"}'
Write-Output "review status=$($rev.document.status)"

# second doc then delete
$up2 = & curl.exe -s -X POST "$base/shops/$shopId/kyc" -H "Authorization: Bearer $mToken" -F "file=@$pngPath;type=image/png" -F 'docType=OTHER'
$doc2 = $up2 | ConvertFrom-Json
$del = Invoke-RestMethod -Uri "$base/kyc/$($doc2.id)" -Method DELETE -Headers @{ Authorization = "Bearer $mToken" }
Write-Output "delete success=$($del.success)"
Write-Output 'OK'
