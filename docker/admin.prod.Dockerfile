# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------
# LocateFlow Admin — Production image (Next.js standalone)
# -----------------------------------------------------------------

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

FROM node:25-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV ADMIN_JWT_SECRET=build_time_admin_secret_32_chars_minimum
ENV USER_JWT_SECRET=build_time_user_secret_32_chars_minimum
ENV FIELD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
ENV CRON_SECRET=build_time_cron_secret_32_chars_minimum
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /workspace/node_modules                       ./node_modules
COPY --from=deps /workspace/apps/admin/node_modules            ./apps/admin/node_modules
COPY --from=deps /workspace/packages/db/node_modules           ./packages/db/node_modules
COPY --from=deps /workspace/packages/shared/node_modules       ./packages/shared/node_modules

COPY . .

RUN pnpm --filter @locateflow/db exec prisma generate \
 && pnpm --filter @locateflow/admin build

FROM node:25-bookworm-slim AS runner
ENV NODE_ENV=production
ENV APP_ENV=production
ENV NEXT_PUBLIC_APP_URL=https://locateflow.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/admin/.next/static     ./apps/admin/.next/static

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3001/login || exit 1

CMD ["node", "apps/admin/server.js"]
