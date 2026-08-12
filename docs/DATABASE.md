# DATABASE.md

## Engine

- **PostgreSQL 16** (production / docker-compose)
- Prisma 6 schema: `apps/api/prisma/schema.prisma`
- Migrations: `apps/api/prisma/migrations/`
- SQLite history archived under `migrations_sqlite_archive/` (do not use for prod)

## Connection

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
```

| Context | Example host |
|---------|----------------|
| Local native | `127.0.0.1:5432` |
| Compose published | `127.0.0.1:5433` → container 5432 |
| Compose internal | `postgres:5432` |

## Migrations

| Environment | Command |
|-------------|---------|
| Production / CI | `npx prisma migrate deploy` |
| Local new migration | `npx prisma migrate dev --name <name>` |
| Generate client | `npx prisma generate` |

**Never** on API process start:

- `prisma db push`
- `prisma db seed`

Compose: one-shot service `migrate` runs `migrate deploy` before API.

### Status / resolve

```bash
npx prisma migrate status
# existing DB created via db push once:
npx prisma migrate resolve --applied 20260810300000_baseline_postgresql
```

## Seed (manual, dev/staging)

```bash
npx prisma db seed
# or
npm run prisma:seed
```

Demo accounts: see root README. **Do not seed production** unless an explicit ops procedure.

## Core tables (subset)

| Domain | Tables |
|--------|--------|
| Identity | `User`, `RefreshToken`, RolePermission |
| Catalog | `Shop`, `Product`, `Category`, `ProductImportJob` |
| Media | `MediaAsset`, `KycDocument` |
| Orders | `Cart`, `Order`, `OrderItem`, `OrderStatusHistory`, `InventoryReservation` |
| Money | `Payment`, `PaymentWebhookEvent`, `Refund`, `FinancialTransaction`, `FinancialEntry`, `PayoutRequest`, `LedgerEntry` |
| RFQ | `RfqRequest`, `RfqOffer`, `RfqItem`, `rfq_number_seq` |
| Jobs | notifications, notification_deliveries |
| Infra | `Outbox`, `IdempotencyKey`, `AuditLog` |

## Backup

Logical dumps via `scripts/backup-db.*` — see [BACKUP.md](./BACKUP.md).

## Indexes / concurrency notes

- Payouts: `SELECT … FROM "Shop" WHERE id = $1 FOR UPDATE`
- RFQ numbers: PostgreSQL sequence `rfq_number_seq`
- Inventory: `InventoryReservation` + product reserved stock
- Payment webhooks: unique `(provider, externalId)` on `PaymentWebhookEvent`
