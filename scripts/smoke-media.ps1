# Smoke: owned media upload + delete by id
# Usage: .\scripts\smoke-media.ps1 -Token <jwt> [-PngPath path]
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$PngPath = "$PSScriptRoot\..\uploads\_test.png",
  [string]$Base = "http://127.0.0.1:3001/api"
)

if (-not (Test-Path $PngPath)) {
  # minimal 1x1 png
  $bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
  $dir = Split-Path $PngPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [IO.File]::WriteAllBytes($PngPath, $bytes)
}

$up = & curl.exe -s -X POST "$Base/media" `
  -H "Authorization: Bearer $Token" `
  -F "file=@$PngPath;type=image/png" `
  -F "entityType=product" `
  -F "entityId=smoke-entity-1" `
  -F "visibility=PUBLIC"

Write-Host "UPLOAD:" $up
$json = $up | ConvertFrom-Json
$id = $json.id
if (-not $id) { Write-Error "No media id in response"; exit 1 }

$get = & curl.exe -s "$Base/media/$id" -H "Authorization: Bearer $Token"
Write-Host "GET:" $get

$del = & curl.exe -s -X DELETE "$Base/media/$id" -H "Authorization: Bearer $Token"
Write-Host "DELETE:" $del

$presign = & curl.exe -s -X POST "$Base/media/presign" `
  -H "Authorization: Bearer $Token" `
  -H "Content-Type: application/json" `
  -d '{"folder":"products","contentType":"image/webp"}'
Write-Host "PRESIGN:" $presign
