#!/usr/bin/env bash
# Compatibility wrapper for the cross-platform Prisma-based diagnostic.
# Prefer: pnpm email:diagnose -- --days=30 --recent=50
set -euo pipefail

pnpm exec tsx scripts/diagnose-email-pipeline.ts "$@"
