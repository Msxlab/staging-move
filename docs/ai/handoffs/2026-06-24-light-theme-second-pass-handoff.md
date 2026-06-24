# Handoff - 2026-06-24 Light Theme Second Pass

## Scope

Responded to the staging dashboard light-theme regression reported by the user: the prior beige/light canvas appeared too dark, grey-brown, and low-contrast on `/dashboard`. Also preserved and verified the dossier scene fixes from the source prototype comparison.

## Source Evidence Used

- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/DossierScene.dc.html`
- Application source files in this repository.

## Code Changes

- Adjusted web Aurora light tokens back to the source warm-paper base `#EFEADF`, while making panes/cards more opaque white:
  - `packages/shared/src/design-tokens-css.ts`
  - `apps/web/src/styles/_aurora-tokens.generated.css`
- Added scoped `.light .lf-aurora` overrides for dark-first translucent utility classes (`bg-foreground/5`, `bg-card/70`, `bg-background/55`, etc.) so app panels no longer inherit a muddy ink wash.
- Lightened the app-shell backdrop in `apps/web/src/styles/globals.css`.
- Updated light browser theme color metadata in `apps/web/src/app/layout.tsx`.
- Kept dossier mapping fixes in `apps/web/src/components/dashboard/dossier-ambient.tsx`:
  - flood -> water
  - radon -> air
  - school -> area/good
  - low walkability -> area/mid, never area/bad chase
- Added umbrella CSS and a CSS-class regression test.
- Added local design QA harness under `docs/ai/audits/2026-06-24-source-dossier-qa/`.
- Added root `design-qa.md` with final result marked blocked because staging deploy verification remains external.

## Verification

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card design-tokens-contrast`
- `pnpm --filter @locateflow/shared exec tsc --noEmit`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile test -- src/lib/home-dossier.test.ts src/lib/home-dossier-cache.test.ts src/lib/dossier-raccoon.test.ts`
- `pnpm --filter @locateflow/web build`
- `pnpm --filter @locateflow/web exec tsx "../../docs/ai/audits/2026-06-24-source-dossier-qa/render-web-dossier-qa.tsx"`
- Local light-shell Playwright harness: `02-web-light-shell-harness.png` / `.metrics.json` under `docs/ai/audits/2026-06-24-source-dossier-qa/`
- `git diff --check`

Known command warnings:
- Node engine warning: repo wants Node 22.x, current local Node is v24.13.0.
- Next build warnings about deprecated middleware convention, Prisma CJS export analysis, and edge runtime static generation.

## Not Changed

- Did not modify payment/billing logic.
- Did not modify mobile source code in this pass.
- Did not deploy or merge.
- Did not include the unrelated local changes in `docs/design-system/colors_and_type.css` or `docs/ui-renewal/30_UIUX_REMEDIATION_PLAN_2026-06-24.md`.

## Next QA

- Confirm Dokploy deploys the PR's latest commit.
- On staging, hard-refresh `/dashboard` in light mode and verify the canvas is warm but not dark/grey-brown.
- Re-check real home dossier rows and route map labels on the user's staging account.
- Re-test the staging PDF export 500 separately; this pass did not complete backend PDF debugging.
