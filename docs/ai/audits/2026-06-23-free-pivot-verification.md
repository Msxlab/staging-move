# 2026-06-23 Free Pivot Verification

Status: CONCERNS FOUND, no application source modified
Branch verified: `codex/free-pivot-verification-2026-06-23`
Base commit: `a620391f230fdd2a9942022690eca696cfac18ee`

## Scope

This pass verified the merged `feat/free-forever` and `fix/qa-audit-2026-06-23` work on `origin/main` after `git fetch --all --prune`.

Recent history reviewed included the current 40-commit window. The relevant merge set is:

- `a620391f` - merge PR #31 `feat/free-forever`
- `3413f16e` - admin affiliate/commission revenue framing
- `98f03f7b` - mobile free / affiliate-funded subscription and onboarding surfaces
- `bb488ea3` - web free / affiliate-funded marketing, SEO, legal, i18n
- `e373894f` - merge PR #30 `fix/qa-audit-2026-06-23`
- `2cc930c9` - portal public-origin redirect fix
- `327f4bca` - marketing header mobile overflow fix
- `95ee3d4a` - onboarding move-plan destination validation fix
- `bf6485cb` - Dossier PDF current-payload 500 fix

Both target branches are contained in `origin/main`.

## Executive Summary

The source implementation is mostly coherent: consumer-free defaults to ON for web consumer feature flags, the entitlement override is reversible, real Stripe/store/admin rows remain raw, finite abuse caps replace unbounded "free forever" access, the four stated QA P1 fixes are covered by targeted tests, and local public-web screenshots show no desktop or 390px mobile horizontal overflow.

The important concerns are deployment/runtime alignment and a few copy/control-plane inconsistencies:

1. P1: The installed Android APK on the emulator points to production API, not staging, so mobile staging QA with `mobile.qa@locateflow.com` was intentionally not attempted.
2. P1: `origin/staging` is 15 commits behind `origin/main`. If staging deploy tracks the `staging` branch, the tested source is not the deployed branch.
3. P2: Admin reads the `CONSUMER_FREE` DB flag as OFF when the row is missing, while web treats missing row as ON by default.
4. P2: Sign-up/sign-in screens render successfully but do not visibly reinforce "free / no credit card / affiliate-funded" in the initial screenshot text.
5. P2: Legal pages retain dormant subscription/refund language with explicit legal-review comments. That is reversible, but counsel review is still not verified in code.

## Evidence Artifacts

Screenshots and runtime JSON:

- Public web local screenshots: `docs/ai/screenshots/2026-06-23-free-pivot-verification/web-local/`
- Admin login local screenshots: `docs/ai/screenshots/2026-06-23-free-pivot-verification/admin-local/`
- Staging QA account smoke: `docs/ai/screenshots/2026-06-23-free-pivot-verification/staging-runtime/staging-qa-account-smoke.json`
- Android APK inspection: `docs/ai/screenshots/2026-06-23-free-pivot-verification/mobile-runtime/mobile-apk-inspection.json`

Local public-web screenshot coverage:

- 8 public/auth web routes x desktop/mobile: home, pricing, why-free, FAQ, billing-policy, refund, sign-up, sign-in.
- All 16 web captures returned HTTP 200.
- All 16 web captures had `hasHorizontalOverflow: false`.
- Pricing/home showed the expected free/no-subscription/no-credit-card/affiliate/free-start text checks.

Admin local screenshot coverage:

- Admin login desktop and mobile returned HTTP 200 after using a local-only dummy `ADMIN_JWT_SECRET`.
- Both captures had `hasHorizontalOverflow: false`.
- Authenticated admin pages were source-reviewed and unit/build-tested, but not runtime-clicked because no admin QA credentials were used.

Staging QA account smoke:

- `POST /api/auth/register`: 201, `emailVerified: true`, `requiresEmailVerification: false`
- `POST /api/auth/login`: 200
- `GET /api/auth/me`: 200, verified user present
- `POST /api/account/delete`: 200, `COMPLETED`
- `POST /api/auth/logout`: 403 after deletion. This is consistent with the account/session already being invalidated by deletion.

Android APK inspection:

- Installed package: `com.locateflow.mobile`
- Version: `1.0.2`, `versionCode=21`
- APK string scan: `hasProductionApi: true`, `hasStagingApi: false`
- Result: mobile runtime QA is blocked until a staging/preview APK is installed.

