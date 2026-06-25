# Design QA - Source Warm Paper and Dossier Scene Deck

final result: blocked

source visual truth path: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html` and `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/DossierScene.dc.html`

implementation screenshot path: blocked. No fresh rendered implementation screenshot was captured after the latest patch.

viewport: blocked. The source is a 390x844 mobile prototype; the implementation target is the authenticated web dashboard, which still needs a same-state desktop and mobile-web capture after deploy.

state: light-mode authenticated dashboard, Home Dossier visible.

full-view comparison evidence: blocked. Code/source comparison was completed, but Product Design QA requires a visible source + rendered implementation comparison in the same input before claiming visual pass.

focused region comparison evidence: blocked. The focused regions are the light app canvas, Home Dossier source deck, dossier animation stages, and source card controls. No fresh staging/browser screenshot exists for the latest patch.

findings:

- [P1] Light dashboard background had drifted from the source app canvas.
  Location: `apps/web/src/styles/globals.css`, `.light` and `.light .app-shell-backdrop`.
  Evidence: source `Move.dc.html` defines the light app interior as `bg: #EFEADF`; the darker greige radial belongs to the outer prototype page. A muddy radial/grid wash on the authenticated shell made the dashboard look greyed out.
  Fix made: set the light app shell to `#EFEADF` and disable the light shell backdrop/grid overlay.

- [P1] Home Dossier source scene deck was not using the source interaction model.
  Location: `apps/web/src/components/dashboard/home-dossier.tsx`, `apps/web/src/styles/globals.css`.
  Evidence: source `Move.dc.html` uses a priority-ordered horizontal scene-card deck with `View full / Swipe view`, stage tags, 5-segment bars, band labels, and dots. Production had source scene markup, but the deck was fixed-order, lacked source controls/tags/band labels, and desktop CSS converted it straight to a grid.
  Fix made: sort scene cards by source-style priority, keep default swipe mode, add `View full / Swipe view`, stage tags, band labels, and dots, and use expanded mode for wrapped full view.

- [P2] Source scene tone variables were applied too low in the DOM.
  Location: `apps/web/src/components/dashboard/home-dossier.tsx`, `apps/web/src/components/dashboard/dossier-ambient.tsx`.
  Evidence: card-level accents and bar segments read `--ds-tone`, but the variable previously lived only inside the nested scene layer.
  Fix made: export and apply `sourceSceneVars` on each source card parent.

- [P1] Mobile dossier parity is not implemented.
  Location: `apps/mobile/src/components/ui/HomeDossierCard.tsx`.
  Evidence: mobile renders row-based `DossierAmbient` layers, not the source horizontal scene-card deck. Mobile light tokens already use `#EFEADF`, and mobile cache is device-side memory + offline disk cache.
  Fix status: not changed. User asked to be notified before mobile edits.

patches made since previous QA pass:

- `apps/web/src/components/dashboard/home-dossier.tsx`: source-like priority deck, swipe/full toggle, source tags, band labels, dots, parent scene variables.
- `apps/web/src/components/dashboard/dossier-ambient.tsx`: export source scene tag and scene variable helpers.
- `apps/web/src/styles/globals.css`: source warm-paper light shell, no light backdrop wash, and source deck CSS.
- `apps/web/src/i18n/messages/en.json`: deck labels.
- `apps/web/src/i18n/messages/es.json`: deck labels.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`: regression coverage for source deck controls and visual markers.

verification:

- `pnpm --filter @locateflow/web test -- home-dossier` passed.
- `pnpm --filter @locateflow/web test -- dossier-ambient` passed.
- `pnpm --filter @locateflow/web lint` passed.
- `pnpm --filter @locateflow/web build` passed.

remaining blocker:

- Capture fresh staging or local browser screenshots after the latest commit, place them next to the source visual, and compare the light canvas + dossier deck before this can be marked `passed`.
