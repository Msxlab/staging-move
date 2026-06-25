# 2026-06-25 Web Dossier Theme Right-Strip Follow-Up

## Scope

- Continued source-bundle UI/theme/dossier audit using only the handoff bundle README and source files under `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Did not use existing repo markdown memory as product evidence.
- Modified web only.
- Did not modify mobile, admin, env files, dependencies, deployment config, or production data.

## Source Evidence Used

- `README.md`: primary target is `project/Move.dc.html`; read source directly.
- `Move.dc.html`: light theme uses `bg #EFEADF`, `bg2 #E7E1D4`, `surface #FFFFFF`, `surface2 #F5F0E7`, `surface3 #ECE6DA`; mobile Home Dossier uses a swipe/full deck with `DossierScene`.
- `DossierScene.dc.html`: source scenes are animated state matrices keyed by type and level.
- `Move Web.dc.html`: web feature/demo cards use `DossierScene` inside dark stages.
- User reference image `C:\Users\Windows\.codex\attachments\07af7ffd-84d4-4198-b2e3-4966cfd0fdd1\image-1.png`: desktop web dossier should read as a single-column row/list with subtle right-side scene motion, not a two-column grid.

## Findings

- Web light app shell had drifted to a white-led derivative instead of the source paper background.
- Desktop Home Dossier grid was forced to two columns at `min-width: 900px`, which did not match the provided desktop reference.
- Desktop row scenes were using the compact card top-stage treatment, which made the animation feel separated from the row/list reference.
- Mobile was inspected only:
  - Light background token is already `#EFEADF`.
  - Dossier cache is device-side memory + offline storage with a 30-minute default freshness window.
  - Mobile Home Dossier still uses row/list presentation and still contains paid-teaser wording/logic; no mobile files were changed pending user approval.

## Changes Made

- Restored web light shell canvas to source paper:
  - `--lf-app-bg: #EFEADF`
- Kept chrome/panel/card surfaces white so the paper background does not wash over content.
- Restored desktop dossier to one-column row/list at `min-width: 900px`.
- Added a desktop-only right-strip override for row dossier scenes:
  - scene layer fills the right 72% of each row,
  - uses a left-to-right mask so copy stays readable,
  - hides internal scene tags on desktop row/list,
  - keeps compact/source deck dark-stage behavior unchanged.
- Updated regression tests for the source beige shell, compact dark source stage, desktop right-strip row scene, and single-column desktop dossier grid.

## Verification

- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier pricing-free-tier-contract`
  - 4 files passed, 115 tests passed.
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card household-activation-card pricing-free-tier-contract`
  - 6 files passed, 153 tests passed.
- `pnpm --filter @locateflow/web lint`
  - passed.
- `pnpm --filter @locateflow/web build`
  - passed.
  - Existing warnings: local Node v24.13.0 vs expected Node 22.x, Next middleware/proxy convention, Prisma CommonJS export warning, Edge runtime static-generation warning.
- `git diff --check`
  - passed with the existing CRLF warning for `apps/web/src/styles/globals.css`.

## Remaining Work

- Visually verify staging after the new commit deploys.
- If the desktop row scene still feels too faint in staging, capture the rendered state and tune opacity/scene density from visual evidence.
- Mobile needs explicit approval before changing its dossier presentation to source swipe/full deck and removing paid-teaser language.
- PDF 500 still needs runtime log evidence if it persists after the newest image is deployed.
