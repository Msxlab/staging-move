# 2026-06-24 - Light Shell And Dossier Follow-up

## Scope

Follow-up after the light-mode authenticated dashboard looked too muted/dirty on staging. This pass stayed on web only and did not modify mobile.

## Changes Made

- Softened authenticated light shell canvas in `apps/web/src/styles/globals.css`.
  - `--lf-app-bg` is back to a cleaner warm white (`#FAF7F0`) instead of the heavier source-paper beige.
  - Light backdrop opacity is lower so the dashboard no longer gets a full-page gray/beige wash.
  - Light AppShell gradient overrides now stay white-forward instead of adding a strong beige middle stop.
- Reduced visual weight of route-map labels in light mode.
  - Labels remain readable but no longer sit on the map as dark/heavy chips.
- Reconnected marketing dossier demo rows to the same scene-card chrome used by the dashboard dossier.
  - `lf-dossier-scene-card` is now applied to the reusable demo row and the neighborhood demo row.
- Expanded the marketing dossier weather cycle to cover the full source weather range:
  - sun, cloud, rain, snow, storm, fog, wind, heat, cold.
- Added a static regression guard in `apps/web/src/lib/pricing-free-tier-contract.test.ts` so the marketing dossier keeps the source scene-card class and weather variants.

## Validation

- `pnpm tokens:check` passed.
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card pricing-free-tier-contract marketing-header pricing-section plan-compare-table` passed.
  - 8 test files, 157 tests.
- `pnpm --filter @locateflow/web exec tsc --noEmit` passed.
- `pnpm --filter @locateflow/web build` passed.
  - Existing warnings: local Node is v24 while repo asks for Node 22; Next middleware convention deprecation; Turbopack warning for external `@prisma/client`; Edge runtime static-generation warning.
- Production CSS output contains the updated light-shell and dossier CSS after build.

## Not Changed

- Mobile UI/theme/cache was not changed.
- PDF export 500 was not changed in this pass.
- Workspace/pro entitlement logic was not changed in this pass.
- Untracked `packages/db/prisma/create-dev-user.ts` was left untouched.

## Manual QA Needed After Deploy

- Open staging `/dashboard` in light mode and confirm the full-page background no longer reads as gray/dirty.
- Open a route-map card with a real map and confirm old/new labels are readable but lighter.
- Open the homepage dossier showcase and confirm dossier scenes are visible above the row content with full weather rotation.
- Re-test `/api/addresses/[id]/dossier/pdf`; this pass did not address the 500.

## Next Recommended Work

Investigate the PDF export 500 server path and the workspace/pro entitlement path next, because those are functional blockers separate from the visual regression handled here.

