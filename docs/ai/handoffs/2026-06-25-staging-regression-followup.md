# 2026-06-25 Staging Regression Follow-Up

## Scope

- Follow-up audit for the staging issues reported after PR deployment:
  - dashboard light-mode color regression
  - route map labels
  - dossier PDF 500
  - dossier cache behavior
  - household invite focus issue
  - workspace/free-Pro entitlement behavior
  - mobile parity status

## Code Changes In This Follow-Up

- The web light canvas was corrected in commit `75ed15aa`.
- Household setup modal now prevents browser/autofill focus from favoring the household-name field:
  - household name uses `autoComplete="off"`
  - first invite email input uses `autoFocus={i === 0}`
  - regression test locks those attributes

## Verified From Source

- Web dossier cache:
  - client uses `sessionStorage` with TTL derived from the dossier response `Cache-Control` header
  - server dossier route uses in-process request-level cache with `private, max-age=...`
  - durable section cache is used for expensive area lookups
- Mobile dossier cache:
  - memory cache + offline disk cache
  - default fresh window is 30 minutes
  - network errors return cached data when present
- Service worker:
  - bypasses `/api/*`
  - never caches navigational HTML
  - only cache-firsts immutable `/_next/static` assets and icons
  - not the likely cause of stale dashboard app-shell HTML
- Route map:
  - light labels are white/glass labels, not dark overlay labels
  - regression test exists and passes
- PDF route:
  - uses the Node runtime and pdfkit font-data shim
  - logs the real `code/message/stack` behind `Failed to build dossier PDF`
  - local real-generator regression tests pass
- Consumer-free entitlement:
  - web `getUserPlan()` resolves pure free/no-row consumers to `PRO` only when `CONSUMER_FREE` is enabled
  - workspace routes also use the consumer entitlement resolver
  - if staging still shows free users as gated, verify the `CONSUMER_FREE` flag state in staging
- Workspace:
  - `/api/workspaces` returns `workspaceModelEnabled: false` when `WORKSPACE_MODEL_ENABLED` is off
  - the screenshot showing a "coming soon" workspace page is consistent with the workspace model flag being off

## Mobile Read-Only Findings

- Mobile `HomeDossierCard` is not source-deck parity with web:
  - it renders a row list with per-row `DossierAmbient`
  - it does not render the web source deck/toggle/82px stage structure
- Mobile still contains old paid-ladder copy/logic in dossier and plan comparison paths:
  - `FREE_TRIAL` preview
  - Individual+ full dossier
  - Family+ shared workspace
  - Pro-only PDF/neighborhood/export
- Mobile files were not changed.

## Verification Run

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `git diff --check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/route-map-card.test.tsx`
- `pnpm --filter @locateflow/web test -- src/app/api/addresses/[id]/dossier/pdf/route.test.ts src/lib/pdf/standard-font-data.test.ts`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/household-activation-card.test.tsx`
- `pnpm --filter @locateflow/web lint`

All checks passed locally. The local machine still prints the existing Node engine warning because it runs Node `v24.13.0` while the repo requests Node `22.x`.

## Still Needs Runtime Verification

- Staging commit/image:
  - `/api/build-info` is authenticated and returned 401 without using browser cookies
  - verify Dokploy deployed the current PR branch commit after `75ed15aa` plus the household-focus commit
- PDF 500:
  - if staging still returns 500, read the Dokploy server log line beginning `Failed to build dossier PDF:` and capture the logged `message`/`code`
- Feature flags:
  - confirm staging `CONSUMER_FREE=true/enabled`
  - confirm staging `WORKSPACE_MODEL_ENABLED=true/enabled`

## Not Changed

- No mobile files changed.
- No admin files changed.
- No dependency files changed.
- No deployment/env config changed.
