$ErrorActionPreference = 'Stop'
$login = Invoke-RestMethod -Uri http://127.0.0.1:3001/api/auth/login -Method POST -ContentType application/json -Body '{"email":"customer@demo.com","password":"123456"}'
$token = $login.accessToken
$dir = Join-Path $PSScriptRoot '..\uploads'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$pngPath = Join-Path $dir '_test.png'
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
$up = & curl.exe -s -X POST 'http://127.0.0.1:3001/api/media/upload' -H "Authorization: Bearer $token" -F "file=@$pngPath;type=image/png" -F 'folder=products'
Write-Output "UPLOAD=$up"
$upObj = $up | ConvertFrom-Json
if (-not $upObj.url) { throw "no url" }
$url = $upObj.url
$del = & curl.exe -s -X DELETE ("http://127.0.0.1:3001/api/media?url=" + [uri]::EscapeDataString($url)) -H "Authorization: Bearer $token"
Write-Output "DELETE=$del"
$presign = & curl.exe -s -X POST 'http://127.0.0.1:3001/api/media/presign' -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"folder":"products","contentType":"image/webp"}'
Write-Output "PRESIGN=$presign"
Write-Output 'OK'