## Verification Matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Pull / branch freshness | CONCERN | `origin/main` has target branches, but `origin/staging...origin/main` is `0 15`; staging branch is behind main. |
| Consumer-free default ON | PASS | `apps/web/src/lib/feature-flags.ts:23-32`, `:63` default missing `CONSUMER_FREE` row to true unless `CONSUMER_FREE_DEFAULT=false`. |
| Rollback path | PASS | Same file supports `CONSUMER_FREE_DEFAULT=false` and disabled DB flag row. |
| Raw billing/admin truth preserved | PASS | `packages/shared/src/entitlement.ts:135-158`; default `applyConsumerFree` false. |
| Real/lapsed Stripe/store/admin not upgraded | PASS | `packages/shared/src/consumer-free.ts:48-56`; tests at `packages/shared/src/consumer-free.test.ts:52-76`. |
| No-subscription consumer gets full access | PASS | `apps/web/src/lib/plan-limits.ts:137-155`. |
| Finite abuse caps | PASS | `apps/web/src/lib/plan-limits.ts:82-85`, address/service/custom-provider cap handling at `:312-329`, `:365-382`, `:484-498`. |
| Concurrent moving-plan H4 | PASS with minor drift risk | `apps/web/src/app/api/moving/route.ts:25-30`, `:111-139`; shared helper exists at `packages/shared/src/workspace-entitlements.ts:91-105`. |
| Dossier PDF 500 fix | PASS | Defensive section access in `apps/web/src/lib/pdf/dossier-report.ts:52-72`; real-generator regression tests at `apps/web/src/app/api/addresses/[id]/dossier/pdf/route.test.ts:203-244`. |
| Onboarding destination validation | PASS | `apps/web/src/app/onboarding/onboarding-client.tsx:88-107`, `:169-183`, `:952-982`; tests at `apps/web/src/app/onboarding/onboarding-move-validation.test.ts:87-118`. |
| Mobile marketing header overflow | PASS | `apps/web/src/components/marketing/marketing-header.tsx:62-66`; tests at `apps/web/src/components/marketing/marketing-header.test.tsx:53-75`; local 390px screenshots show no overflow. |
| Portal `0.0.0.0` redirects | PASS | Movers/partners portal tests at `apps/web/src/app/movers/portal/enter/route.test.ts:19-60` and `apps/web/src/app/partners/portal/enter/route.test.ts:19-60`. |
| Affiliate disclosure | PASS | `apps/web/src/components/affiliate/affiliate-disclosure.tsx`, pricing copy at `apps/web/src/components/marketing/pricing-section.tsx:526-531`, mobile provider detail at `apps/mobile/app/providers/[id].tsx:501-533`. |
| Web public runtime | PASS | Local screenshot JSON has 16 public/auth screenshots, HTTP 200, no horizontal overflow. |
| Staging QA account lifecycle | PASS | Register, auto-verify, login, auth-me, delete completed in staging smoke JSON. |
| Mobile runtime | FAIL/BLOCKED | Installed APK embeds production API and no staging API. Do not use QA account in that APK. |

## Findings

### P1 - Installed Android APK targets production, not staging

Evidence:

- `docs/ai/screenshots/2026-06-23-free-pivot-verification/mobile-runtime/mobile-apk-inspection.json`
- `apps/mobile/eas.json` has correct staging profiles (`preview` / `staging-preview`) with `https://staging.locateflow.com/api`, but the installed APK does not contain that staging API string.

Impact:

- Mobile QA cannot be safely performed with `mobile.qa@locateflow.com` on the installed emulator app because it would talk to production.
- This blocks the requested mobile page-by-page runtime screenshots and real-user mobile flows.

Fix:

- Build and install a fresh `preview` or `staging-preview` APK from current `origin/main`.
- Re-run mobile login, subscription, onboarding, Dossier, provider, settings, export/delete, and route screenshot matrix.

### P1 - Source is fixed on `main`, but `origin/staging` is behind

Evidence:

- `git rev-list --left-right --count origin/staging...origin/main` returned `0 15`.
- `origin/staging` points at `bcbb4e1a`; `origin/main` points at `a620391f`.
- `origin/main` contains `feat/free-forever` and `fix/qa-audit-2026-06-23`.

Impact:

- If deployment is wired to the `staging` branch, the runtime may not contain the verified fixes even though the source on `main` is good.
- `/api/build-info` on staging returned 401, so exact deployed commit could not be verified from the public endpoint.

Fix:

- Confirm which branch Dokploy/staging deploys.
- If it deploys `staging`, merge `origin/main` into `origin/staging` or retarget deploy to `main`.
- Make a non-sensitive build-info endpoint or admin-only evidence available for future QA.

### P2 - Admin `CONSUMER_FREE` status can disagree with web default

Evidence:

- Web default: `apps/web/src/lib/feature-flags.ts:23-32`, `:63` treats missing `CONSUMER_FREE` DB row as enabled by default.
- Admin status: `apps/admin/src/lib/consumer-free-status.ts:33-55` returns `consumerFreeEnabled: flag?.enabled === true`.

Impact:

- If the DB row is absent, consumers get free/pro-level access, while admin dashboard/plans/billing pages can label the model as "Subscription (legacy)" or show legacy MRR as live.
- This is an operator-facing truth mismatch.

