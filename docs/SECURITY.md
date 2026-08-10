# SECURITY.md — Baseline

**Tag:** `audit-baseline`  
**Дата:** 2026-08-10

## Critical findings (на audit-baseline)

1. **Media deletion** — принимается URL/path без ownership check (`DELETE /media?url=`)  
2. **KYC documents** — могут быть доступны через static `/uploads`  
3. **Secrets** — default values в `docker-compose.yml` (DB password, MEILI_MASTER_KEY)  
4. **Database** — риск `db push` вместо `migrate deploy` в prod startup  
5. **Auth** — refresh tokens есть; rotation + family invalidation — доработать  
6. **Admin** — `ADMIN` / `SUPER_ADMIN` широкие права; нет granular permissions  
7. **Rate limiting** — `@nestjs/throttler` есть (short/medium/long); e2e skip в test  
8. **File uploads** — sharp/webp pipeline; нет magic-byte policy + virus scan  
9. **CORS / public API** — calculate tax/shipping partial public; review surface  

## Positive controls already present

- JWT auth + RolesGuard  
- Helmet  
- Optional tenant middleware + Prisma tenant extension (soft)  
- Outbox for domain events  
- Idempotency module  
- Some e2e security specs (`apps/api/test/security.e2e-spec.ts`)  
- Password hashing (bcrypt)  

## Target after Phase 1–2

- [ ] MediaAsset ownership + ACL  
- [ ] Private KYC + signed URLs  
- [ ] Fail-fast secrets validation (Joi/Zod on boot)  
- [ ] Proper migrations only (`migrate deploy`)  
- [ ] Idempotent Stripe webhooks (durable event store)  
- [ ] Strict ledger invariants  
- [ ] Atomic payouts  
- [ ] Request/correlation IDs  

## Secrets inventory (compose defaults — replace in prod)

| Variable | Default risk |
|----------|----------------|
| `POSTGRES_PASSWORD` | `mplace` |
| `MEILI_MASTER_KEY` | weak default string |
| `JWT_SECRET` | must not ship default in prod |
| `STRIPE_SECRET_KEY` | optional local; required for live payments |
