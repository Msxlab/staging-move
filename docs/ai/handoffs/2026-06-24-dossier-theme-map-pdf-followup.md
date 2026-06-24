# 2026-06-24 Dossier Theme, Route Map, PDF Follow-Up

## Scope
- Follow-up to the 2026-06-24 staging regression PR branch:
  `codex/staging-regression-audit-fixes`.
- Investigated the latest user screenshots for:
  route-map label appearance in light mode, Dossier theme/animation visibility,
  and live staging Dossier PDF 500.
- Compared current web source against the supplied latest theme handoff folder:
  `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)`.
- Source code was modified.

## Verified From Code
- Route map labels were hard-coded as black translucent chips in
  `apps/web/src/components/dashboard/route-map-card.tsx`, so light-mode real
  maps inherited a dark label style that did not match the theme.
- The latest theme handoff's `Move.dc.html` keeps light mode on warm Greige
  surfaces (`#EFEADF`, `#F5F0E7`) and defines richer DossierScene conditions.
  Current web tokens already contain the warm light surface values, but the
  Home Dossier rows were still using `bg-foreground/[0.02]` and the shell used
  `bg-foreground/5`, which made the token change weak in the Dossier surface.
- `DossierAmbient` existed and mapped data to scenes, but the web layer was
  narrow, heavily masked, and low opacity compared with the supplied theme
  scene intent.
- `scripts/prepare-web-standalone.mjs` copies pdfkit standard font data, but
  both web Docker build files only ran `next build`; the prepare step was not
  part of the production/staging image build path.

## Changes Made
- Added theme-aware route-map label styling:
  light mode now uses clean paper chips with endpoint-colored borders/text
  instead of fixed black labels.
- Added `lf-dossier-shell`, `lf-dossier-row`, and `lf-dossier-stat` theme hooks
  and wired them into the dashboard Home Dossier and marketing Dossier demo.
- Increased Dossier ambient visibility:
  wider scene layer, softer mask ramp, light-mode glow backing, and stronger
  wave/cloud/wind/water/housing/neighborhood scene opacity.
- Updated Docker build paths to run `node scripts/prepare-web-standalone.mjs`
  after the web build so staging/production standalone images include pdfkit
  standard font data.
- Extended the route-map card test to assert the new endpoint-aware label
  markup.

## Tests Run
- `pnpm --filter @locateflow/web test -- src/components/dashboard/route-map-card.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pdf/standard-font-data.test.ts "src/app/api/addresses/[id]/dossier/pdf/route.test.ts"`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `node --check scripts/prepare-web-standalone.mjs`
- `git diff --check`

## Risks / Follow-Up
- Local tests prove the React/CSS/TypeScript and PDF shim paths compile; they do
  not prove the deployed Docker image without a real image build.
- Live staging will keep showing the old Dossier/PDF behavior until the PR
  branch is merged/deployed to staging.
- After deploy, manually verify:
  route-map light labels, Dossier light/dark visuals, animated scene visibility,
  and `/api/addresses/:id/dossier/pdf` from a real authenticated staging account.
- The web pass improves parity with the latest theme handoff but does not port
  every `DossierScene.dc.html` character scene and condition variant one-for-one.
  Mobile was intentionally not changed in this pass.
