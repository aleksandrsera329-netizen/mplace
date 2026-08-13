# Mplace — Investor Cost Sheet (1 страница, RU)

**Продукт:** Multi-vendor B2B marketplace (оборудование Oil & Gas)  
**Стек:** NestJS 11 · Next.js 16 · PostgreSQL 16 · Redis · Meilisearch · BullMQ · Stripe  
**Статус:** Этап 30 — **GO к пилоту / демо инвестору** (2026-08)  
**Ассет:** Исходный код + документация + security/money test gate (**не** выручка и не бренд)

---

## 1. Что сделано (scope → трудозатраты)

| Блок | Статус | Часы (оценка) |
|------|--------|----------------|
| Auth (JWT, refresh family, lockout, admin MFA) | ✅ | 120–160 |
| Каталог, корзина, checkout, wishlist | ✅ | 140–180 |
| Кабинеты Buyer / Merchant / Admin (Next) | ✅ | 200–280 |
| Платежи (Stripe, webhooks, refunds) | ✅ | 160–220 |
| Ledger + payouts (concurrency-safe) | ✅ | 120–160 |
| RFQ → offer → award → Order | ✅ | 120–160 |
| KYC private + media ACL + file security | ✅ | 100–140 |
| Search, jobs, notifications, multi-tenant | ✅ | 140–200 |
| Security headers, rate limits, XSS, secrets fail-fast | ✅ | 80–120 |
| Ops: metrics, backup/DR, deploy docs | ✅ | 80–120 |
| Тесты (182 unit + 85 security) + PRODUCTION_GATE | ✅ | 100–140 |
| **Итого engineering** | | **~1 360–1 880 ч** |
| **≈ чел.-месяцы (160 ч/мес.)** | | **~8,5–12 PM core · 15–22 PM full team** |

**Снимок кодовой базы:** ~27k LOC API · ~10k LOC Web · 52 модели Prisma · ~57 Next routes · 13 migrations.

---

## 2. Стоимость пересборки «с нуля» (custom)

| Рынок / команда | Ставка (ориентир) | **15 PM** | **20 PM** |
|-----------------|-------------------|-----------|-----------|
| РФ mid-студия | $3–5k / PM | **$45–75k** | **$60–100k** |
| РФ senior-heavy | $5–8k / PM | **$75–120k** | **$100–160k** |
| EU outsource | $8–12k / PM | **$120–180k** | **$160–240k** |
| US product agency | $15–22k / PM | **$225–330k** | **$300–440k** |

### В рублях (≈ 90 ₽ / $)

| Сценарий | Диапазон |
|----------|----------|
| **Реалистичная замена (РФ)** | **12–20 млн ₽** |
| Оптимистичный урезанный MVP | 8–12 млн ₽ |
| Western agency full | 25–40+ млн ₽ |

---

## 3. Стоимость кода / IP (без клиентов)

| Тип сделки | USD | RUB |
|------------|-----|-----|
| Fire-sale / без доки | $30–60k | 3–5 млн |
| **Справедливая продажа IP (текущее качество)** | **$80–150k** | **7–14 млн** |
| IP + handover + 30 дней support | $120–200k | 11–18 млн |

*Правило: 15–40% от полной стоимости custom-сборки.*

---

## 4. Для инвесторов (это не valuation компании)

| Фактор | Комментарий |
|--------|-------------|
| Tech readiness | Pilot-ready multi-vendor B2B + money paths (unit-tested) |
| Частичный moat | RFQ, ledger, KYC ACL, multi-tenant foundation |
| Что снижает цену | UX polish, live Stripe ops, CSP nonces, full E2E, нет ARR |
| Equity story (pre-seed, без выручки) | Tech-asset narrative часто **$100–300k** |

**Не оценка компании.** Equity value = команда + рынок + traction × multiples.

---

## 5. Бюджет на 90 дней (опционально)

| Статья | Стоимость (РФ) |
|--------|----------------|
| Live Stripe + HTTPS + secrets + Sentry | 0,3–0,8 млн ₽ |
| UX / design polish | 0,8–2,0 млн ₽ |
| E2E + load + pen-test lite | 0,5–1,5 млн ₽ |
| Pilot support (2 eng × 3 мес.) | 1,5–3,5 млн ₽ |
| **Буфер go-live 90 дней** | **~3–7 млн ₽** |

---

## Итог

| | |
|--|--|
| **Стоимость пересборки** | **~$100–200k** (РФ) · **$200–400k** (West) |
| **Справедливый code asset** | **~$80–150k · 7–14 млн ₽** |
| **Статус** | Готов к пилотным клиентам и демо инвестору после env/ops checklist |

*Источники: internal LOC/modules (2026-08), stages 0–30, PRODUCTION_GATE. Ставки — рыночный ориентир, не оферта.*
