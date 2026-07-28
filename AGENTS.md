# AGENTS.md — правила работы ИИ-агента (Mplace)

## Сначала прочитать

1. `README.md`
2. `PROJECT_MAP.md`
3. `ARCHITECTURE.md`
4. `TESTING.md`

## Source of truth

| Область | Источник |
|---------|----------|
| UI | `assets/js/*`, html |
| Домен / БД | `apps/api/prisma/schema.prisma` |
| API | `apps/api/src/**` |

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
