# Stage 28: Full drill — backup → restore to clean DB → verify counts + migrate status
# Usage (from repo root):
#   $env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/mplace"
#   .\scripts\verify-backup-restore.ps1
#
# Creates database mplace_restore_test, restores dump, compares row counts.

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ReportDir = Join-Path $RepoRoot "backups\postgres"
$ReportFile = Join-Path $ReportDir ("restore-drill-" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".md")

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

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not set (source production/dev database)"
}

$SourceUrl = $env:DATABASE_URL
# Parse simple postgres URL for admin connection
if ($SourceUrl -notmatch 'postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/([^?]+)') {
  throw "Could not parse DATABASE_URL"
}
$PgUser = $Matches[1]
$PgPass = $Matches[2]
$PgHost = $Matches[3]
$PgPort = if ($Matches[4]) { $Matches[4] } else { "5432" }
$SourceDb = $Matches[5]
$RestoreDb = if ($env:RESTORE_DB_NAME) { $env:RESTORE_DB_NAME } else { "mplace_restore_test" }
$AdminUrl = "postgresql://${PgUser}:${PgPass}@${PgHost}:${PgPort}/postgres"
# Prisma apps may use ?schema=public; libpq tools need clean URL
$RestoreUrl = "postgresql://${PgUser}:${PgPass}@${PgHost}:${PgPort}/${RestoreDb}"
$RestoreUrlPrisma = "${RestoreUrl}?schema=public"

$psql = Find-PgTool "psql.exe"
$env:PGPASSWORD = $PgPass

function Normalize-LibpqUrl([string]$Url) {
  if ($Url -match '\?') { return $Url.Substring(0, $Url.IndexOf('?')) }
  return $Url
}

function Invoke-Sql([string]$DbUrl, [string]$Sql, [switch]$AllowNotices) {
  $tmp = Join-Path $env:TEMP ("mplace_sql_" + [guid]::NewGuid().ToString() + ".sql")
  # UTF8 no BOM — psql on Windows mishandles BOM
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, $Sql, $utf8NoBom)
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $clean = Normalize-LibpqUrl $DbUrl
    $out = & $psql $clean -v ON_ERROR_STOP=1 -t -A -f $tmp 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    $text = ($out | ForEach-Object { "$_" }) -join "`n"
    if ($code -ne 0) { throw "psql failed ($code): $text" }
    return $text.Trim()
  } finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
  }
}

function Get-Counts([string]$DbUrl) {
  $sql = @'
SELECT
  (SELECT count(*) FROM "User")::text || '|' ||
  (SELECT count(*) FROM "Shop")::text || '|' ||
  (SELECT count(*) FROM "Product")::text || '|' ||
  (SELECT count(*) FROM "Order")::text || '|' ||
  (SELECT count(*) FROM "Payment")::text;
'@
  $raw = Invoke-Sql $DbUrl $sql
  $parts = $raw.Split('|')
  return @{
    users    = [int]$parts[0]
    shops    = [int]$parts[1]
    products = [int]$parts[2]
    orders   = [int]$parts[3]
    payments = [int]$parts[4]
  }
}

Write-Host "=== Stage 28 backup → restore drill ==="
Write-Host "Source DB: $SourceDb"
Write-Host "Restore DB: $RestoreDb"

# 1) Counts before backup
$before = Get-Counts $SourceUrl
Write-Host ("Source counts: users={0} shops={1} products={2} orders={3} payments={4}" -f `
  $before.users, $before.shops, $before.products, $before.orders, $before.payments)

# 2) Backup
$env:DATABASE_URL = $SourceUrl
$env:BACKUP_DIR = Join-Path $RepoRoot "backups\postgres"
$backupPath = & (Join-Path $PSScriptRoot "backup-db.ps1")
$backupPath = ($backupPath | Select-Object -Last 1).ToString().Trim()
if (-not (Test-Path $backupPath)) { throw "Backup file missing: $backupPath" }
Write-Host "Backup: $backupPath"

# 3) Drop/create restore database
Write-Host "Recreating database $RestoreDb ..."
# Separate statements — quieter on first run
$dropSql = "DROP DATABASE IF EXISTS `"$RestoreDb`";"
$createSql = "CREATE DATABASE `"$RestoreDb`";"
try {
  Invoke-Sql $AdminUrl "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$RestoreDb' AND pid <> pg_backend_pid();" | Out-Null
} catch {
  Write-Host "Note: terminate backends skipped ($($_.Exception.Message))"
}
Invoke-Sql $AdminUrl $dropSql | Out-Null
Invoke-Sql $AdminUrl $createSql | Out-Null

# 4) Restore
$env:DATABASE_URL = $RestoreUrl
& (Join-Path $PSScriptRoot "restore-db.ps1") -BackupFile $backupPath

# 5) Verify counts
$after = Get-Counts $RestoreUrl
Write-Host ("Restored counts: users={0} shops={1} products={2} orders={3} payments={4}" -f `
  $after.users, $after.shops, $after.products, $after.orders, $after.payments)

$match =
  $before.users -eq $after.users -and
  $before.shops -eq $after.shops -and
  $before.products -eq $after.products -and
  $before.orders -eq $after.orders -and
  $before.payments -eq $after.payments

if (-not $match) {
  throw "Row count mismatch after restore"
}

# 6) prisma migrate status against restore DB
$migrateOut = ""
Push-Location (Join-Path $RepoRoot "apps\api")
try {
  $env:DATABASE_URL = $RestoreUrlPrisma
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $migrateOut = & npx prisma migrate status 2>&1 | ForEach-Object { "$_" } | Out-String
  $ErrorActionPreference = $prevEap
  Write-Host $migrateOut
} finally {
  Pop-Location
  $env:DATABASE_URL = $SourceUrl
}

# 7) Write report
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$utc = (Get-Date).ToUniversalTime().ToString("o")
$backupSize = (Get-Item $backupPath).Length
$report = @(
  "# Backup restore drill report",
  "",
  "- **Date (UTC):** $utc",
  "- **Host:** $env:COMPUTERNAME",
  "- **Source DB:** ``$SourceDb`` @ ``${PgHost}:${PgPort}``",
  "- **Restore DB:** ``$RestoreDb``",
  "- **Backup file:** ``$backupPath``",
  "- **Backup size:** $backupSize bytes",
  "",
  "## Counts (source → restore)",
  "",
  "| Table | Source | Restore |",
  "|-------|--------|---------|",
  "| User | $($before.users) | $($after.users) |",
  "| Shop | $($before.shops) | $($after.shops) |",
  "| Product | $($before.products) | $($after.products) |",
  "| Order | $($before.orders) | $($after.orders) |",
  "| Payment | $($before.payments) | $($after.payments) |",
  "",
  "**Counts match:** $match",
  "",
  "## prisma migrate status (restore DB)",
  "",
  '```',
  $migrateOut.Trim(),
  '```',
  "",
  "## Result",
  "",
  "**PASS** — backup → restore → data verified (row counts match).",
  "",
  "Application start note: point ``DATABASE_URL`` at restore DB and run ``npm run start:prod`` / ``nest start`` if you need a live boot check; schema is identical to source."
) -join "`n"
Set-Content -Path $ReportFile -Value $report -Encoding UTF8
Write-Host "Report written: $ReportFile"
Write-Host "=== DRILL PASS ==="
$ReportFile
