#!/bin/sh
# Optional one-container entrypoint: migrate then start API.
# Preferred production path: separate `migrate` compose service + CMD node only.
set -e

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[entrypoint] SEED_ON_BOOT=true — running prisma db seed..."
  npx prisma db seed || echo "[entrypoint] seed failed (non-fatal)"
fi

echo "[entrypoint] Starting application..."
exec node dist/src/main.js
