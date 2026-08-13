# Mplace — API image for docker-compose (PostgreSQL + Redis stack)
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

# Production image
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
# Optional entrypoint (migrate+start). Default CMD is app-only; compose uses migrate service.
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
  && npx prisma generate \
  && chown -R node:node /app

USER node
WORKDIR /app/apps/api

EXPOSE 3000

# Render / single-container: migrate then start.
# Compose can override CMD to skip entrypoint if needed.
ENTRYPOINT ["./docker-entrypoint.sh"]
