# Mplace — multi-vendor marketplace

Рабочая папка: `C:\Users\sasha\mplace`

## Запуск

```powershell
cd C:\Users\sasha\mplace\apps\api
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# второй терминал
cd C:\Users\sasha\mplace
py -m http.server 8080
```

- Витрина: http://127.0.0.1:8080/
- API health: http://127.0.0.1:3000/api/health

## Демо-логины (только development)

| Роль | Email | Password |
|------|-------|----------|
| Admin | superadmin@demo.com | 123456 |
| Merchant | merchant@demo.com | 123456 |
| Customer | customer@demo.com | 123456 |

## Платежи

| Окружение | Настройка |
|-----------|-----------|
| **Production** | `PAYMENT_PROVIDER=stripe`, `ALLOW_DEV_PAYMENTS=false` — см. `.env.production.example` |
| **Local** | `PAYMENT_PROVIDER=dev` + `ALLOW_DEV_PAYMENTS=true` + CLI-скрипт |

- `POST /orders/:id/pay` **удалён**.
- Guest token: только header **`X-Order-Access-Token`** (не query).
- Stripe webhook: подпись + **amount_received + currency + metadata.orderId**.
- UI: **Stripe Elements** в `cart.html` при `mode=stripe`.
- Dev-confirm: только `scripts/dev-confirm-payment.ps1` (секрет **не** во фронте).
- `assets/js/dev-config.js` **удалён**.

## Безопасность заказов

- Просмотр/оплата: владелец / merchant своего shop / admin / guest token.
- Остатки: atomic `Prisma.sql` (SQLite + PostgreSQL).
- Номер заказа: `MP-{time}-{hash}`.
- State machine + `OrderStatusHistory` + audit.

## Реальные API (не demo-data)

- Catalog, shops, orders, cart, checkout, payments
- Payouts / ledger / balance
- Tickets, disputes, refunds, audit
- Admin reports summary

Меню админки без фиктивных аддонов (themes/plugins и т.п. убраны из навигации).

## Тесты

```powershell
cd C:\Users\sasha\mplace\apps\api
npm test
# e2e (нужна мигрированная БД + seed):
npm run test:e2e
```

## Production checklist

См. `.env.production.example` и `docs/SECURITY_ORDERS_PAYMENTS.md`.

- [ ] PostgreSQL + migrations
- [ ] `PAYMENT_PROVIDER=stripe`, `ALLOW_DEV_PAYMENTS=false`
- [ ] Случайный `JWT_SECRET`, Stripe live/test keys
- [ ] HTTPS, CORS whitelist, Redis, backups
- [ ] Нет demo-паролей в UI
