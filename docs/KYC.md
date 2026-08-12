# KYC.md — Know Your Customer documents

## Principles

1. KYC files are **never public** under `/uploads/kyc`
2. Storage key prefix: `private/kyc/{shopId}/…` (or `private/` + folder)
3. Download only via **signed URL** (TTL ~180s)
4. ACL: shop merchant, uploader, or admin

## Upload

```
POST /api/shops/:shopId/kyc
Content-Type: multipart/form-data
file + docType
```

Pipeline (Stage 24):

- Max size / extension whitelist / MIME / **magic bytes**
- Random storage filename (never original path)
- Optional ClamAV if `CLAMAV_ENABLED=true`
- Creates `MediaAsset` (visibility=`KYC`) + `KycDocument` (PENDING)

## Download

```
GET /api/kyc/documents/:id/download
Authorization: Bearer …
→ { url, expiresIn }  // signed
```

Audit action: `KYC_DOWNLOAD`.

| Actor | Access to shop A KYC |
|-------|----------------------|
| Anonymous | 401 / forbidden |
| Merchant shop B | **403** |
| Merchant shop A | 200 + signed URL |
| ADMIN / SUPER_ADMIN | 200 + signed URL |

## Review

Admin/permission `kyc_approve`:

- Approve / reject document
- May activate shop when all pending docs approved
- Notifications: `KYC_APPROVED` / `KYC_REJECTED`

## Nginx / API guards

- `location ^~ /uploads/kyc/` → deny
- API middleware blocks `/uploads/kyc` and `/uploads/private`

## Merchant UI

- Cabinet: `/merchant/kyc` (Next.js) + API list endpoints under shops/kyc

## Code

- `apps/api/src/kyc/`
- `apps/api/src/media/`
- `apps/api/src/storage/`
- Tests: `src/kyc/kyc-acl.spec.ts`
