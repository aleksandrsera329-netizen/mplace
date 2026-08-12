#!/usr/bin/env bash
# Stage 28: Restore PostgreSQL dump created by backup-db.sh
# Usage:
#   export DATABASE_URL=postgresql://user:pass@host:5432/mplace_restore
#   ./scripts/restore-db.sh /path/to/mplace_YYYYMMDD_HHMMSS.sql.gz
#
# WARNING: restores INTO DATABASE_URL target. Prefer a dedicated restore DB.

set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup.sql.gz|backup.sql>" >&2
  exit 1
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: file not found: $BACKUP_FILE" >&2
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set (target database)" >&2
  exit 1
fi
# Strip Prisma-only query params (?schema=public) for libpq
DB_URL="${DATABASE_URL%%\?*}"
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found in PATH" >&2
  exit 1
fi

echo "Restoring ${BACKUP_FILE} → DATABASE_URL"
# Optional integrity check
if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${BACKUP_FILE}.sha256"
  fi
fi

case "$BACKUP_FILE" in
  *.gz)
    gunzip -c "$BACKUP_FILE" | psql "$DB_URL" -v ON_ERROR_STOP=1
    ;;
  *)
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
    ;;
esac

echo "Restore completed successfully."
