# ROADMAP.md — по ТЗ «Повышение технической и коммерческой ценности»

**Baseline tag:** `audit-baseline`  
**Дата фиксации:** 2026-08-10

## PHASE 1 — Security & Foundation (сейчас)

- [x] **Этап 0. Baseline** ← **мы здесь**  
  - docs: AUDIT, ARCHITECTURE, SECURITY, DEPLOYMENT, ROADMAP  
  - versions captured; git tag `audit-baseline`  
- [ ] **Этап 1. Media ownership**  
- [ ] **Этап 2. Private KYC**  
- [ ] **Этап 3. Production Database** (`migrate deploy`, no push/seed on start)  
- [ ] **Этап 4. Secrets & fail-fast**  

## PHASE 2 — Money Safety

- [ ] Этапы 7–10  
  - Stripe webhook idempotency store  
  - Ledger invariants  
  - Atomic payouts  
  - Payment intent hardening  

## PHASE 3 — Core Business

- [ ] Этапы 11–13  
  - RFQ → Order (award → checkout pipeline)  
  - Inventory reservations (complete)  
  - Shipping/tax on order consistency  

## PHASE 4 — Cabinets

- [ ] Этапы 14–16  
  - Customer / Merchant / Admin UX polish  
  - Cutover legacy HTML → Next.js  
  - i18n completeness  

## Already delivered (pre-baseline product work — not security phase)

> Не путать с Phase 1 security: функциональный progress до audit-baseline.

- CQRS + Outbox + BullMQ foundation  
- Multi-tenant / white-label branding  
- Multi-warehouse + stock reserve  
- Shipping methods/rates + checkout selection  
- Tax (VAT) calculation  
- Documents (invoice/act PDF)  
- In-app notifications + bell  

## Definition of Done (Phase 1)

- Critical media/KYC/secrets/migration issues closed  
- CI runs build + unit + security e2e smoke  
- Tag `security-phase1-done`  
