# ARCHITECTURE.md — Mplace Engine

**Status:** current-state design for NestJS engine  
**Confidence:** Confirmed where scaffold exists; Inferred for planned modules

---

## 1. Что это

Multi-vendor marketplace:

| Роль | UI | Backend scope |
|------|-----|---------------|
| **Customer** | `apps/web` (Next.js storefront) | public catalog, cart, checkout, own orders |
| **Merchant** | `merchant/` | own shop, products, orders, payouts |
| **Admin** | `admin/` | platform-wide catalog, vendors, commissions, support, settings |

Движок: **NestJS REST API** + **PostgreSQL** + **Redis** + (позже) **Stripe Connect**.

Сравнение стеков: `docs/ENGINE_COMPARISON.md`.

---

## 2. Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  storefront │ admin SPA │ merchant SPA                   │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / JSON
                           ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS API  (apps/api)                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Auth     │ │ Catalog  │ │ Orders   │ │ Vendors    │ │
│  │ RBAC     │ │ Products │ │ Cart     │ │ Shops KYC  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Payments │ │ Wallet   │ │ Support  │ │ Config     │ │
│  │ Webhooks │ │ Ledger   │ │ Disputes │ │ Health     │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└───────────┬─────────────────────┬───────────────────────┘
            ▼                     ▼
     PostgreSQL              Redis (rate limit,
     (source of truth)        cache, queues later)
```

---

## 3. Принципы

1. **API-first** — UI не ходит в БД; только REST.
2. **Tenant isolation** — merchant видит только `shopId`, к которому привязан.
3. **Least privilege** — RBAC (`ADMIN`, `MERCHANT`, `CUSTOMER`).
4. **No card data** — платежи через PSP (Stripe); мы храним payment intents / transfer ids.
5. **Ledger for money** — балансы через проводки, не «одно поле balance +=».
6. **Не выдумывать** — в docs: Confirmed / Inferred / TODO.

---

## 4. Подсистемы

### 4.1 Auth
- Login email+password → access JWT (short) + refresh (httpOnly cookie, planned).
- Password: bcrypt (Confirmed in scaffold).
- Guards: `JwtAuthGuard`, `RolesGuard`.
- Roles: enum `UserRole`.

### 4.2 Catalog
- Category tree (group / subgroup / category — упрощённо: Category + parentId).
- Product принадлежит **Shop**.
- Stock, price, status (`DRAFT` | `ACTIVE` | `ARCHIVED`).

### 4.3 Vendors / Shops
- User (MERCHANT) → Shop.
- Shop status: `PENDING` | `ACTIVE` | `SUSPENDED`.
- Admin approval / verification flags (UI: pending verifications).

### 4.4 Cart & Orders
- Cart per customer (or guest session later — TODO).
- Order + OrderItem snapshot (price at purchase time).
- **Order status machine:**

```
PENDING_PAYMENT → PAID → PROCESSING → SHIPPED → COMPLETED
       │            │         │
       └─ CANCELLED  ┴─ REFUND_* / DISPUTED
```

### 4.5 Wallet / Commissions / Payouts (Phase 2)
- Platform commission % (global or per category — TODO).
- `LedgerEntry`: credit/debit vendor & platform.
- `PayoutRequest` → admin approve → PSP transfer.

### 4.6 Support
- Ticket, Dispute, Refund linked to Order.
- Matches admin sidebar: messages/tickets/disputes/refunds.

### 4.7 Payments (Phase 2)
- Stripe Checkout/PaymentIntent + webhooks.
- Idempotent webhook handling.

---

## 5. Потоки

### 5.1 Login
```
POST /api/auth/login { email, password }
  → validate user
  → JWT { sub, email, role, shopId? }
  → { accessToken, user }
```

### 5.2 Merchant creates product
```
POST /api/products  (Bearer, role MERCHANT)
  → shopId from JWT (not from body for security)
  → create product
```

### 5.3 Checkout (target)
```
cart → create order PENDING_PAYMENT
     → Stripe PaymentIntent
     → webhook paid → PAID + ledger credits
     → merchant PROCESSES / SHIPS
```

### 5.4 Admin dashboard stats
```
GET /api/admin/stats  (ADMIN)
  → counts: customers, merchants, orders, today GMV, disputes…
```

---

## 6. Модель данных (Prisma)

Source of truth: `apps/api/prisma/schema.prisma`.

Ключевые сущности:

| Model | Назначение |
|-------|------------|
| User | аккаунты всех ролей |
| Shop | магазин merchant |
| Category | дерево категорий |
| Product | товар магазина |
| Cart / CartItem | корзина |
| Order / OrderItem | заказ |
| LedgerEntry | денежные проводки |
| PayoutRequest | вывод средств |
| Ticket / Dispute / Refund | support |
| AuditLog | чувствительные действия |

---

## 7. Безопасность

| Мера | Статус |
|------|--------|
| HTTPS in production | required (ops) |
| bcrypt passwords | Confirmed scaffold |
| JWT Bearer | Confirmed scaffold |
| RBAC RolesGuard | Confirmed scaffold |
| ValidationPipe whitelist | Confirmed scaffold |
| Helmet | Confirmed scaffold |
| CORS whitelist via env | Confirmed scaffold |
| Rate limit (Throttler) | Confirmed scaffold |
| shopId from JWT for merchants | design rule |
| Stripe for cards | Phase 2 |
| Refresh httpOnly cookies | TODO |
| MFA for admin | TODO |
| Audit log writes | schema ready, wiring TODO |

---

## 8. Окружение

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | sign access tokens |
| `JWT_EXPIRES_IN` | e.g. 15m |
| `PORT` | API port (default 3000) |
| `CORS_ORIGINS` | frontend origins |
| `REDIS_URL` | optional Phase 1+ |
| `STRIPE_*` | Phase 2 |

См. `.env.example`.

---

## 9. Deployment (target)

```
docker compose up   # postgres, redis, api
```

Production: managed Postgres, Redis, reverse proxy TLS, secrets manager.  
**Unverified** until production deploy is done.

---

## 10. Известные ограничения (сейчас)

- UI still uses mock `data.js` until wired to API.
- No real payments yet.
- No email/notifications.
- Guest checkout TODO.
- Ledger/payout modules schema-first; business logic Phase 2.

---

## 11. Связанные файлы

- `docs/ENGINE_COMPARISON.md`
- `PROJECT_MAP.md`
- `apps/api/`
- `TESTING.md` (when tests land)
