# SECURITY.md

**Updated:** Stage 21 (XSS) · Baseline tag: `audit-baseline`

## Status (findings closed)

1. Media ownership — ✅ Stage 1 (`DELETE /media/:id` ACL)  
2. Private KYC — ✅ Stage 2 ([KYC.md](./KYC.md))  
3. Secrets fail-fast — ✅ Stage 4 (`env.validation.ts`)  
4. Migrations only — ✅ Stage 3 (no push/seed on boot)  
5. Refresh family — ✅ Stage 5 (rotation + reuse revoke)  
6. Admin MFA + permissions — ✅ Stage 6  
7. Rate limiting — ✅ Stage 23  
8. File uploads — ✅ Stage 24 (magic-byte + whitelist; optional ClamAV)  
9. CORS allowlist — ✅ Stage 22 (never `*` + credentials)  
10. Security headers — ✅ Stage 22  
11. XSS / frontend — ✅ Stage 21 (`escapeHtml` + DOMPurify policy)  

## Positive controls

- JWT + refresh HttpOnly cookie + RolesGuard / PermissionsGuard  
- Helmet CSP/HSTS/frame/nosniff/referrer + Permissions-Policy  
- CORS allowlist (`CORS_ORIGINS`)  
- Throttler + Redis store; login lockout 5 fails / 15 min  
- FileSecurityService; private KYC + signed download + audit `KYC_DOWNLOAD`  
- Outbox, idempotency; bcrypt passwords  
- XSS: React default escaping; no raw `dangerouslySetInnerHTML`; legacy `escapeHtml`  
- Test gate: [TEST_MATRIX.md](./TEST_MATRIX.md)  

## XSS policy (Этап 21)

### Next.js / React (`apps/web`)

1. **Prefer React text nodes** — `{userInput}` is escaped by React. Never concatenate untrusted data into HTML strings.
2. **`dangerouslySetInnerHTML` is forbidden** unless the value is passed through `sanitizeHtml()` from `apps/web/src/lib/sanitize.ts` (DOMPurify via `isomorphic-dompurify`).
3. **Do not** introduce HTML from API/user content without the sanitizer. Prefer plain text or structured UI.

```tsx
// ❌ forbidden
<div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />

// ✅ only if HTML is required
import { sanitizeHtml } from "@/lib/sanitize"
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.descriptionHtml) }} />
```

### Legacy static HTML/JS (storefront, admin, merchant)

1. **Global helpers** (from `assets/js/api.js` or `assets/js/escape-html.js`):
   - `escapeHtml(str)` — text / template body (`& < > " '`)
   - `escapeAttr(str)` — attribute values (+ backticks); **still validate URLs** (`https?:`, `/`, `data:image/`)
2. Prefer **`textContent`** when inserting plain text into a single node.
3. Any `innerHTML` / template literal with API or user data **must** use `escapeHtml` / `escapeAttr`.
4. Never put untrusted data into `javascript:` URLs, event-handler attributes, or `document.write`.

### CSP (related: Stage 22)

| Surface | Where | Notes |
|---------|--------|--------|
| Nest API | `security-headers.ts` (helmet) | `script-src 'self'` (+ `'unsafe-inline'` only if Swagger enabled) |
| Next.js | `apps/web/next.config.ts` | `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com` — Next/Stripe need inline/eval for now |
| nginx legacy | `nginx.conf` | `script-src 'self' 'unsafe-inline'` for static HTML pages |

**Intent:** CSP is a second line of defense. Primary XSS control is correct escaping/sanitizing.  

**CSP nonces (Stage 20 note / follow-up):**

- Plan: middleware-generated nonce → CSP `script-src 'nonce-…'` on Next production builds; drop `'unsafe-inline'` when HMR is not needed.
- Stripe remains on allowlist (`https://js.stripe.com`).
- Details: [FRONTEND.md](./FRONTEND.md#csp-nonces-for-nextjs-planned-not-fully-enabled).
- Legacy static pages keep edge nginx CSP with `'unsafe-inline'` until removed.

## Private KYC download ACL

| Actor | Download KYC of shop A |
|-------|------------------------|
| Anonymous | 401 |
| Merchant shop B | 403 |
| Merchant shop A (owner) | 200 + signed URL (TTL 180s) |
| ADMIN / SUPER_ADMIN | 200 + signed URL |
| Expired signed URL | 403 |

Signed URL local: `GET /api/media/signed?key=&exp=&sig=` (HMAC, `STORAGE_SIGN_SECRET` or `JWT_SECRET`).  
S3/R2: native presigned GET.

## Target after Phase 1–2

- [x] MediaAsset ownership + ACL  
- [x] Private KYC + signed URLs  
- [x] Proper migrations only (`migrate deploy`)  
- [x] Fail-fast secrets validation (`config/env.validation.ts`)  
- [x] Idempotent Stripe webhooks (`PaymentWebhookEvent`)  
- [x] Refund state machine (COMPLETED only via provider webhook)  
- [x] Strict ledger invariants (double-entry FinancialTransaction)  
- [x] Atomic payouts (reserve under Shop FOR UPDATE)  
- [x] Request/correlation IDs (Этап 26: ALS + X-Request-Id / X-Correlation-Id)  

## Secrets (Этап 4)

**Validator:** `apps/api/src/config/env.validation.ts` via `ConfigModule.forRoot({ validate })`.

### Always required (class-validator)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | non-empty |
| `JWT_SECRET` | non-empty |

### Required when `NODE_ENV=production` (missing → `process.exit(1)`)

| Variable | Rule |
|----------|------|
| `JWT_SECRET` | ≥32 chars; reject `dev-secret`, `change_me`, … |
| `DATABASE_URL` | reject embedded weak passwords (`mplace`, `password`, …) |
| `REDIS_URL` | required |
| `MEILI_MASTER_KEY` | ≥16; reject compose demo key |
| `STRIPE_SECRET_KEY` | must start with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | required |
| `PAYMENT_PROVIDER` | must **not** be `dev` |
| `ALLOW_DEV_PAYMENTS` | must **not** be true |
| `POSTGRES_PASSWORD` | if set, reject `mplace` / `password` / … |

Templates: `.env.example` (dev), `.env.production.example` (prod placeholders only).

### Compose local defaults (dev only)

| Variable | Local compose default | Production |
|----------|----------------------|------------|
| `POSTGRES_PASSWORD` | `mplace` | strong secret, fail-fast if weak |
| `MEILI_MASTER_KEY` | demo string | long random, fail-fast if default |
| `NODE_ENV` | `development` (compose default) | `production` + full secret set |
