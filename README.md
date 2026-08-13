# Mplace — multi-vendor B2B marketplace

NestJS API + **Next.js primary UI** (`apps/web`: storefront, cart/checkout, buyer/merchant/admin).  
Legacy static UI is archived under `legacy/` and is not part of the production path ([LEGACY.md](LEGACY.md)).  
Stack: **PostgreSQL 16 · Redis 7 · Meilisearch · BullMQ · Stripe**.

## Documentation map

| Doc | Content |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, modules, data flow |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Next vs legacy matrix, role routes, cutover |
| [docs/API.md](docs/API.md) | HTTP API overview + Swagger |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, migrations, seed policy |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, secrets, headers, ACL, XSS |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Local / Docker / prod deploy, rollback |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Stripe, webhooks, refunds, ledger link |
| [docs/RFQ.md](docs/RFQ.md) | RFQ → offer → award → Order |
| [docs/KYC.md](docs/KYC.md) | Private KYC uploads + signed download |
| [docs/BACKUP.md](docs/BACKUP.md) | DB backup / restore / drill |
| [docs/MONITORING.md](docs/MONITORING.md) | Health, Prometheus, alerts |
| [docs/TEST_MATRIX.md](docs/TEST_MATRIX.md) | Security & money test gate |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Stages status (0–30) |
| [docs/PRODUCTION_GATE.md](docs/PRODUCTION_GATE.md) | **Stage 30** pilot / investor go-live checklist |
| [docs/AUDIT.md](docs/AUDIT.md) | Area status snapshot |

Product TZ (historical): [`docs/spec/PRODUCT_TZ.md`](docs/spec/PRODUCT_TZ.md).

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)
- Redis (recommended; queues/throttle degrade without it)
- Optional: Meilisearch, Stripe keys

### 1) Database

```powershell
# Option A: local Postgres
# Create DB "mplace", user/password as in DATABASE_URL

# Option B: Docker only infra
cd C:\Users\sasha\mplace
docker compose up -d postgres redis meilisearch
```

### 2) API

```powershell
cd C:\Users\sasha\mplace\apps\api
copy .env.example .env   # if present; else ensure DATABASE_URL + JWT_SECRET
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mplace?schema=public
# PORT=3001
# REDIS_URL=redis://127.0.0.1:6379
# PAYMENT_PROVIDER=dev
# ALLOW_DEV_PAYMENTS=true

npm install
npx prisma migrate deploy
npx prisma db seed          # dev only — never on prod boot
npm run start:dev
```

- API: http://127.0.0.1:3001/api  
- Swagger: http://127.0.0.1:3001/api/docs  
- Health: http://127.0.0.1:3001/api/health  
- Ready: http://127.0.0.1:3001/api/health/ready  
- Metrics: http://127.0.0.1:3001/api/metrics  

### 3) Web (Next.js — primary UI)

```powershell
cd C:\Users\sasha\mplace\apps\web
# NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
npm install
npm run dev
```

- Storefront: http://127.0.0.1:3000/  
- Cart / checkout: `/cart`, `/checkout`  
- Buyer / merchant / admin: `/buyer`, `/merchant`, `/admin`  
- Login: `/login` (role redirect after auth)

See [docs/FRONTEND.md](docs/FRONTEND.md).

### 4) Legacy HTML (optional fallback only)

```powershell
cd C:\Users\sasha\mplace
py -m http.server 8080
# open http://127.0.0.1:8080/  — not used in Docker nginx path
```

Details: [LEGACY.md](LEGACY.md).

### Full Docker stack

```powershell
cd C:\Users\sasha\mplace
docker compose up -d --build
# migrate runs once before API
# nginx :8088 → web + api
curl http://localhost:3001/api/health
```

