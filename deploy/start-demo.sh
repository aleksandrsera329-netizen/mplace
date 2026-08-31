#!/bin/bash
# Render single service: Nest API + Next.js (same UI as local :3002) + proxy.
set -eu

# Neon from Render often fails on AAAA; force IPv4.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first"

if [ -n "${DATABASE_URL:-}" ]; then
  url="$DATABASE_URL"
  case "$url" in
    *\?*) sep='&' ;;
    *) sep='?' ;;
  esac
  case "$url" in
    *sslmode=*) ;;
    *) url="${url}${sep}sslmode=require"; sep='&' ;;
  esac
  case "$url" in
    *connect_timeout=*) ;;
    *) url="${url}${sep}connect_timeout=15"; sep='&' ;;
  esac
  case "$url" in
    *pooler*)
      case "$url" in
        *pgbouncer=*) ;;
        *) url="${url}${sep}pgbouncer=true&connection_limit=1" ;;
      esac
      ;;
  esac
  export DATABASE_URL="$url"
fi

cd /app/apps/api

echo "[entrypoint] prisma migrate deploy..."
migrate_ok=0
for i in 1 2 3 4 5 6; do
  if npx prisma migrate deploy; then
    migrate_ok=1
    break
  fi
  echo "[entrypoint] migrate retry $i"
  sleep $((i * 3))
done
if [ "$migrate_ok" != "1" ]; then
  echo "[entrypoint] migrate failed — API will serve fallback catalog"
fi

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[entrypoint] SEED_ON_BOOT=true — prisma db seed..."
  npx prisma db seed || echo "[entrypoint] seed failed (non-fatal)"
elif [ "$migrate_ok" = "1" ] && [ -f ./prisma/seed.js ]; then
  count="$(node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.product.count().then(n=>{console.log(n); return p.\$disconnect();}).catch(()=>{console.log(-1); process.exit(0);})" || echo -1)"
  if [ "$count" = "0" ]; then
    echo "[entrypoint] catalog empty — seeding..."
    node ./prisma/seed.js || echo "[entrypoint] seed failed (non-fatal)"
  fi
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
  FOUND=$(find /app/web -name server.js -type f 2>/dev/null | head -n 1 || true)
  if [ -n "${FOUND:-}" ]; then
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
