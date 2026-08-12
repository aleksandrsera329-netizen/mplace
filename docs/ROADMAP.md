# ROADMAP.md — по ТЗ «Повышение технической и коммерческой ценности»

**Baseline tag:** `audit-baseline`  
**Дата фиксации:** 2026-08-10

## PHASE 1 — Security & Foundation (сейчас)

- [x] **Этап 0. Baseline**  
  - docs: AUDIT, ARCHITECTURE, SECURITY, DEPLOYMENT, ROADMAP  
  - versions captured; git tag `audit-baseline`  
- [x] **Этап 1. Media ownership** ← **done**  
  - MediaAsset model, owned upload/delete, removed `DELETE /media?url=`
- [x] **Этап 2. Private KYC** ← **done**  
  - KycDocument.mediaAssetId ↔ MediaAsset (visibility=KYC)  
  - private storage prefix, signed download 180s, audit KYC_DOWNLOAD  
  - nginx/API block public `/uploads/kyc` and `/uploads/private`  
- [x] **Этап 3. Production Database** ← **done**  
  - Dockerfile: app-only CMD; no `db push` / seed  
  - compose `migrate` service + PostgreSQL baseline migration  
  - Seed manual only  
- [x] **Этап 4. Secrets & fail-fast** ← **done**  
  - `validateEnv` on ConfigModule; production exit on missing/weak secrets  
  - `.env.production.example`; no secret defaults in app code  
- [x] **Этап 5. Auth 2.0 (refresh family)** ← **done**  
  - familyId + rotation + reuse detection; HttpOnly cookie  
- [x] **Этап 6. Admin security** ← **done**  
  - RolePermission + PermissionsGuard; mandatory admin TOTP MFA  
- [x] **Этап 7. Payments 2.0 (webhook idempotency)** ← **done**  
  - PaymentWebhookEvent + already_processed / failed / ignored  
- [x] **Этап 8. Refund 2.0 (state machine)** ← **done**  
  - REQUESTED→APPROVED→PROVIDER_REQUESTED→COMPLETED (webhook only)  
- [x] **Этап 9. Finance Ledger 2.0** ← **done**  
  - FinancialTransaction + FinancialEntry; debit=credit invariant  
- [x] **Этап 10. Payout concurrency** ← **done**  
  - Atomic RESERVED + Shop FOR UPDATE; concurrent double-spend rejected  
- [x] **Этап 11. Inventory reservation** ← **done**  
  - InventoryReservation ACTIVE→CONFIRMED; expiry release; concurrent reserve  
- [x] **Этап 12. RFQ → Order** ← **done**  
  - award offer → Order PENDING_PAYMENT; race-safe; other offers REJECTED  
- [x] **Этап 13. RFQ concurrency (numbers)** ← **done**  
  - `rfq_number_seq` + RFQ-YYYY-#####; no count()+1  
