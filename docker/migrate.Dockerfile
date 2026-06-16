# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------
# LocateFlow Migrate — One-shot container that runs `prisma migrate deploy`
# Depends on mysql becoming healthy. Exits 0 on success.
# -----------------------------------------------------------------

FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /workspace

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Only what prisma needs — keep the image small.
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/db/prisma packages/db/prisma
COPY patches patches

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @locateflow/db...

COPY packages/db ./packages/db

RUN pnpm --filter @locateflow/db exec prisma generate

# Default command runs migrations then the admin seed.
# Data seed (master) is intentionally NOT run in prod — operators decide.
# The admin seed is required because admin login depends on an AdminUser row.
CMD ["sh", "-lc", "pnpm --filter @locateflow/db exec prisma migrate deploy && pnpm --filter @locateflow/db exec tsx prisma/seed-admin.ts"]
