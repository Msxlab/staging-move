# Handoff: Route Map And Dashboard CTA Fixes

Date: 2026-06-18  
Branch: `codex/route-map-geocode-fix`  
Application source modified: yes

## What Was Fixed

1. Route Map coordinate persistence and resilience.
   - `/api/moving` now applies the existing `geocodeFallbackForPersist` helper when it creates an inline destination address.
   - `/api/moving` GET now includes nested origin/destination coordinates, so the dashboard can resolve route endpoints from the moving-plan payload as well as from the addresses feed.
   - `RouteMapCard` now falls back from the full Google map source to the existing `preview=1` OSM/Geoapify map source if the full map image fails.
   - `RouteMapCard` can resolve coordinates from nested moving-plan addresses when the addresses feed is incomplete.

2. Dashboard invalid CTA markup.
   - Replaced remaining dashboard `<Link><button>` patterns with styled links in:
     - `apps/web/src/app/(app)/dashboard/dashboard-client.tsx`
     - `apps/web/src/app/(app)/dashboard/move-command-center.tsx`
   - Added a markup contract test so dashboard links cannot wrap buttons again.

## Changed Source Files

- `apps/web/src/app/api/moving/route.ts`
- `apps/web/src/app/api/moving/route.test.ts`
- `apps/web/src/components/dashboard/route-map-card.tsx`
- `apps/web/src/components/dashboard/route-map-card.test.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-client.tsx`
- `apps/web/src/app/(app)/dashboard/move-command-center.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-markup-contract.test.ts`

## Tests Run

- `pnpm --filter @locateflow/web test -- 'src/components/dashboard/route-map-card.test.tsx' 'src/app/api/moving/route.test.ts' 'src/app/(app)/dashboard/dashboard-markup-contract.test.ts' 'src/app/api/maps/static/route.test.ts'`
  - PASS: 4 files / 46 tests.
- `pnpm --filter @locateflow/web exec tsc --noEmit`
  - PASS.
- `pnpm verify:typecheck`
  - PASS.
- `pnpm --filter @locateflow/web test`
  - PASS: 289 files / 2577 tests.
- `pnpm lint`
  - PASS: 6/6 turbo tasks.
- `pnpm --filter @locateflow/admin test`
  - PASS: 120 files / 753 tests.
- `pnpm --filter @locateflow/mobile test`
  - PASS: 30 files / 296 tests.
- `pnpm --filter @locateflow/connectors test`
  - PASS: 15 files / 105 tests.

Local note: commands ran under Node `v24.13.0`; repo engine wants Node `22.x`, so promotion should preferably re-run on Node 22.

## Remaining Risk

- Existing live moving plans whose addresses were already persisted without coordinates may still need an approved address re-save or one-time backfill after this code deploys.
- The full Google map path may still depend on live `GOOGLE_MAPS_API_KEY`; this fix provides an OSM preview fallback when the full image fails, but the live map proxy should still be verified after deploy.
- No production data was changed and no deploy was performed.

## Recommended Next Action

Review, commit/push/PR, deploy after approval, then verify:

1. Create or re-save a QA move with manually entered destination address.
2. Confirm `/api/moving` returns nested coordinates for both endpoints.
3. Confirm Route Map first attempts the full map and falls back to preview if needed.
4. Confirm dashboard DOM has zero `a button` matches.
5. For the owner’s existing live plan, perform an approved address re-save/backfill only if coordinates remain missing.
