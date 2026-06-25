# 2026-06-25 Web Theme / Dossier Follow-up

## Scope
- Corrected the light dashboard canvas after the previous hotfix made staging look too gray.
- Kept changes web-only. Mobile was inspected for theme/cache/dossier parity, but no mobile source was modified.
- Did not deploy, merge, edit environment files, or touch production data.

## Source Evidence
- Source bundle light theme uses `bg #EFEADF`, `bg2 #E7E1D4`, `surface #FFFFFF`, and `surface2 #F5F0E7`.
- Source dossier scene engine includes multiple animated level/type states; the web implementation already ports that scene matrix through `DossierAmbient` and `source-dossier-scene.css`.

## Changes
- `apps/web/src/styles/globals.css`
  - Restored light app canvas to `--lf-app-bg: #EFEADF`.
  - Kept app chrome and cards on white/surface tokens for contrast.
  - Increased desktop dossier row scene visibility by widening the right-side animation layer and reducing the row mask strength.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Updated the contract test to require the source warm-paper canvas and the widened desktop scene strip.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the free-tier/theme contract to reject the previous white-led gradient and require the source warm-paper token.

## Verification
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient route-map-card home-dossier-fetch`
  - Passed: 4 files, 63 tests.
- `pnpm --filter @locateflow/web lint`
  - Passed.
- `pnpm --filter @locateflow/web test -- dossier/pdf standard-font-data`
  - Passed: 2 files, 12 tests.
- `pnpm --filter @locateflow/web build`
  - Passed.
  - Warnings: local Node is v24.13.0 while repo wants Node 22.x; existing Next middleware/proxy and Prisma external warnings remain.
- `git diff --check`
  - Passed with Git line-ending warning for `apps/web/src/styles/globals.css`.

## Findings / Risks
- Web cache: the Home Dossier browser cache is `sessionStorage` per browser tab/session, while the service worker intentionally does not cache `/api/*`. The app should not continuously re-fetch a fresh dossier until the session cache expires or is bypassed.
- Mobile cache: mobile uses memory plus offline device storage with a freshness TTL and gate-boundary epoch. It is device-side, not server-only. Comments still describe old paid-plan dossier gates, so mobile needs a separate approved pass.
- PDF: local route/generator/font-shim regression tests and production build pass. If staging still returns 500, inspect Dokploy container logs for the new `Failed to build dossier PDF` error details and confirm the latest image actually includes the pushed commits.
- Staging deploy was not performed from this session.

## Next Recommended Action
- Merge or redeploy the updated PR branch to staging, then hard-refresh `/dashboard` and retest `/api/addresses/:id/dossier/pdf` while watching Dokploy logs.
