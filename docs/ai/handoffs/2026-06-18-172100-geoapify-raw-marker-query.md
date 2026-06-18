# Geoapify Raw Marker Query

## Context

- PR #310 was merged and deployed at commit `25e8e62fb536fecad4dd7649006459c430ec83d6`.
- Web and admin build-info both reported `sourceBranch: "main"` and that commit.
- Chrome dashboard still showed `STYLIZED VIEW`; the map image had `naturalWidth: 0`.
- Geoapify Static Maps GET examples keep marker delimiters raw, e.g. `marker=lonlat:...;color:%23...;size:...`.
- The app was still using `URLSearchParams`, which encoded marker delimiters like `lonlat%3A` and `%3Bcolor`.

## Change

- Builds the Geoapify Static Maps query string manually for the `marker` parameter.
- Keeps `lonlat:`, `;`, `,`, and `|` delimiters in the documented raw form.
- Encodes color `#` as `%23` and still URL-encodes the API key.
- Keeps marker-only Geoapify; no Google Maps path was added.
- No auth, entitlement, billing, telemetry, deploy, migration, or secret behavior changed.

## Tests

- `pnpm --filter @locateflow/web exec vitest run src/app/api/maps/static/route.test.ts` — passed, 24 tests.
- `pnpm verify:typecheck` — passed.

## Post-Deploy Verification

1. Confirm `/api/build-info` reports the merge commit for this PR.
2. Reload the logged-in dashboard.
3. Confirm Route Map no longer shows `STYLIZED VIEW`.
4. Confirm `/api/maps/static` image requests return `200 image/*`.
