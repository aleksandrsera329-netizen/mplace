# Gap analysis: PRODUCT_TZ vs текущий Mplace

**Код:** `C:\Users\sasha\mplace`  
**API:** NestJS `apps/api` + Prisma  
**UI:** static storefront / admin / merchant  
**Дата:** 2026-07-31  

Легенда: ✅ есть (база) · 🟡 частично · ❌ нет  

---

## Epic 1 — Auth / Roles / Security

| Требование | Статус | Сейчас |
|------------|--------|--------|
| Роли Guest / Buyer / Vendor / Admin / SuperAdmin | 🟡 | `UserRole`: ADMIN, MERCHANT, CUSTOMER (+ guest session без User) |
| Регистрация email | ✅ | `/auth/register`, merchant register |
| Регистрация телефон | ❌ | только email |
| Подтверждение email/SMS | ❌ | — |
| 2FA TOTP/SMS | ❌ | — |
| Восстановление пароля | ❌ | — |
| Блокировка после 5 fail | ❌ | — |
| JWT access | ✅ | access JWT |
| Refresh tokens | 🟡 | planned в ARCHITECTURE, в коде не полный cycle |
| Rate limit auth | 🟡 | Redis planned; production depends on deploy |
| Audit log входов | 🟡 | `AuditLog` model + admin audit; не полный login trail |
| KYC документов | 🟡 | shop status PENDING/ACTIVE; **нет** upload паспорт/ИНН/устав |
| KYC статусы + notify | 🟡 | approve/reject shop; notify seller — слабо/нет |

**Вывод Sprint 1–2:** добить auth enterprise + KYC docs — поверх существующего JWT/RBAC.

> **Update 2026-07-31:** реализовано ядро Sprint 1–2 + RFQ core + buyer wishlist.  
> См. `IMPLEMENTATION_STATUS.md`.

---

## Epic 2 — Buyer Dashboard

| Требование | Статус | Сейчас |
|------------|--------|--------|
| История заказов | 🟡 | API orders для customer; отдельный buyer cabinet UI минимальный |
| История **заявок RFQ** | ❌ | RFQ нет |
| Фильтры сделок | 🟡 | базово |
| Сравнение предложений | ❌ | — |
| Избранное | ❌ | — |
| Сохранённые поиски | ❌ | — |
| Файлы к заявке | ❌ | — |
| История документов | ❌ | — |

---

## Epic 3 — Vendor Dashboard

| Требование | Статус | Сейчас |
|------------|--------|--------|
| CRUD товаров | ✅ | create/update/delete + statuses |
| Bulk Excel/CSV | ❌ | — |
| Остатки/цены | 🟡 | stock, priceCents; не real-time multi-warehouse |
| Мульти-фото + сертификаты | 🟡 | imageUrl single; сертификаты нет |
| Входящие заявки RFQ | ❌ | — |
| Volume discounts / personal prices | ❌ | — |
| Финансовый дашборд | 🟡 | balance, payouts, ledger API |
| Статистика views/conversion | 🟡 | soldCount; views/conversion — нет |

---

## Epic 4 — RFQ (критично)

| Требование | Статус |
|------------|--------|
| Multi-item заявка + файлы + deadline | ❌ |
| Matching продавцов | ❌ |
| Предложение продавца | ❌ |
| Сравнительная таблица | ❌ |
| Чат по заявке | ❌ |
| Статусы + history | ❌ |

**Вывод:** RFQ — greenfield модуль (prisma models + API + UI).

---

## Epic 5 — Payments

| Требование | Статус | Сейчас |
|------------|--------|--------|
| Stripe | 🟡 | payment-intent / webhook path; dev mode |
| ЮKassa | ❌ | — |
| СБП | ❌ | — |
| Счета/акты PDF | ❌ | — |
| Split / escrow | 🟡 | commission + ledger; full split PSP — TODO |
| История транзакций | 🟡 | ledger / payments |

---

## Epic 6 — Search

| Требование | Статус |
|------------|--------|
| Meilisearch / ES | ❌ (DB filter/search only) |
| Фасеты | 🟡 базово |
| Автодополнение | ❌ |
| Похожие / compare | ❌ |

---

## Epic 7–11

| Epic | Статус |
|------|--------|
| 7 Reviews | ❌ (нет post-order reviews) |
| 8 Disputes | 🟡 Dispute model + API base |
| 9 Notifications | ❌ (email/Telegram/in-app templates) |
| 10 Analytics | 🟡 admin reports summary |
| 11 Docs / S3 | ❌ PDF gen + S3 |

---

## Рекомендуемый фокус

1. **Не переписывать** с нуля — расширять `apps/api` + UI.  
2. **Спринт 1–2:** Epic 1 (phone, verify, 2FA, lockout, refresh, KYC files).  
3. **Спринт 3–5:** Vendor polish + **RFQ core** (самый большой gap).  
4. Buyer cabinet (Epic 2) опирается на RFQ — логично после/параллельно с RFQ.  
5. Платежи (Epic 5) — после стабильных order+RFQ accept → order flow.

Подробный backlog спринтов: `SPRINT_PLAN.md`.
