# Sprint plan — Mplace (по PRODUCT_TZ)

**Команда-размер:** ориентир 1–2 dev full-stack  
**Длина спринта:** 1–2 недели  
**Репозиторий:** `C:\Users\sasha\mplace`

---

## Definition of Done (каждый sprint)

- [ ] Prisma migration (если schema)  
- [ ] API + guard/RBAC  
- [ ] UI happy path  
- [ ] `npm run build` в `apps/api`  
- [ ] Минимум 1 e2e/unit на критичный flow  
- [ ] Обновление docs (этот plan / GAP)  

---

## Sprint 1 — Auth foundation (Epic 1)

**Цель:** enterprise auth skeleton

| # | Task | AC |
|---|------|-----|
| 1.1 | Роли: map `CUSTOMER→Buyer`, `MERCHANT→Vendor`, `ADMIN` + `SUPER_ADMIN` | enum + guards |
| 1.2 | Phone field + optional phone register | unique phone nullable |
| 1.3 | Email verification (token link) | cannot full-login until verified (flag) |
| 1.4 | Password reset (email token) | set new password |
| 1.5 | Failed login counter + lock 15m after 5 | 429/403 + audit |
| 1.6 | Refresh token (httpOnly cookie or rotate table) | access short-lived |
| 1.7 | Rate limit `/auth/*` | Redis or in-memory with note |
| 1.8 | Login audit events | AuditLog type LOGIN_SUCCESS/FAIL |

**Out:** SMS gateway (stub interface), full TOTP UI polish can slip to S2.

---

## Sprint 2 — 2FA + KYC docs (Epic 1)

| # | Task | AC |
|---|------|-----|
| 2.1 | TOTP 2FA enroll + verify at login | Google Authenticator |
| 2.2 | SMS 2FA provider interface + mock | swap real SMS later |
| 2.3 | KYC document upload (S3 or local disk) | passport, INN, charter, certs |
| 2.4 | KYC workflow Pending→Approved/Rejected | admin API + UI |
| 2.5 | Notify merchant (email stub + in-app flag) | on status change |

---

## Sprint 3 — Vendor catalog power (Epic 3.1)

| # | Task | AC |
|---|------|-----|
| 3.1 | Multi-image products | ProductImage[] |
| 3.2 | Certificate attachments | ProductDocument |
| 3.3 | CSV/Excel bulk import | preview + commit |
| 3.4 | Stock/price bulk edit | merchant UI table |

---

## Sprint 4 — RFQ core create + match (Epic 4.1)

| # | Task | AC |
|---|------|-----|
| 4.1 | Models: RfqRequest, RfqItem, RfqAttachment | migrations |
| 4.2 | Buyer creates multi-item RFQ + deadline + files | API + UI |
| 4.3 | Matching: by category / shop active / keywords | list invited shops |
| 4.4 | Notify matched merchants | stub + list in vendor inbox |

---

## Sprint 5 — RFQ offers + compare + chat (Epic 4.2–4.3, Epic 3.2)

| # | Task | AC |
|---|------|-----|
| 5.1 | RfqOffer + line prices / alternatives | vendor reply |
| 5.2 | Buyer comparison table | all offers side-by-side |
| 5.3 | RfqMessage chat thread | per RFQ |
| 5.4 | Status machine + history | draft→open→quoted→awarded→closed |
| 5.5 | Award → create Order draft | link RFQ→Order |

---

## Sprint 6–7 — Buyer cabinet (Epic 2)

| # | Task |
|---|------|
| 6.1 | Buyer dashboard shell (orders + RFQs) |
| 6.2 | Filters/status for orders & RFQs |
| 6.3 | Wishlist / favorites |
| 6.4 | Saved searches |
| 6.5 | Document history per deal |

---

## Sprint 8–9 — Payments (Epic 5)

| # | Task |
|---|------|
| 8.1 | Stripe production hardening |
| 8.2 | YooKassa adapter |
| 8.3 | SBP (via bank/PSP) |
| 8.4 | Invoice/act PDF |
| 8.5 | Split / platform commission on capture |
| 8.6 | Optional escrow state |

---

## Sprint 10+ — Search, social proof, ops

- Meilisearch facets (Epic 6)  
- Reviews after COMPLETED (Epic 7)  
- Dispute UX polish (Epic 8)  
- Email/Telegram/in-app (Epic 9)  
- Analytics export (Epic 10)  
- S3 + PDF suite (Epic 11)  

---

## Первый следующий шаг (сегодня)

1. Зафиксировать TZ ✅ (`PRODUCT_TZ.md`)  
2. Начать **Sprint 1.1–1.5**: schema User phone/lockout/emailVerified + auth service  
3. Не трогать payment/ledger production rules без отдельного review  

---

## Риски

| Риск | Митигация |
|------|-----------|
| RFQ scope explosion | MVP: 1 matching rule, no AI |
| SMS cost | mock provider until pilot |
| Free Render disk | Postgres + managed disk for prod |
| Static HTML UI scale | keep API-first; later SPA if needed |