- [x] **Этап 14. Buyer Cabinet** ← **done**  
  - GET /buyer/dashboard|orders|rfqs; Next.js /buyer/*  
- [x] **Этап 15. Merchant Cabinet** ← **done**  
  - GET /merchant/dashboard|orders|rfqs|kyc|balance; GMV + revenue  
- [x] **Этап 16. Product Management** ← **done**  
  - merchant products CRUD + bulk + CSV import pipeline  
- [x] **Этап 18. Notifications (P1)** ← **done**  
  - NotificationType / NotificationChannel + NotificationDelivery  
  - NotificationsService.notify → durable row + IN_APP/EMAIL deliveries  
  - Wired: ORDER_PAID, RFQ_OFFER_RECEIVED, RFQ_AWARDED, KYC_*, PAYOUT_COMPLETED  
  - API: GET list (paginated, unread first), unread-count, PATCH/POST :id/read, read-all  
- [x] **Этап 19. Background Jobs** ← **done**  
  - BullMQ queues: emails, notifications, search-index, imports, webhooks, documents, payouts, inventory  
  - `jobs/` processors + JobsModule scheduler  
  - Product import confirm → imports queue (jobId immediate)  
  - inventory `release-expired` every 5 min  
  - Email delivery status updated by worker (retries)  
- [x] **Этап 17. Search 2.0 (Meilisearch)** ← **done**  
  - GET /api/search/products — filters, facets, sort, pagination  
  - GET /api/search/autocomplete  
  - Product brand/moq/attributes; index via search-index queue  
  - Non-ACTIVE / archived products removed from index  
- [x] **Этап 23. Rate limiting** ← **done**  
  - Global 120/min + Redis store (`@nest-lab/throttler-storage-redis`)  
  - Hard limits: login 5/15m, password 3/h, MFA 5/10m, register 5/h, RFQ 10/h, payment 10/15m, upload 20/h, search 60/min  
  - Headers X-RateLimit-* + Retry-After; login lockout 5 fails / 15 min  
- [x] **Этап 22. Security headers** ← **done**  
  - helmet: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy  
  - Permissions-Policy; CORS allowlist only + credentials  
  - nginx + Next.js headers  
- [x] **Этап 21. XSS / frontend security** ← **done**  
  - No unsafe `dangerouslySetInnerHTML` in apps/web; `sanitizeHtml` (DOMPurify) helper  
  - Legacy: `escapeHtml` / `escapeAttr` in api.js; templates escape API data  
  - CSP reviewed (Stage 22); XSS rules in docs/SECURITY.md  
- [x] **Этап 20. Frontend consolidation** ← **done**  
  - Primary UI = Next.js (`apps/web`): catalog, PDP, cart, checkout, cabinets  
  - Role homes + `?next=` login; legacy `*.html` redirects in next.config  
  - Auth: `/register` + login MFA (verify/enroll TOTP)  
  - docs/FRONTEND.md (legacy JS audit, migration steps, CSP nonce plan) + LEGACY.md  
  - nginx already → web
- [x] **Этап 24. File security** ← **done**  
  - FileSecurityService: size/ext/MIME/magic-byte + filename normalize  
  - Random storage keys only; never original path  
  - Applied: media, KYC, CSV import, product image/docs  
  - Optional ClamAV via CLAMAV_ENABLED + clamd INSTREAM  
- [x] **Этап 26. Observability** ← **done**  
  - requestId + correlationId middleware (headers X-Request-Id / X-Correlation-Id)  
  - AsyncLocalStorage request context + StructuredLogger  
  - Structured logs + duration: payment, refund, payout, KYC, RFQ, auth  
- [x] **Этап 25. Testing (release gate)** ← **done**  
  - `docs/TEST_MATRIX.md` security & money checklist  
  - Critical ACL / lockout / over-refund tests  
  - `npm run test:security` critical suite  
- [x] **Этап 27. Monitoring** ← **done**  
  - `/api/health` liveness + `/api/health/ready` readiness  
  - Prometheus `/api/metrics` (HTTP, BullMQ, payments, webhooks)  
  - `docs/MONITORING.md` alert rules  
- [x] **Этап 28. Backup & DR** ← **done**  
  - `scripts/backup-db` + `restore-db` (sh/ps1), 30-day retention  
  - `docs/BACKUP.md` + verified restore drill  
  - optional compose profile `backup`  
- [x] **Этап 29. Documentation** ← **done**  
  - README + API/DATABASE/PAYMENTS/RFQ/KYC docs  
  - ARCHITECTURE / SECURITY / DEPLOYMENT refreshed  
  - Production checklist → Stage 30  

## PHASE 2 — Pilot / polish

- [x] **Этап 30. Final production gate** ← **done**  
  - [docs/PRODUCTION_GATE.md](./PRODUCTION_GATE.md) — full checklist with statuses  
  - API/Web production builds green; `test:security` 85; unit 182  
  - Verdict: **GO for pilot / investor demo** (ops §6 secrets/HTTPS/Stripe)  
- [ ] Admin / merchant / buyer UX polish (non-blocking)  
- [ ] Legacy HTML delete after pilot confirmation  
- [ ] CSP nonces + payment UI polish (non-blocking)  

## Already delivered (product foundation)

- CQRS + Outbox + BullMQ  
- Multi-tenant / white-label  
- Warehouse + shipping + tax + documents  
- RFQ → Order, inventory reservation, cabinets  

## Definition of Done (security / foundation)

- Critical media/KYC/secrets/migration/money issues closed  
- `npm test` + `npm run test:security` green  
- Backup restore drill documented  
- Docs sufficient for new engineer onboarding  
