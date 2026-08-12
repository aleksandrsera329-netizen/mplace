# FRONTEND.md — consolidation status (Этап 20)

**Primary UI:** `apps/web` (Next.js 16 App Router)  
**Legacy:** root `*.html` + `assets/js` — **fallback only**, not the default path

Production nginx (`nginx.conf`) proxies `/` → Next.js `web` service. Legacy static server (`py -m http.server 8080`) is optional for local comparison.

---

## Target structure (TZ) vs current

| TZ path | Current Next route | Status |
|---------|-------------------|--------|
| `app/shop` | `/` + alias `/shop` → `/` | ✅ |
| `app/product` | `/product/[id]` | ✅ |
| `app/cart` | `/cart` | ✅ |
| `app/checkout` | `/checkout` | ✅ |
| `app/dashboard` (buyer) | `/buyer/dashboard` + alias `/dashboard` | ✅ |
| `app/merchant` | `/merchant/*` | ✅ |
| `app/admin` | `/admin/*` | ✅ |
| Auth | `/login` (+ MFA), `/register` | ✅ |

---

## What runs on Next.js today

### Storefront (public)

| Flow | Route |
|------|--------|
| Catalog + filters/search | `/` |
| Product card | `/product/[id]` |
| Cart | `/cart` + cart drawer |
| Checkout (name/email/tax/shipping) | `/checkout` |
| Wishlist | `/wishlist` |
| Login + MFA (TOTP / enroll) | `/login` |
| Register (customer / merchant) | `/register` |

### Buyer

| Flow | Route |
|------|--------|
| Dashboard | `/buyer/dashboard` |
| Orders | `/buyer/orders`, `/orders`, `/orders/[id]` |
| RFQ | `/rfq`, `/rfq/new`, `/rfq/[id]`, `/buyer/rfqs` |
| Profile / security / addresses | `/account/profile`, `/buyer/security`, `/buyer/addresses` |

### Merchant

| Flow | Route |
|------|--------|
| Dashboard | `/merchant`, `/merchant/dashboard` |
| Products CRUD | `/merchant/products`, `/new`, `/[id]` |
| Orders | `/merchant/orders`, `/[id]` |
| Inventory / warehouse / shipping | `/merchant/inventory`, `/warehouse`, `/shipping` |
| Finance / payouts / KYC / RFQ | `/merchant/finance`, `/payouts`, `/kyc`, `/rfq` |

### Admin

| Flow | Route |
|------|--------|
| Dashboard | `/admin` |
| Users, merchants, shops, products, categories | `/admin/*` |
| Orders, payments, payouts, disputes, KYC, audit | `/admin/*` |
| Settings / branding / invites | `/admin/settings/*` |

### Cross-cutting

- Shared `Header`, theme, i18n (ru/en/ar)
- Role home: `lib/role-routes.ts` → post-login + header account icon
- Cabinets: layout-level role guards (buyer / merchant / admin)
- Redirects: legacy `*.html` paths → Next routes (`next.config.ts`)

---

## What remains on legacy (static HTML)

| File | Purpose | Next equivalent |
|------|---------|-----------------|
| `index.html` | Old catalog | `/` |
| `product.html` | Old PDP | `/product/[id]` |
| `cart.html` / `checkout.html` | Old cart/checkout | `/cart`, `/checkout` |
| `login.html` | Old login | `/login` |
| `account.html` | Old buyer hub | `/buyer/dashboard` |
| `orders.html` / `order.html` | Old orders | `/orders` |
| `wishlist.html` | Old wishlist | `/wishlist` |
| `rfqs.html`, `rfq.html`, `rfq-create.html`, `rfq-offer.html` | Old RFQ UI | `/rfq/*` |
| `merchant.html`, `merchant-*.html`, `merchant/index.html` | Old merchant SPA | `/merchant/*` |
| `admin/index.html` + `assets/js/admin.js` | Old admin SPA | `/admin/*` |
| `assets/js/*` | Shared legacy API client / i18n / XSS helpers | `apps/web/src/lib/api.ts` |

**Policy:** do not add new features to legacy HTML. Prefer Next. Legacy may be deleted after pilot (Stage 30) once smoke-checked.

