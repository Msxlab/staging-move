# 2026-06-25 Source Bundle UI + Runtime Audit

Scope:
- External source bundle: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested`
- Current repo branch: `fix/ui-ux-remediation`
- Web, mobile read-only parity, cache, dossier PDF, consumer-free entitlement, workspace gate, staging deployment pointers

Evidence policy:
- Findings in this handoff are based on source bundle files, application source files, tests/config/source routes, git refs, and direct staging health/build-info HTTP checks.
- Existing repo markdown/memory files are not used as product evidence here.
- No production data, secrets, env files, browser profiles, or customer PII were read.

## Executive Result

The latest fix branch is not deployed to the `staging` branch. `origin/fix/ui-ux-remediation` is at `40ab19c3`, while `origin/staging` is still `775c0e6f`; `40ab19c3` is not an ancestor of `origin/staging` or `origin/main`.

This is the strongest explanation for the user's staging screenshots still showing the bad warm/beige dashboard canvas, old-looking dossier rows, and dark route-map labels. The code on the fix branch has the neutral light canvas and source dossier deck behavior, but staging cannot show those if Dokploy is building `staging` at `775c0e6f`.

## External Bundle Inventory

Root:
- `README.md`: handoff instructions; says to inspect `project/Move.dc.html` first and follow imports.
- `project/Index.dc.html`: project map. It states the standalone mobile modules (Reminders, Help, Search, Providers, Custom providers, Invitations) were built but not yet linked inside the Move app navigation.

Core source files:
- `Move.dc.html`: primary mobile app source; contains the source light theme tokens and Home Dossier swipe/full animated deck.
- `DossierScene.dc.html`: animated dossier scene matrix with the `ds-*` keyframes and scene states for weather, air, water, area, transit, cost, and housing.
- `Raccoon.dc.html`: shared brand character component used by source scene visuals.
- `Move Web.dc.html`: marketing/landing page with embedded live app/demo concepts.
- `Web.dc.html`: web router/shell for marketing pages.
- `Admin.dc.html`: admin prototype source; not deeply audited against current admin in this pass.

Standalone source modules:
- `Providers.dc.html`, `Reminders.dc.html`, `Help.dc.html`, `Search.dc.html`, `CustomProviders.dc.html`, `Invitations.dc.html`: mobile module prototypes.
- `Auth.dc.html`, `Onboarding.dc.html`: mobile auth/onboarding prototypes.
- `Web Login.dc.html`, `Web Onboarding.dc.html`, `Web Features.dc.html`, `Web Why-Free.dc.html`, `Web Blog.dc.html`: marketing/auth web prototypes.
- `manifest.json`, `sw.js`, `support.js`, icons/screenshots/uploads: PWA/runtime support and visual assets.

## Source Theme Contract

Verified in `Move.dc.html`:
- Light source theme uses `bg:'#EFEADF'`, `bg2:'#E7E1D4'`, `surface:'#FFFFFF'`, `surface2:'#F5F0E7'`, `surface3:'#ECE6DA'`.
- Light source route map uses `mapBg:'linear-gradient(180deg,#dde6ef,#cdd8e6)'` and `mapFilter:'saturate(0.95) brightness(1.02)'`.
- Home Dossier source deck is a horizontal swipe deck by default and wraps in full mode:
  - `dViewLabel` is `View full` / `Swipe view`.
  - `dWrap` toggles `nowrap` / `wrap`.
  - `dOverflow` toggles `auto` / `visible`.
  - card width is `76%` in swipe mode and `calc(50% - 6px)` in full mode.

Conflict:
- The source bundle's `#EFEADF` background is real, but the user's latest dashboard screenshot shows that applying this warm paper globally makes the operational dashboard look worse.
- Current branch therefore keeps `#EFEADF` as an opt-in source/dossier paper token and uses neutral app canvas `#F8FAFC` for the light dashboard.
- Do not blindly restore global beige without a new visual confirmation.

## Deployment Finding

Severity: P0 for staging QA validity.

Evidence:
- `git ls-remote origin staging` -> `775c0e6f... refs/heads/staging`
- `git ls-remote origin fix/ui-ux-remediation` -> `40ab19c3... refs/heads/fix/ui-ux-remediation`
- `git merge-base --is-ancestor 40ab19c3 origin/staging` -> no.
- `git merge-base --is-ancestor 40ab19c3 origin/main` -> no.
- `https://staging.locateflow.com/api/health` returns healthy.
- `https://staging.locateflow.com/api/build-info` returns `401 UNAUTHORIZED`, so commit verification through the app requires an authenticated browser/session.

