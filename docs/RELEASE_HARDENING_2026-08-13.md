# Release hardening — 2026-08-13

## Completed

- Global post-authentication tenant isolation enforcement.
- Explicit cross-tenant mismatch rejection.
- JWT tenant hydration when no tenant header/domain is present.
- `RefreshToken` removed from tenant-scoped Prisma models.
- Cross-tenant E2E coverage added.
- Demo passwords removed from HTML/docs; seed uses `DEMO_PASSWORD` or a random generated password.
- Legacy static frontend archived under `legacy/`.
- Next.js production CSP moved to per-request nonce-based `src/proxy.ts`; `unsafe-eval` removed.
- nginx no longer injects a conflicting static CSP.
- Web lint/build added to CI.
- Dependency license policy added to CI.
- Canonical `DEPLOY.md`, architecture, security, feature matrix, investor one-pager and commercial handover template added.
- Demo video script/shot list added.
- Product assets required by the seed moved into Next public assets.

## Target-environment checks

The following require external infrastructure/credentials and were not falsely marked as completed:

- real Stripe test-mode end-to-end event delivery
- clean `npm ci` against the public npm registry (network/cache unavailable in this execution environment)
- clean Postgres/Redis/Meilisearch E2E execution
- final screen recording for the 5–10 minute product demo

CI is configured to perform the reproducible checks on every push/PR.
