# Geoapify Static Style Hardening

## Context

- Deploy of PR #308 was verified live on `main` at commit `1e890744eaf6077ce4cc594279f9dad97797f61a`.
- `https://locateflow.com/api/build-info` and `https://admin.locateflow.com/api/build-info` both reported `sourceBranch: "main"` and that commit.
- Chrome dashboard still showed `STYLIZED VIEW`; observed `/api/maps/static` image requests failed with HTTP 424.
- Dokploy logs showed `[maps/static] geoapify upstream returned 400`.

## Change

- Kept the static map proxy Geoapify-only.
- Changed the dark Static Maps style from `dark-matter` to `osm-bright-grey`, a style shown in Geoapify Static Maps examples.
- Changed marker size from `42` to documented/example-safe `48`.
- No auth, entitlement, billing, telemetry, env, deploy, or migration behavior changed.

## Tests

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts` — passed, 23 tests.
- `pnpm verify:typecheck` — passed.

## Verification Needed After Deploy

1. Confirm build-info moves to the merge commit for this PR.
2. Open the dashboard while logged in and verify the Route Map no longer shows `STYLIZED VIEW`.
3. Confirm `/api/maps/static` asset requests return `200 image/*`.
4. If it still fails, inspect `X-Maps-Source-Statuses`; do not expose the Geoapify key.
