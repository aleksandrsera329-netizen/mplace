# Mplace — Investor Cost Sheet (1 page)

**Product:** Multi-vendor B2B marketplace (Oil & Gas equipment)  
**Stack:** NestJS 11 · Next.js 16 · PostgreSQL 16 · Redis · Meilisearch · BullMQ · Stripe  
**Status:** Stage 30 — **GO for pilot / investor demo** (2026-08)  
**Asset:** Source code + docs + security/money test gate (not revenue / brand)

---

## What is built (scope → effort)

| Scope block | Delivered | Est. hours |
|-------------|-----------|------------|
| Auth (JWT, refresh family, lockout, admin MFA) | ✅ | 120–160 |
| Catalog, cart, checkout, wishlist | ✅ | 140–180 |
| Buyer / Merchant / Admin cabinets (Next) | ✅ | 200–280 |
| Payments (Stripe, webhooks, refunds) | ✅ | 160–220 |
| Ledger + payouts (concurrency-safe) | ✅ | 120–160 |
| RFQ → offer → award → Order | ✅ | 120–160 |
| KYC private + media ACL + file security | ✅ | 100–140 |
| Search, jobs, notifications, multi-tenant | ✅ | 140–200 |
| Security headers, rate limits, XSS, secrets fail-fast | ✅ | 80–120 |
| Observability, metrics, backup/DR, deploy docs | ✅ | 80–120 |
| Tests (182 unit + 85 security) + PRODUCTION_GATE | ✅ | 100–140 |
| **Total engineering** | | **~1 360–1 880 h** |
| **≈ person-months (160 h/mo)** | | **~8.5–12 PM core · 15–22 PM full team** |

**Codebase snapshot:** ~27k LOC API · ~10k LOC Web · 52 Prisma models · ~57 Next routes · 13 migrations.

---

## Replacement cost (build from scratch)

| Market / team | Rate (indicative) | **15 PM** | **20 PM** |
|---------------|-------------------|-----------|-----------|
| RF mid studio | $3–5k / PM | **$45–75k** | **$60–100k** |
| RF senior-heavy | $5–8k / PM | **$75–120k** | **$100–160k** |
| EU outsource | $8–12k / PM | **$120–180k** | **$160–240k** |
| US product agency | $15–22k / PM | **$225–330k** | **$300–440k** |

### RUB (≈ 90 ₽ / $)

| Scenario | Range |
|----------|--------|
| **Realistic replace (RF)** | **12–20 млн ₽** |
| Optimistic lean MVP cut | 8–12 млн ₽ |
| Western agency full | 25–40+ млн ₽ |

---

## Code / IP asset value (no customers)

| Deal type | Range USD | Range RUB |
|-----------|-----------|-----------|
| Fire-sale / incomplete docs | $30–60k | 3–5 млн |
| **Fair IP sale (current quality)** | **$80–150k** | **7–14 млн** |
| IP + handover + 30d support | $120–200k | 11–18 млн |

*Rule of thumb: 15–40% of full custom replacement cost.*

---

## Narrative for investors (not a valuation)

| Factor | Note |
|--------|------|
| Tech readiness | Pilot-ready multi-vendor B2B + money paths unit-tested |
| Moat (partial) | RFQ, ledger, KYC ACL, multi-tenant foundation |
| Gaps (price down) | UX polish, live Stripe ops, CSP nonces, full E2E, no ARR |
| Equity story (pre-seed, no revenue) | Tech asset often framed **$100–300k** contribution narrative |

**This is not a company valuation.** Equity value = team + market + traction × multiples.

---

## Ask / next 90 days (optional budget)

| Item | Cost (RF) |
|------|-----------|
| Live Stripe + HTTPS + prod secrets + Sentry | 0.3–0.8 млн ₽ ops |
| UX / design polish | 0.8–2.0 млн ₽ |
| E2E + load + pen-test lite | 0.5–1.5 млн ₽ |
| Pilot support (2 eng × 3 mo) | 1.5–3.5 млн ₽ |
| **90-day go-live buffer** | **~3–7 млн ₽** |

---

## Bottom line

| | |
|--|--|
| **Cost to rebuild** | **~$100–200k** (RF) · **$200–400k** (West) |
| **Fair code asset** | **~$80–150k · 7–14 млн ₽** |
| **Status** | Ready for pilot customers & investor demo after env/ops checklist |

*Sources: internal LOC/modules (2026-08), stage 0–30 roadmap, PRODUCTION_GATE. Rates market-indicative, not an offer.*
