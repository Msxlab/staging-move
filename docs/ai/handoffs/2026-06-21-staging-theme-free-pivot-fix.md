# 2026-06-21 Staging Theme + Free-Pivot Fix Handoff

## Scope

Branch: `codex/staging-audit-2026-06-21`

This pass continued the staging audit after the design zip/theme concern and the free-for-all pivot review. It stayed code-first before redeploy/browser QA.

## Theme Finding

The design zip bundle currently in this repo points to **Gold as the default accent**, with Sapphire and Emerald present as selectable/variant accents.

Evidence from `design-src/handoffs/*.zip`:

- `Admin.dc.html` exposes `accent` options `Gold`, `Sapphire`, `Emerald`, with default `Gold`.
- Extracted zip scans show repeated Gold tokens `#CBA45E`, `#DCBC7C`, `#B0852F` across every pushed handoff bundle.
- `packages/shared/src/design-tokens.ts` is aligned to `Edition VIII - Move Gold`.

Important nuance: an earlier commit (`64b396e2`) introduced a Sapphire mobile foundation, so the user's memory that it may not have been Gold is understandable. The current pushed zip sources, however, resolve to Gold default. If a newer external zip differs, compare against that package directly before changing theme again.

## Fixes Applied

- Mobile subscription screen no longer shows pricing, restore, upgrade, or plan-comparison UI for an active included/free effective entitlement with no Stripe/store management. It now mirrors web's "Everything included / no subscription" behavior.
- Added `shouldShowMobileConsumerFreePanel` and tests so real Stripe/App Store/Play subscriptions still keep billing-management UI.
- Removed duplicate mobile service selected-chip style keys that broke TypeScript.
- Fixed four web invalid interactive-nesting regressions (`<Link>` containing `<button>`) in moving, providers, and services CTAs.
- Replaced visible old `LocateFlow` copy with `Move` in mobile widget and shared task/provider guidance strings. Remaining `LocateFlow` occurrences in the scoped mobile/shared scan are technical callback/user-agent identifiers.

## Validation

Dependency install:

- `pnpm install --frozen-lockfile` completed on host. Host Node is still `v24.12.0`, so pnpm prints the expected engine warning because repo wants Node `22.x`.
- Docker Node 22 named-volume install/test path worked after temporary TLS workaround for registry/Prisma bootstrap.

Passed:

- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `pnpm --filter @locateflow/mobile test -- src/lib/subscription-visible-plans.test.ts`
- Docker Node 22: `pnpm --filter @locateflow/mobile test -- src/lib/subscription-visible-plans.test.ts`
- Docker Node 22: `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `DATABASE_URL=mysql://root:password@127.0.0.1:3306/defaultdb pnpm --filter @locateflow/db exec prisma validate`
- `git diff --check`

Full test totals from the last clean `verify:tests` run:

- Web: 323 files / 2755 tests passed
- Admin: 127 files / 779 tests passed
- Mobile: 34 files / 324 tests passed
- Shared: 35 files / 388 tests passed
- Connectors: 15 files / 105 tests passed

## Remaining

- Commit and push this fix set.
- Redeploy Dokploy staging so `/api/build-info` moves past the old deployed commit.
- After redeploy, run browser/runtime QA on:
  - public home, features, why-free, blog, sign-in, onboarding
  - logged-in web dashboard, moving, services, providers, settings/subscription
  - admin overview/users/moving/providers/leads/affiliate/subscriptions/settings
  - mobile web/embed or emulator pass for subscription/settings/services/providers if available
- Product-design screenshot audit is still pending because it requires rendered staging screenshots.
- Full Codex Security **Deep Security Scan** has not been run in the plugin's required six-worker workflow in this pass; ordinary tests/typecheck and focused security-sensitive code review continued instead.
