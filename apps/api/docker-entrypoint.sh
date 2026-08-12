#!/bin/sh
# Optional one-container entrypoint: migrate then start API.
# Preferred production path: separate `migrate` compose service + CMD node only.
set -e

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting application..."
exec node dist/src/main.js
