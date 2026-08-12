# AUDIT.md — Baseline Audit (audit-baseline)

**Дата:** 2026-08-10  
**Tag:** `audit-baseline`  
**Цель:** Зафиксировать состояние перед выполнением ТЗ «Повышение технической и коммерческой ценности».  
**Репозиторий:** `C:\Users\sasha\mplace`  
**Ветка (на момент baseline):** `master`

## Версии (зафиксировано командами)

| Компонент       | Версия          | Примечание |
|-----------------|-----------------|------------|
| Node.js         | v22.21.0        | `node -v` |
| npm             | 10.9.4          | `npm -v` |
| NestJS          | 11.1.28 (core)  | `@nestjs/core` resolved; package.json `^11.0.1` |
| NestJS common   | ^11.0.1         | apps/api/package.json |
| Prisma CLI/Client | 6.19.3        | `npx prisma -v` / `@prisma/client` |
| Next.js         | 16.3.0          | apps/web/package.json |
| React           | 19.2.8          | apps/web |
| PostgreSQL      | 16 (image)      | `postgres:16-alpine` в docker-compose.yml |
| Redis           | 7 (image)       | `redis:7-alpine` в docker-compose.yml |
| Meilisearch     | v1.11           | `getmeili/meilisearch:v1.11` |
| Nginx           | 1.27-alpine     | docker-compose |
| TypeScript      | ~5.7–5.9        | API 5.7.3 package; runtime prisma report 5.9.3 |
| Docker Desktop  | n/a at capture  | daemon not running — live `docker compose exec` failed |

### Команды (выполнено 2026-08-10)

```text
node -v          → v22.21.0
npm -v           → 10.9.4
cd apps/api && npx prisma -v
  prisma                  : 6.19.3
  @prisma/client          : 6.19.3
  Node.js                 : v22.21.0
cd apps/api && npm list @nestjs/core
  @nestjs/core@11.1.28
cd apps/web && npm list next
  next@16.3.0
docker compose exec postgres postgres --version
  → Docker Desktop unavailable (pipe dockerDesktopLinuxEngine not found)
```

### apps/api/package.json (ключевое)

