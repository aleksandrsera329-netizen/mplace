# SQLite-era Prisma migrations (archived — Stage 3)

These migrations used SQLite syntax (`PRAGMA`, `DATETIME`, `PRIMARY KEY` without PG enums)
and `migration_lock.toml` had `provider = "sqlite"`.

They are **not** used by `prisma migrate deploy` anymore.

## Replacement

- Active history: `prisma/migrations/`
- Baseline: `20260810300000_baseline_postgresql` (full PostgreSQL schema from current `schema.prisma`)
- Lock: `provider = "postgresql"`

Do not copy these folders back into `prisma/migrations/` while the datasource is PostgreSQL.
