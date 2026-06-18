# Mobile Detail Refresh Cache Handoff

Date: 2026-06-18
Branch: `codex/mobile-detail-refresh-cache`

## Completed

- Killed the repeat full-screen refresh flash for mobile detail/stack screens by hydrating last-known detail data before foreground loading.
- Extended the existing mobile offline-cache primitive with an in-memory synchronous `peekOfflineCache` for same-session stack revisits.
- Kept AsyncStorage as the durable offline cache and preserved logout cleanup by clearing the in-memory cache in `clearAllOfflineCaches`.
- Added `useDetailOfflineCache` so detail screens share one cache/hydration path.
- Updated these detail screens to use cache keys by `screen + id`:
  - `detail.moving.<id>`
  - `detail.service.<id>`
  - `detail.provider.<id>`
  - `detail.address.<id>`
  - `detail.budget.<id>`
  - `detail.custom-provider.<id>`

## Behavior

- First-ever view with no cache still shows the existing full-screen loading/skeleton state.
- Revisit after a successful fetch hydrates from memory synchronously and renders cached content immediately.
- Existing pull-to-refresh still uses the small refresh spinner.
- Network fetches still run in the background and write the latest successful data back to offline cache.
- API calls, response shapes, mutation flows, and reduce-motion behavior were not changed.

## Tests

- `pnpm --filter @locateflow/mobile exec tsc --noEmit` passed.
- `pnpm --filter @locateflow/mobile test -- src/lib/offline-cache.test.ts src/lib/home-dossier.test.ts src/lib/subscription-visible-plans.test.ts` passed: 3 files / 121 tests.
- `pnpm verify:typecheck` passed.
- `pnpm --filter @locateflow/mobile test` passed: 30 files / 295 tests.

Local warning only:

- The repo expects Node `22.x`; this shell used Node `v24.13.0`.

## Manual QA

Device/emulator revisit QA was not completed in this environment:

- `adb` was not available.
- `emulator` was not available.

Manual QA still recommended on a real device or simulator:

1. Open each detail screen once and wait for live data.
2. Navigate back to the list/tab.
3. Re-enter the same detail screen.
4. Confirm cached content appears immediately and the full skeleton/loading screen does not flash.
5. Pull to refresh and confirm the small refresh indicator still works.

Screens to check:

- Moving plan detail
- Service detail
- Provider detail
- Address detail
- Budget detail
- Custom provider detail

## Guardrails

- No deploy.
- No push to main.
- No migration.
- No secret or `.env` access.
- No API shape changes.
- No production data access.
