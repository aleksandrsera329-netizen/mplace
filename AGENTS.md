# AGENTS.md — правила работы ИИ-агента (Mplace)

## Сначала прочитать

1. `README.md`
2. `docs/spec/PRODUCT_TZ.md` — **product backlog (новое ТЗ)**
3. `docs/spec/GAP_ANALYSIS.md` — что уже есть / чего нет
4. `docs/spec/SPRINT_PLAN.md` — порядок спринтов
5. `PROJECT_MAP.md`
6. `ARCHITECTURE.md`
7. `TESTING.md`

## Source of truth

| Область | Источник |
|---------|----------|
| Product / US / Epics | `docs/spec/PRODUCT_TZ.md` |
| UI | `assets/js/*`, html |
| Домен / БД | `apps/api/prisma/schema.prisma` |
| API | `apps/api/src/**` |

Приоритет при конфликте: **код** → **PRODUCT_TZ** → ARCHITECTURE → demo UI.

## Бренд

Проект называется **Mplace**. Не использовать чужие бренды (в т.ч. zCart / Incevio) в UI, docs, API messages.

## Можно менять

- `apps/api/src/**`
- `prisma/schema.prisma` + новые migrations
- UI (`admin/`, `merchant/`, `assets/`)
- docs при изменении поведения

## Нельзя без подтверждения

- auth/RBAC «втихую»
- rewriting applied migrations
- хранение card PAN/CVV
- ledger/commission production rules
- коммит `.env` / секретов

## Generated

- `node_modules/`, `apps/api/dist/`

## Проверки после API

```powershell
cd apps\api
npm run build
npm run start:dev
# health + login
```

## Демо-учётки (seed)

- Admin: `superadmin@demo.com` / `123456`
- Merchant: `merchant@demo.com` / `123456`
- Customer: `customer@demo.com` / `123456`
