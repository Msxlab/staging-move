# Design QA - Source Dossier Web - 2026-06-25

final result: blocked

## Source Visual Truth

- Source bundle: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Move.dc.html`
- Source dossier scene library: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\DossierScene.dc.html`
- User-provided dossier reference screenshot: `C:\Users\Windows\.codex\attachments\07af7ffd-84d4-4198-b2e3-4966cfd0fdd1\image-1.png`

## Implementation Target

- Web PR: `https://github.com/Msxlab/staging-move/pull/63`
- Components:
  - `apps/web/src/components/dashboard/home-dossier.tsx`
  - `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - `apps/web/src/styles/globals.css`
  - `apps/web/src/styles/source-dossier-scene.css`

## Viewport And State

- Intended source viewport: source prototype declares `390x844`.
- Intended product states: light theme, authenticated dashboard, Home Dossier visible, source deck collapsed swipe state and expanded full state.
- Implementation screenshot path: not captured.

## Full-View Comparison Evidence

Blocked. A same-state rendered implementation screenshot has not been captured in this run. Product Design QA requires source and implementation images in the same comparison context before claiming visual parity.

## Focused Region Comparison Evidence

Blocked for the same reason. The code-level checks prove wiring and token intent, but not pixel fidelity for typography, spacing, contrast, or animation appearance.

## Findings

- [P1] Visual parity is not yet proven from rendered evidence.
  Location: web authenticated dashboard / Home Dossier.
  Evidence: source file requires source Greige/paper tokens, `View full` / `Swipe view`, source dossier cards, dots, and `DossierScene` animations. PR #63 now implements and tests these code paths, but no rendered screenshot was captured.
  Impact: code can be correct while final browser output still has spacing, contrast, font, clipping, or animation issues.
  Fix: after PR #63 is deployed or run locally, capture the dashboard Home Dossier in light theme at matching desktop and mobile-web widths. Compare against the source/reference screenshot in the same view.

- [P1] Staging will continue to look wrong until PR #63 is merged and Dokploy deploys it.
  Location: `staging.locateflow.com`.
  Evidence: PR #63 is open, not merged. Earlier staging screenshots therefore cannot show the corrected source beige canvas, light surface remaps, or dossier deck changes.
  Impact: refreshing staging before merge/deploy will keep showing the old behavior.
  Fix: merge PR #63 to `staging`, let Dokploy finish, then re-test the live URL.

## Patches Made Since Previous QA Pass

- Closed superseded PR #62, which used a neutral light canvas interpretation.
- Updated PR #63 so `.light` maps `--lf-app-bg` to source paper `var(--bg)` / `#EFEADF`.
- Kept white/near-white card surfaces for contrast by remapping low-alpha foreground backgrounds in light mode.
- Restored source dossier deck controls, dots, cards, scene tags, and `ds-fan` keyframe.
- Added regression coverage for the warm light canvas and dossier source deck.

## Required Follow-Up

1. Capture source/reference and implementation screenshots side by side.
2. Check required fidelity surfaces: typography, spacing, colors/tokens, image/asset fidelity, and copy/content.
3. Verify light and dark dashboard, Home Dossier collapsed/expanded, route map labels, and responsive mobile-web widths.
4. Update this QA report to `passed` only when no actionable P0/P1/P2 visual findings remain.
