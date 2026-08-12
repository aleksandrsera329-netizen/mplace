# TEST_MATRIX.md — Security & Money Release Gate (Этап 25)

**Цель:** минимальный, но жёсткий matrix для пилота.  
**Команды:**

```bash
cd apps/api
npm test                 # unit/integration (src/**/*.spec.ts)
npm run test:security    # critical subset (security + money)
# npm run test:e2e       # requires DB + env (optional full gate)
```

**Легенда:** ✅ covered · 🟡 partial · ❌ missing

---

## Auth

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Login success | ✅ | `src/auth/auth.service.spec.ts` |
| Login fail (wrong password / missing user) | ✅ | `auth.service.spec.ts` |
| Lockout after 5 fails | ✅ | `src/auth/auth-security.matrix.spec.ts` |
| Refresh rotation | ✅ | `auth.service.spec.ts` (refresh rotation) |
| Refresh reuse → revoke family | ✅ | `auth.service.spec.ts` |
| 2FA / MFA flow (admin mandatory) | ✅ | `auth.service.spec.ts` (admin MFA) |
| Password reset | ✅ | `auth-security.matrix.spec.ts` |

## Orders

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Stock race (last item) | ✅ | `src/warehouse/inventory.service.spec.ts` (needs migrated DB); e2e `security.e2e-spec.ts` |
| Order ownership | ✅ | e2e `security.e2e-spec.ts`; merchant isolation |
| Status transitions | ✅ | `src/orders/order-status.machine.spec.ts`; `order-security.spec.ts` |
| Payment mismatch (amount/currency/orderId) | ✅ | `src/orders/order-security.spec.ts` (webhook validators) |

## Payments

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Duplicate webhook → no double process | ✅ | `src/payments/payments-webhook.spec.ts` |
| Wrong amount / currency | ✅ | `order-security.spec.ts` + webhook service path |
| Refund flow | ✅ | `src/refunds/refunds.service.spec.ts` |
| Duplicate refund / over-refund | ✅ | `refunds.service.spec.ts` (idempotent confirm + max amount) |

## Finance

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Concurrent payout (balance 1000, two×800) | ✅ | `src/finance/payout-concurrency.spec.ts` |
| Negative balance prevention | ✅ | payout concurrency + ledger rejects |
| Refund after payout | 🟡 | ledger `postRefund` unit; full E2E path optional |
| Ledger debit = credit invariant | ✅ | `src/finance/ledger.service.spec.ts` |

## KYC

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Cross-shop access → 403 | ✅ | `src/kyc/kyc-acl.spec.ts` |
| Public / unauthenticated → 401/403 | ✅ | `kyc-acl.spec.ts` (Forbidden without actor) |
| Admin access → OK | ✅ | `kyc-acl.spec.ts` |

## Media

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Cross-owner delete → 403 | ✅ | `src/media/media-acl.spec.ts` |
| Cross-owner download/view → 403 | ✅ | `media-acl.spec.ts` |

## RFQ

| Scenario | Status | Automated tests |
|----------|--------|-----------------|
| Ownership | ✅ | `rfq-award.spec.ts` (non-owner cannot award) |
| Offer | ✅ | `src/rfq/commands/__tests__/respond-to-rfq.handler.spec.ts` |
| Award race | ✅ | `src/rfq/rfq-award.spec.ts` (second award 409) |
| RFQ number collision | ✅ | `src/rfq/rfq-number-concurrency.spec.ts` |
| RFQ → Order | ✅ | `rfq-award.spec.ts` |

## Adjacent (not in TZ list, but release-relevant)

| Area | Status | Tests |
|------|--------|-------|
| File upload security | ✅ | `src/common/upload/file-security.spec.ts` |
| Rate limits config | ✅ | `src/common/throttle/throttle.limits.spec.ts` |
| Security headers / CORS | ✅ | `src/common/security/security-headers.spec.ts` |
| Observability requestId | ✅ | `src/common/observability/request-context.spec.ts` |
| Permissions guard | ✅ | `src/auth/guards/permissions.guard.spec.ts` |

---

## Critical gate (must stay green)

These are the **pilot blockers** — all must have automated tests:

1. Auth refresh reuse → family revoke  
2. Concurrent payout double-spend prevention  
3. Payment webhook idempotency  
4. Media / KYC ACL (cross-shop / cross-owner)  
5. RFQ award race  
6. Ledger debit = credit  

Run: `npm run test:security`

---

## Notes

- Unit/integration specs live under `apps/api/src/**/*.spec.ts`.  
- E2E (`npm run test:e2e`) needs Postgres + env; not required for every CI commit if unit gate is green, but recommended before pilot.  
- Jaeger / ELK are out of Stage 25 scope (observability Stage 26 covers requestId ALS).  
