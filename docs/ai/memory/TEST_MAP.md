# Test Map

Updated: 2026-06-15

## Test Inventory

Discovered test/spec files: 432.

Major coverage areas by file inventory:

- Web middleware/auth/account/password/OAuth/MFA/session.
- Web API routes for workspaces, addresses, services, Stripe, webhooks, cron, exports, providers, notifications, tickets, movers, maps, consent, locale.
- Web libs for rate limits, runtime config, billing, IAP, security events/alerts, soft delete, provider matching, recommendations, connectors, email, legal, analytics, PDFs.
- Admin middleware/auth/MFA/sessions/permissions/step-up.
- Admin API routes for backups, users, subscriptions, providers, connectors, runtime config, security, logs, settings, tickets, blog, movers.
- Admin libs for backups, hard delete, SSRF guard, logo fetching, audit, alerts, email sanitization, CSV safety, storage, pagination.
- Mobile auth/API/OAuth/IAP/app-lock/release-config/offline-cache/subscription/UX helper tests.
- Shared package tests for permissions, entitlement, billing, runtime config, encryption, trusted client IP, provider integrity/coverage, migration engine.
- Connector framework tests for retry, circuit breaker, dispatcher, executor, HTTP client, OAuth, manifest, registry, USPS.
- E2E tests under `apps/web/tests/e2e`.

## CI Workflows

`.github/workflows/ci.yml` includes:

- Lint and type check:
  - install with frozen lockfile;
  - web TypeScript;
  - admin TypeScript;
  - mobile lint;
  - Prisma validate with placeholder DB URL.
- Security:
  - production dependency audit at high severity;
  - gitleaks scan.
- Tests:
  - web tests;
  - admin tests;
  - mobile tests.
- Production migrate:
  - gated on lint/typecheck, tests, and security;
  - main push only;
  - runs Prisma migrate deploy with secret `DATABASE_URL`.
- Provider guards.
- Playwright E2E on main pushes.

`.github/workflows/cron.yml` includes scheduled production cron invocations and an uptime-check backstop.

## Tests Not Run in This Audit

No local checks were run because the user requested inspection first and required approval before lint/typecheck/test commands.

Not run:

- `pnpm install`
- `pnpm lint`
- `pnpm verify:typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm --filter @locateflow/web test`
- `pnpm --filter @locateflow/admin test`
- `pnpm --filter @locateflow/mobile test`
- Playwright
- Prisma commands

## Recommended Targeted Verification After Review

- Typecheck: web/admin/mobile.
- Unit tests for areas touched by any fixes.
- Backup SQL dump route test after filename hardening.
- Middleware/cron tests for partner-consent legacy route decision.
- Deployment smoke that confirms app startup no longer runs migrations once fixed.
- Mobile OAuth/IAP tests before mobile release.
