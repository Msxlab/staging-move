# Handoff: Live Staging Source Fixes

Date: 2026-06-23

Branch: `codex/free-pivot-followup-fixes`

## What Changed

- Fixed admin free-pivot status resolution so a missing `CONSUMER_FREE` FeatureFlag row defaults to enabled, unless `CONSUMER_FREE_DEFAULT=false` opts out.
- Added admin unit coverage for default-on, env opt-out, DB override, and affiliate revenue sums.
- Removed stale checkout wording from auth account creation.
- Added visible free/no-card/partner-funded reassurance to sign-up and sign-in.
- Updated English and Spanish `landing.noCreditCard` copy.
- Added auth regression coverage to prevent the stale checkout copy from returning.

## Live Staging QA

Live staging target: `https://staging.locateflow.com`

Saved evidence:

- Metrics: `docs/ai/screenshots/2026-06-23-live-staging-fixes/live-staging-responsive-metrics.json`
- Screenshots: `docs/ai/screenshots/2026-06-23-live-staging-fixes/`

Checked both mobile `390x844` and desktop `1440x900` across 16 public/auth/legal routes.

Key results:

- Live public pages returned HTTP 200.
- `/api/build-info` returned HTTP 401, so branch/commit was not verified from live.
- Desktop had no horizontal overflow.
- Mobile public pages still overflowed on live staging with `scrollWidth=497` vs `clientWidth=390`.
- Live overflow offender is the desktop logged-out header CTA group.
- Current source already has the header overflow fix (`hidden ... lg:flex`) and a regression test.
- Live `/sign-up` still has stale checkout text; this branch fixes it in source.

## Verification

Passed:

- `pnpm --filter @locateflow/web test -- src/app/auth-page-regression.test.ts src/components/marketing/marketing-header.test.tsx src/components/marketing/pricing-section.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/admin test -- src/lib/consumer-free-status.test.ts`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/admin lint`

Note: the local runtime is Node `v24.12.0`; the repo declares Node `22.x`, so pnpm prints an engine warning before successful commands.

## Next Steps

1. Deploy staging from the intended branch/commit.
2. Re-run live staging mobile/desktop screenshot QA after deploy.
3. Confirm the public mobile header overflow is gone live.
4. Confirm sign-up/sign-in free/no-card copy is live.
5. Run official signed Android `staging-preview` QA once the artifact is available.
6. Run authenticated admin QA after approved admin credentials are provided.

Application source code was modified.
