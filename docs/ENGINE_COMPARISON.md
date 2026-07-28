# Сравнение движков: NestJS custom vs Medusa vs Bagisto

Контекст: UI-клон multi-vendor marketplace (`mplace`) уже есть. Нужен **современный и безопасный** backend-движок.

Уровни уверенности: **Confirmed** (проверено/общеизвестно по докам), **Inferred**, **Unverified**.

---

## 1. Критерии выбора (под этот проект)

| Критерий | Вес | Почему важно |
|----------|-----|--------------|
| Подгонка под готовый admin/merchant/store UI | высокий | не хотим выкидывать фронт |
| Multi-vendor (shops, commissions, payouts) | высокий | ядро площадки |
| Безопасность (RBAC, PCI-friendly payments) | высокий | деньги + роли |
| Скорость MVP | средний | быстрее увидеть API |
| Контроль кода / vendor lock-in | высокий | свой продукт |
| Экосистема TypeScript | средний | один язык с фронтом |
| DevOps на Windows + Docker | средний | локальная разработка |

---

## 2. Кратко

| | **NestJS custom** | **Medusa** | **Bagisto** |
|--|-------------------|------------|-------------|
| Стек | Node.js, TypeScript, Nest | Node.js, TypeScript, Medusa v2 | PHP 8, Laravel, Vue |
| Модель | свой API с нуля | headless commerce + modules | full ecom + multi-vendor |
| Multi-vendor | сами | через marketplace module / custom | из коробки (marketplace) |
| Admin UI | **ваш** HTML/JS | свой Admin | свой Admin (Vue) |
| Лицензия | MIT (Nest) | MIT | MIT (Bagisto/Webkul) |
| PCI | Stripe Connect сами | Stripe plugins | payment packages |
| Оценка под mplace | **★ лучший fit** | ★★ хорош, если готовы Medusa Admin | ★★ если команда на PHP |

**Рекомендация: NestJS custom** — сохраняем UI, полный контроль безопасности и multi-vendor логики, один TS-стек.

---

## 3. NestJS custom (выбранный путь)

### Плюсы
- API-first: фронт (`index.html`, `admin/`, `merchant/`) ходит в REST — без смены UI.
- Модули 1:1 с сайдбаром Mplace (catalog, orders, vendors, wallet, support…).
- Security by design: Guards, RBAC, validation pipes, rate limiting — стандарт Nest.
- Prisma + PostgreSQL: явная схема, миграции, audit-friendly.
- Stripe Connect: split payments / payouts без хранения карт.
- Документация (OpenAPI) из декораторов.

### Минусы
- Всё marketplace-ядро пишем сами (дольше, чем «поставить Bagisto»).
- Нет готовых themes/plugins как у ecom-платформ.
- Ответственность за бизнес-правила (комиссии, ledger) — на нас.

### Сроки (оценка, Inferred)

| Этап | Срок |
|------|------|
| Каркас: Docker, auth, health, schema | 3–5 дней |
| MVP: products, orders, shops, basic checkout | 2–4 недели |
| Деньги: commissions, payouts, Stripe | +2–3 недели |
| Support, reports, promotions | +2–4 недели |

### Когда выбирать
- Уже есть свой UI (наш случай).
- Нужен контроль RBAC/tenant isolation.
- Команда комфортна с TypeScript/Node.

---

## 4. Medusa (open-source headless)

### Плюсы
- Confirmed: современный headless commerce на Node/TS + PostgreSQL.
- Готовые flows: cart, checkout, products, regions, fulfillment plugins.
- Admin UI из коробки (можно не использовать, API-first).
- Плагины Stripe, расширяемость modules/workflows (Medusa v2).

### Минусы
- Multi-vendor **не** «Amazon out of the box» — marketplace нужно собирать (modules + custom).
- Модель данных Medusa (Product, Cart, Order) ≠ 1:1 Mplace UI — маппинг/адаптеры.
- Learning curve workflows/modules.
- Два «мира»: Medusa Admin vs наш admin — дублирование или отказ от одного.

### Сроки (Inferred)
- Поднять store + single-vendor: 1–2 недели.
- Multi-vendor + commissions + наш UI: 3–6 недель (зависит от глубины).

### Когда выбирать
- Готовы жить в модели Medusa.
- Важнее готовый cart/checkout, чем пиксель-perfect Mplace admin.
- Не критично переписать/адаптировать фронт.

---

## 5. Bagisto (Laravel multi-vendor)

### Плюсы
- Confirmed: open-source Laravel ecom с multi-vendor capabilities.
- Ближе к «классическому Mplace» (PHP marketplace mental model).
- Много готового: catalog, sellers, commissions, admin panel.

### Минусы
- **Другой стек** (PHP/Laravel/Vue) — два языка в проекте, если оставить HTML/JS UI.
- Admin Bagisto ≠ наш admin: либо выкидываем UI-клон, либо делаем headless-адаптацию (не основной use-case Bagisto).
- Тяжелее «просто API под статику» без кастома.
- DevOps: PHP-FPM + Composer + типичный Laravel stack.

### Сроки (Inferred)
- Установка + demo multi-vendor: дни.
- Подключение **существующего** mplace UI: 4–8+ недель (по сути второй фронт на API, если оно есть/доделывается).

### Когда выбирать
- Команда PHP/Laravel.
- Готовы использовать **admin Bagisto**, а не наш HTML.
- Нужен быстрый «полноценный маркетплейс» без своего UI.

---

## 6. Сводная матрица

| Вопрос | Nest custom | Medusa | Bagisto |
|--------|-------------|--------|---------|
| Оставить UI mplace? | Да, нативно | Да, через API | Сложно / нецелесообразно |
| Multi-vendor готовность | С нуля, под нас | Средняя + custom | Высокая из коробки |
| Безопасность «как мы хотим» | Полный контроль | Хорошая база + custom | Хорошая база Laravel |
| Один язык (TS) | Да | Да | Нет |
| Риск lock-in в чужую модель | Низкий | Средний | Средний/высокий UI |
| Скорость «магазин за неделю» | Нет | Да (single-vendor) | Да (свой admin) |
| Скорость «API под наш UI» | Да | Средне | Медленно |

---

## 7. Итоговое решение

**Строим NestJS custom engine** в `apps/api`.

| Решение | Причина |
|---------|---------|
| Не Medusa сейчас | multi-vendor + наш admin = почти custom поверх Medusa; выигрыш меньше, сложность модели выше |
| Не Bagisto | ломает стратегию «сохранить UI-клон»; PHP-стек |
| NestJS | лучший баланс: безопасность, API, fit UI, документация, рост |

**Пересмотр, если:**
- команда только PHP → Bagisto + их admin;
- нужен production cart/checkout за 1 неделю и UI можно сменить → Medusa.

---

## 8. Связанные документы

- `ARCHITECTURE.md` — устройство выбранного движка  
- `apps/api/prisma/schema.prisma` — модель данных  
- `PROJECT_MAP.md` — где что лежит  
