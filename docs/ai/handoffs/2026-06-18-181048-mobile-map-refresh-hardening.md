# Mobile Map Refresh Hardening

## Summary

- Hardened the mobile route map so a successful Geoapify image is kept on screen while background refreshes/replacement image requests run.
- This addresses the observed behavior where the map appears briefly, then disappears after the screen refresh/reconciles.
- Web was verified separately and already shows the route map correctly.

## Root Cause

The previous mobile map component still had a destructive failure path:

- A new `uri` or image error could set the component back to hidden/null.
- React Native image loads can be cancelled or retried during screen refresh, especially when the address/move payload is reconciled.
- The component did not keep the last successful map URI visible while a replacement URI was loading.

## Fix

- Added `loadedUri` as the last-known-good map image.
- The visible map now uses `loadedUri ?? uri`.
- Replacement images preload invisibly and only replace the visible map after `onLoad`.
- If a refresh/replacement request fails but `loadedUri` exists, the map stays visible instead of collapsing.
- Route keys now round coordinates to the same precision as the proxy URL to avoid clearing the map for tiny float jitter.

## Changed Files

- `apps/mobile/src/components/addresses/TransitRouteMap.tsx`
- `apps/mobile/src/__tests__/tab-cache-and-map-contract.test.ts`
- `docs/ai/handoffs/2026-06-18-181048-mobile-map-refresh-hardening.md`

## Tests

- `pnpm --filter @locateflow/mobile exec vitest run src/__tests__/tab-cache-and-map-contract.test.ts src/components/addresses/transit-route-map-url.test.ts`
  - 2 files passed
  - 14 tests passed
- `pnpm --filter @locateflow/mobile test`
  - 32 files passed
  - 309 tests passed
- `pnpm verify:typecheck`
  - passed for web, admin, mobile, db, connectors

## Notes

- No production data or secrets were read.
- This does not change the server map proxy or Geoapify configuration.
- A new OTA should be published from the commit containing this hardening.
