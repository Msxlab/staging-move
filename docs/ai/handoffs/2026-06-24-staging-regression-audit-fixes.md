# 2026-06-24 Staging Regression Audit Fixes

## Scope
- Investigated staging regressions reported after the recent commit batch:
  workspace page stuck on coming-soon, dashboard/API 403 noise, onboarding briefing 500,
  dossier PDF 500, household invite focus/autofill confusion, dossier ambient visuals,
  cache behavior, and CI coverage for staging.
- Source code was modified.

## Verified From Code
- `GET /api/workspaces` returned `workspaceModelEnabled:false` only when disabled, but omitted
  `workspaceModelEnabled:true` when enabled. The settings UI treated the missing field as false.
- `requireWorkspaceContext` rejected `SUSPENDED` members before the shared permission matrix could
  allow read-only access.
- `/api/onboarding/briefing` failed open to an uncaught route error if entitlement/workspace scope
  resolution threw after auth, which can surface as a production Server Components 500.
- The web standalone prep script did not explicitly copy `pdfkit/js/data`, even though dossier PDF
  generation depends on those standard font metric files at runtime.
- The household activation modal lacked stable input names/autocomplete hints and opened with the
  name input as the first focusable field even when an existing household name was already present.
- Dossier ambient scenes existed in code, but opacity/mask values made them barely perceptible on
  the current light dossier surface.
- CI only ran on `main` and did not run shared/connectors tests in the test job.

## Changes Made
- Workspace API now returns `{ workspaceModelEnabled: true }` when enabled.
- Workspace context now resolves `SUSPENDED` members and lets `can()` enforce read-only behavior.
- Onboarding briefing now fails soft with `{ configured:false }` when entitlement/scope resolution
  is gated or unavailable.
- Web standalone prep now copies pdfkit standard font data to both standalone root layouts; the
  pdfkit shim now searches cwd ancestors for the copied data.
- Household activation modal now focuses the first email field when a household name already exists,
  and adds explicit input `name`, `autoComplete`, and `inputMode` attributes.
- Expired partner consent refresh now clears encrypted access/refresh tokens and token expiry.
- Dossier ambient CSS visibility was raised while keeping content above the decorative layer.
- CI now runs for `staging` and includes db/shared/connectors typecheck plus shared/connectors tests.

## Cache Notes
- Web dossier has short in-process response caching plus durable area-scoped external lookup caching.
- Mobile has in-memory React Query cache, AsyncStorage offline list/detail caches, dashboard snapshot,
  and home dossier cache. Logout/delete clears sensitive local caches.
- The intended design is not continuous upstream/API fetching; repeated 403/500 failures were causing
  repeated visible console noise and fallback attempts.

## Tests Run
- `pnpm --filter @locateflow/web test -- src/app/api/workspaces/route.test.ts src/lib/workspace-context-resolver.test.ts src/app/api/onboarding/briefing/route.test.ts src/lib/pdf/standard-font-data.test.ts "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" src/components/dashboard/dossier-ambient.test.tsx`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `node --check scripts/prepare-web-standalone.mjs`
- `pnpm --filter @locateflow/web test -- src/app/api/profile/route.test.ts src/app/api/addresses/route.test.ts src/app/api/services/route.test.ts src/app/api/budget/route.test.ts src/app/api/moving/route.test.ts`
- `git diff --check`

## Risks / Follow-Up
- Dossier visual parity should still be manually checked on staging against the latest supplied theme
  reference after deploy; this fix restores visibility but does not re-implement every design variant
  from the reference HTML.
- The PDF 500 fix should be verified in a production-like standalone Docker build because the local
  test covers generator/shim behavior, not the deployed filesystem image.
- Staging still needs real browser QA for workspace creation/invites and API console noise after the
  branch is deployed.
