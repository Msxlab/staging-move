# Geoapify-only static maps handoff

Date: 2026-06-18
Branch: `codex/geoapify-only-static-maps`

## Context

- Owner clarified LocateFlow does not use Google Maps for route maps; route maps should use Geoapify only.
- PR #306 was merged and deployed to production before this follow-up.
- Live build-info after PR #306:
  - Web: `sourceBranch=main`, `commitSha=93f05260c3a62364a7219f3d564d12ed1c66d49b`
  - Admin: `sourceBranch=main`, `commitSha=93f05260c3a62364a7219f3d564d12ed1c66d49b`

## What changed

- Removed the Google Static Maps upstream path from `GET /api/maps/static`.
- Normal full maps and preview maps now both use `GEOAPIFY_API_KEY` and Geoapify Static Maps.
- Kept the existing entitlement behavior:
  - Non-preview full map still requires `realMap`.
  - `preview=1` still bypasses the `realMap` gate.
  - Unauthenticated requests still return `401`.
- Updated map-related comments/config labels so route maps no longer claim Google Maps.
- Kept `GOOGLE_MAPS_API_KEY` only as a Google Places autocomplete key label.

## Tests run

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts`
  - 1 file passed, 23 tests passed.
- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts src/components/dashboard/route-map-card.test.tsx src/components/marketing/plan-compare-table.test.tsx`
  - 3 files passed, 55 tests passed.
- `pnpm verify:typecheck`
  - Passed.
- `pnpm --filter @locateflow/shared test`
  - Passed.

Note: local Node is `v24.13.0`; repo warns it wants Node `22.x`.

## Live verification before this branch

- Open Chrome dashboard session on production account showed `Pro`.
- Home Dossier Pro content and PDF CTA were visible.
- Route Map still rendered `Stylized view`.
- DOM contained no `/api/maps/static` image URL, which means the card did not mount an image request at all.

## Important remaining diagnosis

This branch fixes the provider path so map requests are Geoapify-only. It does not by itself force the route card to mount an image if stored route endpoint coordinates are missing.

If production still shows `Stylized view` after this branch is merged/deployed, the next likely issue is address/move records missing `latitude`/`longitude`. The next fix should be one of:

1. Ensure address creation/update persists coordinates when Places/Geoapify autocomplete is used.
2. Add a Geoapify server-side city/state geocode fallback for route maps when only `fromCity`/`toCity` are available.

Do not expose `GEOAPIFY_API_KEY` client-side.

## Guardrails

- No secrets read or printed.
- No production data modified.
- No deploy performed from this branch.
- No DB migration.
