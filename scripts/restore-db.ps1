# Stage 28: Restore PostgreSQL dump (Windows)
# Usage:
#   $env:DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/mplace_restore"
#   .\scripts\restore-db.ps1 -BackupFile .\backups\postgres\mplace_YYYYMMDD_HHMMSS.sql.gz
#
# WARNING: restores INTO DATABASE_URL. Use a dedicated database for tests.

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

function Find-PgTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if ($env:PG_BIN) {
    $p = Join-Path $env:PG_BIN $Name
    if (Test-Path $p) { return $p }
  }
  foreach ($ver in @("18", "17", "16")) {
    $p = "C:\Program Files\PostgreSQL\$ver\bin\$Name"
    if (Test-Path $p) { return $p }
  }
  throw "pg tool not found: $Name"
}

if (-not (Test-Path $BackupFile)) {
  throw "File not found: $BackupFile"
}
if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not set (target database)"
}

$psql = Find-PgTool "psql.exe"
# libpq URI for psql must not include Prisma-only query params (e.g. ?schema=public)
$DbUrl = $env:DATABASE_URL
if ($DbUrl -match '\?') { $DbUrl = $DbUrl.Substring(0, $DbUrl.IndexOf('?')) }
Write-Host "Restoring $BackupFile → DATABASE_URL"
Write-Host "Using: $psql"

# Verify checksum if present
$shaFile = "$BackupFile.sha256"
if (Test-Path $shaFile) {
  $expected = (Get-Content $shaFile -Raw).Split()[0].Trim().ToLower()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $BackupFile).Hash.ToLower()
  if ($expected -ne $actual) {
    throw "SHA256 mismatch for $BackupFile"
  }
  Write-Host "SHA256 OK"
}

$sqlFile = $BackupFile
$tempSql = $null
if ($BackupFile -match '\.gz$') {
  $tempSql = Join-Path $env:TEMP ("mplace_restore_" + [guid]::NewGuid().ToString() + ".sql")
  Add-Type -AssemblyName System.IO.Compression
  $in = [System.IO.File]::OpenRead((Resolve-Path $BackupFile))
  try {
    $gzip = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
    try {
      $out = [System.IO.File]::Create($tempSql)
      try { $gzip.CopyTo($out) } finally { $out.Dispose() }
    } finally { $gzip.Dispose() }
  } finally { $in.Dispose() }
  $sqlFile = $tempSql
}

try {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $psql $DbUrl -v ON_ERROR_STOP=1 -f $sqlFile
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($code -ne 0) { throw "psql restore failed with exit $code" }
  Write-Host "Restore completed successfully."
} finally {
  if ($tempSql -and (Test-Path $tempSql)) {
    Remove-Item -Force $tempSql -ErrorAction SilentlyContinue
  }
}
