# 2026-06-25 Light Theme Cleanup Follow-up

## Scope
- Web light-mode dashboard/dossier visual cleanup after the previous warm canvas made staging look too muddy.
- No mobile, admin, env, deployment, dependency, database, or production changes.

## Changed
- `apps/web/src/styles/globals.css`
  - Softened the full light app canvas by mixing the source beige paper token with white instead of applying raw `--bg` across the whole shell.
  - Reduced light backdrop grid/radial opacity so the page no longer reads as a flat beige overlay.
  - Forced route-map labels in light mode to remain bright chips with readable ink instead of dark labels on light maps.
  - Lifted dossier shell, rows, and source cards toward clean white surfaces while preserving a warm edge.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the light-canvas contract to require the softened source-beige mix and to reject raw full-page `var(--bg)`.

## Verification
- `git diff --check`
  - Passed. Git reported the existing Windows line-ending warning for `apps/web/src/styles/globals.css`.
- `pnpm --filter @locateflow/web test -- src/components/dashboard/route-map-card.test.tsx src/components/dashboard/home-dossier.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
  - Passed: 4 files, 131 tests.
- `pnpm --filter @locateflow/web lint`
  - Passed: `tsc --noEmit`.
  - Warning: repo expects Node 22.x, local runtime is Node v24.13.0.

## Deploy Notes
- This change still needs to be merged/deployed by the existing Dokploy/GitHub flow before it appears on staging.
- Staging QA should hard-refresh `https://staging.locateflow.com/dashboard` after deploy and check:
  - page background is warm but not muddy,
  - route-map labels are light readable chips,
  - dossier rows/cards read as clean white surfaces,
  - dossier source deck/animations remain visible when the latest deployed commit includes the deck changes.
