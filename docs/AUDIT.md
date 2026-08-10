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
| Media ownership             | ❌ Critical  | DELETE media по URL/path без ownership |
| KYC privacy                 | ❌ Critical  | Файлы под `/uploads`, риск публичности |
| Production migrations       | ❌ Critical  | Риск `prisma db push` / seed в startup Docker |
| Secrets defaults            | ❌ Critical  | Defaults в compose (postgres/mplace, MEILI key) |
| Refresh tokens              | 🟡           | Есть таблица/логика; rotation family — доработать |
| Stripe webhooks idempotency | 🟡           | Частично (есть idempotency module) |
| Ledger invariants           | 🟡           | LedgerEntry / finance есть, строгие инварианты — нет |
| Multi-tenant                | 🟡           | Tenant, middleware, optional tenantId |
| CQRS / Outbox               | 🟡           | Order/RFQ CQRS + Outbox + BullMQ |
| Warehouse / Shipping / Tax  | 🟡           | Foundation реализован |
| Documents (invoice/act PDF) | 🟡           | Есть API + pdfkit |
| Notifications               | 🟡           | In-app + queue/email path |
| RFQ → Order                 | ❌           | Gap (нет полноценного award→order) |
| Frontend                    | 🟡           | Legacy HTML + apps/web Next.js 16 |
| Automated security tests    | 🟡           | Есть `test/security.e2e-spec.ts`, покрытие узкое |
| Observability               | ❌           | Sentry optional; нет requestId/correlationId end-to-end |

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

1. Media delete без ownership check  
2. KYC файлы потенциально публичны через static `/uploads`  
3. `prisma db push` / seed в production startup path (проверить Dockerfile)  
4. Secrets имеют default values (compose + env fallbacks)  
5. Нет fail-fast на отсутствующие production secrets  

## Следующий шаг

→ **Этап 1. Security Hardening (Media ownership)**
