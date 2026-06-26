# 2026-06-25 Light Canvas Source Token Follow-Up

## Scope

- Follow-up to the source-bundle UI/theme/cache audit after staging light mode looked worse than intended.
- Source bundle checked from `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project`.
- Repo memory/docs were not used as audit evidence; this handoff records the current code/source findings and the code change made.

## Source Evidence

- `Move.dc.html` defines light theme surfaces as `bg:'#EFEADF'`, `surface:'#FFFFFF'`, `surface2:'#F5F0E7'`, and `surface3:'#ECE6DA'`.
- `Move.dc.html` imports `DossierScene` into the home dossier card stage at `hint-size="100%,82px"`.
- `DossierScene.dc.html` contains the source dossier animation keyframes and scenario variants.

## Current Code Findings

- Web shared tokens already expose the source light paper token: `packages/shared/src/design-tokens.ts` defines `surfaceLight.background: "#EFEADF"` and `surfaceLight.surface: "#FFFFFF"`.
- Web app shell background uses `--lf-app-bg`; the bad follow-up made this a white-heavy mix. This patch restores it to `var(--bg)`, which resolves to the generated light `#EFEADF` token.
- Dossier scene code is present on web: `apps/web/src/components/dashboard/home-dossier.tsx` renders the source dossier deck/stage, and `apps/web/src/styles/source-dossier-scene.css` carries the source animation keyframes.
- Web dossier cache is not only API-every-time:
  - Browser/session cache in `apps/web/src/components/dashboard/home-dossier.tsx` uses `window.sessionStorage` under `lf:home-dossier:v1:`.
  - Server route cache in `apps/web/src/app/api/addresses/[id]/dossier/route.ts` returns `X-Dossier-Cache` and `Cache-Control`.
  - Durable area-data cache in `apps/web/src/lib/address-data-cache.ts` returns fresh `HIT` and stale fallback `STALE`.
- Mobile was inspected but not modified. Mobile light theme consumes the same shared `surfaceLight.background`; mobile dossier cache uses memory + disk through `apps/mobile/src/lib/home-dossier-cache.ts`.

## Code Changes

- `apps/web/src/styles/globals.css`
  - Restored light app canvas to `--lf-app-bg: var(--bg)`.
  - Reduced the light-mode backdrop white veil and grid so the dashboard reads as warm source beige instead of grey/washed.
  - Increased light-mode dossier ambient contrast/saturation and reduced the white overlay on animated scene rows.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the contract test to require the raw source beige token path.
  - Added guards against reintroducing the previous white-heavy `color-mix(... #FFFFFF 62%)` canvas.

## Validation

- `git diff --check` passed.
- `pnpm --filter @locateflow/web test -- src/components/dashboard/route-map-card.test.tsx src/components/dashboard/home-dossier.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier-fetch.test.tsx src/lib/pricing-free-tier-contract.test.ts src/lib/service-worker-cache.test.ts` passed: 6 files, 140 tests.
- `pnpm --filter @locateflow/web lint` passed via `tsc --noEmit`.
- Node warning remains environmental: repo wants Node 22.x; local run used Node v24.13.0.

## Not Changed

- No mobile source files were changed.
- No admin source files were changed.
- No dependency, lockfile, env, deployment, or production config files were changed.

## Remaining QA

- After Dokploy deploys the pushed commit, verify staging dashboard light mode at `/dashboard`.
- Verify a home dossier page shows the source dossier deck/stage and clearer row animations.
- Verify route map labels remain legible in light mode.
- Verify `/api/addresses/:id/dossier/pdf` separately; this patch is visual/theme only and does not change PDF export code.
