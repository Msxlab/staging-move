# 2026-06-25 Beige Canvas And Dossier Row Animation Handoff

## Scope

- Corrected the latest web light-theme regression after user visual review.
- Kept the change limited to web theme/dossier presentation tests and CSS.
- Mobile and admin were inspected read-only for parity notes; no mobile/admin source files were changed.

## Source Bundle Findings

- `Move.dc.html` defines the light Greige app background token as `#EFEADF`.
- The same source keeps clean white surfaces on top of that beige paper canvas.
- The provided staging screenshot shows the row-style home dossier with right-side ambient animations, so hiding the detailed dossier rows made the current web experience worse even if the source deck was present.
- `DossierScene.dc.html` contains the full animated scene matrix for weather, air, water, area, transit, cost, and housing-style scenes. Web has a source-scene bridge, but the row-list animations also need to remain visible.

## Web Changes

- Restored the full authenticated light app canvas to `var(--bg)`, which resolves to the source beige `#EFEADF`.
- Reduced the app-shell overlay so the beige canvas is not muddied by a heavy pearl/white wash.
- Stopped hiding `.lf-dossier-grid[data-source-compact="true"]`; the animated detail rows now remain visible under the source dossier deck.
- Updated regression tests so the beige canvas and visible animated rows are protected.

## Mobile Read-Only Notes

- Mobile light theme already consumes shared `surfaceLight.background`, which is the same beige token.
- Mobile home dossier uses a row-list `HomeDossierCard` with React Native Reanimated ambient scenes.
- Mobile does not currently implement the exact `Move.dc.html` source dossier deck/swipe/full-view pattern.
- No mobile source changes were made; mobile parity work should be approved separately before edits.

## Admin Read-Only Notes

- The external admin prototype is a dark navy/gold admin surface.
- Current admin styling is broadly in that dark/admin direction and was not part of this beige web regression.
- No admin source changes were made.

## Verification

- `pnpm --filter @locateflow/web test -- src/lib/pricing-free-tier-contract.test.ts src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

All checks passed locally. Local Node warning remains: repo requests Node 22.x, local runtime is Node v24.13.0.

## Risks And QA

- Web now shows both the source deck and the detailed animated rows. This restores the visible animations the user expected, but product may later choose a tighter combined layout.
- Browser screenshot QA was not completed in this pass; staging should be visually checked after deploy.
- Staging deploy must pick up the new commit before the visual change appears.

