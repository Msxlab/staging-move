# 2026-06-25 Web Light Theme Follow-up

## Scope

- Responded to staging feedback that the dashboard light-mode paper color became too heavy/muddy.
- Limited source changes to web CSS and regression tests.
- Did not modify mobile, admin, dependencies, environment files, deployment config, or production data.

## Source Evidence Used

- `apps/web/src/styles/globals.css`
- `apps/web/src/styles/source-dossier-scene.css`
- `apps/web/src/components/dashboard/home-dossier.tsx`
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
- `apps/web/src/components/dashboard/route-map-card.tsx`
- Source bundle theme reference from `Move.dc.html` and `DossierScene.dc.html`

## Changes

- Light dashboard canvas now uses a very light warm off-white undertone instead of the heavier source paper wash across the whole app shell.
- Light app chrome and panels remain white/crisp so dashboard cards do not inherit the muddy beige look.
- Route map endpoint labels now use light paper surfaces in light mode, not dark overlay styling.
- Dossier source-stage and row-stage light overrides no longer use the dark `#101B30/#0A1322` scene background.
- Dossier scene tags were tuned for light mode so they sit on the lighter stage without black badges.
- Added regression tests that pin:
  - light dossier stages to the light map canvas;
  - route map light labels away from the dark overlay treatment.

## Verification

- `pnpm --filter @locateflow/web test -- route-map-card dossier-ambient home-dossier`
  - 4 files passed, 125 tests passed.
- `pnpm --filter @locateflow/web test -- "app/api/addresses/[id]/dossier/pdf/route"`
  - 1 file passed, 10 tests passed.
- `pnpm --filter @locateflow/web lint`
  - passed.
- `pnpm --filter @locateflow/web build`
  - passed.
- `git diff --check`
  - passed with only the existing line-ending warning for `apps/web/src/styles/globals.css`.

## Notes

- Local commands warn that the current Node version is `v24.13.0` while the repo expects `22.x`.
- Build still emits existing Next/Prisma warnings, but it completed successfully.
- If staging still shows the old muddy color or PDF 500 after this branch is merged/deployed, verify Dokploy is running the newest image/commit and check staging container logs for the PDF endpoint.
