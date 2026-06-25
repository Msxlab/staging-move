# Design QA - Source Greige Shell and Dossier Scene Deck

final result: blocked

source visual truth path: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`

implementation screenshot path: `C:/Users/Windows/AppData/Local/Temp/codex-clipboard-9dbdcdd0-3602-412c-8ab7-ed161994ff13.png`

viewport: desktop browser screenshot from user; exact viewport not verified in tooling.

state: light-mode authenticated dashboard.

full-view comparison evidence: blocked. The user-provided staging screenshot shows the authenticated dashboard shell looking too muddy/grey-beige after the prior beige app-shell correction. This session could inspect source/code and the supplied screenshot, but the current toolset did not expose a controllable Chrome/browser capture for a fresh same-state side-by-side comparison after the new patch.

focused region comparison evidence: blocked. The affected areas are the dashboard shell/background, route-map labels on light maps, and the Home Dossier visual scene treatment. A fresh staging screenshot after deploy is still needed before a pass can be claimed.

findings:

- [P1] Light dashboard background was over-tinted.
  Location: `apps/web/src/styles/globals.css`, `.light` and `.light .app-shell-backdrop`.
  Evidence: source keeps a greige page gradient in `Move.dc.html`; a flat beige/wash made the authenticated dashboard look muddy in the supplied screenshot.
  Fix made: set the authenticated light shell to the source-style radial greige gradient (`#EFEEEA -> #DEDCD3 -> #D4D2C8`) while keeping cards/surfaces white and reducing the backdrop/grid wash.

- [P2] Route map labels needed stronger light-mode contrast.
  Location: `apps/web/src/styles/globals.css`, `.light .lf-route-map-label`.
  Evidence: light basemaps make semi-transparent labels low contrast.
  Fix made: label chips are now more opaque, darker, and use stronger border/shadow in light mode.

- [P1] Home Dossier source parity is still not visually proven.
  Location: `apps/web/src/components/dashboard/home-dossier.tsx`, `apps/web/src/components/dashboard/dossier-ambient.tsx`, `apps/web/src/styles/source-dossier-scene.css`.
  Evidence: source `Move.dc.html` uses a prominent horizontal scene-card treatment; current web renders source scene animations inside the production data-row/grid pattern. Code wiring exists and tests prove source scene markup renders, but fresh visual proof on staging is blocked.
  Fix made: add a visual source-style scene deck above the detailed rows, using the same real `deriveDossierView` data and existing `DossierAmbient` scene matrix, so the animations read as scene-first cards instead of faint row decoration.

patches made in this follow-up:

- `apps/web/src/components/dashboard/home-dossier.tsx`: source-style visual scene deck added above the detailed rows.
- `apps/web/src/styles/globals.css`: source radial greige light shell restored with white surfaces; source deck styling added.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`: guard added for the source scene deck markup.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`: guard updated so the light shell stays on the source greige radial gradient and rejects previous flat/incorrect backgrounds.

verification:

- `pnpm tokens:check` passed.
- `pnpm --filter @locateflow/web test -- home-dossier` passed.
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract` passed.
- `pnpm --filter @locateflow/web test -- dossier-ambient route-map-card standard-font-data` passed.
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts"` passed.
- `pnpm --filter @locateflow/web test -- workspace-routes` passed.
- `pnpm --filter @locateflow/web lint` passed.
- `pnpm --filter @locateflow/web build` passed.

remaining blockers:

- Fresh staging/browser screenshot after deploy.
- Dokploy runtime logs for the still-reported dossier PDF 500; browser JSON only says `Failed to build dossier PDF`, while code now logs the real `code/message/stack`.
- Runtime config check for `WORKSPACE_MODEL_ENABLED=true`; code shows workspace creation/invites are still intentionally gated by that flag even when `CONSUMER_FREE` resolves consumers to PRO.
