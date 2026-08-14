# Demo video script — 5–7 minutes (buyer sale)

**Finished video:** `docs/sales-assets/mplace-demo-walkthrough.mp4` (~6m 15s)  
**Recorded from:** https://mplace-vu4o.onrender.com  
**Rebuild:** `py -3 scripts/build_demo_video.py`

---

## Structure (matches live walkthrough file)

| Time | Section | Assets |
|------|---------|--------|
| 0:00–0:40 | Opening + home | title + home + catalog scroll |
| 0:40–2:00 | Catalog / search / product | search “valve”, product card |
| 2:00–3:00 | Order / request | cart drawer + cart page |
| 3:00–4:30 | RFQ | create RFQ + buyer RFQs + orders |
| 4:30–5:30 | Seller desk | merchant cabinet, products, orders |
| 5:30–6:30 | Admin note | MFA-protected admin (title card) + account |
| 6:30–7:00 | Close | request private demo + end card |

---

## Spoken lines (for live re-record with voice)

### 0:00–0:40 — Home
“This is Mplace Energy — multi-vendor B2B marketplace for oil and gas procurement. Live always-on demo.”

### 0:40–2:00 — Catalog
“English-first catalog: categories, suppliers, stock, USD. Search, open product, add to order list.”

### 2:00–3:00 — Order
“Cart becomes a procurement request — real buy path, not a brochure.”

### 3:00–4:30 — RFQ
“RFQ: buyer publishes lines and deadline; suppliers quote; buyer can award. Seeded open/awarded RFQs for private walkthrough.”

### 4:30–5:30 — Seller
“Seller desk: products, stock, incoming orders.”

### 5:30–6:30 — Admin
“Platform admin is MFA-protected for super-admin — shown on private demos under NDA.”

### 6:30–7:00 — Close
“Working B2B foundation — catalog, RFQ, seller, admin — saves 6–12 months rebuild. Request private demo on screen.”

---

## Notes

- Super-admin login requires **MFA enrollment** in API (`mfaEnrollmentRequired`) — not shown as full admin UI in automated video.
- Merchant + buyer private screens are included.
- Passwords are never shown on screen.
- Private credentials: `docs/PRIVATE_DEMO.md`
