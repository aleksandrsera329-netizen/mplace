# ARCHITECTURE.md — Mplace

**Updated:** Stage 20 frontend consolidation (2026-08)  
**Baseline tag:** `audit-baseline`

## High-level

```
Browser
  └── apps/web (Next.js App Router)  ← PRIMARY UI
        ├── /                    storefront catalog
        ├── /product/[id]        PDP
        ├── /cart · /checkout    purchase path
        ├── /buyer/*             buyer cabinet
        ├── /merchant/*          merchant cabinet
        ├── /admin/*             admin cabinet
        └── /login · /dashboard  auth + role home
  (legacy root *.html + assets/js = fallback only — see FRONTEND.md)
           │
           ▼  HTTPS JSON
     NestJS API  (apps/api)  prefix /api
           │
           ├── PostgreSQL 16
           ├── Redis 7  (BullMQ, cache, throttle store)
           ├── Meilisearch (product search)
           └── Storage local | S3 | R2
           │
           └── Socket.IO (order/user events)
```

## Design principles

1. **API-first** — UI never bypasses money/ACL rules  
2. **Shop / tenant isolation** — `shopId` + optional `tenantId`  
3. **RBAC + permissions** — roles + `RolePermission` for admins  
4. **Money safety** — ledger invariants, payout locks, webhook idempotency  
5. **Private by default** — MediaAsset ownership; KYC never public  

## Backend modules

| Area | Path | Notes |
|------|------|--------|
| Auth | `auth/` | JWT + refresh family + admin TOTP |
| Catalog | `catalog/`, `merchant/` | products, import CSV |
| Search | `search/` | Meilisearch Stage 17 |
| Media / Storage | `media/`, `storage/` | ownership + private keys |
| KYC | `kyc/` | private docs + signed download |
| Orders | `orders/` | cart, checkout, status machine |
| Inventory | `warehouse/` | reservations, releaseExpired job |
| Payments | `payments/` | Stripe + webhooks |
| Refunds | `refunds/` | state machine |
| Finance | `finance/` | ledger + payouts |
| RFQ | `rfq/` | award → order |
| Notifications | `notifications/` | in-app + delivery channels |
| Jobs | `queue/`, `jobs/` | BullMQ processors |
| Observability | `common/observability/` | requestId ALS |
| Metrics | `metrics/` | Prometheus |
| Health | `health/` | live / ready |
| Security | helmet, throttle, file-security | Stages 22–24 |

## Domain events

`events/domain-events.ts` — e.g. `OrderPaid`, `RfqAwarded`, `PayoutCompleted` → notifications + side effects.

## Money flow (simplified)

```
Payment success → Order PAID → ledger postPayment
                              → inventory confirm
                              → notify buyer/merchant

Refund COMPLETED (webhook) → ledger postRefund

Payout RESERVED (FOR UPDATE) → COMPLETED → ledger finalize
```

## RFQ flow

```
RFQ OPEN → Offers → Award → Order PENDING_PAYMENT → pay as normal
```

## Frontend (Этап 20)

| App | Role |
|-----|------|
| **`apps/web` (Next.js)** | **Primary** — storefront + cart/checkout + buyer/merchant/admin |
| root `*.html` + `assets/js` | Legacy fallback only (not served by prod nginx `/`) |

**Role homes:** `CUSTOMER` → `/buyer/dashboard`, `MERCHANT` → `/merchant/dashboard`, `ADMIN` → `/admin`  
(`apps/web/src/lib/role-routes.ts`)

**Status matrix & cutover:** [FRONTEND.md](./FRONTEND.md) · [LEGACY.md](../LEGACY.md)

### nginx

`location /` → `web` (Next). API only under `/api/`. Legacy HTML is not on the default production path.

## Deployment topology

Compose: `postgres`, `redis`, `meilisearch`, **`migrate`** (one-shot), `api`, `web`, `nginx`, optional `db-backup` profile.

API process: **only** `node dist/src/main.js` — no migrate/seed on start.

## Further reading

- [FRONTEND.md](./FRONTEND.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [DATABASE.md](./DATABASE.md) · [SECURITY.md](./SECURITY.md)  
- [PAYMENTS.md](./PAYMENTS.md) · [RFQ.md](./RFQ.md) · [KYC.md](./KYC.md)  
- [MONITORING.md](./MONITORING.md) · [BACKUP.md](./BACKUP.md)  
