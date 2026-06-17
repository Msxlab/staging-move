# Free Tier Preview Implementation Handoff

Timestamp: 2026-06-17 15:54:38
Branch: `codex/free-tier-preview`

## Current Behavior Findings

- `FREE_TRIAL` previously had `homeDossier=false`, `dossierPdf=false`, and `aiBriefing=false`; paid plans had the full Home Dossier, while AI briefing remains Family+Pro in the current entitlement matrix.
- `/api/moving` already blocks Free users from creating a full editable `MovingPlan` with `MOVING_PLAN_UPGRADE_REQUIRED`.
- Onboarding computed a personalized checklist teaser with `generateChecklist`, but Free users had no persistent dashboard surface for that preview.
- `/api/addresses/[id]/dossier` gated Free users before lookup work; no preview subset was returned.
- `/api/moving/migration` was user-gated but not entitlement-gated.
- `PATCH /api/move-tasks` allowed task mutation without checking the paid move-task entitlement; `POST /api/move-tasks` was already gated.

## Implemented Free Preview Subset

- Free Home Dossier preview now returns only:
  - flood zone
  - school district
  - moving-day weather when an active destination move is within the existing NWS weather window
- Free dossier preview does not return full-only sections:
  - hazards
  - radon
  - water
  - air
  - housing
  - EV charging
  - neighborhood intelligence
  - PDF export
- No ISP/broadband signal was added to the dossier. Existing provider/FCC code remains only for provider suggestions and serviceability surfaces.
- Free dashboard now re-renders a read-only move checklist preview from coarse local context using the existing `generateChecklist` engine. No `MovingPlan` or `MoveTask` rows are created for Free preview.
- Home Dossier PDF entitlement is Individual+; Free still receives the PDF upgrade teaser.

## Entitlement and Gate Changes

- Added `homeDossierPreview` to workspace entitlements.
- Kept Free caps at 3 addresses / 10 services / reminders / provider catalog.
- Kept paid-only:
  - full editable move plan and task tracking
  - provider migration
  - AI briefing per current matrix
  - full Home Dossier and PDF
  - advanced exports and multi-member features by tier
- Added `canGenerateMoveTasks` gate to `/api/moving/migration`.
- Added `canGenerateMoveTasks` gate to `PATCH /api/move-tasks`.
- Verified Free AI briefing remains `entitled:false` via existing onboarding briefing route test coverage.

## Copy Alignment

- Updated web and mobile plan comparison copy to mention Free Home Dossier preview as flood, school district, and moving-day weather.
- Removed Home Dossier broadband/provider availability claims from dossier-specific copy.
- Updated pricing and compare surfaces so Home Dossier PDF is shown as Individual+ instead of Pro-only.

## Tests Run

- `pnpm install --frozen-lockfile`
  - lockfile was unchanged; local `node_modules` created for this clean worktree.
- `pnpm --filter @locateflow/web test -- "src/lib/free-move-preview.test.ts" "src/app/(app)/dashboard/move-command-center.test.tsx" "src/app/api/addresses/[id]/dossier/route.test.ts" "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" "src/app/api/moving/migration/route.test.ts" "src/app/api/move-tasks/route.test.ts" "src/app/api/onboarding/briefing/route.test.ts" "src/components/dashboard/home-dossier.test.tsx" "src/components/marketing/plan-compare-table.test.tsx" "src/components/marketing/pricing-section.test.tsx" "../../packages/shared/src/workspace-entitlements.test.ts"`
  - 11 files passed, 158 tests passed.
- `pnpm --filter @locateflow/mobile test -- "src/lib/plan-comparison.test.ts"`
  - 1 file passed, 15 tests passed.
- `pnpm verify:typecheck`
  - passed for web, admin, mobile, db, and connectors.

## Notes and Guardrails

- No DB migration was needed.
- No deploy was run.
- No Stripe, Apple, or Google store writes were performed.
- No production data or secrets were read.
- No billing provider configuration was changed.
- Local test environment warned that the current Node is `v24.13.0` while the repo requests Node `22.x`; tests and typecheck still passed.

## Recommended Review

- Product review should confirm whether Individual should remain excluded from AI briefing. The current code and tests preserve the existing Family+Pro AI matrix, while this task only guarantees Free stays unentitled.
- Manual QA should verify the Free dashboard preview after onboarding completion, the Free Home Dossier preview payload, and upgrade CTA destinations.