Details: [docs/DOCKER.md](docs/DOCKER.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Demo logins (development seed only)

| Role | Email | Password |
|------|-------|----------|
| Super admin | `superadmin@demo.com` | Set `DEMO_PASSWORD` before seeding |
| Merchant | `merchant@demo.com` | Set `DEMO_PASSWORD` before seeding |
| Customer | `customer@demo.com` | Set `DEMO_PASSWORD` before seeding |

> Admins require TOTP MFA after first login (Stage 6). Do **not** use these credentials in production.

---

## Main commands (`apps/api`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Nest watch |
| `npm run build` | Compile |
| `npm run start:prod` | `node dist/src/main.js` |
| `npx prisma migrate deploy` | Apply migrations (prod/CI) |
| `npx prisma migrate dev` | Create migration (dev) |
| `npx prisma db seed` | Seed demo data (manual) |
| `npm test` | Unit / integration |
| `npm run test:security` | Critical security & money suite |
| `npm run test:e2e` | E2E (DB + env required) |

Backup:

```powershell
$env:DATABASE_URL = "postgresql://..."
.\scripts\backup-db.ps1
.\scripts\verify-backup-restore.ps1   # full drill
```

---

## Subsystems (one-liners)

| Area | Summary |
|------|---------|
| **Auth** | JWT access + refresh family rotation; admin TOTP MFA; lockout after 5 fails |
| **Payments** | Stripe PaymentIntents + idempotent webhooks; no `POST /orders/:id/pay` |
| **Ledger** | Double-entry `FinancialTransaction` / entries; debit = credit |
| **Payouts** | Atomic RESERVED + `Shop FOR UPDATE` |
| **RFQ** | Create → offers → award → `Order PENDING_PAYMENT` |
| **KYC** | Private storage, signed URLs, shop ACL |
| **Search** | Meilisearch facets + queue reindex |
| **Jobs** | BullMQ: email, import, inventory release, search |

---

## Project status (Stage 30)

**Verdict:** ready for **pilot customers** and **investor demo** after env secrets / HTTPS / Stripe webhook are set on the target host.

Full scored checklist: **[docs/PRODUCTION_GATE.md](docs/PRODUCTION_GATE.md)**.

### Pre-flight (ops — target environment)

- [ ] PostgreSQL + `prisma migrate deploy` (no `db push`, no auto-seed)
- [ ] Strong secrets: `JWT_SECRET`, DB password, `REDIS_URL`, Meili key
- [ ] `NODE_ENV=production`, `PAYMENT_PROVIDER=stripe`, `ALLOW_DEV_PAYMENTS=false`
- [ ] Stripe test/live keys + webhook secret verified
- [ ] HTTPS reverse proxy; CORS allowlist (no `*`); security headers
- [ ] Redis for BullMQ + rate limits
- [ ] Backups scheduled ([BACKUP.md](docs/BACKUP.md))
- [ ] Health `/api/health/ready` + metrics `/api/metrics` ([MONITORING.md](docs/MONITORING.md))
- [ ] `SENTRY_DSN` for error tracking
- [ ] `npm run test:security` green before release ([TEST_MATRIX.md](docs/TEST_MATRIX.md))
- [ ] No demo seed in production

### Gate evidence (2026-08-12)

| Check | Result |
|-------|--------|
| `apps/api` build | ✅ |
| `apps/web` build | ✅ |
| Unit tests | ✅ 182 |
| `test:security` | ✅ 85 |

---

## Architecture snapshot

```
Browser → Next.js apps/web (primary; legacy HTML = fallback only)
        ↓ Bearer + cookies + X-Session-Key
NestJS API  /api
        ↓
PostgreSQL · Redis (BullMQ/cache) · Meilisearch · Storage (local|S3|R2)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## License

UNLICENSED / private project.


## Commercial readiness

- Canonical deployment: `docs/DEPLOY.md`
- Security overview: `docs/SECURITY_OVERVIEW.md`
- Architecture: `docs/ARCHITECTURE_DIAGRAM.md`
- Feature matrix: `docs/FEATURE_MATRIX.md`
- License audit: `docs/THIRD_PARTY_LICENSE_AUDIT.md`
- Investor one-pager: `docs/INVESTOR_ONE_PAGER.md`
- Demo video script: `docs/DEMO_VIDEO_SCRIPT.md`
- Legacy static UI: archived under `legacy/`
