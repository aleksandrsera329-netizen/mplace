# Stage 28: PostgreSQL backup (Windows PowerShell)
# Usage:
#   $env:DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/mplace"
#   .\scripts\backup-db.ps1
# Optional:
#   $env:BACKUP_DIR = "C:\backups\mplace"
#   $env:RETENTION_DAYS = "30"
#   $env:PG_BIN = "C:\Program Files\PostgreSQL\18\bin"

$ErrorActionPreference = "Stop"

function Find-PgTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if ($env:PG_BIN) {
    $p = Join-Path $env:PG_BIN $Name
    if (Test-Path $p) { return $p }
  }
  $candidates = @(
    "C:\Program Files\PostgreSQL\18\bin\$Name",
    "C:\Program Files\PostgreSQL\17\bin\$Name",
    "C:\Program Files\PostgreSQL\16\bin\$Name"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  throw "pg tool not found: $Name (install PostgreSQL client tools or set PG_BIN)"
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not set"
}

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else {
  Join-Path (Split-Path $PSScriptRoot -Parent) "backups\postgres"
}
$RetentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 30 }
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$FileName = "mplace_$Date.sql.gz"
$Target = Join-Path $BackupDir $FileName
$SqlTemp = Join-Path $env:TEMP "mplace_backup_$Date.sql"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$pgDump = Find-PgTool "pg_dump.exe"
Write-Host "Starting backup → $Target"
Write-Host "Using: $pgDump"

# Strip Prisma query params (?schema=public) — invalid for libpq tools
$DbUrl = $env:DATABASE_URL
if ($DbUrl -match '\?') { $DbUrl = $DbUrl.Substring(0, $DbUrl.IndexOf('?')) }

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $pgDump $DbUrl --format=plain --no-owner --no-acl --file=$SqlTemp
$code = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($code -ne 0) { throw "pg_dump failed with exit $code" }

# gzip via .NET
Add-Type -AssemblyName System.IO.Compression
$in = [System.IO.File]::OpenRead($SqlTemp)
try {
  $out = [System.IO.File]::Create($Target)
  try {
    $gzip = New-Object System.IO.Compression.GZipStream($out, [System.IO.Compression.CompressionLevel]::Optimal)
    try {
      $in.CopyTo($gzip)
    } finally { $gzip.Dispose() }
  } finally { $out.Dispose() }
} finally { $in.Dispose() }

Remove-Item -Force $SqlTemp -ErrorAction SilentlyContinue

$Size = (Get-Item $Target).Length
if ($Size -lt 100) {
  Remove-Item -Force $Target -ErrorAction SilentlyContinue
  throw "Backup file too small ($Size bytes)"
}

# SHA256
$hash = (Get-FileHash -Algorithm SHA256 -Path $Target).Hash.ToLower()
Set-Content -Path "$Target.sha256" -Value "$hash  $FileName" -Encoding ASCII

# Retention
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "mplace_*.sql.gz" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object {
    Write-Host "Deleting old backup: $($_.Name)"
    Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
    Remove-Item -Force "$($_.FullName).sha256" -ErrorAction SilentlyContinue
  }

Write-Host "Backup created: $FileName ($Size bytes)"
Write-Host "BACKUP_FILE=$Target"
# Return path for pipelines
$Target