Impact:
- Staging can be healthy while still running an old commit.
- The user's screenshots from `staging.locateflow.com` should not be treated as proof that `40ab19c3` failed until Dokploy builds a branch containing `40ab19c3`.

Required action:
- Merge/push the fix branch into the branch Dokploy actually builds for staging, or point Dokploy at `fix/ui-ux-remediation`.
- Confirm Dokploy deployment log shows commit `40ab19c3` or a later merge commit containing it.

## Web Theme + Dossier Integration

Verified current branch:
- `packages/shared/src/design-tokens.ts` has `surfaceLight.background: "#F8FAFC"`, `surfaceLight.surface: "#FFFFFF"`, `surfaceLight.cardHover: "#EEF2F7"`.
- `apps/web/src/app/layout.tsx` sets light `theme-color` to `#F8FAFC`.
- `apps/web/src/components/layout/app-shell.tsx` uses `var(--lf-app-bg, #F8FAFC)` in light mode.
- `apps/web/src/styles/globals.css` defines:
  - `--lf-source-paper-bg: #EFEADF`
  - `--lf-app-bg: #F8FAFC`
  - white/neutral light app shell panels
  - light route-map labels as white chips with dark ink

Verified dossier source deck:
- `apps/web/src/components/dashboard/home-dossier.tsx` builds `sceneCards` from real dossier rows and renders `.lf-dossier-source-toolbar`, `.lf-dossier-source-deck`, `.lf-dossier-source-card`, `.lf-dossier-source-stage`, source tags, bars, bands, and dots.
- `apps/web/src/styles/globals.css` hides the old `.lf-dossier-grid[data-source-compact="true"]` and styles the source deck.
- `apps/web/src/components/dashboard/dossier-ambient.tsx` bridges existing ambient specs to source scene specs.

Open risk:
- Web source code now differs from the user's staging screenshot. If the screenshot still shows the old row list after `40ab19c3` is deployed, then runtime `sceneCards.length` is unexpectedly zero or CSS is being overridden. Current source inspection does not show that as the expected path.

## Route Map Labels

Verified current branch:
- `apps/web/src/styles/globals.css` light route-map labels use white backgrounds and dark ink.
- `apps/web/src/components/dashboard/route-map-card.tsx` overlays labels on both real map image and fallback map, with endpoint-specific corner anchoring.

Conclusion:
- The user's screenshot with dark labels is consistent with stale staging, not the latest fix branch.

## Cache Behavior

Web:
- `HomeDossier` uses per-address `sessionStorage` cache key `lf:home-dossier:v1:${addressId}`.
- It reads `Cache-Control: private, max-age=...` from the dossier API and falls back to a client freshness window.
- The web service worker bypasses `/api/*` entirely and only caches hashed Next assets/icons. It does not cache dossier API responses or authenticated HTML.

API:
- `/api/addresses/[id]/dossier` has an in-process LRU-ish cache with an entitlement/consumer-free epoch, so a consumer-free flag flip changes cache keys and bypasses stale gated payloads.

Mobile:
- `apps/mobile/src/lib/home-dossier-cache.ts` uses memory + offline disk cache, default fresh TTL of 30 minutes, and a gate-boundary epoch so a teaser/full entitlement flip bypasses stale cache.

Conclusion:
- Cache is partly server-side for API aggregation, partly browser/device-side for UX. It should not continuously hit upstream APIs while cache is fresh. A stale/missing cache or force refresh will hit the API again.

## PDF 500

Verified current branch:
- `apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts` gates by `planFeatures(plan).dossierPdf`, delegates data aggregation to the dossier JSON route, then calls `generateDossierReportPdf`.
- The route logs `Failed to build dossier PDF` with `code`, `message`, and `stack`.
- `apps/web/src/lib/pdf/standard-font-data.ts` contains a pdfkit standard-font data shim for Next standalone builds.

Open:
- Staging still returns `{"error":"Failed to build dossier PDF"}` per user screenshot, but the exact cause is not verifiable from HTTP alone.
- Required evidence is the Dokploy runtime log line emitted by the catch block.

Likely possibilities:
- Staging is not running the latest pdfkit shim branch.
- The latest branch is deployed but standalone file tracing still omits pdfkit data in that image.
- Another runtime-only PDF input error is occurring; the new log should expose it.

## Consumer-Free / Pro Entitlement

