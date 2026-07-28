# Mplace — single free-tier container (API + static storefront)
FROM node:22-bookworm-slim AS build

WORKDIR /app

# API deps + build
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci
COPY apps/api/ ./
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir prisma --module commonjs --esModuleInterop --skipLibCheck || true

# Production image
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

# Production deps + prisma CLI (needed for migrate/seed at container start)
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci --omit=dev \
  && npm install prisma@6.19.3 --no-save \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/node_modules/@prisma ./node_modules/@prisma

# Storefront (static)
WORKDIR /app
COPY index.html login.html cart.html ./frontend/
COPY admin ./frontend/admin
COPY merchant ./frontend/merchant
COPY assets ./frontend/assets

# SQLite data dir (ephemeral on free tier unless disk attached)
RUN mkdir -p /data && chown -R node:node /data /app

ENV DATABASE_URL=file:/data/mplace.db
ENV FRONTEND_DIR=/app/frontend
ENV PAYMENT_PROVIDER=dev
ENV ALLOW_DEV_PAYMENTS=false

USER node
WORKDIR /app/apps/api

EXPOSE 10000

# migrate + seed + start
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || true) && node dist/src/main.js"]
