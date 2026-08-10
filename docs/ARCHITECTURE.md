# ARCHITECTURE.md — Mplace Engine (Baseline 2026-08-10)

**Status:** current-state + target after TZ  
**Tag:** `audit-baseline`

## Высокоуровневая схема (текущая)

```
Browser
  ├── legacy static HTML (root *.html + assets/)
  └── apps/web (Next.js 16 App Router)
           ↓ HTTPS / JSON (Bearer + X-Session-Key + optional X-Tenant-Id)
NestJS API (apps/api)  :3001 /api
           ↓
PostgreSQL 16  ·  Redis 7 (BullMQ/cache)  ·  Meilisearch v1.11  ·  Storage (local/S3/R2)
           ↓
WebSockets (Socket.IO namespace /orders)
```

## Принципы (обязательные)

1. **API-first** — UI не обходит бизнес-правила  
2. **Tenant / shop isolation** — `tenantId` (optional multi-tenant) + `shopId`  
3. **Least privilege (RBAC)** — `SUPER_ADMIN` / `ADMIN` / `MERCHANT` / `CUSTOMER`  
4. **Money safety** — ledger, commission, idempotent payments (target: strict)  
5. **Private by default** — KYC, media ownership (target Phase 1)  

## Backend modules (фактический срез)

| Область | Модули / зоны кода |
|---------|-------------------|
| Auth | `auth/` JWT + refresh tokens table |
| Catalog | `catalog/`, `search/`, `media/`, `storage/` |
| Orders | `orders/` CQRS + cart/checkout + stock reserve |
| Payments | `payments/` Stripe + dev confirm |
| Finance | `finance/` ledger, payouts |
| RFQ | `rfq/` CQRS + offers |
| Tenant / WL | `tenant/`, branding |
| Warehouse | `warehouse/` ProductStock reserve |
| Shipping | `shipping/` methods/zones/rates |
| Tax | `tax/` VAT rates |
| Documents | `documents/` invoice/act + PDF |
| Notifications | `notifications/` + BullMQ |
| Infra | `common/outbox`, `common/idempotency`, `queue/`, `health/` |

## Основные модели (текущие + планируемые)

**Есть сейчас**

- User, Shop, Product, Category, ProductImage/Document  
- Cart / CartItem, Order / OrderItem (+ warehouseId, tax, shipping fields)  
- Payment, LedgerEntry, PayoutRequest  
- RfqRequest / RfqOffer / RfqMatch / messages  
- Tenant, TenantInvite, Warehouse, ProductStock  
- ShippingMethod / Zone / Rate  
- TaxRate, ProductTax  
- Document (INVOICE/ACT/UPD/OFFER)  
- Notification  
- Outbox, IdempotencyKey  

**Планируемые (по ТЗ hardening)**

- MediaAsset (ownership)  
- PaymentWebhookEvent  
- InventoryReservation (если отделят от ProductStock)  
- FinancialTransaction + FinancialEntry (замена/усиление ledger)  
- RFQ → Order award pipeline  

## Frontend

| Слой | Назначение |
|------|------------|
| `apps/web` | Customer / Merchant / Admin cabinets (Next.js) |
| root `*.html` | Legacy industrial UI (до полного cutover) |

## Deployment (текущий — изменится в Этапе 3)

**docker-compose:** postgres:16-alpine, redis:7-alpine, meilisearch:v1.11, nginx:1.27-alpine  

**Риск production CMD (проверить Dockerfile):**  
`npx prisma db push` / seed при старте  

**Target:**

1. Build image  
2. Migration job: `npx prisma migrate deploy`  
3. Start API **без** db push и seed  
4. Reverse proxy + security headers  
5. Secrets только через env (без defaults)  

## Observability (gap)

- `nestjs-pino` HTTP logs  
- Sentry optional (`SENTRY_DSN`)  
- Нет end-to-end `requestId` / correlationId в audit + queue jobs  
