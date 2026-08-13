# Mplace architecture

```mermaid
flowchart TB
    Browser[Browser / Buyer / Merchant / Admin]
    Nginx[Nginx / TLS / Edge headers]
    Web[Next.js 16 storefront + cabinets]
    API[NestJS 11 API]
    Tenant[Tenant isolation
AsyncLocalStorage + Prisma extension]
    PG[(PostgreSQL)]
    Redis[(Redis)]
    Meili[(Meilisearch)]
    Jobs[BullMQ workers]
    Stripe[Stripe / Connect]
    Storage[Object / local storage]
    Sentry[Sentry]
    Metrics[Prometheus metrics]

    Browser --> Nginx
    Nginx --> Web
    Nginx --> API
    API --> Tenant
    Tenant --> PG
    API --> Redis
    API --> Meili
    API --> Jobs
    Jobs --> Redis
    API --> Stripe
    API --> Storage
    API --> Sentry
    API --> Metrics
```

## Security boundary

```text
request
  → tenant middleware (host/header)
  → route authentication (JWT)
  → global TenantIsolationInterceptor
  → Prisma tenant extension
  → controller/service
```

The interceptor makes the verified JWT tenant authoritative when no explicit tenant is supplied and rejects explicit tenant mismatches before controller logic runs.
