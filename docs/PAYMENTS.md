# PAYMENTS.md

## Overview

Payments are **provider-driven**. The API creates a PaymentIntent (or dev intent), then marks the order paid only after a **verified** webhook / controlled dev-confirm.

There is **no** `POST /orders/:id/pay`.

## Providers

| `PAYMENT_PROVIDER` | Behavior |
|--------------------|----------|
| `stripe` | Stripe PaymentIntents + signed webhooks |
| `dev` | Local/dev confirm path (`ALLOW_DEV_PAYMENTS=true` required) |

Production: `PAYMENT_PROVIDER=stripe`, `ALLOW_DEV_PAYMENTS` must be false (fail-fast in `env.validation.ts`).

## Happy path

```
Checkout → Order PENDING_PAYMENT
    → POST /orders/:id/payment-intent
    → Client pays (Stripe Elements / Checkout)
    → POST /payments/webhook (or /webhooks/stripe)
    → validate signature + amount + currency + metadata.orderId
    → PaymentWebhookEvent (idempotent)
    → Order PAID + inventory confirm + ledger postPayment
    → Notification ORDER_PAID
```

## Webhook idempotency (Stage 7)

Table: `PaymentWebhookEvent`

| Status | Meaning |
|--------|---------|
| `received` | accepted, processing |
| `processed` | business logic applied |
| `ignored` | event type not handled |
| `failed` | error (Stripe may retry) |
| re-delivery of processed/ignored | `already_processed` |

## Validation

Webhook handler rejects:

- invalid Stripe signature
- `amount_received` ≠ payment amount
- currency mismatch
- `metadata.orderId` mismatch

## Refunds (Stage 8)

State machine (not completed by admin alone):

```
REQUESTED → APPROVED → PROVIDER_REQUESTED → COMPLETED
                                    ↘ FAILED
```

- Buyer/admin: create `REQUESTED`
- Admin: `APPROVED`
- Provider webhook: `COMPLETED` only
- Over-refund blocked: `paidBase - alreadyRefunded`

## Ledger (Stage 9)

- Double-entry via `FinancialTransaction` + `FinancialEntry`
- Invariant: total debit = total credit
- `postPayment` / `postRefund` idempotent by reference where applicable

## Payouts (Stage 10)

- Merchant requests payout
- Status path includes **RESERVED** under `Shop FOR UPDATE`
- Concurrent double-spend rejected (see `payout-concurrency.spec.ts`)
- Complete → ledger finalize + `PAYOUT_COMPLETED` notification

## Dev confirm

```powershell
# only when ALLOW_DEV_PAYMENTS=true
.\scripts\dev-confirm-payment.ps1
```

Secret via env / header — never embed in frontend.

## Monitoring

Counters (Prometheus `/api/metrics`):

- `payments_succeeded_total` / `payments_failed_total`
- `webhooks_processed_total` / `webhooks_failed_total`
- `payouts_failed_total`

## Related code

- `apps/api/src/payments/`
- `apps/api/src/refunds/`
- `apps/api/src/finance/`
