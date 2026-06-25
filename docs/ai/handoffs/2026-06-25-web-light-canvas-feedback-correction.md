# 2026-06-25 Web Light Canvas Feedback Correction

## Trigger

User reported the deployed light dashboard became visually worse after the intermediate light-canvas adjustment. Screenshot showed the app-level canvas reading as a muddy beige/gray wash.

## Verified Source Context

- External source bundle keeps `#EFEADF` as the source paper token.
- Current product shell has sidebar/header/card chrome that is not a direct one-screen clone of the source prototype, so the source paper token needs white chrome/panel separation and the light backdrop disabled.

## Changes Made

- Kept `--lf-source-paper-bg: #EFEADF` for source/dossier paper surfaces.
- Restored app-level light canvas to the source paper token, `--lf-app-bg: #EFEADF`.
- Made light app panels opaque white instead of translucent white over beige.
- Added `data-lf-theme="light"` on `AppShell` so light shell CSS does not depend only on the document class cascade.
- Added `data-lf-theme` CSS rules to force the app shell backdrop/grid off in light mode and keep sidebar/header/card chrome clean.
- Kept Aurora light base on the source paper token while using white pane tokens and reduced overlays.
- Kept the source dossier animated deck as the primary view in both swipe and full modes.

## Files Changed

- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/styles/globals.css`
- `apps/web/src/styles/aurora.css`
- `apps/web/src/components/dashboard/home-dossier.tsx`
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`

## Verification

- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/components/dashboard/route-map-card.test.tsx src/lib/pricing-free-tier-contract.test.ts`
  - Passed: 4 files, 135 tests.
- `pnpm --filter @locateflow/web lint`
  - Passed.
- `git diff --check`
  - Passed with CRLF warnings for CSS files only.

## Not Changed

- Mobile source files were not modified.
- PDF export 500 was not fixed in this pass; local route/font tests were already passing earlier, so staging still needs container logs to identify the runtime failure.
- Dokploy/GitHub deployment state was not changed manually; only code is being pushed to the PR branch.

## Next QA

1. After deploy, hard refresh `/dashboard` in light mode.
2. Confirm the main canvas matches the source warm paper (`#EFEADF`) without a gray/yellow wash.
3. Confirm the sidebar/header remain clean white.
4. Confirm the dashboard cards no longer look like translucent gray overlays.
5. Open a home dossier and confirm the source animated card deck remains visible in swipe and full modes.
