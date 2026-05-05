# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------
# LocateFlow Web — Production image (Next.js standalone)
# Multi-stage: deps → builder → runner
# -----------------------------------------------------------------

# ── 1) deps: install pnpm + deps only (cached) ────────────────────
FROM node:25-bookworm-slim AS deps
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

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── 2) builder: generate prisma client + next build ───────────────
FROM node:25-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV USER_JWT_SECRET=build_time_user_secret_32_chars_minimum
ENV ADMIN_JWT_SECRET=build_time_admin_secret_32_chars_minimum
ENV FIELD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
ENV CRON_SECRET=build_time_cron_secret_32_chars_minimum
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com
ENV NEXT_PUBLIC_SITE_URL=https://locateflow.com
ENV SITE_URL=https://locateflow.com
ENV APP_ENV=production
ENV R2_BUCKET=locateflow
ENV IMGPROXY_KEY=0000000000000000000000000000000000000000000000000000000000000000
ENV IMGPROXY_SALT=0000000000000000000000000000000000000000000000000000000000000000
ENV NEXT_PUBLIC_IMGPROXY_URL=https://img.locateflow.com

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /workspace/node_modules                       ./node_modules
COPY --from=deps /workspace/apps/web/node_modules              ./apps/web/node_modules
COPY --from=deps /workspace/packages/db/node_modules           ./packages/db/node_modules
COPY --from=deps /workspace/packages/shared/node_modules       ./packages/shared/node_modules

COPY . .

RUN pnpm --filter @locateflow/db exec prisma generate \
 && pnpm --filter @locateflow/web build

# ── 3) runner: minimal image with standalone output ───────────────
FROM node:25-bookworm-slim AS runner
ENV NODE_ENV=production
ENV APP_ENV=production
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com
ENV NEXT_PUBLIC_SITE_URL=https://locateflow.com
ENV SITE_URL=https://locateflow.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

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

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
