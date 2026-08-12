# BACKUP.md — PostgreSQL Backup & Disaster Recovery (Stage 28)

## Goals

| Requirement | Status |
|-------------|--------|
| Daily backup | Scripts + cron / Task Scheduler examples |
| Point-in-time recovery | Optional (WAL archive notes) |
| Retention 30 days | Default in scripts (`RETENTION_DAYS=30`) |
| Verified cycle: backup → restore → app → data | `scripts/verify-backup-restore.ps1` + drill report |

---

## Scripts

| Script | Platform | Purpose |
|--------|----------|---------|
| `scripts/backup-db.sh` | Linux / macOS / CI | `pg_dump` → `mplace_YYYYMMDD_HHMMSS.sql.gz` |
| `scripts/restore-db.sh` | Linux / macOS / CI | gunzip \| `psql` |
| `scripts/backup-db.ps1` | Windows | same |
| `scripts/restore-db.ps1` | Windows | same |
| `scripts/verify-backup-restore.ps1` | Windows drill | full backup → clean DB → verify counts |

Default output directory: **`backups/postgres/`** (repo-relative; gitignored recommended).

### Backup

```bash
# Linux / compose host
export DATABASE_URL="postgresql://mplace:mplace@127.0.0.1:5433/mplace"
export BACKUP_DIR="/backups/postgres"   # optional
export RETENTION_DAYS=30                # optional
./scripts/backup-db.sh
```

```powershell
# Windows
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/mplace"
$env:BACKUP_DIR = "C:\Users\sasha\mplace\backups\postgres"
$env:PG_BIN = "C:\Program Files\PostgreSQL\18\bin"  # if not on PATH
.\scripts\backup-db.ps1
```

Produces:

- `mplace_YYYYMMDD_HHMMSS.sql.gz`
- `mplace_YYYYMMDD_HHMMSS.sql.gz.sha256`

### Restore

```bash
# Prefer a NEW database — never restore onto live without maintenance window
export DATABASE_URL="postgresql://mplace:mplace@127.0.0.1:5433/mplace_restore"
createdb mplace_restore   # or CREATE DATABASE
./scripts/restore-db.sh /backups/postgres/mplace_20260812_120000.sql.gz
```

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/mplace_restore_test"
.\scripts\restore-db.ps1 -BackupFile .\backups\postgres\mplace_YYYYMMDD_HHMMSS.sql.gz
```

### After restore — application start

```bash
cd apps/api
export DATABASE_URL="...restore db..."
npx prisma migrate status    # should show applied migrations
npx prisma generate
npm run build
npm run start:prod           # or start:dev
# smoke: curl http://127.0.0.1:3000/api/health/ready
```

### Data verification queries

```sql
SELECT count(*) FROM "User";
SELECT count(*) FROM "Shop";
SELECT count(*) FROM "Product";
SELECT count(*) FROM "Order";
SELECT count(*) FROM "Payment";
SELECT count(*) FROM "RfqRequest";
```

Compare to pre-backup counts (the drill script does this automatically).

---

## Schedule

### Linux cron (daily 02:15)

```cron
15 2 * * * DATABASE_URL="postgresql://..." BACKUP_DIR=/backups/postgres /opt/mplace/scripts/backup-db.sh >> /var/log/mplace-backup.log 2>&1
```

### systemd timer (sketch)

- Service: `ExecStart=/opt/mplace/scripts/backup-db.sh`
- Timer: `OnCalendar=daily`

### Windows Task Scheduler

- Program: `powershell.exe`
- Args: `-File C:\Users\sasha\mplace\scripts\backup-db.ps1`
- Env: `DATABASE_URL`, `BACKUP_DIR`, `PG_BIN`

### Docker Compose (optional one-shot / cron container)

See `docker-compose.yml` service `db-backup` (profile `backup`).

---

## Retention

- Default **30 days** (`RETENTION_DAYS`)
- Scripts delete `mplace_*.sql.gz` older than retention
- Off-site: copy `backups/postgres/` to S3/R2/NAS nightly (example):

```bash
# after backup-db.sh
aws s3 sync "$BACKUP_DIR" "s3://my-bucket/mplace-pg/" --storage-class STANDARD_IA
```

---

## Point-in-time recovery (PITR) — optional

Logical dumps (`pg_dump`) restore to **backup time**, not arbitrary points.

For true PITR:

1. Enable Postgres WAL archiving (`archive_mode=on`, `archive_command` → object storage)
2. Base backup (`pg_basebackup`) daily
3. Continuous WAL ship to S3/R2
4. Restore base + replay WAL to target LSN/time

Recommended for production after pilot; daily logical dump is the Stage 28 minimum.

---

## Verified drill

Run:

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/mplace"
.\scripts\verify-backup-restore.ps1
```

Report is written to `backups/postgres/restore-drill-*.md`.

Latest successful drill (if present): see files matching `backups/postgres/restore-drill-*.md`.

**Example verified run (local):** `backups/postgres/restore-drill-20260812_132016.md`

| Check | Result |
|-------|--------|
| Backup size | ~17 KB gzip (dev dataset) |
| Source → restore counts | User 5, Shop 5, Product 10, Order 2, Payment 0 — **match** |
| `prisma migrate status` on restore DB | **Database schema is up to date!** (13 migrations) |

---

## Acceptance checklist

- [x] Working backup script (`.sh` + `.ps1`)
- [x] Working restore script (`.sh` + `.ps1`)
- [x] Documentation (this file)
- [x] At least one successful backup → restore → data verified cycle (drill report)

---

## Related

- Codebase file backups (not DB): `docs/BACKUP_RESTORE.md`
- Deploy: `docs/DEPLOYMENT.md`
- Monitoring after restore: `docs/MONITORING.md` (`/api/health/ready`)
