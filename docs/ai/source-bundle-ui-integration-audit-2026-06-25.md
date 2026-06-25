# Source Bundle UI Integration Audit - 2026-06-25

## Scope

Evidence used:

- External README: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\README.md`
- External source HTML/CSS/JS bundle under `initial-check-requested\project`
- Current code in this repository
- Git refs: `origin/staging`, `origin/codex/staging-clean-dashboard-canvas`, `origin/fix/ui-ux-remediation`
- User-provided dossier screenshot: `C:\Users\Windows\.codex\attachments\07af7ffd-84d4-4198-b2e3-4966cfd0fdd1\image-1.png`

Existing repo memory, handoff, roadmap, README, and prior `.md` files were not used as audit evidence.

## Source Bundle Map

The README says `Move.dc.html` is the primary design file and that imports should be followed.

Important external files:

- `Move.dc.html`: primary app/mobile-shell prototype. Defines Home, Moving, Services, Addresses, More, stack overlays, theme tokens, bottom nav, AI briefing, countdown, reminders, Home Dossier, route/map, service modules, settings, subscription, profile, blog, privacy, and splash.
- `DossierScene.dc.html`: source dossier animation library. Defines 37 `ds-*` keyframes and scene variants for transit, air, water, area, cost, housing, and weather states.
- `Raccoon.dc.html`: source character asset used by the dossier and app surfaces.
- `Move Web.dc.html` and `Web.dc.html`: marketing/public web shell, hero, dossier feature, FAQ, testimonials, web routes.
- `Admin.dc.html`: admin dashboard/sidebar/topbar/overview/users/moves/providers/support/data sources/analytics/content/settings.
- `Onboarding.dc.html` and `Web Onboarding.dc.html`: native-style and web onboarding flows.

Source theme evidence:

- `Move.dc.html:1020` defines light Greige tokens: `bg:'#EFEADF'`, `bg2:'#E7E1D4'`, `surface:'#FFFFFF'`, `surface2:'#F5F0E7'`, `surface3:'#ECE6DA'`.
- `Move.dc.html:1039` maps these into CSS vars including `--bg`.
- `Move.dc.html:1139` selects the light background preset from `lightBg`, defaulting to `Greige`.

Source dossier evidence:

- `Move.dc.html:149` names the section: `home dossier (priority-ordered - swipe / view full)`.
- `Move.dc.html:156` renders a `toggleDossierFull` button.
- `Move.dc.html:160` renders dossier cards with `flex:0 0 {{ dCardW }}`.
- `Move.dc.html:163` imports `DossierScene` into each card stage.
- `Move.dc.html:1072` toggles `dossierFull`.
- `Move.dc.html:1386-1389` defines `Swipe view`, `View full`, wrap/overflow/snap behavior, card width, and dots.
- `DossierScene.dc.html:34` defines `ds-fan`, which is part of source weather/air motion.
- `DossierScene.dc.html:514-543` defines scene props and the type/level condition matrix.

## Current Web State

On `origin/staging`:

- `home-dossier.tsx` includes `lf-dossier-source-deck`, but it is not a fully connected primary source deck.
- `home-dossier.tsx:890` renders `<div className="lf-dossier-source-deck px-5 pb-4" aria-hidden="true">`.
- `home-dossier.tsx:914` always renders the legacy `lf-dossier-grid`.
- There is no source `dossierFull`/`View full`/`Swipe view` toggle in `origin/staging`.
- `source-dossier-scene.css` is present, but the source `ds-fan` keyframe is missing from `origin/staging`.
- `dossier-ambient.tsx:129` maps app dossier data into source scene type/level.
- `dossier-ambient.tsx:751-765` renders source scene functions for transit, air, water, flood, radon, school, hood, EV, area, cost, housing, and weather.
- `dossier-ambient.tsx:1090` marks the decorative scene layer `aria-hidden`.

On `origin/fix/ui-ux-remediation`:

- The branch has source deck toggle/data-expanded/source-compact wiring.
- The branch has all 37 source keyframes, including `ds-fan`.
- This branch is not what `origin/staging` currently contains.

On `origin/codex/staging-clean-dashboard-canvas` / PR #62:

- Only the light dashboard canvas hotfix is applied.
- `--lf-app-bg` is neutralized to `#F8FAFC`.
- `--lf-source-paper-bg: #EFEADF` is retained as a scoped source paper variable.
- This branch does not complete dossier deck parity.

## Current Theme State

There are three competing states:

1. Source bundle says light Greige background is `#EFEADF`.
2. `origin/staging` applies a global warm radial background ending in `#EFEADF`, which caused the muddy dashboard screenshot.
3. PR #62 neutralizes the app shell to `#F8FAFC` to stop the immediate staging regression.

Conclusion: source fidelity and dashboard readability need a controlled token mapping, not another blind global color swap. The likely intended end state is:

- source paper tone `#EFEADF` available as the light theme foundation;
- white or near-white cards and controls;
- no heavy radial beige overlay over dense dashboard content;
- source dossier/card surfaces should keep the paper feel;
- desktop app shell must be visually QA'd because it is not the same 390x844 source phone shell.

## Current Mobile State

