# LocateFlow Merged Audit Report

Generated: 2026-04-18

This report merges the provider/recommendation remediation work with a repo-level audit of the current source-of-truth chains, security posture, runtime config flow, and release-readiness signals.

## 1. Scorecard

| Area | Score / 10 | Notes |
| --- | --- | --- |
| Provider data integrity | 8.8 | Duplicate slug/name/category collisions were removed and guarded. |
| Recommendation correctness | 8.1 | ZIP/state tiering bug fixed, but seed coverage is still state-heavy. |
| Auth and permission model | 8.3 | Web and admin both use DB-tracked JWT sessions plus route-level checks. |
| Billing and runtime config | 8.0 | Shared billing/runtime definitions are centralized; deploy docs were missing some managed-key guidance. |
| Backup/export/security controls | 8.2 | Step-up auth, encryption, CSRF, rate limits, audit logs, and backup signing exist. |
| Accessibility and UX readiness | 6.7 | No dedicated a11y test suite or explicit keyboard/focus regression coverage found. |
| Documentation and release readiness | 7.4 | Deploy guidance is strong but had runtime-config drift; partially corrected. |
| Overall | 8.0 | Core architecture is coherent; remaining risk is mostly data precision and release hardening. |

## 2. System Summary

- `packages/shared` is the main source-of-truth for billing plans, legal documents, runtime-config definitions, recommendation logic, provider integrity rules, and coverage helpers.
- `packages/db` is the persistence/source-of-truth layer for Prisma models, seed orchestration, and coverage rebuild logic.
- `apps/web` is the primary end-user runtime: auth, providers, recommendations, notifications, export, and moving flows.
- `apps/admin` is the mutation/control-plane runtime: provider CRUD/import, runtime-config management, backups, subscriptions, notifications, and security tooling.
- `apps/mobile` is mostly a consumer of shared logic and web APIs, with local wrappers for auth/settings UX.

## 3. Severity Findings

### Resolved in this remediation

- High: provider seed had duplicate slugs, duplicate normalized names, and cross-category copies that created ambiguous recommendation inputs.
  Evidence:
  `packages/db/prisma/seed-data/providers.ts`
  `packages/shared/src/provider-integrity.ts`
  `scripts/audit-provider-seed.ts`
- High: ZIP exact matches previously caused broader state/federal providers to disappear from recommendation/listing results.
  Evidence:
  `apps/web/src/lib/provider-matching.ts`
  `apps/web/src/lib/provider-matching.test.ts`
- Medium: admin session hijack alerts were reading `payload.sub` instead of the real `payload.adminId`, which could drop actor attribution in security events.
  Evidence:
  `apps/admin/src/middleware.ts`
- Medium: recommendation engine imports in web/admin were bypassing the package export surface and reading shared code by direct file path.
  Evidence:
  `apps/web/src/lib/recommendation-engine.ts`
  `apps/admin/src/lib/recommendation-engine.ts`
- Medium: mobile shared export surface was missing `provider-coverage`, creating source-of-truth drift versus the web/server shared entrypoint.
  Evidence:
  `packages/shared/src/index.mobile.ts`
- Medium: deploy documentation did not explain managed runtime-config storage/fallbacks or optional offsite backup keys.
  Evidence:
  `README.deploy.md`
  `packages/shared/src/runtime-config.ts`
  `apps/admin/src/app/api/runtime-config/route.ts`

### Remaining verified findings

- Medium: provider seed no longer has duplicate slug/name collisions, but shared-domain cross-category overlap remains at 30 clusters.
  Evidence:
  `docs/generated/provider-seed-audit.md`
- Medium: provider coverage data currently has `0` exact ZIP rules and `0` ZIP prefix rules, so the engine is still mostly state-tiered in production data.
  Evidence:
  `docs/generated/provider-seed-audit.md`
  `scripts/audit-provider-coverage.ts`
- Medium: accessibility coverage is manual only; no dedicated a11y automation or keyboard/focus regression suite was found in the repo.
  Evidence:
  `apps/web/package.json`
  `apps/admin/package.json`
  no Playwright/a11y-specific assertions located for settings/providers/admin critical flows
- Low: deploy/docs drift risk remains whenever new runtime-config keys are added because the authoritative catalog is code-driven, not docs-driven.
  Evidence:
  `packages/shared/src/runtime-config.ts`
  `README.deploy.md`

## 4. Connection Verification Matrix

### Auth -> permission -> protected UI

- Web:
  `apps/web/src/app/api/auth/login/route.ts`
  -> `apps/web/src/lib/user-auth.ts`
  -> `packages/db/prisma/schema.prisma` (`User`, `UserLoginSession`)
  -> `apps/web/src/middleware.ts`
