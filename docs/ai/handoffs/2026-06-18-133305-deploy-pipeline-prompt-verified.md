# Deploy Pipeline Prompt Verification

Date: 2026-06-18 13:33 ET  
Branch: `codex/build-info-endpoints`

## Prompt Findings

### Verified Correct

- `move-main/codex/dokploy-migration` is stale relative to `move-main/main`.
  - `move-main/main`: `1a2636eddfd79322063824dee3d8e51d3a706746`
  - `move-main/codex/dokploy-migration`: `1c17530f21e831c5f4b6ce5dbd68d61fa6340b52`
  - `git rev-list --count move-main/codex/dokploy-migration..move-main/main`: `60`
  - `git rev-list --count move-main/main..move-main/codex/dokploy-migration`: `0`
- The stale deploy branch is missing current map/taxonomy work.
  - Main: `GEOAPIFY=6`, `getMergedDisplayCategoryKey=40`, `FINANCIAL_BANKING=5`
  - `codex/dokploy-migration`: `GEOAPIFY=0`, `getMergedDisplayCategoryKey=37`, `FINANCIAL_BANKING=0`
- Web and admin had no source-code `/api/build-info` route.
- Live public probes reached Cloudflare-backed services:
  - `https://locateflow.com/api/health`: `200`
  - `https://admin.locateflow.com/api/healthz`: `200`
- Live `/api/build-info` returned `401`, consistent with no public route/allowlist.
- `GEOAPIFY_API_KEY` was read by `apps/web/src/app/api/maps/static/route.ts` but was not passed through Dokploy/prod compose env.

### Corrected / Nuanced

- `X-Robots-Tag: noindex` on `/api/health` is expected because API responses are noindexed by middleware.
- Public pages checked (`/`, `/pricing`) did not return `X-Robots-Tag: noindex`, so the API health header alone is not evidence that production SEO env is wrong.
- The repo does include `docker-compose.dokploy.yml`; it is at the repository root, not under `docker/`.

### Not Verified Here

- The actual Dokploy UI Source Branch for web/admin was not changed or read from the panel in this pass.
- No deploy, force rebuild, or production config edit was performed.

## Fixes Made

- Added safe public build metadata endpoints:
  - `apps/web/src/app/api/build-info/route.ts`
  - `apps/admin/src/app/api/build-info/route.ts`
- Added shared `readBuildInfo()` helper that returns only safe metadata:
  - `service`
  - `commitSha`
  - `sourceBranch`
  - `builtAt`
  - `environment`
- Publicly allowlisted `/api/build-info` in web/admin middleware.
- Added build metadata Docker args/env plumbing in:
  - root `Dockerfile`
  - `docker/web.prod.Dockerfile`
  - `docker/admin.prod.Dockerfile`
  - `docker-compose.dokploy.yml`
  - `docker-compose.prod.yml`
- Passed `GEOAPIFY_API_KEY` through Dokploy/prod compose env.
- Registered `GEOAPIFY_API_KEY` in runtime-config and expected-env catalogs so it is visible/manageable as an optional map fallback key.

## Tests Run

- `pnpm --filter @locateflow/web exec vitest run src/app/api/build-info/route.test.ts src/middleware.test.ts src/app/api/maps/static/route.test.ts ../../packages/shared/src/build-info.test.ts ../../packages/shared/src/__tests__/runtime-config.test.ts`
  - Result: 5 files passed, 106 tests passed
- `pnpm --filter @locateflow/admin exec vitest run src/app/api/build-info/route.test.ts src/middleware.test.ts`
  - Result: 2 files passed, 14 tests passed
- `pnpm verify:typecheck`
  - Result: passed

Note: local Node is `v24.13.0`; repo wants Node `22.x`, so pnpm emitted engine warnings.

## Remaining Manual Step

If Dokploy web/admin Source Branch is still `codex/dokploy-migration`, switch both services to `main`, set build metadata env/build args if supported, and force rebuild both services. This requires explicit production/Dokploy approval and was not performed here.

## Guardrails

- No secrets read or printed.
- No production data access.
- No deploy.
- No migration.
- No source branch merge to main.
