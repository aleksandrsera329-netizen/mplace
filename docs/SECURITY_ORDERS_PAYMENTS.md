# Orders & payments security

## Payment provider

- **Production:** `PAYMENT_PROVIDER=stripe` only.
- **Local:** `PAYMENT_PROVIDER=dev` + `ALLOW_DEV_PAYMENTS=true` + CLI script.
- **Never** put `DEV_PAYMENT_SECRET` in frontend JS or HTML.

## Rules

1. **No** `POST /orders/:id/pay`.
2. Checkout returns `paymentToken` once; bcrypt hash + TTL 30m in DB.
3. Token only via **header** `X-Order-Access-Token` (not query string).
4. `payment-intent` requires JWT owner **or** valid token.
5. Stripe webhook validates **signature + amount_received + currency + metadata.orderId** against Payment/Order.
6. Only webhook (or local CLI dev-confirm) → `PAID` + atomic stock + ledger.
7. Stock: `Prisma.sql` UPDATE … WHERE stock >= qty (SQLite + PostgreSQL).
8. `dev-confirm` returns **404** unless `ALLOW_DEV_PAYMENTS=true` and not production/staging.

## Guest flow

```
checkout → paymentToken (once)
payment-intent + X-Order-Access-Token
stripe.confirmPayment (Elements) → Stripe webhook → PAID
```

Local without Stripe:

```powershell
$env:DEV_PAYMENT_SECRET="…from apps/api/.env only…"
.\scripts\dev-confirm-payment.ps1 -OrderId "…" -PaymentToken "…"
```

## Stripe production

```
PAYMENT_PROVIDER=stripe
ALLOW_DEV_PAYMENTS=false
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PUBLISHABLE_KEY=...
```

Webhook: `POST /api/payments/webhook`
