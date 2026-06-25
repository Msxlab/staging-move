# Design QA - Source Paper Light Theme And Dossier Runtime

final result: blocked

source visual truth path: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`, `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/DossierScene.dc.html`, and the user-provided staging dashboard screenshots.

implementation screenshot path: blocked. No fresh rendered implementation screenshot was captured after the latest branch commit because no Browser/Chrome capture tool was available in this run.

viewport: blocked. Source mobile app prototype is 390x844. Current implementation target is the authenticated web dashboard light theme plus later mobile parity. Desktop, mobile-web, and native-mobile screenshots still need same-state comparison.

state: authenticated dashboard, light mode, Home Dossier visible, route map visible, source-paper canvas expected.

full-view comparison evidence: blocked. Code/source comparison and regression tests were completed, but Product Design QA requires the source visual and rendered implementation screenshot in the same comparison input before claiming visual pass.

focused region comparison evidence: blocked. Required focused regions are the light dashboard canvas, route-map labels, Home Dossier source deck, dossier animation stages, and source card controls. A fresh staging/browser screenshot for the latest branch head is still missing.

findings:

- [P0] Staging is still not proven to contain the fix branch.
  Location: git remote/deployment state.
  Evidence: `origin/fix/ui-ux-remediation` was pushed to `4cb639e6`, while `origin/staging` remains `775c0e6f`. The latest source-paper correction is not in `origin/staging` unless Dokploy is explicitly building the fix branch.
  Impact: staging screenshots can still show the older broken colors, missing source deck, and old route labels even when the PR branch code is corrected.
  Fix: merge or deploy the fix branch, then confirm Dokploy built commit `4cb639e6` or a later merge commit containing it.

- [P1] Source paper background had drifted away from the source bundle.
  Location: `packages/shared/src/design-tokens.ts`, `packages/shared/src/design-tokens-css.ts`, `apps/web/src/styles/globals.css`, `apps/web/src/styles/aurora.css`, generated web token partials.
  Evidence: source `Move.dc.html` defines light `bg:'#EFEADF'`, `bg2:'#E7E1D4'`, `surface:'#FFFFFF'`, `surface2:'#F5F0E7'`, and `surface3:'#ECE6DA'`; current branch had temporarily moved the app canvas to neutral `#F8FAFC`.
  Impact: it contradicted the requested source light theme and could make web/mobile token consumers diverge from the handoff bundle.
  Fix made: restore `#EFEADF` as the web/shared light app canvas while keeping operational panels, chrome, and cards white/solid for contrast.

- [P1] Light theme could become muddy if panels inherit the paper canvas.
  Location: `.light` app shell and `.lf-app-shell` utility overrides in `apps/web/src/styles/globals.css` and `apps/web/src/styles/aurora.css`.
  Evidence: the user screenshot showed the warm canvas reading as a disabled grey wash when too many translucent panels sat on top of it.
  Impact: source beige is correct as the page canvas, but card/panel translucency makes the dashboard feel low-contrast.
  Fix made: light app shell uses source paper, while `bg-foreground/*`, `bg-background/*`, sidebar/header/nav, and dossier cards are forced to white/strong white panel tokens.

- [P1] Home Dossier source deck must be visible before the old row list.
  Location: `apps/web/src/components/dashboard/home-dossier.tsx`, `apps/web/src/styles/globals.css`.
  Evidence: source `Move.dc.html` uses the animated swipe/full scene-card deck with `View full` / `Swipe view`; current web tests confirm `.lf-dossier-source-deck` is present and `.lf-dossier-grid[data-source-compact="true"]` stays hidden instead of returning on desktop.
  Impact: if staging still shows only the old rows, it is a deployment/runtime mismatch, not the expected latest branch code.
  Fix status: covered by existing source deck code and tests; still needs runtime screenshot after deploy.

- [P1] Mobile Home Dossier source deck parity is not implemented.
  Location: `apps/mobile/src/components/ui/HomeDossierCard.tsx`, `apps/mobile/src/lib/home-dossier.ts`.
  Evidence: mobile still renders value rows with native `DossierAmbient` layers, not the `Move.dc.html` swipe/full source card deck.
  Impact: native mobile will not fully match the source handoff even if web does.
  Fix status: not changed. The user asked to be notified before mobile edits.

- [P2] Shared light token change can affect mobile light mode.
  Location: `apps/mobile/src/lib/theme.ts` consumes `surfaceLight` from `@locateflow/shared`.
  Evidence: `surfaceLight.background` is now source paper `#EFEADF`; mobile imports that token for `theme.colors.background`.
  Impact: mobile light canvas may shift on the next mobile build even though no mobile file was edited directly.
  Fix: treat mobile visual QA as required before shipping a mobile build.

patches made since previous QA:

- Restored source light paper canvas: `#EFEADF` for web/shared light background and `#E7E1D4` / `#F5F0E7` / `#ECE6DA` source-family secondary surfaces.
- Kept light app chrome and operational panels white/solid for contrast.
- Updated browser light `theme-color` to `#EFEADF`.
- Regenerated web token CSS partials from `packages/shared/src/design-tokens-css.ts`.
- Updated regression tests from "neutral canvas" to "source paper canvas with white web surfaces."

verification:

- `pnpm tokens:emit` passed.
- `pnpm tokens:check` passed.
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pricing-free-tier-contract.test.ts` passed, 113 tests.
- `pnpm --filter @locateflow/web lint` passed.
- `git diff --check` passed.

remaining blockers:

- Fresh screenshot capture of the latest branch is still required before visual QA can pass.
- Staging deployment must be confirmed to contain the latest branch commit.
- PDF 500 still requires Dokploy runtime log evidence.
- Mobile source deck parity needs an explicitly approved mobile implementation pass.
