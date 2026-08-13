# Stripe test-mode verification

This is the repeatable manual/integration checklist for the payment path.

## Configuration

```text
PAYMENT_PROVIDER=stripe
ALLOW_DEV_PAYMENTS=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Never use `sk_live_*` in a test environment.

## Flow

1. Create/verify a merchant Stripe Connect account.
2. Create a product for that merchant.
3. Add the product to a buyer cart.
4. Checkout and create the order.
5. Create a Stripe PaymentIntent.
6. Confirm the PaymentIntent with Stripe test payment data.
7. Deliver `payment_intent.succeeded` to the webhook endpoint.
8. Verify the webhook is persisted once and marked processed.
9. Verify order status changes to paid/confirmed.
10. Verify ledger debit/credit invariants.
11. Request and approve a refund.
12. Deliver `charge.refunded` / refund webhook.
13. Verify refund is completed exactly once and ledger balances remain invariant.
14. Verify duplicate webhook delivery is idempotent.
15. Verify payout request cannot double-spend a merchant balance.

## Automated coverage

The repository includes webhook idempotency, refund state-machine, payout-concurrency and ledger tests. A real Stripe test-mode run still requires Stripe credentials and webhook delivery from the target environment.

## Evidence to retain for a buyer

- Stripe test-mode event IDs
- webhook delivery log
- order ID
- payment ID
- refund ID
- ledger entries
- final merchant payout state
