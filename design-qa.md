# Design QA - Source Bundle Integration, Web Dossier, Mobile Gaps

final result: blocked

source visual truth path: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`, `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/DossierScene.dc.html`, and `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move Web.dc.html`

implementation screenshot path: blocked. No fresh rendered implementation screenshot was captured after the latest web branch commits.

viewport: blocked. The source mobile app prototype is 390x844. The current implementation target is the authenticated web dashboard plus later mobile parity; same-state desktop, mobile-web, and native mobile captures still need to be compared.

state: light-mode authenticated dashboard, Home Dossier visible.

full-view comparison evidence: blocked. Code/source comparison was completed, but Product Design QA requires the source visual and rendered implementation screenshot in the same comparison input before claiming visual pass.

focused region comparison evidence: blocked. The focused regions are the light dashboard canvas, route-map labels, Home Dossier source deck, dossier animation stages, and source card controls. No fresh staging/browser screenshot exists for the latest branch head.

findings:

- [P1] Staging is still behind the PR branch that contains the visual fixes.
  Location: git remote state.
  Evidence: after `git fetch origin staging fix/ui-ux-remediation`, `origin/staging` remained at `775c0e6f`, while `fix/ui-ux-remediation` was at `06a8aeda` before the latest keyframe patch. User screenshots from `staging.locateflow.com` can therefore still show the older, worse light theme and non-source dossier behavior.
  Fix status: not deployable from this agent. PR branch must be merged to staging and Dokploy must build that resulting staging commit.

- [P1] The previous light shell tone was visually too muddy on the wide authenticated dashboard.
  Location: `apps/web/src/styles/globals.css`, `.light` and light shell gradient utilities.
  Evidence: source `Move.dc.html` defines `bg: #EFEADF` and `surface2: #F5F0E7`; applying the heavier warm paper to the full wide shell plus translucent dashboard panels made the UI read greyed-out in the user's screenshot.
  Fix made: keep the wide web light shell on the cleaner source `surface2` tone `#F5F0E7` and reduce the light overlay wash so dashboard panels do not look disabled.

- [P1] Home Dossier source scene deck was not using the source interaction model until the PR branch changes.
  Location: `apps/web/src/components/dashboard/home-dossier.tsx`, `apps/web/src/styles/globals.css`.
  Evidence: source `Move.dc.html` uses a priority-ordered horizontal scene-card deck with `View full / Swipe view`, stage tags, 5-segment bars, band labels, and dots. Staging still shows the older row layout until the PR branch is deployed.
  Fix made: source-like priority sort, default swipe deck, full/swipe toggle, source tags, band labels, dots, and card-level source tone variables were added on the web branch.

- [P2] Source DossierScene keyframe definitions are now covered by the web CSS.
  Location: `apps/web/src/styles/source-dossier-scene.css`.
  Evidence: source `DossierScene.dc.html` defines 37 keyframes. Web CSS now defines all source keyframes; extras are local web extensions (`ds-bubble`, `ds-floatband`, `ds-stroll`). Regex comparison reported `web animation uses without web keyframes: none`.
  Fix made: add the missing source `ds-fan` keyframe. Note: source itself does not visibly use `ds-fan`, so this is parity cleanup rather than the main visible animation failure.

- [P1] Mobile Home Dossier parity is not implemented.
  Location: `apps/mobile/src/components/ui/HomeDossierCard.tsx`, `apps/mobile/src/lib/home-dossier.ts`.
  Evidence: mobile renders row-based `DossierAmbient` layers and still has paid-unlock comments/copy paths, not the source horizontal scene-card deck from `Move.dc.html`.
  Fix status: not changed. The user asked to be notified before mobile edits.

- [P2] The source README note about mobile standalone modules being unlinked is stale relative to current code.
  Location: `apps/mobile/app/(tabs)/more.tsx`, `apps/mobile/app/settings/workspace.tsx`, `apps/mobile/app/invitations/[token].tsx`, `apps/mobile/app/workspace/accept-invite.tsx`.
  Evidence: current mobile code already links Search, Providers, Custom Providers, Reminders, Workspace, Help, Support, Notifications, and invite accept flows.
  Fix status: no source changes needed for this finding.

patches made in the active PR branch:

- `apps/web/src/styles/globals.css`: light shell tone correction, route-map label light-mode styling, source deck styling.
- `apps/web/src/components/dashboard/home-dossier.tsx`: source-like Home Dossier deck behavior and controls.
- `apps/web/src/components/dashboard/dossier-ambient.tsx`: source scene tag and scene variable helpers.
- `apps/web/src/styles/source-dossier-scene.css`: source keyframe parity for `ds-fan`.
- `apps/web/src/i18n/messages/en.json`: deck labels.
- `apps/web/src/i18n/messages/es.json`: deck labels.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`: regression coverage for source deck controls and visual markers.

verification:

- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier` passed.
- `pnpm --filter @locateflow/web lint` passed.
- `pnpm --filter @locateflow/web build` passed.

remaining blockers:

- Merge PR branch into staging, then confirm Dokploy built the resulting staging commit.
- Capture fresh screenshots after that deploy and compare them against the source visuals in the same QA input.
- Mobile Home Dossier source deck parity needs a separate approved mobile edit pass.
- Admin dashboard visual/runtime QA has not been completed in this pass.
