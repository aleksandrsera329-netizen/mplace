# LEGACY storefront (fallback)

> **Stage 20:** Primary product UI is **Next.js** (`apps/web`).  
> Root `*.html` and `assets/js` are a **temporary fallback** for local static serving only.

## Do not use for new work

- New features → `apps/web`
- Production path → nginx → Next (`web` container)

## When this folder is relevant

- Comparing UI during migration
- Offline demos without Node
- Smoke-testing XSS helpers in plain HTML

## Mapping

See [docs/FRONTEND.md](docs/FRONTEND.md) for route matrix and cutover plan.

## Removal criteria (Stage 30+)

- [ ] Catalog / PDP / cart / checkout used only via Next in pilot
- [ ] Merchant + admin only via Next
- [ ] No external docs link to `*.html`
- [ ] Then delete root HTML + `assets/js` (or archive)


## Current status

Legacy static HTML/JS is archived under `legacy/` and is not served by the production nginx path. The production UI is `apps/web` (Next.js).
