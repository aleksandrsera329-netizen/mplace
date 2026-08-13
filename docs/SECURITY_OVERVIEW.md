# Security overview

## Tenant isolation

Every authenticated tenant request is checked by the global `TenantIsolationInterceptor`.

Rules:

- `SUPER_ADMIN` may operate across tenants.
- Tenantless platform `ADMIN` users remain unscoped by design; tenant-scoped ADMIN users are enforced like other tenant users.
- A verified JWT tenant is used when no tenant header/domain is supplied.
- An explicit tenant that differs from the JWT tenant is rejected.
- Prisma automatically scopes tenant-aware models by `tenantId`.
- `RefreshToken` is intentionally not tenant-scoped; it is owned by the user/session chain.

## Authentication

- JWT access tokens
- refresh-token rotation and reuse detection
- password lockout
- MFA/TOTP for privileged roles
- HttpOnly refresh cookie
- strict DTO validation

## Browser security

- Next.js production CSP uses per-request nonces for scripts.
- `unsafe-eval` has been removed from the production Next CSP.
- HSTS, frame denial, nosniff, referrer policy and Permissions-Policy are enabled.
- API security headers are provided by Helmet.

## Files and KYC

Private/KYC storage paths are denied at the edge and application layer. Media download/delete checks ownership/tenant access.

## Payments

- Stripe webhook signature verification
- durable webhook event records
- idempotent processing
- refund state machine
- payout concurrency controls
- ledger invariants
- dev payment provider disabled in production

## Release controls

Run:

```bash
npm audit --audit-level=high
npm test
npm run test:security
npm run test:e2e
npm run build
```

The production environment must provide strong secrets and explicitly select Stripe provider mode.