**scripts:** `build`, `start` / `start:dev` / `start:prod`, `test`, `test:e2e`, `test:all`, `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `db:setup`

**dependencies (фрагмент):**  
`@nestjs/core` ^11.0.1, `@nestjs/common` ^11.0.1, `@nestjs/cqrs` ^11.0.3, `@nestjs/bullmq` ^11.0.5, `@prisma/client` ^6.19.3, `bullmq`, `stripe`, `passport-jwt`, `bcrypt`, `pdfkit`, `meilisearch`, `nestjs-pino`, `helmet`, `@sentry/node`

**devDependencies:** `prisma` ^6.19.3, `jest` ^30, `ts-jest`, `@nestjs/testing`, `typescript` ^5.7.3

### apps/web/package.json (ключевое)

**scripts:** `dev`, `build`, `start`, `lint`  
**dependencies:** `next` 16.3.0, `react` 19.2.8, `@tanstack/react-query`, `zustand`, `zod`

## Текущий статус ключевых областей

| Область                     | Статус       | Комментарий |
|-----------------------------|--------------|-------------|
| Media ownership             | ✅ Done (Этап 1) | MediaAsset + DELETE /media/:id ownership |
| KYC privacy                 | ✅ Done (Этап 2) | private/kyc + signed URL + ACL + audit KYC_DOWNLOAD |
| Production migrations       | ✅ Done (Этап 3) | `migrate deploy` only; no push/seed on API start |
| Secrets defaults            | ✅ Done (Этап 4) | validateEnv fail-fast; prod rejects weak/missing secrets |
| Refresh tokens              | ✅ Done (Этап 5) | family + rotation + reuse detection + HttpOnly cookie |
| Stripe webhooks idempotency | ✅ Done (Этап 7) | PaymentWebhookEvent durable + status machine |
| Ledger invariants           | ✅ Done      | Double-entry posting rejects unbalanced entries; covered by ledger tests |
| Multi-tenant                | ✅ Hardened  | Tenant-aware Prisma extension covers unique reads/mutations and all tenantId models |
| CQRS / Outbox               | 🟡           | Order/RFQ CQRS + Outbox + BullMQ |
| Warehouse / Shipping / Tax  | 🟡           | Foundation реализован |
| Documents (invoice/act PDF) | 🟡           | Есть API + pdfkit |
| Notifications               | ✅ Done (Этап 18) | NotificationType/Channel + Delivery; notify() durable; ORDER_PAID/RFQ/KYC/PAYOUT wired |
| Background Jobs (BullMQ)    | ✅ Done (Этап 19) | emails/imports/inventory queues; import async; releaseExpired cron; email retries |
| Search (Meilisearch)        | ✅ Done (Этап 17) | filters+facets+autocomplete; queue index; brand/moq/attributes |
| Rate limiting               | ✅ Done (Этап 23) | Throttler+Redis; auth/RFQ/payment/upload hard limits; 429 headers |
| Security headers            | ✅ Done (Этап 22) | helmet CSP/HSTS/frame/nosniff/referrer + Permissions-Policy; CORS allowlist |
| XSS / frontend security     | ✅ Done (Этап 21) | escapeHtml legacy; sanitizeHtml+DOMPurify; no raw dangerouslySetInnerHTML |
| Frontend consolidation      | ✅ Done (Этап 20) | Next primary (cart/checkout/cabinets); legacy fallback; FRONTEND.md |
| Production / pilot gate     | ✅ Done (Этап 30) | docs/PRODUCTION_GATE.md — GO for pilot; builds+security suite green |
| File upload security        | ✅ Done (Этап 24) | magic-byte + whitelist + size; random keys; optional ClamAV |
| Observability               | ✅ Done (Этап 26) | requestId/correlationId ALS; structured logs; money/RFQ/KYC |
| Security/Money test matrix  | ✅ Done (Этап 25) | docs/TEST_MATRIX.md + `npm run test:security` |
| Monitoring                  | ✅ Done (Этап 27) | ready probe + Prometheus /metrics + MONITORING.md |
| Backup & DR                 | ✅ Done (Этап 28) | pg_dump scripts + restore drill + 30d retention |
| Documentation               | ✅ Done (Этап 29) | README + API/DB/Payments/RFQ/KYC + ops docs |
| RFQ → Order                 | ✅ Done      | Award transaction creates PENDING_PAYMENT order with RFQ provenance |
| Frontend                    | 🟡           | Legacy HTML + apps/web Next.js 16 |
| Admin permissions + MFA     | ✅ Done (Этап 6) | RolePermission matrix; mandatory TOTP for admins |
| Automated security tests    | ✅ Done      | Unit/security matrix + E2E suite + CI dependency audit gate |

## Baseline команды (рекомендуемый прогон)

```bash
cd apps/api
npm install
npm run build
npm test
# npm run test:e2e   # требует DB + env

