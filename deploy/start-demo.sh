#!/bin/bash
# Render single service: Nest API + Next.js (same UI as local :3002) + proxy.
set -euo pipefail

cd /app/apps/api

echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[entrypoint] SEED_ON_BOOT=true — prisma db seed..."
  npx prisma db seed || echo "[entrypoint] seed failed (non-fatal)"
fi

if [ "${PATCH_PRODUCT_PHOTOS:-true}" = "true" ] && [ -f ./scripts/set-product-photos.js ]; then
  echo "[entrypoint] patching catalog photos..."
  node ./scripts/set-product-photos.js || echo "[entrypoint] photo patch skipped"
fi

if [ "$#" -gt 0 ]; then
  echo "[entrypoint] exec $*"
  exec "$@"
fi

API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3002}"

echo "[entrypoint] Nest API on :${API_PORT}"
export SERVE_FRONTEND=false
unset FRONTEND_DIR || true
PORT="${API_PORT}" node dist/src/main.js &
API_PID=$!

echo "[entrypoint] Next.js on :${WEB_PORT}"
WEB_DIR=/app/web
if [ ! -f "${WEB_DIR}/server.js" ]; then
  FOUND=$(find /app/web -name server.js -type f | head -n 1)
  if [ -n "$FOUND" ]; then
    WEB_DIR=$(dirname "$FOUND")
  fi
fi
cd "$WEB_DIR"
PORT="${WEB_PORT}" HOSTNAME=0.0.0.0 node server.js &
WEB_PID=$!

echo "[entrypoint] waiting for API health..."
for _i in $(seq 1 45); do
  if curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null; then
    echo "[entrypoint] API is up"
    break
  fi
  sleep 1
done

echo "[entrypoint] public proxy on :${PORT:-3000}"
node /app/deploy/proxy.js &
PROXY_PID=$!

term() {
  echo "[entrypoint] stopping..."
  kill "$API_PID" "$WEB_PID" "$PROXY_PID" 2>/dev/null || true
}
trap term TERM INT

wait -n "$API_PID" "$WEB_PID" "$PROXY_PID" || true
echo "[entrypoint] a process exited"
term
wait || true
exit 1
