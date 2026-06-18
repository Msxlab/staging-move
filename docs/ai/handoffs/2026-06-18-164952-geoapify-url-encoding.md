# Geoapify URL encoding follow-up

Date: 2026-06-18
Branch: `codex/geoapify-url-encoding`

## Live verification

- PR #307 was merged and deployed.
- Public build-info:
  - Web: `commitSha=28b8eff31e6268ea4ac9bdf29a1f4b1a66464fbf`, `sourceBranch=main`
  - Admin: `commitSha=28b8eff31e6268ea4ac9bdf29a1f4b1a66464fbf`, `sourceBranch=main`
- Logged-in dashboard Route Map now mounts `/api/maps/static` image requests.
- Observed map asset requests:
  - full map request
  - `preview=1` fallback request
- Both returned HTTP `424`.
- Dokploy web logs showed:
  - `[maps/static] geoapify upstream returned 400`

## Diagnosis

- Coordinates are present and the route-map image is being requested.
- The remaining failure is Geoapify upstream `400`, not missing coordinates and not stale deploy.
- Geoapify Static Maps docs require URL-encoded marker/geometry strings and show simple marker examples like `lonlat:...;color:%23...;size:48`.

## Fix

- Changed `buildGeoapifyStaticUrl()` to build query strings with `URLSearchParams`.
- Simplified marker syntax from `type:material;color:#...;size:42` to documented `lonlat;color;size`.
- Kept polyline geometry and server-side key handling.

## Verification

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts`
  - Passed: 1 file, 23 tests.
- `pnpm verify:typecheck`
  - Passed.
- Safe external format check with a dummy Geoapify key returned `401` instead of `400`, which indicates the URL shape reaches auth validation rather than request-shape rejection.

Note: local Node is `v24.13.0`; repo warns it wants Node `22.x`.

## Guardrails

- No secrets read or printed.
- No production data modified.
- No deploy performed.
- No DB migration.

## Next verification after merge/deploy

Reload the logged-in dashboard Route Map widget and confirm:

- `/api/maps/static?...` returns image content.
- Route Map no longer displays `Stylized view`.
- Dokploy logs no longer show `geoapify upstream returned 400`.
