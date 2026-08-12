#!/usr/bin/env bash
# Stage 28: PostgreSQL logical backup (daily-friendly)
# Usage:
#   export DATABASE_URL=postgresql://user:pass@host:5432/mplace
#   ./scripts/backup-db.sh
# Optional:
#   BACKUP_DIR=/var/backups/mplace  RETENTION_DAYS=30  ./scripts/backup-db.sh

set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
FILENAME="mplace_${DATE}.sql.gz"
TARGET="${BACKUP_DIR}/${FILENAME}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Strip Prisma-only query params (?schema=public) for libpq
DB_URL="${DATABASE_URL%%\?*}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found in PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Starting backup → ${TARGET}"
# --no-owner --no-acl: portable restores across roles
pg_dump "$DB_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose 2> >(grep -v '^pg_dump: ' >&2 || true) \
  | gzip -c > "$TARGET"

SIZE=$(wc -c < "$TARGET" | tr -d ' ')
if [[ "$SIZE" -lt 100 ]]; then
  echo "ERROR: backup file too small (${SIZE} bytes)" >&2
  rm -f "$TARGET"
  exit 1
fi

# Retention: delete dumps older than RETENTION_DAYS
if command -v find >/dev/null 2>&1; then
  find "$BACKUP_DIR" -type f -name 'mplace_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null || true
fi

# checksum for integrity
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$TARGET" > "${TARGET}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$TARGET" > "${TARGET}.sha256"
fi

echo "Backup created: ${FILENAME} (${SIZE} bytes)"
echo "BACKUP_FILE=${TARGET}"
