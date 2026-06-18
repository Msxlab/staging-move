# 2026-06-18 12:52 - Map + Mobile Cache Follow-up

## Context

- User reported mobile Services tab showing a roughly 1-second full skeleton flash despite prior cache work.
- User reported the move-in-progress route map rendering as an empty/dark area on mobile and unreliable on web.
- Live Chrome check on `https://locateflow.com/dashboard` showed an authenticated full map endpoint request to `/api/maps/static` returning a Cloudflare-level 502. Unauthenticated shell requests correctly returned 401, confirming the route exists but authenticated/upstream map work was the failing path.

## Changes

- `apps/web/src/app/api/maps/static/route.ts`
  - Added a 4-second upstream fetch timeout so map source stalls return controlled app responses instead of leaking into proxy-level failures.
  - Added full-map source fallback: Google Static Maps first, then Geoapify when Google is missing, blocked, slow, or returns non-image/error content.
  - Kept `preview=1` as Geoapify-only and kept the Family/Pro `realMap` gate on non-preview requests.

- `apps/mobile/src/components/addresses/TransitRouteMap.tsx`
  - Hid the route map frame until the image actually loads.
  - Full Google failure still falls to Geoapify preview; preview failure falls back to the existing stylized dashed route.
  - Prevents the visible black/empty map rectangle seen in the screenshots.

- `apps/mobile/app/(tabs)/services.tsx`
  - Seeds Services screen state from the in-memory offline cache before first render.
  - Avoids setting `loading=true` when cached/prior data is already present.

- `apps/mobile/app/(tabs)/moving.tsx`
  - Applies the same in-memory cache seed and foreground-load guard to the Moving tab.

- `apps/mobile/src/__tests__/tab-cache-and-map-contract.test.ts`
  - Added contract coverage for tab cache seeding and hidden map preload frame.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/app/api/maps/static/route.test.ts` - passed, 22 tests.
- `pnpm --filter @locateflow/mobile test -- src/components/addresses/transit-route-map-url.test.ts src/lib/offline-cache.test.ts src/__tests__/tab-cache-and-map-contract.test.ts` - passed, 25 tests.
- `pnpm verify:typecheck` - passed.
- `pnpm lint` - passed.
- `pnpm --filter @locateflow/web test` - passed, 289 files / 2580 tests.
- `pnpm --filter @locateflow/mobile test` - passed, 31 files / 299 tests.
- `pnpm --filter @locateflow/admin test` - passed, 120 files / 753 tests.
- `pnpm --filter @locateflow/connectors test` - passed, 15 files / 105 tests.
- `git diff --check` - passed.

## Deployment Notes

- No deploy performed.
- No OTA sent from this feature branch. Mobile OTA should be sent only after this branch is merged into `main`, from the final `main` commit, to avoid another stale/missing-source OTA.
- For production map behavior, Dokploy must redeploy web after merge. If `GOOGLE_MAPS_API_KEY` remains absent but `GEOAPIFY_API_KEY` is set, the full route map should now fall back to Geoapify rather than staying empty.

## Guardrails

- No secrets read or printed.
- No production data modified.
- No migration.
- No billing/store/Stripe changes.
