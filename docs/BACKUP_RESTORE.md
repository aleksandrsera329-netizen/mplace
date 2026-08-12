# Бэкап и восстановление

> **PostgreSQL backup / restore (Stage 28):** see **[BACKUP.md](./BACKUP.md)**  
> Scripts: `scripts/backup-db.*`, `scripts/restore-db.*`, `scripts/verify-backup-restore.ps1`

## Бэкап «до нефтегаза» (общий маркетплейс)

| | |
|--|--|
| Папка | `C:\Users\sasha\mplace-backups\mplace-pre-oilgas-20260728-1631` |
| ZIP | `C:\Users\sasha\mplace-backups\mplace-pre-oilgas-20260728-1631.zip` |
| Инструкция | `C:\Users\sasha\mplace-backups\RESTORE.md` |

## Новый бэкап (текущая версия)

После важных изменений:

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
$dest = "C:\Users\sasha\mplace-backups\mplace-$ts"
robocopy C:\Users\sasha\mplace $dest /E /XD node_modules dist .git /NFL /NDL /NJH /NJS
Compress-Archive -Path $dest -DestinationPath "$dest.zip"
```

## Восстановление коротко

1. Остановить API  
2. Заменить папку `C:\Users\sasha\mplace` из бэкапа  
3. `cd apps\api` → `npm ci` → `npx prisma generate` → `npx prisma migrate deploy` → `npx prisma db seed` → `npm run build`
