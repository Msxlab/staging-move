# 2026-06-25 03:34 Web Light/Motion Follow-Up

## Scope
- Continued web audit/fix for staging dashboard light theme, dossier deck motion, and route-map motion.
- Source bundle inspected from `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project`.
- Mobile was read-only for parity context; no mobile source files changed in this pass.

## Verified Source Notes
- `Move.dc.html` light theme uses `bg:#EFEADF`, `surface:#FFFFFF`, `surface2:#F5F0E7`, `surface3:#ECE6DA`, `border:rgba(16,29,45,0.10)`, and hero panels `linear-gradient(135deg,#FFFFFF,#F4EFE5)`.
- `Move.dc.html` defines motion primitives including `mv-rise`, `mv-grow`, `mv-dash`, and `mv-travel`.
- Source dossier deck cards use animated scene stages and sorted card priority by level.

## Changes Made
- Added shared web motion primitives in `apps/web/src/styles/globals.css`:
  - `lf-move-rise`
  - `lf-move-bar`
  - `lf-route-map-dash`
  - reduced-motion guard
- Added light-mode hero-panel styling in `globals.css` and `aurora.css` so dashboard hero cards use source-like white/paper panels instead of muddy transparent beige overlays.
- Applied `lf-source-hero-panel` + `lf-move-rise` to web move briefing and move command center surfaces.
- Applied `lf-move-rise` to Home Dossier source deck cards.
- Added `lf-route-map-dash` to the stylized route map fallback path and restored the source-like `9 9` dash pattern.
- Updated regression tests for the new CSS/class contract.

## Verification
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card move-briefing-card move-command-center`
  - Passed: 6 files, 162 tests.
- `pnpm --filter @locateflow/web lint`
  - Passed.
- `git diff --check`
  - Passed, with Windows CRLF warnings only.

## Staging / PR State
- `origin/fix/ui-ux-remediation` and PR #59 head: `a914a6a18c3a959c254776b123fa9e5921ecf96f`.
- `origin/staging`: `775c0e6f0a4aa20d674d3a30fdf113f71379431d`.
- Therefore the PR head is not currently the same commit as the remote staging branch.
- Live staging CSS contains `#EFEADF` and `lf-dossier-source-deck`, but not the new `lf-source-hero-panel` / `lf-route-map-dash` changes from this pass.

## Risks / Follow-Up
- Browser visual QA was not run in this pass because no Chrome/browser control tool is available in this session. User can verify after PR merge/deploy, or authorize Playwright if needed.
- PDF 500 remains a separate server/runtime issue to re-check after this UI pass.
- Mobile parity still needs a deliberate follow-up before any mobile edits.
