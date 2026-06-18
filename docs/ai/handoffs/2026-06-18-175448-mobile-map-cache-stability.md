# Mobile Map Cache Stability

## Summary

- Fixed a mobile route-map flash where the Geoapify image could render briefly, then collapse on same-route background refreshes.
- Verified live web dashboard Route Map is already loading a real Geoapify JPEG from `/api/maps/static`.
- Did not read or copy production `.env`, secrets, tokens, or credentials.

## Root Cause

`TransitRouteMap` reset `loaded=false` whenever `coords` changed by object identity. The Addresses and Moving screens refresh their address payloads in the background, which creates a new coordinate object even when the actual route is unchanged. That made the map frame collapse to the pre-load 1px state. On React Native, an unchanged image URI may not fire `onLoad` again, so the map could stay hidden after appearing briefly.

## Fix

- Added a stable route key based on rounded endpoint coordinates.
- Reset the full/preview ladder only when the actual route key changes.
- Track the previous image URI and reset `loaded` only when the URI actually changes.
- Preserved the existing full map -> preview map -> stylized banner fallback behavior.

## Changed Files

- `apps/mobile/src/components/addresses/TransitRouteMap.tsx`
- `apps/mobile/src/__tests__/tab-cache-and-map-contract.test.ts`
- `docs/ai/handoffs/2026-06-18-175448-mobile-map-cache-stability.md`

## Verification

- `pnpm --filter @locateflow/mobile exec vitest run src/__tests__/tab-cache-and-map-contract.test.ts src/components/addresses/transit-route-map-url.test.ts`
  - 2 test files passed
  - 13 tests passed
- `pnpm --filter @locateflow/mobile test`
  - 32 test files passed
  - 308 tests passed
- `pnpm verify:typecheck`
  - passed for web, admin, mobile, db, connectors

## Live Web Check

- `https://locateflow.com/api/build-info` reports web on `main`, commit `5c22b8ed29d16ddd0f10ac9c2b8bc41a6b78bbc0`.
- `https://admin.locateflow.com/api/build-info` reports admin on the same commit.
- Chrome dashboard showed a real `/api/maps/static` image:
  - content type: `image/jpeg`
  - size: `1280x448`
  - failed map assets: `0`

## Risks / Follow-Up

- This fix stabilizes the existing mobile Addresses and Moving detail map rendering. It does not add a new mobile Dashboard map card.
- If product wants exact web parity, next approved task should add an Active Move Route Map card to the mobile Dashboard using the same `TransitRouteMap` primitive.
- The current Geoapify `area=rect` map is a real basemap without route line or pins. Adding route geometry/pins should be a separate Geoapify URL contract task.
