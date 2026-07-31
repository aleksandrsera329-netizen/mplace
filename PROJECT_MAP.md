# PROJECT_MAP.md — Mplace

Карта репозитория для людей и ИИ-агентов.

---

## 1. Обзор

| Что | Где |
|-----|-----|
| Storefront UI | `index.html`, `assets/css/store.css` |
| Login UI | `login.html` |
| Admin UI | `admin/index.html`, `assets/js/admin.js` |
| Merchant UI | `merchant/index.html`, `assets/js/merchant.js` |
| Mock data (legacy UI) | `assets/js/data.js` |
| **API engine** | `apps/api/` |
| Architecture | `ARCHITECTURE.md` |
| **Product TZ (новое)** | `docs/spec/PRODUCT_TZ.md` |
| Gap analysis | `docs/spec/GAP_ANALYSIS.md` |
| Sprint plan | `docs/spec/SPRINT_PLAN.md` |
| Stack comparison | `docs/ENGINE_COMPARISON.md` |
| Doc bootstrap guide | `создание документации.md` |
| Compose (Postgres/Redis) | `docker-compose.yml` |
| Env template | `.env.example` |

---

## 2. Корень

```
mplace/
├── admin/                 # Admin SPA (static)
├── merchant/              # Merchant SPA (static)
├── assets/                # Shared CSS/JS for UI
├── apps/api/              # NestJS engine  ← backend
├── docs/                  # Extra docs
├── docker-compose.yml
├── ARCHITECTURE.md
├── PROJECT_MAP.md
├── README.md
├── .env.example
└── index.html / login.html
```

---

## 3. API (`apps/api`)

| Path | Purpose | Edit? |
|------|---------|-------|
| `src/main.ts` | bootstrap, helmet, CORS, validation | yes |
| `src/app.module.ts` | root module | yes |
| `src/auth/` | login, JWT, strategy | yes (security-sensitive) |
| `src/common/guards/` | RolesGuard | yes (security-sensitive) |
| `src/common/decorators/` | `@Roles`, `@CurrentUser` | yes |
| `src/health/` | `GET /api/health` | yes |
| `src/admin/` | admin stats | yes |
| `src/prisma/` | PrismaService | yes |
| `prisma/schema.prisma` | **DB source of truth** | yes + migrate |
| `prisma/seed.ts` | demo users | yes |
| `dist/` | build output | **no** (generated) |
| `node_modules/` | deps | **no** |

### Entry points
- HTTP: `src/main.ts`
- Modules: Auth, Health, Admin, Prisma

### Planned modules (not yet)
- catalog, orders, vendors, payments, wallet, support

---

## 4. API routes (Confirmed after scaffold)

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/health` | no | — |
| POST | `/api/auth/login` | no | — (throttled) |
| GET | `/api/auth/me` | JWT | any |
| GET | `/api/admin/stats` | JWT | ADMIN |

---

## 5. UI ↔ Engine

| UI area | Current data | Target API |
|---------|--------------|------------|
| login | sessionStorage mock | `POST /api/auth/login` |
| admin dashboard | `data.js` | `GET /api/admin/stats` |
| products/orders… | `data.js` | future CRUD modules |

**Danger:** until wired, UI and API are **two sources** — prefer API after connect.

---

## 6. Dangerous zones

| Zone | Rule |
|------|------|
| `prisma/migrations/` | don't rewrite applied migrations |
| Auth / RolesGuard | changes need review |
| Ledger / payouts (future) | money correctness |
| `.env` secrets | never commit |
| `dist/`, `node_modules/` | don't edit |

---

## 7. Типовые задачи

| Задача | Куда идти |
|--------|-----------|
| Новый endpoint | `apps/api/src/<module>/` + module import in `app.module.ts` |
| Новая таблица | `prisma/schema.prisma` → migrate |
| Демо-логины | `prisma/seed.ts` |
| Стили админки | `assets/css/admin.css` |
| Пункт меню админки | `assets/js/admin.js` MENU |

---

## 8. Команды

```powershell
# Infra
cd C:\Users\sasha\mplace
docker compose up -d

# API
cd apps\api
copy ..\..\.env.example .env   # if needed
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Static UI
cd C:\Users\sasha\mplace
py -m http.server 8080
```
