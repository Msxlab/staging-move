# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------
# LocateFlow Web — Production image (Next.js standalone)
# Multi-stage: deps → builder → runner
# -----------------------------------------------------------------

# ── 1) deps: install pnpm + deps only (cached) ────────────────────
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

# ── 2) builder: generate prisma client + next build ───────────────
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# BUILD_PHASE=true tells `next build` and any startup-time validators
# that this is a build container — not a runtime container — so the
# strict secret/runtime-config gate (apps/web/src/lib/internal-secrets.ts
# etc.) skips the production-required check. The runtime image below
# does NOT set BUILD_PHASE, so it must be supplied with the real
# secrets at container start (via Docker compose env_file or platform
# secret manager) or the runtime validator throws on first request.
ENV BUILD_PHASE=true

ARG NEXT_PUBLIC_APP_URL=https://locateflow.com
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
ARG NEXT_PUBLIC_SITE_URL=https://locateflow.com
ARG SITE_URL=https://locateflow.com
ARG APP_ENV=production
ARG NEXT_PUBLIC_IMGPROXY_URL=https://img.locateflow.com

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV SITE_URL=$SITE_URL
ENV APP_ENV=$APP_ENV
ENV NEXT_PUBLIC_IMGPROXY_URL=$NEXT_PUBLIC_IMGPROXY_URL

# IMPORTANT: secrets MUST NOT be baked into image layers via ENV.
# - USER_JWT_SECRET, ADMIN_JWT_SECRET, FIELD_ENCRYPTION_KEY, CRON_SECRET,
#   IMGPROXY_KEY, IMGPROXY_SALT, R2_*, STRIPE_*, RESEND_API_KEY, etc.
#   are read from the runtime environment (compose `env_file` or the
#   platform's secret manager).
# - During build, `next build` does not need real production secrets —
#   `BUILD_PHASE=true` is honored by validators and the build proceeds
#   with placeholder logic. Any new code path that requires a secret
#   at build time must guard on `process.env.BUILD_PHASE === "true"`.

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /workspace/node_modules                       ./node_modules
COPY --from=deps /workspace/apps/web/node_modules              ./apps/web/node_modules
COPY --from=deps /workspace/packages/db/node_modules           ./packages/db/node_modules
COPY --from=deps /workspace/packages/shared/node_modules       ./packages/shared/node_modules
COPY --from=deps /workspace/packages/connectors/node_modules   ./packages/connectors/node_modules

COPY . .

RUN pnpm --filter @locateflow/db exec prisma generate \
 && pnpm --filter @locateflow/web build

# ── 3) runner: minimal image with standalone output ───────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV APP_ENV=production
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com
ENV NEXT_PUBLIC_SITE_URL=https://locateflow.com
ENV SITE_URL=https://locateflow.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# BUILD_PHASE is intentionally unset at runtime so the secret/runtime-
# config validators run in strict mode. The container will refuse to
# serve traffic until the real secrets are present in the environment.

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output bundles its own node_modules.
# The top-level .next/standalone contains a self-contained server.js
# that expects the monorepo root as the working directory.
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public           ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/package.json  ./packages/db/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/prisma        ./packages/db/prisma
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/db/src           ./packages/db/src
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/src       ./packages/shared/src
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/package.json ./node_modules/@locateflow/shared/package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/packages/shared/src       ./node_modules/@locateflow/shared/src

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
