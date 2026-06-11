# syntax=docker/dockerfile:1.7
# LocateFlow web app image for DigitalOcean App Platform.
# Uses Next.js standalone output from apps/web.

FROM node:22-bookworm-slim AS pnpm-base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

WORKDIR /workspace

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl wget \
 && rm -rf /var/lib/apt/lists/*

RUN npm config set registry "$NPM_CONFIG_REGISTRY" \
 && npm config set fetch-retries "$NPM_CONFIG_FETCH_RETRIES" \
 && npm config set fetch-retry-factor "$NPM_CONFIG_FETCH_RETRY_FACTOR" \
 && npm config set fetch-retry-mintimeout "$NPM_CONFIG_FETCH_RETRY_MINTIMEOUT" \
 && npm config set fetch-retry-maxtimeout "$NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT" \
 && for attempt in 1 2 3 4 5; do \
      if npm install -g pnpm@9.15.0; then break; fi; \
      if [ "$attempt" = "5" ]; then exit 1; fi; \
      sleep "$((attempt * 10))"; \
    done \
 && pnpm --version | grep -Fx "9.15.0"

FROM pnpm-base AS deps

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches patches

RUN pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile --ignore-scripts \
 && mkdir -p \
      apps/web/node_modules \
      apps/admin/node_modules \
      apps/mobile/node_modules \
      packages/db/node_modules \
      packages/shared/node_modules

FROM pnpm-base AS builder

ENV NODE_ENV=production

ARG NEXT_PUBLIC_APP_URL=https://locateflow.com
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
ARG NEXT_PUBLIC_SITE_URL=https://locateflow.com
ARG SITE_URL=https://locateflow.com
ARG APP_ENV=production
ARG NEXT_PUBLIC_IMGPROXY_URL=
ARG R2_BUCKET=

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    SITE_URL=$SITE_URL \
    APP_ENV=$APP_ENV \
    NEXT_PUBLIC_IMGPROXY_URL=$NEXT_PUBLIC_IMGPROXY_URL \
    R2_BUCKET=$R2_BUCKET

COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /workspace/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

RUN pnpm --filter @locateflow/db generate \
 && pnpm --filter @locateflow/web build \
 && test -f apps/web/.next/standalone/apps/web/server.js \
 && test -d apps/web/.next/static \
 && test -d apps/web/public

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    APP_ENV=production \
    NEXT_PUBLIC_APP_URL=https://locateflow.com \
    NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com \
    NEXT_PUBLIC_SITE_URL=https://locateflow.com \
    SITE_URL=https://locateflow.com \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl wget \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@5.22.0 \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/src ./packages/db/src
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/src ./packages/shared/src
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/package.json ./node_modules/@locateflow/shared/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/src ./node_modules/@locateflow/shared/src

USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/api/health" || exit 1

CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL:-$MYSQL_DATABASE_URL}\"; if [ -z \"$DATABASE_URL\" ]; then echo 'DATABASE_URL or MYSQL_DATABASE_URL is required'; exit 1; fi; prisma migrate deploy --schema packages/db/prisma/schema.prisma && exec node apps/web/server.js"]
