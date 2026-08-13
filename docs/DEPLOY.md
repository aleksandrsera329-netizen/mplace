# Mplace deployment: zero → demo

This is the canonical deployment path for a clean checkout.

## 1. Prerequisites

- Node.js 22+
- Docker + Docker Compose
- PostgreSQL 16 (or the Compose database)
- Redis 7
- Meilisearch 1.x
- Stripe test account for payment verification

## 2. Environment

Copy `.env.production.example` to the target environment and set real secrets.

For a local demo, use:

```bash
cp .env.example .env
```

Never commit `.env`.

## 3. API install and database

```bash
cd apps/api
npm ci
npm run prisma:generate
npm run prisma:deploy
```

For a disposable local demo database:

```bash
npm run db:setup
DEMO_PASSWORD='use-a-random-password' npx prisma db seed
```

The seed generates a random password when `DEMO_PASSWORD` is omitted and prints it once to the terminal. Demo users must never be created in production.

## 4. Web install

```bash
cd ../web
npm ci
npm run lint
npm run build
```

## 5. Full local stack

From the repository root:

```bash
docker compose up --build
```

Production request path:

```text
Browser → nginx → Next.js
                 └→ /api → NestJS → PostgreSQL / Redis / Meilisearch
```

Legacy static HTML is archived under `legacy/` and is not served.

## 6. Verification

API:

```bash
cd apps/api
npm test
npm run test:security
npm run test:e2e
npm run build
```

Web:

```bash
cd apps/web
npm run lint
npm run build
```

## 7. Stripe test mode

Set:

```text
PAYMENT_PROVIDER=stripe
ALLOW_DEV_PAYMENTS=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Then register the Stripe webhook endpoint described in `docs/PAYMENTS.md` and run the complete smoke flow in `docs/STRIPE_TEST_MODE.md`.

## 8. Production gate

Before first real traffic:

- HTTPS enabled
- strong JWT/database/Redis/Meili secrets
- Stripe live/test keys selected intentionally
- webhook verified
- Sentry configured
- backups scheduled and restore drill completed
- demo seed disabled
- cross-tenant E2E green
- `npm audit --audit-level=high` green