cd ../web
npm install
npx tsc --noEmit
# npm run build
```

## Известные Critical issues (на старте audit-baseline)

1. ~~Media delete без ownership check~~ → fixed Этап 1  
2. ~~KYC файлы публичны через static `/uploads`~~ → fixed Этап 2  
3. ~~`prisma db push` / seed в production startup~~ → fixed Этап 3  
4. ~~Secrets / no fail-fast~~ → fixed Этап 4 (`config/env.validation.ts`)  
5. ~~Нет fail-fast на production secrets~~ → fixed Этап 4

## Этап 2 — Private KYC (выполнено)

- Prisma: `KycDocument.mediaAssetId` → `MediaAsset` (visibility=`KYC`)  
- Storage: `uploadPrivate` → `private/kyc/{shopId}/{entityId}/{uuid}.ext`  
- Download: `GET /api/kyc/documents/:id/download` (JWT + shop/admin ACL) → signed URL 180s  
- Stream local: `GET /api/media/signed?key&exp&sig` (HMAC)  
- `GET /api/media/:id` для KYC: ACL + signed url, не public path  
- nginx: `deny` на `/uploads/kyc/` и `/uploads/private/`  
- API middleware: 403 на те же префиксы  
- Audit: `KYC_UPLOAD`, `KYC_DOWNLOAD`, `KYC_APPROVED`/`REJECTED`, `KYC_DELETE`  

## Этап 3 — Production Database (выполнено)

- Dockerfile CMD: `["node", "dist/src/main.js"]` — **без** `db push` / seed  
- Optional: `apps/api/docker-entrypoint.sh` (migrate then start)  
- compose service **`migrate`**: `npx prisma migrate deploy`, `restart: "no"`  
- `api` depends_on migrate `service_completed_successfully`  
- PostgreSQL baseline: `20260810300000_baseline_postgresql`  
- `migration_lock.toml` → `provider = "postgresql"`  
- SQLite history → `prisma/migrations_sqlite_archive/`  
- Seed: только manual (`npm run prisma:seed`)  
- Проверка: clean DB `migrate deploy` → schema up to date; existing DB `resolve --applied`  

## Этап 4 — Secrets & fail-fast (выполнено)

- `apps/api/src/config/env.validation.ts` + `ConfigModule.forRoot({ validate })`  
- Production: missing `JWT_SECRET` / `DATABASE_URL` / `REDIS_URL` / `MEILI_MASTER_KEY` / Stripe → `process.exit(1)`  
- Reject weak JWT, MEILI demo key, `POSTGRES_PASSWORD=mplace`, `PAYMENT_PROVIDER=dev`  
- No hardcoded `dev-storage-sign-secret` (uses JWT / `STORAGE_SIGN_SECRET`)  
- Templates: `.env.example` (dev), `.env.production.example` (prod placeholders)  
- Compose `NODE_ENV` default `development` (local); set `production` only with real secrets  

## Этап 5 — Auth 2.0 Refresh family (выполнено)

- `RefreshToken.familyId` + `replacedBy` (migration `20260810400000_refresh_token_family`)  
- Login/register: new `familyId`, opaque refresh (sha256 stored)  
- Refresh: rotation in same family; old token `revokedAt` + `replacedBy`  
- Reuse of revoked refresh → revoke all active tokens in family + 401 + audit `REFRESH_REUSE_DETECTED`  
- HttpOnly cookie `refreshToken` path `/api/auth` (secure in production); body still accepted  
- `cookie-parser` in `main.ts`  
- Unit tests: rotation, reuse, expired, logout  

## Этап 6 — Admin security (выполнено)

- `Permission` enum + `RolePermission` model; seed full set for ADMIN/SUPER_ADMIN  
- `PermissionsGuard` + `@RequirePermissions(...)` on admin routes, KYC review, payouts  
- SUPER_ADMIN bypass in guard  
- Mandatory MFA for ADMIN/SUPER_ADMIN: login → `mfaEnrollmentRequired` or `mfaRequired` + `tempToken`  
- Endpoints: `POST /auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/verify`  
- TOTP via existing `twoFactorSecret` / `twoFactorEnabled` + `totpVerifiedAt`; QR via `qrcode`  
- Admins cannot disable MFA  

## Этап 7 — Payments 2.0 Webhook idempotency (выполнено)

- Model `PaymentWebhookEvent` (`payment_webhook_events`): unique `(provider, externalId)`  
- Flow: verify signature → upsert `received` → process → `processed` | `ignored` | `failed`  
- Duplicate `event.id` with processed/ignored → `{ status: 'already_processed' }` (no business re-run)  
- Failed processing rethrows (Stripe retries); status=`failed` + errorMessage  
- Routes: `POST /api/payments/webhook`, alias `POST /api/webhooks/stripe`  
- Nest `rawBody: true` already in main.ts  
- Unit tests: success, duplicate, invalid signature, failed handler  

## Этап 8 — Refund 2.0 State Machine (выполнено)

- `RefundStatus`: REQUESTED → APPROVED → PROVIDER_REQUESTED → COMPLETED (+ REJECTED/FAILED)  
- COMPLETED **только** через webhook (`confirmProviderRefund`)  
- API: `POST /refunds`, `PATCH /refunds/:id/approve|reject`, `POST /refunds/:id/provider`  
- `PATCH /refunds/:id/complete` → 400  
- Ledger REFUND entries on complete (idempotent by refund id)  
- Legacy `POST /orders/:id/refund` uses request→approve→provider (no direct COMPLETED)  

## Этап 9 — Finance Ledger 2.0 (выполнено)

- `FinancialTransaction` + `FinancialEntry` (DEBIT/CREDIT, amount > 0)  
- `LedgerService.postTransaction` — invariant sum(debits)=sum(credits)  
- Helpers: `postPayment`, `postRefund`; idempotent by type+reference  
- Integrated: `completePayment` → postPayment; `confirmProviderRefund` → postRefund  
- Legacy `LedgerEntry` retained  
- Vendor balance: CREDIT−DEBIT on `VENDOR_PAYABLE`  

## Этап 10 — Payout concurrency (выполнено)

- `PayoutStatus.RESERVED|PROCESSING|COMPLETED|FAILED|CANCELLED`  
- `requestPayoutAtomic`: `SELECT … FOR UPDATE` on Shop + Serializable tx  
- Ledger reserve: DEBIT `VENDOR_PAYABLE` / CREDIT `VENDOR_AVAILABLE`  
- `failPayout` releases reserve; `completePayout` finalizes to CLEARING  
- Concurrency test: 1000 available, 800+800 → 1 success, 1 reject  

## Этап 11 — Inventory reservation (выполнено)

- `InventoryReservation` + `ReservationStatus` (ACTIVE/CONFIRMED/EXPIRED/RELEASED)  
- `InventoryService.reserve` — Product FOR UPDATE, stock not decremented  
- Checkout creates ACTIVE holds; `markPaid` → `confirm` decrements stock  
- Cancel unpaid → `releaseOrder`; `releaseExpired()` for TTL  
- Concurrency: two reserves for last unit → one success  

## Этап 12 — RFQ → Order (выполнено)

- `POST /rfq/:id/award` + legacy `.../award/:offerId`  
- Transaction: FOR UPDATE RFQ → ACCEPTED/REJECTED offers → RFQ AWARDED → Order  
- Order: `source=RFQ`, `rfqId`, `offerId`, `PENDING_PAYMENT`  
- Repeat award → `ConflictException` (409)  
- Vendor sees order by shopId; buyer can pay via payment-intent  

## Этап 13 — RFQ number concurrency (выполнено)

- PostgreSQL sequence `rfq_number_seq`  
- `generateRfqNumber()` → `RFQ-YYYY-00001` via `nextval`  
- create RFQ inside transaction; retry on unique (P2002)  
- Removed `count() + 1`  
- Concurrency test: 10 parallel creates → unique numbers  

## Этап 14 — Buyer Cabinet (выполнено)

- `BuyerService` + `GET /api/buyer/dashboard|orders|rfqs`  
- Roles: **CUSTOMER only** (merchant/admin → 403)  
- Orders filter: active|completed|cancelled  
- RFQs filter: draft|open|offers|awarded  
- Web: `/buyer/dashboard`, `/buyer/orders`, `/buyer/rfqs` + layout  

## Этап 15 — Merchant Cabinet (выполнено)

- `MerchantModule`: dashboard, orders, rfqs, kyc, balance, payouts, analytics  
- Roles: **MERCHANT only** + `user.shopId` scope  
- GMV = sum(totalCents) for PAID/PROCESSING/SHIPPED/COMPLETED  
- revenueCents = GMV − commissionCents  
- availableBalance from LedgerService  
- KYC status + documents list  
- Web: `/merchant` + `/merchant/dashboard` overview, `/merchant/kyc`  

## Этап 16 — Product Management (выполнено)

- `GET/POST /merchant/products`, `GET/PATCH/DELETE :id`  
- `POST :id/duplicate`, `PATCH :id/archive`  
- `PATCH /merchant/products/bulk`  
- Import: `POST import/upload` → `GET import/:jobId/preview` → `POST import/:jobId/confirm`  
- `ProductImportJob` model; CSV only (MVP); invalid rows skipped  
- Scoped by `shopId`  

## Следующий шаг

→ Admin cabinet / payment intent hardening
