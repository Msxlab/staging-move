# Source Integration Web/Mobile Audit Handoff

## Scope

User asked to inspect the approved source bundle without relying on existing repo memory, fix web visual regressions, explain staging/deploy status, and avoid mobile edits until notified.

Approved source bundle:

- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested`

Source files inspected:

- `README.md`
- `project/Move.dc.html`
- `project/DossierScene.dc.html`
- `project/Move Web.dc.html`
- mobile module source inventory from the same folder

Repository code inspected:

- `apps/web/src/styles/globals.css`
- `apps/web/src/styles/source-dossier-scene.css`
- `apps/web/src/components/dashboard/home-dossier.tsx`
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
- `apps/mobile/src/components/ui/HomeDossierCard.tsx`
- `apps/mobile/src/lib/home-dossier.ts`
- `apps/mobile/src/lib/home-dossier-cache.ts`
- `apps/mobile/app/(tabs)/more.tsx`
- `apps/mobile/app/settings/workspace.tsx`
- `apps/mobile/app/invitations/[token].tsx`
- `apps/mobile/app/workspace/accept-invite.tsx`

## Web Findings

1. Staging is behind the visual-fix branch.

- `origin/staging` remained at `775c0e6f` after fetch.
- `fix/ui-ux-remediation` was ahead with source deck and light-shell fixes.
- Result: screenshots from `staging.locateflow.com` can still show old colors and old dossier layout until PR branch is merged and deployed.

2. Light shell color had to be corrected after user feedback.

- Source app tokens include `bg: #EFEADF` and `surface2: #F5F0E7`.
- The full wide dashboard using the heavier warm paper plus translucent panels looked muddy/grey.
- Web shell now uses `#F5F0E7`, with reduced light overlay wash.

3. Web Home Dossier is now source-like on the PR branch.

- Source `Move.dc.html` uses a priority-ordered horizontal deck with `View full / Swipe view`, dots, stage tags, 5-segment bars, and band labels.
- Web branch now implements that deck model.

4. Dossier animation keyframe parity is now covered.

- Source `DossierScene.dc.html` defines 37 keyframes.
- Web CSS now contains all source keyframes, including `ds-fan`.
- Web also has local extensions: `ds-bubble`, `ds-floatband`, and `ds-stroll`.
- Regex comparison result: `web animation uses without web keyframes: none`.
- Note: source itself does not visibly use `ds-fan`, so this fixes parity hygiene, not the main visible staging issue.

5. Route-map light labels are already addressed on the branch.

- `apps/web/src/styles/globals.css` contains light-mode `.lf-route-map-label` overrides.
- If staging still shows dark pills, it is likely seeing the old staging commit or cached deployed assets.

## Mobile Findings

1. Mobile Home Dossier does not yet match the source deck.

- `apps/mobile/src/components/ui/HomeDossierCard.tsx` renders row-based ambient layers.
- It does not implement the source horizontal swipe/full deck.
- No mobile source code was changed in this pass.

2. Mobile dossier/cache behavior is device-side.

- `apps/mobile/src/lib/home-dossier-cache.ts` uses memory cache and offline disk cache.
- Default freshness is 30 minutes before network refresh.
- It falls back to stale cache on network errors.

3. Mobile standalone modules are more linked than the source README note suggests.

- `apps/mobile/app/(tabs)/more.tsx` links Search, Providers, Custom Providers, Reminders, Workspace, Help, Support, and Notifications.
- Workspace invite accept surfaces exist in mobile route files.

4. Mobile still has stale paid-unlock comments/copy paths around dossier access.

- This should be cleaned up only in an approved mobile pass, because user asked to be notified before mobile edits.

## Changed In This Pass

- `apps/web/src/styles/source-dossier-scene.css`
  - Added the missing source `@keyframes ds-fan`.
- `design-qa.md`
  - Updated QA status and blockers.
- `docs/ai/handoffs/2026-06-25-source-integration-web-mobile-audit.md`
  - Added this audit handoff.

## Verification

Passed:

- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

Still required:

- Fresh staging screenshot comparison after merge/deploy.

## Risks

- Staging will continue to look wrong until the branch is merged into staging and Dokploy builds that resulting commit.
- CSS-only keyframe parity does not prove visual animation quality; browser screenshot/video QA is still required.
- Mobile dossier parity remains incomplete by design until the user approves mobile edits.

## Recommended Next Action

1. Commit and push the CSS keyframe parity patch plus this handoff.
2. Confirm PR branch is merged to staging.
3. Verify Dokploy build commit equals the merged staging commit.
4. Capture fresh web screenshots and compare against the source.
5. Ask user for approval before starting mobile Home Dossier source-deck parity work.
