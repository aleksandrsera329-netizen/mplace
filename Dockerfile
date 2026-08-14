# Mplace — API + static storefront (Render Starter single service)
FROM node:22-bookworm-slim AS build

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

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /app/apps/api
RUN npm ci --omit=dev \
  && npm install prisma@6.19.3 --no-save \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
  && npx prisma generate \
  && chown -R node:node /app

# Public demo storefront (static HTML)
WORKDIR /app
COPY index.html login.html cart.html product.html checkout.html account.html \
  orders.html order.html wishlist.html rfq.html rfqs.html rfq-create.html \
  rfq-offer.html request-demo.html merchant.html merchant-orders.html \
  merchant-products.html \
  telderi26cbc82300252d53c5d2f2a264e9d799.txt ./frontend/
COPY admin ./frontend/admin
COPY merchant ./frontend/merchant
COPY assets ./frontend/assets
RUN chown -R node:node /app/frontend

ENV FRONTEND_DIR=/app/frontend
ENV SERVE_FRONTEND=true

USER node
WORKDIR /app/apps/api

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
