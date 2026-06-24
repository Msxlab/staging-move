# 2026-06-24 Web Theme, Dossier Scene, Route Map Handoff

## Scope

Web-only fix pass for the staging light-theme regression, route-map label contrast, and home dossier scene fidelity against the provided handoff source.

## Verified From Source

- The handoff light canvas uses a greige page background (`#EFEADF` / `#E7E1D4` / radial `#EFEEEA -> #D4D2C8`), while the web app shell was still painting authenticated and embed shells with `var(--surface)` (white).
- The production dossier ambient layer had data-driven motion, but it was mostly abstract waves/particles plus a static mood mark. The handoff source includes small character body/props and situation-specific pose motion.
- Route map overlay labels in light mode used a pale white chip that could read poorly on the light static map.

## Changes Made

- `apps/web/src/components/layout/app-shell.tsx`
  - Changed authenticated app shell and mobile embed shell background from `var(--surface)` to `var(--bg)`.
- `apps/web/src/styles/globals.css`
  - Replaced the light app backdrop blue wash with the handoff-style greige radial background.
  - Warmed the dossier ambient light overlay away from blue.
  - Added source-handoff inspired story-character body/prop/pose CSS for dossier ambient rows.
  - Improved light route-map label surface, border, color, and shadow contrast.
  - Extended reduced-motion handling to the new dossier character layer.
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - Added a data-derived `DossierStoryCharacter` wrapper around the existing mood SVG.
  - Maps existing dossier kinds/intensities/variants to visible poses such as air mask, storm, cold, water glass, cost alert, walking, and spark.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Added coverage for the new story character pose markup.

## Checks Run

- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/route-map-card.test.tsx src/components/dashboard/home-dossier.test.tsx`
  - Passed: 116 tests.
- `pnpm --filter @locateflow/web exec tsc --noEmit`
  - Passed.
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" src/app/api/maps/static/route.test.ts src/lib/pdf/standard-font-data.test.ts`
  - Passed: 36 tests.
- `git diff --check`
  - Passed with only the existing Windows LF/CRLF warning for `apps/web/src/styles/globals.css`.

## Risks / Follow-Up

- This is a web-only pass. Mobile has similar theme/dossier drift but was not modified.
- This ports the visible character layer and pose motion, not every single handoff `DossierScene.dc.html` micro-scene.
- Live staging still needs browser QA after Dokploy deploy picks up the PR branch.
- If staging PDF still returns 500 after this PR deploys, inspect deployed logs/runtime version next; local PDF regression tests pass.
