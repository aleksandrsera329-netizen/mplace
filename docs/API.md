# API.md — HTTP API overview

Base URL (local default): **`http://127.0.0.1:3001/api`**

Interactive OpenAPI: **`GET /api/docs`** (Swagger UI).

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | email/password; rate limit 5/15m |
| POST | `/auth/refresh` | rotate refresh (cookie or body) |
| POST | `/auth/logout` | revoke refresh |
| POST | `/auth/register` | customer |
| POST | `/auth/register/merchant` | merchant + shop |
| POST | `/auth/mfa/verify` | admin TOTP |
| POST | `/auth/password/forgot` | always 200 (no enum) |
| POST | `/auth/password/reset` | token + new password |
| GET | `/auth/me` | JWT required |

Headers:

- `Authorization: Bearer <accessToken>`
- `X-Session-Key` — guest cart
- `X-Order-Access-Token` — guest order view (header only)
- `X-Request-Id` / `X-Correlation-Id` — optional; echoed on response

## Catalog & search

| Method | Path |
|--------|------|
| GET | `/products`, `/products/:id` |
| GET | `/products/search` |
| GET | `/search/products`, `/search/autocomplete` |
| POST | `/products` (merchant/admin) |
| POST | `/products/upload-image` |
| POST | `/products/:id/documents` |

## Orders & cart

| Method | Path |
|--------|------|
| GET/POST/PATCH/DELETE | `/cart`, `/cart/items` |
| POST | `/checkout` |
| GET | `/orders`, `/orders/:id` |
| PATCH | `/orders/:id/status` |

## Payments

| Method | Path |
|--------|------|
| POST | `/orders/:id/payment-intent` |
| POST | `/payments/webhook`, `/webhooks/stripe` |
| POST | `/payments/dev-confirm` | only if `ALLOW_DEV_PAYMENTS` |
| POST | `/orders/:id/refund` |

See [PAYMENTS.md](./PAYMENTS.md).

## Finance

| Method | Path |
|--------|------|
| GET | `/finance/balance` (merchant) |
| POST | `/finance/payouts` |
| PATCH | `/finance/payouts/:id` (admin) |

## RFQ

| Method | Path |
|--------|------|
| POST | `/rfq` |
| GET | `/rfq`, `/rfq/:id` |
| POST | `/rfq/:id/offers` |
| POST | `/rfq/:id/award` |

See [RFQ.md](./RFQ.md).

## KYC & media

| Method | Path |
|--------|------|
| POST | `/shops/:id/kyc` |
| GET | `/kyc/documents/:id/download` |
| POST | `/media`, `/media/upload` |
| DELETE | `/media/:id` |

See [KYC.md](./KYC.md).

## Cabinets

| Method | Path |
|--------|------|
| GET | `/buyer/dashboard`, `/buyer/orders`, `/buyer/rfqs` |
| GET | `/merchant/dashboard`, `/merchant/orders`, `/merchant/products` |
| POST | `/merchant/products/import/upload` |

## Ops

| Method | Path | Auth |
|--------|------|------|
| GET | `/health`, `/health/live` | public (liveness) |
| GET | `/health/ready` | public (readiness → 503 if deps down) |
| GET | `/health/status` | public UI badge |
| GET | `/metrics` | Prometheus scrape |

## Notifications

| Method | Path |
|--------|------|
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |

---

For full request/response schemas use Swagger at `/api/docs`.
