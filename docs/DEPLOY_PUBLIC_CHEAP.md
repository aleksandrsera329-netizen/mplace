# Публичный деплой дёшево: Neon + Render + Vercel + sana.tmweb.ru

Цель: покупатели открывают **https://sana.tmweb.ru**

```
Браузер → Vercel (Next.js) → Render (Nest API) → Neon (PostgreSQL)
```

`ALLOW_PILOT=true` на API разрешает production **без** Stripe/Redis/Meili (только JWT + DATABASE_URL).  
Для реальных денег потом выключить pilot и включить Stripe.

---

## 0. Подготовка

- Код в GitHub: `https://github.com/aleksandrsera329-netizen/mplace`
- Аккаунты: [neon.tech](https://neon.tech) · [render.com](https://render.com) · [vercel.com](https://vercel.com) · панель Timeweb

---

## 1. Neon (база) — 2 минуты

1. https://console.neon.tech → **Sign up** (GitHub)
2. **New Project** → имя `mplace` → region EU (Frankfurt) если есть
3. **Connection string** → скопировать  
   `postgresql://...@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`  
4. Сохранить в блокнот как `DATABASE_URL`

---

## 2. Render (API) — 5 минут

1. https://dashboard.render.com → **Sign up** (GitHub)
2. **New → Blueprint** → repo `mplace` → Apply `render.yaml`  
   **или** **New → Web Service** → Docker, root `Dockerfile`
3. Environment:
   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | строка из Neon |
   | `ALLOW_PILOT` | `true` |
   | `PAYMENT_PROVIDER` | `dev` |
   | `ALLOW_DEV_PAYMENTS` | `true` |
   | `JWT_SECRET` | Generate / длинная строка 32+ |
   | `CORS_ORIGINS` | `https://sana.tmweb.ru,https://ВАШ.vercel.app` |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
4. **Deploy**
5. Дождаться URL: `https://mplace-api-xxxx.onrender.com`
6. Проверка: `https://mplace-api-xxxx.onrender.com/api/health` → `{"status":"ok"...}`

### Миграции (один раз)

В Render → Shell **или** локально:

```powershell
cd C:\Users\sasha\mplace\apps\api
$env:DATABASE_URL="postgresql://...neon..."
npx prisma migrate deploy
# опционально демо-данные:
# npx prisma db seed
```

Если entrypoint Docker уже делает `migrate deploy` — Shell не нужен.

---

## 3. Vercel (сайт) — 5 минут

1. https://vercel.com → **Sign up** (GitHub)
2. **Add New Project** → `mplace`
3. **Root Directory** → `apps/web`  
4. Environment Variables:
   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_API_URL` | `https://mplace-api-xxxx.onrender.com/api` |
5. **Deploy**
6. URL вида `https://mplace-xxx.vercel.app`

Проверка: открыть сайт → каталог грузится (товары с API).

---

## 4. Домен Timeweb: sana.tmweb.ru

### В Vercel

1. Project → **Settings → Domains**
2. Add: `sana.tmweb.ru`
3. Vercel покажет DNS (обычно CNAME → `cname.vercel-dns.com`)

### В Timeweb (https://hosting.timeweb.ru/domains)

1. Домен **sana.tmweb.ru** → **DNS / Управление зоной**
2. Добавить запись:
   - **Тип:** `CNAME`
   - **Имя:** `@` или `sana` (как просит панель для поддомена)
   - **Значение:** `cname.vercel-dns.com` (точно как в Vercel)
3. Подождать 5–60 минут
4. В Vercel домен станет **Valid**

### CORS на Render

Обновить:

```text
CORS_ORIGINS=https://sana.tmweb.ru,https://www.sana.tmweb.ru,https://mplace-xxx.vercel.app
```

Redeploy API.

---

## 5. Smoke-тест

| URL | Ожидание |
|-----|----------|
| `https://sana.tmweb.ru` | Витрина |
| `https://...onrender.com/api/health` | ok |
| Войти `customer@demo.com` | после seed |
| Корзина / checkout | работает (dev payments) |

**Cold start Render free:** первый запрос после сна ~30–60 сек.

---

## 6. Стоимость

| Сервис | Старт |
|--------|--------|
| Neon | $0 free |
| Vercel | $0 hobby |
| Render free | $0 (sleep) |
| Домен Timeweb | уже есть |
| **Итого** | **~$0** |

Позже: Render Starter ~$7/мес если не хотите sleep.

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| CORS error | `CORS_ORIGINS` включает точный origin сайта |
| Empty catalog | `NEXT_PUBLIC_API_URL` с `/api` на конце; API health ok |
| API crash on boot | `ALLOW_PILOT=true` + `DATABASE_URL` Neon; JWT 32+ |
| Domain not working | DNS CNAME; SSL на Vercel pending → wait |
