# Mplace demo — Nest API + Next.js (same app as local :3002) behind one port
FROM node:22-bookworm-slim AS api-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci
COPY apps/api/ ./
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir prisma --module commonjs --esModuleInterop --skipLibCheck || true

FROM node:22-bookworm-slim AS web-build

WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=3001
ENV WEB_PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1
ENV SERVE_FRONTEND=false
ENV INTERNAL_API_URL=http://127.0.0.1:3001/api
ENV NEXT_PUBLIC_API_URL=/api

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- API runtime ---
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci --omit=dev \
  && npm install prisma@6.19.3 --no-save \
  && npm cache clean --force

COPY --from=api-build /app/apps/api/dist ./dist
COPY --from=api-build /app/apps/api/prisma ./prisma
COPY apps/api/scripts/set-product-photos.js ./scripts/set-product-photos.js
RUN npx prisma generate

# --- Next.js standalone ---
WORKDIR /app
COPY --from=web-build /app/.next/standalone ./web
COPY --from=web-build /app/.next/static ./web/.next/static
COPY --from=web-build /app/public ./web/public

COPY deploy/proxy.js ./deploy/proxy.js
COPY deploy/start-demo.sh ./deploy/start-demo.sh
RUN chmod +x /app/deploy/start-demo.sh \
  && chown -R node:node /app

USER node
WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --retries=5 --start-period=60s \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/deploy/start-demo.sh"]
