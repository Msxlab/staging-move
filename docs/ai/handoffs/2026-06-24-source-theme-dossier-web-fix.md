# 2026-06-24 Source Theme and Dossier Web Fix Handoff

## Scope

User reported the deployed light theme became muddy/low contrast, dossier scene animations were not visible enough, and requested comparison against:

`C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`

This handoff records source-code evidence only. Existing repository docs/memory files were not used as audit evidence.

## Source Bundle Findings

- `README.md` says the primary design is `project/Move.dc.html`; imports should be followed from there.
- `Move.dc.html` defines the light theme tokens at lines around 1020:
  - `bg: #EFEADF`
  - `bg2: #E7E1D4`
  - `surface: #FFFFFF`
  - `surface2: #F5F0E7`
  - `surface3: #ECE6DA`
  - `heroGrad: linear-gradient(135deg,#FFFFFF,#F4EFE5)`
- `Move.dc.html` imports `DossierScene` for dossier cards at line around 163.
- `Move.dc.html` maps dossier categories to scene types at lines around 1206-1215:
  - weather -> weather
  - air -> air
  - water -> water
  - safety -> area
  - transit -> transit
  - cost -> cost
  - housing -> housing
- `DossierScene.dc.html` has the full animation matrix and keyframes at lines around 13-49.
- `DossierScene.dc.html` supports source scene props at lines around 514-539:
  - types: weather, air, water, area, transit, cost
  - levels: good, mid, bad, sun, cloud, rain, snow, storm, fog, wind, heat, cold
- There is no source `flood` scene type. The web app's `flood` scene is a product-specific bridge for FEMA flood rows.

## Web Findings

- Web dossier rows use `DossierAmbient` from `apps/web/src/components/dashboard/dossier-ambient.tsx`.
- Web maps app-specific sections to source-like scene types in `sourceDossierSceneFor`.
- Web `HomeDossierCard` uses row-list dossier layout, not the exact source horizontal swipe/full card model from `Move.dc.html`.
- Web browser cache for dossier data is in `sessionStorage` through `apps/web/src/components/dashboard/home-dossier.tsx` with key prefix `lf:home-dossier:v1:`.
- The light theme drift came from shadcn light tokens being colder than the source bundle while app shell/canvas changes tried to restore source beige separately.

## Web Changes Made

- Restored generated shadcn light token alignment to the source warm-paper palette:
  - `--background` -> source `#EFEADF`
  - `--muted` and `--accent` -> source `#F5F0E7`
  - `--surface-secondary` -> source `#F5F0E7`
- Adjusted the web app canvas to the lighter source paper end (`#F4EFE5`) so the whole page stays warm without looking muddy.
- Reduced the app shell grid/gradient overlay opacity and ink density.
- Raised flood scene bands in `source-dossier-scene.css` so the flood animation is visible inside the 82px dossier scene stage.

## Mobile Findings

Mobile was inspected but not modified.

- `apps/mobile/src/lib/theme.ts` already consumes shared source light surface tokens for the mobile theme.
- `apps/mobile/src/components/ui/HomeDossierCard.tsx` is a React Native row-list implementation, not the exact source `Move.dc.html` dossier card/swipe/full model.
- `apps/mobile/src/components/ui/DossierAmbient.tsx` is an independent RN/Reanimated implementation inspired by web parity; it is not a direct port of `DossierScene.dc.html`.
- `apps/mobile/src/components/ui/HomeDossierCard.tsx` still has a light-mode risk at line around 705: `backgroundColor: "rgba(255,255,255,0.025)"`. This is a dark-mode alpha pattern and may be too low contrast in mobile light mode.

## Tests Run

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile test -- home-dossier`

All commands passed. Each pnpm command emitted the expected local warning that this machine runs Node v24.13.0 while the repo requests Node 22.x.

## Remaining Risks

- No fresh post-fix staging screenshot was captured in this step.
- Mobile visual parity is not fixed yet; only inspected and tested.
- Admin source parity was not completed in this web-focused fix.
- The PDF 500 remains a backend/staging runtime issue unless separately reverified and fixed.

## Recommended Next Action

Deploy this branch to staging, hard refresh the web app, and capture light-mode screenshots for:

- `/dashboard`
- an address dossier page
- route map light mode
- PDF export endpoint

Then decide whether to apply the mobile light-mode row/surface fix.
