# DEPLOYMENT.md

**Tag:** `audit-baseline`  
**Дата:** 2026-08-10

## Local development

См. корневой `README.md`, `docs/DOCKER.md`, `START_LOCAL.bat` / `start.ps1`.

### Типичный локальный запуск

```powershell
# DB: local PostgreSQL or docker compose
cd C:\Users\sasha\mplace
# docker compose up -d postgres redis meilisearch

cd apps\api
# set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mplace
npm run start:dev

cd ..\web
# set NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
npm run dev
```

### API scripts (apps/api)

| Script | Назначение |
|--------|------------|
| `npm run start:dev` | Nest watch |
| `npm run build` | `nest build` |
| `npm run start:prod` | `node dist/src/main.js` |
| `npm run prisma:generate` | client |
| `npm run prisma:migrate` | migrate dev |
| `npm run prisma:deploy` | migrate deploy |
| `npm test` / `test:e2e` | unit / e2e |

## Docker Compose (текущий)

| Service | Image |
|---------|--------|
| postgres | `postgres:16-alpine` |
| redis | `redis:7-alpine` |
| meilisearch | `getmeili/meilisearch:v1.11` |
| nginx | `nginx:1.27-alpine` |

Файлы: `docker-compose.yml`, `Dockerfile`, `Dockerfile.web`, `nginx.conf`.

## Kubernetes / Helm (скелет)

- `k8s/` — manifests  
- `helm/mplace/`, `deploy/helm/mplace/`  

## Production (target after Этап 3)

1. **Build** image (CI)  
2. **Migration job:** `npx prisma migrate deploy` (one-shot)  
3. **Start API** — **без** `db push` и **без** seed  
4. Nginx / reverse proxy: TLS, security headers, rate limit at edge  
5. Secrets только через env / secret manager (no defaults)  
6. Health: `/api/health`  
7. Observability: structured logs + Sentry + metrics (Prometheus scaffold exists)  

## Anti-patterns (запретить в prod)

- `prisma db push` on container start  
- `prisma db seed` on every deploy  
- Default JWT/DB passwords in image  
- Public `/uploads` for KYC  
