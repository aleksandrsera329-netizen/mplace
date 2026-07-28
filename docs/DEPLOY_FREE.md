# Бесплатный сервер для Mplace

## Рекомендация: **Render.com Free**

| | |
|--|--|
| Цена | **$0** |
| Карта | Обычно **не нужна** |
| HTTPS | Да |
| URL | `https://mplace-xxxx.onrender.com` |
| Минус | Засыпает через ~15 мин простоя (холодный старт ~30–60 сек) |
| Данные | SQLite в контейнере — **сбрасываются** при redeploy (для демо ок) |

Альтернативы:

| Площадка | Бесплатно? | Примечание |
|----------|------------|------------|
| **Render** | Да | Лучший старт для Node без карты |
| **Oracle Cloud Always Free** | Да (навсегда VM) | Нужна регистрация + своя настройка Linux |
| **Railway** | Кредиты/trial | Часто нужна карта |
| **Fly.io** | Нет free для новых | Pay-as-you-go |

---

## Деплой на Render (5–10 минут)

### 1. Код уже в GitHub
Репозиторий: (создаётся скриптом / вручную)

### 2. Render
1. Зайдите: https://render.com/  
2. **Sign up** через GitHub  
3. **New → Blueprint**  
4. Выберите репозиторий `mplace`  
5. Подтвердите `render.yaml`  
6. Deploy  

Или **New → Web Service → Docker** из репо, root = `.`

### 3. После деплоя
- Откройте URL сервиса  
- Первый запрос может идти **до минуты** (cold start)  
- Логины seed (только для демо):  
  - `superadmin@demo.com` / `123456`  
  - `merchant@demo.com` / `123456`  

### 4. Env (уже в blueprint)
- `JWT_SECRET` — генерируется  
- `ALLOW_DEV_PAYMENTS=false`  
- `PAYMENT_PROVIDER=dev` (для демо без Stripe)  
- Для Stripe: в Dashboard → Environment добавьте ключи  

### 5. CORS
Если фронт и API на одном URL — CORS не критичен.  
Если разделите — укажите `CORS_ORIGINS=https://ваш-url.onrender.com`

---

## Oracle Always Free (настоящий «сервак»)

Если нужен VPS 24/7 бесплатно:
1. https://www.oracle.com/cloud/free/  
2. Создать VM Ampere A1 (ARM) или x86  
3. Установить Docker, скопировать проект, `docker compose up`  

Сложнее, но без cold start.

---

## Локальный Docker (проверка образа)

```powershell
cd C:\Users\sasha\mplace
docker build -t mplace .
docker run --rm -p 10000:10000 -e JWT_SECRET=local_test_secret_32chars_min mplace
```

Открыть: http://127.0.0.1:10000/
