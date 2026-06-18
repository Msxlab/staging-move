# Geoapify Area Static Map

## Context

- PR #311 was merged and deployed at commit `fa03daa7d79a251938d2748ea180a525343b88b9`.
- Web and admin build-info both reported `sourceBranch: "main"` and that commit.
- Chrome dashboard still showed `STYLIZED VIEW`.
- `/api/maps/static` assets still failed with HTTP 424.
- The marker-only Geoapify request still appeared to be rejected upstream, so the next safest production path is to avoid marker parsing entirely.

## Change

- Replaced marker-based Geoapify Static Maps requests with an `area=rect` basemap request covering the origin and destination with padding.
- Kept Geoapify-only behavior; no Google Maps path was added.
- City labels remain overlaid by `RouteMapCard`, so the user still sees old/new city context.
- No auth, entitlement, billing, telemetry, env, deploy, migration, or secret behavior changed.

## Tests

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts` — passed, 24 tests.
- `pnpm verify:typecheck` — passed.

## Post-Deploy Verification

1. Confirm `/api/build-info` reports the merge commit for this PR.
2. Reload the logged-in dashboard and scroll to Route Map.
3. Confirm Route Map no longer shows `STYLIZED VIEW`.
4. Confirm `/api/maps/static` image requests return `200 image/*`.
