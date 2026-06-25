# 2026-06-25 Source Beige Light Theme Fix

## Scope

User reported the previous light dashboard color became visibly worse than the provided source design. This pass keeps the web app aligned with the external source bundle:

- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Move.dc.html`
- Source light theme app canvas: `#EFEADF`
- Source light soft surface: `#F5F0E7`
- Source white panel/surface: `#FFFFFF`

## Changed

- Restored web light app canvas tokens from the incorrect clean-white canvas back to source warm paper beige.
- Regenerated web token CSS from `packages/shared/src/design-tokens-css.ts`.
- Updated the light theme regression test to assert source beige values.
- Kept dossier source deck/animation implementation unchanged.

## Verified

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`
- `pnpm --filter @locateflow/web test -- src/app/api/addresses/[id]/dossier/pdf/route.test.ts src/app/api/addresses/[id]/dossier/route.test.ts src/lib/home-dossier-cache.test.ts`
- `pnpm --filter @locateflow/mobile test -- src/lib/home-dossier-cache.test.ts src/lib/plan-comparison.test.ts`

Node warning observed during pnpm commands: repo expects Node `22.x`; local runtime is `v24.13.0`.

## Findings

- Web cache: `apps/web/src/app/api/addresses/[id]/dossier/route.ts` has an in-process dossier cache with a 10-minute TTL and a consumer-free epoch key.
- Mobile cache: `apps/mobile/src/lib/home-dossier-cache.ts` uses memory + offline disk cache, default fresh window 30 minutes, and preserves stale cache on network errors.
- Mobile dossier visual parity is not complete: mobile has animated row ambience, but it does not implement the source bundle's top-stage swipe/full dossier deck from `Move.dc.html`.
- Mobile plan comparison still contains the old tier matrix where Free only gets dossier preview and Pro-only gates remain, so it should be reviewed before claiming full affiliate/free-pivot parity on mobile.

## Not Changed

- No mobile source files were changed.
- No deployment files, environment files, secrets, or production config were changed.
- No deploy or merge was performed.

## Next

- Deploy/merge the PR branch to staging, then verify the dashboard light canvas against source beige.
- If staging PDF still returns 500, inspect Dokploy/runtime logs for the newly logged `Failed to build dossier PDF` details.
- Plan a separate mobile parity patch before changing mobile: source deck layout, full/free entitlement copy, and plan matrix should be handled together.
