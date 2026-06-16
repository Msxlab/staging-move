# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------
# LocateFlow Admin — Production image (Next.js standalone)
# -----------------------------------------------------------------

FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json                 apps/web/package.json
COPY apps/admin/package.json               apps/admin/package.json
COPY apps/mobile/package.json              apps/mobile/package.json
COPY packages/db/package.json              packages/db/package.json
COPY packages/shared/package.json          packages/shared/package.json
COPY packages/connectors/package.json      packages/connectors/package.json
COPY packages/db/prisma                    packages/db/prisma
COPY patches                               patches

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# BUILD_PHASE=true tells startup-time validators that this is a build
# container so they skip the strict production secret check. The runtime
# image below does not set BUILD_PHASE — it must be started with real
# secrets in the environment, or the runtime validator throws on the
# first request.
ENV BUILD_PHASE=true

ARG NEXT_PUBLIC_APP_URL=https://locateflow.com
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
ARG NEXT_PUBLIC_SITE_URL=https://locateflow.com
ARG SITE_URL=https://locateflow.com
ARG APP_ENV=production

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV SITE_URL=$SITE_URL
ENV APP_ENV=$APP_ENV

# IMPORTANT: secrets MUST NOT be baked into image layers via ENV.
# Real values for ADMIN_JWT_SECRET / USER_JWT_SECRET /
# FIELD_ENCRYPTION_KEY / CRON_SECRET / etc. are supplied to the runtime
# container via Docker compose env_file or the platform's secret manager.

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /workspace/node_modules                       ./node_modules
COPY --from=deps /workspace/apps/admin/node_modules            ./apps/admin/node_modules
COPY --from=deps /workspace/packages/db/node_modules           ./packages/db/node_modules
COPY --from=deps /workspace/packages/shared/node_modules       ./packages/shared/node_modules
COPY --from=deps /workspace/packages/connectors/node_modules   ./packages/connectors/node_modules

COPY . .

RUN pnpm --filter @locateflow/db exec prisma generate \
 && pnpm --filter @locateflow/admin build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV APP_ENV=production
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com
ENV NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
ENV NEXT_PUBLIC_SITE_URL=https://locateflow.com
ENV SITE_URL=https://locateflow.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
# BUILD_PHASE intentionally unset at runtime — runtime validators run
# in strict mode and the container refuses traffic until real secrets
# are present in the environment.

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget default-mysql-client \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/admin/.next/static     ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/admin/public           ./apps/admin/public

USER nextjs

EXPOSE 3001

# Healthcheck targets a public liveness endpoint. Authenticated operational
# endpoints such as /api/auth/me stay protected and are unsuitable for Docker
# health probes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3001/api/healthz || exit 1

CMD ["node", "apps/admin/server.js"]
