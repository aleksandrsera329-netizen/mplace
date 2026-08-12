# Mplace — Seller Due Diligence

## Release hardening completed

- Tenant-aware Prisma operations cover all schema models with `tenantId`: `findMany`, `findFirst`, `findUnique`, `findUniqueOrThrow`, `count`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, and `upsert`.
- Tenant ownership is injected/immutable on tenant-scoped create/update/upsert operations.
- Prisma tenant-extension initialization now fails closed instead of silently falling back to an unscoped client.
- CI uses checked-in PostgreSQL migrations via `prisma migrate deploy` rather than `db push`.
- CI includes a high-severity dependency audit gate.
- Legacy frontend demo data no longer embeds passwords in browser assets.

## Verification

The release gate is: install dependencies, generate Prisma Client, run `npm audit --audit-level=high`, apply migrations with `npm run prisma:deploy`, run unit/security/E2E tests, and build the API and web application.

## Known intentional behavior

The Prisma tenant extension remains unscoped when there is no AsyncLocalStorage tenant context. This is required for explicitly trusted system/SUPER_ADMIN and migration/background-job flows. Application request guards are responsible for establishing tenant context before tenant-user access.

## Commercial positioning

Mplace is a B2B multi-vendor marketplace foundation with RFQ/procurement, merchant and buyer portals, payments, ledger, KYC, inventory, payouts, and administration. It should be represented to buyers as a reusable marketplace platform/codebase, not as a proven SaaS business unless production customer/revenue evidence is separately supplied.