---

## Role redirects (Stage 20)

| Role | Home after login / account icon |
|------|----------------------------------|
| `CUSTOMER` | `/buyer/dashboard` |
| `MERCHANT` | `/merchant/dashboard` |
| `ADMIN` / `SUPER_ADMIN` | `/admin` |

Deep links: `/login?next=/checkout` (open-redirect safe: internal paths only).

---

## Legacy JavaScript libraries audit (`assets/js`)

| File | Role | Replaced by (Next) | Risk if kept |
|------|------|--------------------|--------------|
| `api.js` | Fetch client, session, cart, escapeHtml | `src/lib/api.ts` + `role-routes.ts` | Drift of API contracts |
| `escape-html.js` | Standalone XSS helper | React escaping + `sanitize.ts` | Low |
| `i18n.js` | Legacy locale switcher | `src/i18n/*` | Dual translation strings |
| `admin.js` | Admin SPA (innerHTML tables) | `/admin/*` pages | High XSS surface (mitigated Stage 21) |
| `merchant.js` | Merchant SPA | `/merchant/*` pages | High XSS surface |
| `data.js` | Demo/static seed data for SPAs | API + React Query | Stale demo data |

**Third-party:** legacy pages use no npm CDN frameworks (plain JS). Next uses React 19, TanStack Query, Zustand, Zod, isomorphic-dompurify, Radix, Tailwind.

**Recommendation:** freeze `assets/js` (no new features). Prefer deleting after Stage 30 pilot.

---

## Next.js migration steps (concrete)

### Already done (Stage 20)

1. Treat **nginx → Next** as the only production frontend path.
2. Implement storefront catalog, PDP, cart, checkout on App Router.
3. Buyer / merchant / admin cabinets with layout role guards.
4. `homePathForRole` + post-login redirect + header account link.
5. Redirects from `*.html` paths in `next.config.ts`.
6. Document matrix in this file + `LEGACY.md`.
7. Auth: `/login` (MFA verify + enroll), `/register` (customer + merchant).
8. Prefill checkout from session; cart drawer → `/checkout`.

### Remaining (post–Stage 20 / pilot)

| Step | Action | Owner hint |
|------|--------|------------|
| A | Smoke E2E: guest cart → checkout → order visible in buyer | QA |
| B | Admin first-login MFA enroll path in prod seed | Ops |
| C | Stripe Elements / hosted Checkout UI polish | Payments |
| D | Visual parity (industrial theme) if brand requires | Design |
| E | Remove static server from README quick-start | Docs |
| F | Delete root `*.html` + `assets/js` after no traffic | Stage 30 |
| G | CSP nonces (below) | Security |

### CSP nonces for Next.js (planned, not fully enabled)

Current `next.config.ts` still allows `'unsafe-inline'` / `'unsafe-eval'` for Next runtime + Stripe.

**Target approach (Next 15+/16 App Router):**

1. Generate per-request nonce in **middleware** (`crypto.randomUUID()` / `Buffer`).
2. Pass nonce via `x-nonce` request header / `headers()`.
3. Set `Content-Security-Policy: script-src 'self' 'nonce-{n}' https://js.stripe.com` (drop `unsafe-inline` when stable).
4. Wire nonce into root `layout` for any remaining inline scripts.
5. Keep `style-src 'unsafe-inline'` until CSS-in-JS / Tailwind pipeline allows hashes.

**Blockers today:** Next dev HMR and some Stripe embeds need eval/inline; enable nonces first in **production** builds only (`NODE_ENV=production`).

See also [SECURITY.md](./SECURITY.md) XSS/CSP section.

---

## Cutover plan (remaining)

1. **Done:** browse → cart → checkout on Next; cabinets; role redirects; register/MFA; nginx → web.
2. Optional: Stripe UI polish, theme parity.
3. **Delete legacy** after Stage 30 pilot confirms no static bookmarks.
4. **CSP nonces** in production (see above).

---

## Local dev

```powershell
# Primary
cd apps/web
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:3001/api"
npm run dev
# http://127.0.0.1:3000

# Legacy fallback only
cd C:\Users\sasha\mplace
py -m http.server 8080
```
