# TESTING.md

**Status:** bootstrap. Full suite not yet built.

---

## Какие тесты есть

| Тип | Статус | Где |
|-----|--------|-----|
| Nest unit (scaffold) | default jest files may be outdated | `apps/api/src/**/*.spec.ts` |
| E2E | scaffold template | `apps/api/test/` |
| UI tests | нет | — |

Confidence: **Confirmed** scaffold exists; **Unverified** that default `app.controller.spec` still passes (controller removed from AppModule).

---

## Как запускать

```powershell
cd C:\Users\sasha\mplace\apps\api
npm test
npm run test:e2e
npm run lint
npm run build
```

---

## Ручная проверка API (после migrate + seed)

```powershell
# Health
curl http://127.0.0.1:3000/api/health

# Login admin
curl -X POST http://127.0.0.1:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"superadmin@demo.com\",\"password\":\"123456\"}"

# Me (paste token)
curl http://127.0.0.1:3000/api/auth/me -H "Authorization: Bearer <token>"

# Admin stats
curl http://127.0.0.1:3000/api/admin/stats -H "Authorization: Bearer <token>"
```

---

## Что запускать после изменений

| Изменение | Проверки |
|-----------|----------|
| Auth / guards | `npm run build`, manual login + 401/403 cases |
| Prisma schema | `npx prisma migrate dev`, seed, health |
| New endpoint | build + curl/e2e |
| UI only | open static server, no API required yet |

---

## TODO

- [ ] Replace obsolete `app.controller.spec.ts`
- [ ] Auth e2e: login success/fail, role guard
- [ ] CI workflow
