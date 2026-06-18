# Live Build Info + Route Map Preview Handoff

## Summary

- Published `codex/build-info-endpoints` to `main` and confirmed Dokploy redeployed commit `5b8140a74abcabb9e45956c51fbddfd8eb857a42`.
- Verified live build-info endpoints are reachable:
  - `https://locateflow.com/api/build-info`
  - `https://admin.locateflow.com/api/build-info`
- Verified both services now report `sourceBranch: "main"`.
- Found the live web dashboard still rendering the Route Map widget as the stylized fallback with no `/api/maps/static` image request mounted.
- Root cause in code: `RouteMapCard` returned early when `realMap=false`, so it never attempted the Geoapify/OSM preview source even though the map proxy supports `preview=1`.

## Change

- Updated `apps/web/src/components/dashboard/route-map-card.tsx` so lower tiers or gated rich-map states skip the rich map but still attempt the preview map when route coordinates exist.
- Added `buildRouteMapImageSources` tests proving:
  - entitled/rich-map state uses full map first and preview as fallback
  - gated state uses the preview source first
- No secrets, production data, migrations, Stripe/store writes, or flag changes.

## Tests

- `pnpm --filter @locateflow/web exec vitest run src/components/dashboard/route-map-card.test.tsx src/app/api/maps/static/route.test.ts`
- `pnpm verify:typecheck`

## Notes

- `commitSha` and `builtAt` currently report `unknown` live because only `BUILD_SOURCE_BRANCH=main` is configured. To expose exact deploy identity, set `BUILD_COMMIT_SHA` and `BUILD_CREATED_AT` in Dokploy during build/deploy.
- If the dashboard still shows the stylized map after this change ships, the next likely blocker is missing route coordinates for the active move/address data rather than the map proxy or entitlement gate.
