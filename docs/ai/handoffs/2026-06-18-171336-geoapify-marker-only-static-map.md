# Geoapify Marker-Only Static Map

## Context

- PR #309 was merged and deployed to production at commit `6170dea00b298074cf1628c795addaa344d25a5f`.
- Web and admin build-info both reported `sourceBranch: "main"` and that commit.
- Chrome dashboard still rendered the Route Map fallback as `STYLIZED VIEW`.
- Observed `/api/maps/static` dashboard image assets still failed with HTTP 424.
- Dokploy logs continued to show `[maps/static] geoapify upstream returned 400`.

## Change

- Removed the Geoapify `geometry` query parameter from the GET Static Maps request.
- Kept marker-only real basemap generation with two Geoapify markers and no Google Maps path.
- Trimmed the runtime `GEOAPIFY_API_KEY` before appending it to the upstream request, guarding against accidental Dokploy whitespace.
- No auth, entitlement, billing, telemetry, deploy, migration, or secret behavior changed.

## Tests

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts` — passed, 24 tests.
- `pnpm verify:typecheck` — passed.

## Post-Deploy Verification

1. Confirm `/api/build-info` reports the merge commit for this PR.
2. Reload the logged-in dashboard.
3. Confirm Route Map no longer shows `STYLIZED VIEW`.
4. Confirm `/api/maps/static` asset requests return `200 image/*`.
