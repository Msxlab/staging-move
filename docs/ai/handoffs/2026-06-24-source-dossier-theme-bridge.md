# 2026-06-24 Source Dossier Theme Bridge

## Scope
- User reported staging light theme became worse after the neutral canvas correction, and asked to compare the current web/mobile implementation against the source bundle under `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- This handoff records the web changes made in this pass and mobile findings from source inspection only.

## Source Evidence Read
- `Move.dc.html` source light theme uses `bg: #EFEADF`, `bg2: #E7E1D4`, `surface: #FFFFFF`, `surface2: #F5F0E7`, `surface3: #ECE6DA`.
- `Move.dc.html` builds dossier cards from a source `typeMap` / `levelMap` and passes `type` and `level` into `DossierScene`.
- `DossierScene.dc.html` supports source scene types `weather`, `air`, `water`, `area`, `transit`, `cost`, and `housing`, with levels including `good`, `mid`, `bad`, and weather-specific levels such as `rain`, `snow`, `storm`, `fog`, `wind`, `heat`, and `cold`.

## Web Changes
- Restored web light theme tokens to the source beige canvas:
  - `--bg: #EFEADF`
  - `--bg-deep: #E7E1D4`
  - shadcn `--background: 41.25 33.33% 90.59%`
  - Aurora `--au-base: #EFEADF`
- Kept cards white and reduced the page backdrop's white/greige overlay so the source beige reads without the muddy full-screen wash seen in staging.
- Added `sourceDossierSceneFor` to bridge the current row ambient model to the source `DossierScene(type, level)` matrix.
- `DossierAmbient` now emits `data-source-type` and `data-source-level`, so web output can be tested against the source scene states.
- Increased dossier ambient visibility in light mode and emphasized source elevated/weather states without moving the row text or changing data semantics.

## Mobile Findings
- Mobile was inspected only; no mobile files were changed in this pass.
- `apps/mobile/src/lib/home-dossier-cache.ts` already uses device-side memory plus disk/offline cache with a default 30 minute freshness window.
- Mobile dossier UI still uses its local `DossierAmbient` / `ambientForSection` contract, not a direct port of `DossierScene.dc.html`.

## Tests Run
- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier-fetch.test.tsx src/components/ui/dialog.test.tsx src/lib/design-tokens-contrast.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `git diff --check`

## Notes
- Local Node is `v24.13.0`; repo engine asks for Node `22.x`. Commands completed with warnings only.
- Authenticated staging/browser visual QA was not verified in this pass.
- This is a source-semantics bridge and visibility correction, not a full direct replacement of the current row artwork with the entire `DossierScene.dc.html` component.