Fix:

- Reuse the same defaulting rule in admin status resolution, or import a shared flag-default helper.
- Add an admin unit test for missing `CONSUMER_FREE` row.

### P2 - Sign-up and sign-in do not visibly carry the free/affiliate promise

Evidence:

- Local screenshot text checks for `sign-up` and `sign-in` did not find `LocateFlow is free`, `no subscription`, `no credit card`, `affiliate`, or `get started free`.
- Screenshot files:
  - `web-local/07-desktop-sign-up.png`
  - `web-local/07-mobile-sign-up.png`
  - `web-local/08-desktop-sign-in.png`
  - `web-local/08-mobile-sign-in.png`

Impact:

- The public marketing/pricing pages communicate the pivot, but the account-creation moment does not reinforce that no payment is coming.
- This is a UX conversion/trust gap, not a backend blocker.

Fix:

- Add compact free-model reassurance near the auth form: "Free forever. No credit card. Partner/referral funded at no extra cost."
- Keep legal/affiliate wording consistent with `AffiliateDisclosure`.

### P2 - Legal review is still not verified

Evidence:

- `apps/web/src/app/billing-policy/page.tsx:46-60`
- `apps/web/src/app/refund/page.tsx:46-61`, `:114-123`

Impact:

- The pages correctly say current consumer use is free and subscription terms are dormant, but comments explicitly require legal review.

Fix:

- Have counsel approve the billing/refund/affiliate-disclosure wording before public launch.

### P3 - Duplicate consumer-free moving-plan limit constant can drift

Evidence:

- Local route constant: `apps/web/src/app/api/moving/route.ts:25-30`
- Shared helper: `packages/shared/src/workspace-entitlements.ts:91-105`

Impact:

- Both values are currently 25, but future edits could drift.

Fix:

- Import `CONSUMER_FREE_CONCURRENT_PLAN_LIMIT` or `concurrentPlanLimitForPlan` in the route.

## Tests And Checks Run

All commands were run locally on branch `codex/free-pivot-verification-2026-06-23`.

- `git fetch --all --prune`
- `pnpm verify:typecheck` - PASS
- `pnpm --filter @locateflow/web test` - PASS, 2909 tests
- `pnpm --filter @locateflow/admin test` - PASS, 788 tests
- `pnpm --filter @locateflow/mobile test` - PASS, 341 tests
- `pnpm --filter @locateflow/shared test` - PASS, 417 tests
- `pnpm --filter @locateflow/connectors test` - PASS, 105 tests
- `pnpm --filter @locateflow/web build` - PASS
- `pnpm --filter @locateflow/admin build` - PASS
- `pnpm --filter @locateflow/mobile exec tsc --noEmit` - PASS
- Local Playwright via system Chrome for web/admin screenshots - PASS for captured pages
- Staging QA account API lifecycle - PASS through deletion
- Android installed APK inspection - BLOCKED for staging runtime because API target is production

Warnings observed:

- Local Node is `v24.12.0`; repo engine wants Node `22.x`.
- Next warns the `middleware` convention is deprecated in favor of `proxy`.
- Build warnings remain around `@prisma/client` CJS import traces.

## Manual QA Not Completed

- Authenticated admin dashboard runtime pages were not clicked because no admin QA credential was used.
- Native mobile runtime screenshots were not captured because the installed APK targets production.
- Full authenticated web app page-by-page screenshots were not repeated after the new free-pivot merge; this pass used source/tests plus staging API lifecycle smoke and focused local public/auth screenshots.
- Dossier PDF was verified by source and test suite, not by a live authenticated PDF download in this pass.

## Recommended Next Action

1. Install a current staging-preview Android APK and re-run the mobile route screenshot matrix.
2. Align staging deployment branch with `origin/main`, or prove the deploy commit another way.
3. Fix admin consumer-free missing-row default.
4. Add free/no-card/affiliate reassurance to sign-up and sign-in.
5. Get legal approval for the free/affiliate-funded billing and refund language.

## Follow-up Update

Follow-up runtime QA was saved in `docs/ai/audits/2026-06-23-free-pivot-followup.md`.

Key update:

- Mobile runtime was re-run with a local debug Android APK configured for staging APIs, and `mobile.qa@locateflow.com` was registered, seeded, screenshoted, and deleted.
- The official signed EAS `staging-preview` APK was still not installed.
- Authenticated staging web `/api/build-info` reported `sourceBranch: feat/design-foundation`, commit `38cb3718abf1958f6fd1c6cd731abd3974047b23`, built `2026-06-23T16:16:25.779Z`, which is behind both `origin/staging` and `origin/main`.
- Public staging mobile web still has 390px horizontal overflow on home, pricing, and why-free.
