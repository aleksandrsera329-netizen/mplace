# DEPLOYMENT.md

**Updated:** Stage 29

## Local development

See root [README.md](../README.md).

```powershell
# Infra
docker compose up -d postgres redis meilisearch

# API
cd apps\api
# configure .env (DATABASE_URL, JWT_SECRET, REDIS_URL, PORT=3001)
npm install
npx prisma migrate deploy
npx prisma db seed          # dev only
npm run start:dev

# Web
cd ..\web
# NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
npm install
npm run dev
```

### API scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Nest watch |
| `npm run build` | compile |
| `npm run start:prod` | `node dist/src/main.js` |
| `npm run prisma:deploy` | migrate deploy |
| `npm run prisma:seed` | seed **manual** |
| `npm test` / `test:security` / `test:e2e` | tests |

## Docker Compose (production-shaped)

| Service | Role |
|---------|------|
| postgres | data |
| redis | queues / cache / throttle |
| meilisearch | search |
| **migrate** | one-shot `prisma migrate deploy` |
| **api** | app only (no seed) |
| web | Next.js |
| nginx | reverse proxy :8088 |
| db-backup | profile `backup` |

```powershell
docker compose up -d --build
curl http://localhost:3001/api/health/ready
```

Optional monitoring:  
`docker compose -f docker-compose.yml -f deploy/docker-compose.monitoring.yml up -d`  
→ [MONITORING.md](./MONITORING.md)

## Migration procedure

1. Ship image / code with new migrations under `prisma/migrations/`  
2. Run **migrate job** against target DB: `npx prisma migrate deploy`  
3. Verify: `npx prisma migrate status`  
4. Start/restart API  
5. Smoke: `/api/health/ready`, login, critical path  

**Rollback of schema:** prefer forward-fix migrations. If emergency:

1. Stop traffic  
2. Restore DB from backup ([BACKUP.md](./BACKUP.md))  
3. Deploy previous API image matching that schema  
4. Verify migrate status  

## Production environment

| Variable | Production |
|----------|------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | strong credentials |
| `JWT_SECRET` | ≥32, non-default |
| `REDIS_URL` | required |
| `MEILI_MASTER_KEY` | strong |
| `STRIPE_SECRET_KEY` | `sk_…` |
| `STRIPE_WEBHOOK_SECRET` | required |
| `PAYMENT_PROVIDER` | `stripe` |
| `ALLOW_DEV_PAYMENTS` | unset/false |
| `CORS_ORIGINS` | explicit allowlist |

Fail-fast: `apps/api/src/config/env.validation.ts`.

Templates: `.env.example`, `.env.production.example`.

## Production deploy checklist

1. Secrets from vault / secret manager  
2. `migrate deploy` succeeds  
3. API starts (`start:prod`)  
4. Ready probe green  
5. Webhook URL points to `/api/webhooks/stripe` (or `/api/payments/webhook`)  
6. Metrics scraped  
7. Backup job scheduled  

## Rollback (app)

1. Redeploy previous container image  
2. If migration already applied and incompatible → restore DB snapshot from before migrate  
3. Confirm `/api/health/ready` and critical flows  

## Incident response (brief)

| Symptom | First checks |
|---------|----------------|
| API 5xx spike | logs by `requestId`; `/metrics` 5xx rate; Sentry |
| Payments stuck | Stripe dashboard + `PaymentWebhookEvent` rows; webhook signature |
| Payout failed | finance logs; shop balance; ledger |
| Search empty | Meili health; reindex job |
| DB down | ready probe; Postgres; restore from backup if data loss |

Escalate with: `X-Request-Id`, time UTC, orderId/paymentId, environment.

## Kubernetes / Helm

- Manifests: `k8s/`, `helm/mplace/`  
- Use a Job for migrate before rolling API  

## Anti-patterns (prod)

- `db push` or seed on container start  
- Default passwords in image  
- Public KYC paths  
- `origin: *` with credentials  