Verified current branch:
- `packages/shared/src/consumer-free.ts` defines `CONSUMER_FREE` override: pure free/no-row consumers resolve to `effectivePlan: "PRO"` and `effectiveStatus: "PAID_ACTIVE"` when enabled.
- `apps/web/src/lib/consumer-entitlement.ts` applies this to consumer read paths.
- `apps/web/src/lib/plan-limits.ts` short-circuits eligible consumer-free users to PRO-style limits.

Important distinction:
- This makes users effectively PRO for consumer gates.
- It does not automatically enable every feature flag or operational surface.

## Workspace / Household

Verified current branch:
- `apps/web/src/app/(app)/layout.tsx` only shows Workspace nav when `isWorkspaceModelEnabled()` is true and the user is Family/Pro or invited member.
- `apps/web/src/app/(app)/settings/workspace/workspace-client.tsx` has a separate `workspaceModelEnabled` state from `/api/workspaces`.
- If `consumerFree` is true but `WORKSPACE_MODEL_ENABLED` is false, the UI intentionally shows: "Shared workspaces are coming soon..."

Conclusion:
- The user's "all accounts should be pro/free but workspace not working" can be true if `CONSUMER_FREE` is on but `WORKSPACE_MODEL_ENABLED` is off or backfill is incomplete.
- This is not only a plan issue; it is a workspace feature-gate/deployment configuration issue.

## Household Invite Focus

Verified current branch:
- `apps/web/src/components/dashboard/household-activation-card.tsx` defines `householdSetupInitialFocusTarget()` as `"email"` and the first invite email input has `autoFocus={i === 0}`.
- Tests assert focus starts on email so typing does not land in Household name.

Conclusion:
- If staging still focuses Household name, staging is stale or the modal is a different code path.

## Mobile Parity

Verified read-only:
- The source bundle's old note that mobile standalone modules were not linked is stale relative to current repo code. Current mobile has routes for search, providers, custom providers, reminders, help, invitations, workspace accept, and workspace settings; More links many of them.
- Mobile Home Dossier still uses a row-based `HomeDossierCard` with native `DossierAmbient` layers, not the source `Move.dc.html` swipe/full animated card deck.
- Mobile plan comparison still contains the old paid ladder matrix; it may be user-visible and can contradict consumer-free if the profile/snapshot does not override copy consistently.
- Mobile light theme imports shared `surfaceLight`; after the neutral canvas fix, mobile light will also inherit `#F8FAFC` if the shared package is consumed in the mobile build.

Not changed:
- No mobile source code was changed in this pass because the user asked to be notified before mobile edits.

## Admin

Not verified in code in this pass:
- `Admin.dc.html` exists in the external bundle, but current admin parity was not deeply audited.
- Recommend separate admin audit after staging deployment is confirmed, because current visible blockers are deploy/runtime/theme/dossier/PDF/workspace.

## Immediate Next Actions

1. Deploy the correct commit to staging:
   - Ensure the deployed branch contains `40ab19c3` or a later merge commit containing it.
   - Confirm in Dokploy deployment log, not just `/api/health`.

2. Re-test staging after deploy:
   - Dashboard light canvas should be neutral `#F8FAFC` / white panels, not dirty global beige.
   - Route-map labels should be white/dark-ink chips in light mode.
   - Home Dossier should show source animated deck with `View full` / `Swipe view`.
   - Household setup typing should land in the invite email field.

3. For PDF 500:
   - Pull the Dokploy runtime log entry for `Failed to build dossier PDF`.
   - If message contains `ENOENT` / `pdfkit/js/data`, verify the deployed image contains the latest pdfkit standard-font shim and copied data files.

4. For workspace:
   - Verify `WORKSPACE_MODEL_ENABLED` and required workspace backfill in staging.
   - Do not confuse `CONSUMER_FREE` entitlement with the separate workspace model gate.

5. Mobile follow-up:
   - Separate approved pass to port source swipe/full dossier deck to native if desired.
   - Review mobile plan comparison/subscription copy against consumer-free behavior.

## Commands Run

- `git status --short --branch`
- `git log --oneline --decorate -5`
- `git rev-list --count origin/main..HEAD`
- `git log --oneline --decorate --reverse origin/main..HEAD`
- `git ls-remote origin staging`
- `git ls-remote origin fix/ui-ux-remediation main`
- `git merge-base --is-ancestor 40ab19c3 origin/staging`
- `git merge-base --is-ancestor 40ab19c3 origin/main`
- `Invoke-WebRequest https://staging.locateflow.com/api/health`
- `Invoke-WebRequest https://staging.locateflow.com/api/build-info`
- targeted `rg` and `Get-Content` inspections of web/mobile/source bundle files

## Application Source Changes In This Pass

None.

This pass only adds this handoff report.
