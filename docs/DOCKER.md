# Docker Compose — полный стек

## Команда

```powershell
cd C:\Users\sasha\mplace
# .env уже есть (или: copy .env.example .env)
docker compose up -d --build
```

## Сервисы

| Сервис | Контейнер | Порт на хосте (этот ПК) | Внутри сети Docker |
|--------|-----------|-------------------------|---------------------|
| nginx | mplace-nginx | **8088** → 80 | 80 |
| api | mplace-api | **3001** → 3000 | 3000 |
| postgres | mplace-postgres | 5432 | 5432 |
| redis | mplace-redis | 6379 | 6379 |

На этом компьютере порты **80** и **3000** уже заняты другими контейнерами (Caddy, open-webui), поэтому:

- сайт: **http://127.0.0.1:8088/**
- API: **http://127.0.0.1:8088/api/health** или **http://127.0.0.1:3001/api/health**

Если 80/3000 свободны — в `docker-compose.yml` можно вернуть `"80:80"` и `"3000:3000"`.

## Остановка

```powershell
docker compose down
# с данными БД:
docker compose down -v
```

## Примечания

- Prisma: **PostgreSQL** (`schema.prisma` provider = postgresql)
- Старт API: `prisma db push` + seed + Nest
- Фронт раздаёт **nginx**, API проксируется на `/api/`
