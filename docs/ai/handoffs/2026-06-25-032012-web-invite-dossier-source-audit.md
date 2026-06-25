# 2026-06-25 03:20 - Web invite/dossier source audit follow-up

## Scope
- Follow-up on staging complaints after PR #59 remained open and unmerged.
- Source reference inspected read-only: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Web source changes only; mobile was inspected read-only.

## Verified Findings
- Live `https://staging.locateflow.com/dashboard` is not serving PR #59 head `b6767178fb535a6a587d889acd0d2d46a90b00a0`.
- `b6767178fb535a6a587d889acd0d2d46a90b00a0` is on `origin/fix/ui-ux-remediation`, not `origin/staging`.
- PR #59 is open, not merged, draft=false, mergeable=true per GitHub connector.
- Live staging HTML still advertises light theme color `#F6F3EC`; the PR branch has the source canvas correction.
- Source `DossierScene.dc.html` contains the full animated scene/keyframe set, and current web `source-dossier-scene.css` contains those keyframes.
- Source `Move.dc.html` uses a priority dossier animation deck as part of the intended Home Dossier presentation.
- Mobile uses shared light token `surfaceLight.background = "#EFEADF"` and has row-level `DossierAmbient`, but does not have the web/source swipe deck structure. No mobile source was changed.
- Web cache layering:
  - UI reads/writes Home Dossier payloads in `sessionStorage` using the API `Cache-Control` max-age or a 10-minute fallback.
  - Web service worker bypasses `/api/*` and never caches HTML navigations.
  - Server route has an in-process dossier payload cache plus durable area cache for upstream facts.
  - Mobile cache is user-device AsyncStorage plus memory, with a default 30-minute freshness window.

## Changes Made
- `apps/web/src/components/dashboard/household-activation-card.tsx`
  - Household invite modal now focuses the first email input when opened.
  - Empty household name now falls back to localized default copy instead of forcing the user to type a name first.
  - Removed the stale name input ref and unused target workspace id variable.
- `apps/web/src/components/dashboard/household-activation-card.test.tsx`
  - Updated regression coverage for email-first focus.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
  - Updated the desktop dossier expectation so the source animation deck is not hidden by a stale test contract.
- `apps/web/src/i18n/messages/en.json`
  - Added `household_defaultName`.
- `apps/web/src/i18n/messages/es.json`
  - Added `household_defaultName`.

## Checks Run
- `pnpm --filter @locateflow/web test -- home-dossier household-activation-card`
- `pnpm --filter @locateflow/web test -- home-dossier household-activation-card dossier-ambient route-map-card pricing-free-tier-contract`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" "src/lib/pdf/standard-font-data.test.ts"`
- `git diff --check`

All checks passed. Local Node warning remains: repo wants Node 22.x; local Node is v24.13.0.

## Remaining Risk
- Staging will continue to look wrong until PR #59 and this follow-up commit are merged into `staging` and Dokploy redeploys that branch.
- PDF tests pass locally; if staging still returns 500 after the correct commit is deployed, the next required evidence is the Dokploy/server log line emitted near `Failed to build dossier PDF:`.
- Mobile parity needs a separate implementation pass if the source swipe deck is required on mobile too.

## Next Action
- Commit and push this follow-up onto `fix/ui-ux-remediation`.
- Merge PR #59 into `staging` only after review/approval, then redeploy staging.
- After deployment, hard refresh staging and verify `/dashboard`, Home Dossier, route-map labels, household invite modal, and `/api/addresses/:id/dossier/pdf`.