- Admin:
  `apps/admin/src/app/api/auth/login/route.ts`
  -> `apps/admin/src/lib/auth.ts`
  -> `packages/db/prisma/schema.prisma` (`AdminUser`, `AdminSession`, `AdminAuditLog`)
  -> `apps/admin/src/middleware.ts`

### Billing/webhook -> subscription

- Shared billing definition:
  `packages/shared/src/billing.ts`
- Web billing runtime mapping:
  `apps/web/src/lib/billing.ts`
- Persistence:
  `packages/db/prisma/schema.prisma` (`Subscription`)
- Admin visibility:
  `apps/admin/src/lib/shared-billing.ts`
  `apps/admin/src/app/api/subscriptions/route.ts`

### Runtime-config -> consumer

- Definition catalog:
  `packages/shared/src/runtime-config.ts`
- Admin write/read plane:
  `apps/admin/src/lib/runtime-config.ts`
  `apps/admin/src/app/api/runtime-config/route.ts`
  `apps/admin/src/app/(admin)/runtime-config/page.tsx`
- Web consumer:
  `apps/web/src/lib/runtime-config.ts`
- Admin consumer:
  `apps/admin/src/lib/runtime-config.ts`

### Provider/recommendation -> API -> UI

- Seed source:
  `packages/db/prisma/seed-data/providers.ts`
- Seed sanitation:
  `packages/shared/src/provider-integrity.ts`
  `packages/db/prisma/seed-master.ts`
- Coverage generation:
  `packages/shared/src/provider-coverage.ts`
  `packages/db/src/provider-coverage.ts`
- Listing/recommendation APIs:
  `apps/web/src/app/api/providers/route.ts`
  `apps/web/src/app/api/providers/recommendations/route.ts`
- Matching/scoring:
  `apps/web/src/lib/provider-matching.ts`
  `packages/shared/src/recommendation-engine.ts`
- UI consumers:
  `apps/web/src/hooks/use-providers.ts`
  `apps/web/src/app/(app)/providers/providers-client.tsx`
  `apps/mobile/src/hooks/use-providers.ts`
  `apps/mobile/src/components/provider/RecommendedRow.tsx`

### Export/support/backup flows

- User export:
  `apps/web/src/app/api/export/route.ts`
- Notifications:
  `apps/web/src/lib/notifications.ts`
  `apps/web/src/app/api/notifications/route.ts`
- Admin backup:
  `apps/admin/src/app/api/backup/route.ts`
  `apps/admin/src/lib/backup-archive.ts`
  `apps/admin/src/lib/backup-storage.ts`

## 5. Logical Assessment

- The repo now has a coherent provider source-of-truth chain. Seed data is sanitized before persistence, admin mutations are checked against semantic conflicts, and web recommendation/listing flows consume tiered provider data consistently.
- The recommendation engine itself is centralized in `packages/shared`, which is the correct direction. The remaining gap is not algorithm shape but data granularity: state-level coverage dominates, so ZIP precision is structurally limited until richer coverage rows are added.
- Auth architecture is stronger than average for a small monorepo: DB-tracked sessions, route-level authorization, step-up password confirmation for sensitive admin actions, CSRF checks, and rate limits are all present.
- Runtime config is also well-shaped architecturally: definitions are centralized, secrets are masked, admin overrides are encrypted, and DB entries can safely fall back to env. The main risk there was documentation drift, not code design.
- Backup/export/security controls are materially present, including AES-GCM backup encryption, backup signing, audit logs, offsite upload support, and sensitive-field masking in export.

## 6. Backlog

### Next high-value engineering slice

- Add real ZIP exact/prefix coverage rows for priority categories instead of relying almost entirely on state-level matching.
- Define an allowlist/threshold model for acceptable shared-domain cross-category providers so `audit-provider-seed` can fail CI only on risky collisions.
- Add recommendation integration tests that exercise full route behavior for `exact`, `prefix`, and `state` coverage tiers.
- Add a small admin security regression test for session hijack event attribution.

### Quality and release hardening

- Add automated a11y checks for web/admin critical pages:
  sign-in, settings, providers, runtime-config, backups
- Add CI commands for:
  `pnpm verify:provider-guards`
  admin typecheck
  mobile typecheck
  recommendation smoke coverage
- Keep deploy docs synchronized with `packages/shared/src/runtime-config.ts` whenever new managed keys are introduced.

### Product/data backlog

- Review the remaining 30 cross-category shared-domain clusters and classify them as:
  acceptable multi-product family
  needs taxonomy split
  needs copy/explanation change
- Expand recommendation explanations and completion-aware filtering once richer coverage data exists.
