# 2026-06-25 Web Light Theme + Dossier Follow-Up

## Scope

- Rechecked the latest source prototype bundle at `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Focused this implementation pass on web light theme regression and dossier scene visibility.
- Mobile was read-only in this pass; no mobile source files were modified.

## Verified Source Facts

- `project/Move.dc.html` light theme defines `bg #EFEADF`, `bg2 #E7E1D4`, `surface #FFFFFF`, `surface2 #F5F0E7`.
- `project/DossierScene.dc.html` contains the source animated scene matrix for weather, air, water, area, cost, housing, transit, and multiple weather variants.
- `project/Move Web.dc.html` positions the product as free/affiliate-funded: "Everything's included - no subscription" and all user-facing feature rows are free.

## Web Changes Made

- Restored the light app canvas to the source paper color via `--lf-app-bg: #EFEADF`.
- Kept dashboard chrome/cards on clean white surface tokens so the whole app does not become muddy beige.
- Increased desktop dossier row scene coverage from 78% to 86% and reduced the mask fade so row animations are more visible in the right side of each dossier row.
- Updated web contract tests so future changes preserve source beige canvas plus white surfaces.

## Cache Findings

- Web Home Dossier uses browser `sessionStorage` at key prefix `lf:home-dossier:v1:` and respects the endpoint `Cache-Control` `max-age`; repeated views in the same browser session should not continuously hit the API.
- The dossier API also uses server-side cache keys that include user, workspace scope, address, plan/feature state, and weather target date.
- Mobile has a private device cache layer using AsyncStorage plus an in-memory layer for tab/detail data. No mobile change was made.

## PDF Findings

- Local route regression tests for `/api/addresses/:id/dossier/pdf` pass with the real PDF generator.
- The code includes a pdfkit standard-font shim and standalone preparation script that copies `pdfkit/js/data` into runtime locations.
- If staging still returns `{"error":"Failed to build dossier PDF"}`, the next needed evidence is the Dokploy runtime log entry printed by `console.error("Failed to build dossier PDF:", { code, message, stack })`.

## Validation

- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" "src/lib/pdf/standard-font-data.test.ts"`
- `pnpm --filter @locateflow/web test -- "src/components/dashboard/home-dossier-fetch.test.tsx" "src/app/api/addresses/[id]/dossier/route.test.ts"`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

## Known Warnings

- Local Node is v24.13.0 while the app asks for Node 22.x.
- Next build warns that `middleware` should move to `proxy`.
- Turbopack warns about `@prisma/client` CommonJS wildcard export.
- Edge runtime warning remains.

## Open Risks / Next Work

- Staging PDF 500 cannot be proven fixed without checking the new runtime log message or confirming the running build SHA.
- Mobile still has comments/copy paths that mention paid unlock/Individual-style language; behavior should be audited before changing mobile.
- A browser screenshot comparison is still needed after deployment to confirm the visual result against the provided dossier screenshots.
