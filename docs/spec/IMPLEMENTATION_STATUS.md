# Implementation status — после внедрения ТЗ (2026-07-31)

Код: `C:\Users\sasha\mplace\apps\api`  
Локально API: `http://127.0.0.1:3000/api`

---

## Сделано в этой итерации

### Epic 1 — Auth / Security

| Feature | Endpoint / detail | Status |
|---------|-------------------|--------|
| SUPER_ADMIN role | enum + RolesGuard (full access) | ✅ |
| Register email/phone | `POST /auth/register` | ✅ |
| Email verify tokens | `POST /auth/verify-email` | ✅ (dev returns token) |
| Password forgot/reset | `POST /auth/password/forgot`, `/reset` | ✅ |
| Login lockout 5 fails | `POST /auth/login` | ✅ |
| JWT + **refresh** | `accessToken` + `refreshToken`, `POST /auth/refresh` | ✅ |
| Logout revoke refresh | `POST /auth/logout` | ✅ |
| Rate limit auth | `@Throttle` on auth routes + global Throttler | ✅ |
| Login audit | `AuditLog` LOGIN_SUCCESS/FAIL/LOCKED | ✅ |
| TOTP 2FA | `POST /auth/2fa/setup`, `/enable`, `/disable` | ✅ |
| SMS 2FA | interface later | ⏳ stub via TOTP only |

### Epic 1.2 — KYC docs

| Feature | Endpoint | Status |
|---------|----------|--------|
| Upload docs | `POST /kyc/documents` (merchant) | ✅ |
| List mine | `GET /kyc/me` | ✅ |
| Admin pending | `GET /kyc/pending` | ✅ |
| Approve/Reject | `PATCH /kyc/documents/:id` | ✅ (+ shop verified) |

### Epic 2 — Buyer (часть)

| Feature | Endpoint | Status |
|---------|----------|--------|
| Wishlist | `GET/POST/DELETE /buyer/wishlist/:productId` | ✅ |
| Saved searches | `GET/POST/DELETE /buyer/saved-searches` | ✅ |
| My orders | `GET /buyer/orders` | ✅ |
| RFQ list/compare UI | buyer via `/rfq` | ✅ API |

### Epic 3 — Vendor (часть уже была)

| Feature | Status |
|---------|--------|
| Product CRUD | ✅ (было) |
| Balance / payouts | ✅ (было) |
| RFQ inbox + offer | ✅ `GET /rfq`, `POST /rfq/:id/offers` |
| Bulk Excel | ⏳ next |
| Multi photo models | ✅ schema `ProductImage`/`ProductDocument` |

### Epic 4 — RFQ (core)

| Feature | Endpoint | Status |
|---------|----------|--------|
| Create multi-item RFQ | `POST /rfq` | ✅ |
| Auto match shops | on create | ✅ |
| List role-aware | `GET /rfq` | ✅ |
| Get + messages | `GET /rfq/:id`, `POST /rfq/:id/messages` | ✅ |
| Vendor offer | `POST /rfq/:id/offers` | ✅ |
| Compare matrix | `GET /rfq/:id/compare` | ✅ |
| Award offer | `POST /rfq/:id/award/:offerId` | ✅ |
| Award → Order | ⏳ next sprint |

### Schema migration

`prisma/migrations/20260731064203_tz_epic1_4_foundation`

---

## Ещё не сделано (по ТЗ)

- SMS provider, real email SMTP  
- Bulk CSV/Excel upload UI  
- Meilisearch  
- YooKassa / SBP  
- PDF invoices  
- Full buyer SPA pages  
- Telegram notifications  
- Reviews after deal  
- S3 file storage (сейчас path string)  

---

## Как прогнать локально

```powershell
cd C:\Users\sasha\mplace\apps\api
npx prisma migrate deploy
npx prisma db seed
npm run build
node dist/src/main.js
```

Smoke:

```http
POST /api/auth/login { "email":"superadmin@demo.com", "password":"123456" }
POST /api/rfq  (Bearer customer)
POST /api/rfq/:id/offers (Bearer merchant)
GET  /api/rfq/:id/compare (Bearer customer)
POST /api/kyc/documents (Bearer merchant)
GET  /api/kyc/pending (Bearer admin)
```

Demo:

| Role | Email | Password |
|------|-------|----------|
| SuperAdmin | superadmin@demo.com | 123456 |
| Merchant | merchant@demo.com | 123456 |
| Customer | customer@demo.com | 123456 |

---

## Deploy на Render

После push:

1. Redeploy service `mplace-vu4o`  
2. Migration + seed в CMD контейнера уже есть  
3. Проверить `/api/health`  

**Важно:** free tier без persistent disk — SQLite может сбрасываться.
