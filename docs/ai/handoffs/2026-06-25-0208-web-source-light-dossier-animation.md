# 2026-06-25 Web Source Light + Dossier Animation Follow-up

## Scope

- Compared the provided source bundle at `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested` against the current web and mobile source.
- Used source code, configs, manifests, tests, and the source bundle README only. Existing repo memory/docs were not used as evidence.
- Changed web only. Mobile was read-only in this pass.

## Source Findings

- `project/Move.dc.html` light theme defines `bg: #EFEADF`, `bg2: #E7E1D4`, `surface: #FFFFFF`, and `surface2: #F5F0E7`.
- The source dossier renders a visible animated `DossierScene` stage in a source deck. The current web CSS had already ported the source deck, but hid it on desktop when the detailed rows were shown.
- `project/DossierScene.dc.html` supports the weather, air, water, area, transit, cost, and housing animation states, including good/mid/bad ranges and weather variants.

## Web Changes

- Restored the light app canvas to the source warm paper token `#EFEADF`.
- Kept web chrome and dense dashboard surfaces on white/pearl variables to avoid the previous muddy beige regression.
- Kept the light app backdrop disabled so no grid/overlay muddies the warm canvas.
- Stopped hiding the source dossier animation deck at desktop widths. Desktop now keeps the detailed rows and also shows the source animation deck, with compact card sizing.
- Updated tests so the intended contract is explicit: source canvas plus clean white surfaces, and no desktop rule that hides the dossier animation deck.

## Mobile Read-only Notes

- `apps/mobile/src/lib/theme.ts` already maps light `background` to shared `surfaceLight.background`.
- `packages/shared/src/design-tokens.ts` defines `surfaceLight.background` as `#EFEADF`.
- `apps/mobile/src/lib/home-dossier-cache.ts` uses device-side memory + offline cache with a 30 minute default freshness window and stale fallback on network error.
- No mobile files were modified.

## Checks Run

- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`
- `git diff --check`

## Notes

- Commands reported the existing local engine warning: package expects Node 22.x while local Node is v24.13.0.
- The Next build passed with existing warnings about the deprecated middleware convention and CommonJS external export handling for `@prisma/client`.
- The staging PDF 500 was not verified from server logs in this pass. The PDF endpoint needs Dokploy/server logs for the failing request to isolate the runtime error.

## Application Source Modified

- Yes, web source and web tests only.