Mobile was inspected read-only.

- `apps/mobile/src/components/ui/HomeDossierCard.tsx` is row/list based.
- It renders `DossierAmbient` per row, for example lines 314, 337, 355, 393, 426, 440, 471, 494, 537, and 597.
- It does not implement the source `Swipe view` / `View full` dossier deck.
- `apps/mobile/src/components/ui/DossierAmbient.tsx` uses Reanimated motion via `withRepeat` / `withTiming`; see lines 12, 88, 111, 292, 692.
- `apps/mobile/src/lib/theme.ts:173` maps mobile light `background` to shared `surfaceLight.background`.
- Therefore changing `packages/shared/src/design-tokens.ts` light background affects mobile globally.

Mobile conclusion: mobile has animated row ambience, not the source deck architecture. Do not change mobile before explicit user approval.

## Admin, Onboarding, Marketing

Source bundle includes complete Admin, Onboarding, and public Web prototypes.

Code counterparts exist:

- Admin app and components exist under `apps/admin/src/app` and `apps/admin/src/components`.
- Web onboarding exists under `apps/web/src/app/onboarding`.
- Marketing components exist under `apps/web/src/components/marketing`.

Not verified yet:

- Pixel/layout parity for Admin.
- Pixel/layout parity for web onboarding.
- Pixel/layout parity for public marketing pages.
- Full interaction parity for prototype overlays/modules.

These require either a code screenshot audit or targeted source-to-implementation QA for the same viewport/state.

## Findings

1. P1 - Dossier source deck is only partially integrated on staging.
   - Evidence: source requires `toggleDossierFull` and swipe/full behavior; staging deck is `aria-hidden`, has no toggle, and legacy grid always renders.
   - Impact: users see the old row/list experience and believe animations did not arrive.
   - Fix: promote the source deck to primary UI, add the toggle/state/dots, and compact or hide the legacy grid when source deck is active.

2. P1 - Staging is not running the broader UI remediation branch.
   - Evidence: `origin/fix/ui-ux-remediation` has toggle/data-expanded/source-compact and all 37 keyframes; `origin/staging` does not.
   - Impact: fixes may exist in a branch but do not affect staging.
   - Fix: either merge the remediation branch after review or backport its dossier-specific subset into a clean staging PR.

3. P1 - Light theme direction is unresolved at token level.
   - Evidence: source says `#EFEADF`; staging used a muddy radial; PR #62 uses neutral `#F8FAFC`.
   - Impact: repeated color reversions can keep breaking dashboard readability.
   - Fix: define a final light-mode mapping: source paper background plus white surfaces, with no muddy overlay. Then run desktop and mobile screenshot QA.

4. P2 - Source motion keyframe parity is incomplete on staging.
   - Evidence: source `DossierScene.dc.html` has 37 keyframes; `origin/staging` is missing `ds-fan`.
   - Impact: at least one source animation state cannot match exactly.
   - Fix: add `ds-fan` or backport the complete `source-dossier-scene.css` from the remediation branch.

5. P2 - Mobile dossier is structurally different from source.
   - Evidence: mobile renders row ambience, not the swipe/full deck.
   - Impact: even if web is fixed, mobile will not match the source dossier interaction.
   - Fix: decide whether mobile should adopt the source deck or intentionally keep the native row list. Implementation requires user approval first.

6. P2 - Design QA cannot be marked passed yet.
   - Evidence: design-qa requires a source visual and rendered implementation screenshot in the same state/viewport. Current work is source/code audit only.
   - Impact: visual parity remains unproven.
   - Fix: after implementation, capture source target and staging/local implementation in matching states, then write `design-qa.md` with pass/blocked status.

## Recommended Integration Order

1. Web dossier parity first.
   - Backport source deck toggle/data-expanded/source-compact behavior from `origin/fix/ui-ux-remediation`.
   - Add missing `ds-fan`.
   - Ensure legacy grid does not dominate the first visual read.
   - Run targeted web tests for `home-dossier`, `dossier-ambient`, and token contracts.

2. Light theme decision second.
   - Reconcile source `#EFEADF` with desktop dashboard readability.
   - Avoid radial beige overlays on dense dashboard surfaces.
   - Test dashboard, dossier, route map, settings, and marketing in light/dark.

3. PDF/export and route-map polish third.
   - The PDF 500 and map labels are separate implementation/runtime issues and should not be hidden inside theme work.

4. Mobile parity after user approval.
   - Either port the source deck interaction to mobile or explicitly document mobile as row-list native variant.
   - Then adjust mobile light tokens and run mobile visual QA.

5. Admin/onboarding/marketing audit pass.
   - Capture or render matching screens and compare against Admin/Web/Onboarding source prototypes.

## Immediate Web Fix Candidates

Safe to do without touching mobile:

- Add `ds-fan` to `apps/web/src/styles/source-dossier-scene.css`.
- Add source deck expanded/swipe state and labels to `apps/web/src/components/dashboard/home-dossier.tsx`.
- Add `data-source-compact` so the legacy grid does not visually compete with the source deck.
- Add tests that assert source deck is visible, toggle exists, legacy grid is compacted, and all source keyframes are present.

