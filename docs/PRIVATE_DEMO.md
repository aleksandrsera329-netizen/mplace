# Private demo credentials (NOT public)

Do **not** put these on the live login page, README homepage, or sales video UI.

## Accounts (after seed)

| Role | Email | Password |
|------|--------|----------|
| Super admin | `superadmin@demo.com` | `MplacePrivateDemo!` (or `DEMO_PASSWORD` env) |
| Seller (DrillTech) | `merchant@demo.com` | same |
| Seller (Pipe & Valve) | `valves@demo.com` | same |
| Seller (FieldSafe) | `ppe@demo.com` | same |
| Buyer | `customer@demo.com` | same |
| Buyer 2 | `buyer@demo.com` | same |

Override password on deploy: set Render env `DEMO_PASSWORD`, then re-run seed.

## Seed

```bash
# local
cd apps/api
$env:DEMO_PASSWORD="MplacePrivateDemo!"
npx prisma db seed
```

On Render: one-off shell / job after deploy, or entrypoint seed once.

## Public vs private

| Public | Private (NDA / scheduled) |
|--------|---------------------------|
| Catalog, product, cart, RFQ create | Admin `/admin/` |
| Request Private Demo form | Merchant `/merchant.html` |
| Sign-in form (no passwords shown) | Full RFQ award paths with data |

## Live URL

https://mplace-vu4o.onrender.com
