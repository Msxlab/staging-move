# 2026-06-21 Staging Cap, Theme, and QA Follow-up

## Current Live State

Dokploy staging is running from branch `codex/staging-audit-2026-06-21`.

Live build-info checked after the operator's latest deploy:

- Web: `ad9276b11321bf3846b98e62046fa90d7718ad56`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T20:58:56.503Z`.
- Admin: `ad9276b11321bf3846b98e62046fa90d7718ad56`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T20:58:56.488Z`.

Live health/readiness after env copy:

- Web `/api/health`: healthy, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.
- Admin `/api/ready`: `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`, DB ready.

Important: the local fixes below are not deployed yet. Live still needs a push/redeploy after this follow-up patch is committed.

## Theme Decision

The latest committed zip set in `design-src/handoffs/*.zip` resolves to Gold as the default accent.

Evidence:

- Extracted `Admin.dc.html` and `Move.dc.html` expose accent choices `Gold`, `Sapphire`, and `Emerald`, with default `Gold`.
- Gold tokens are the primary/default values: `#CBA45E`, `#DCBC7C`, `#B0852F`.
- Sapphire/teal (`#37C2C9`) and Emerald/green (`#54CB7E`) are present as variants/support accents, not the default route.
- Runtime tokens in `packages/shared/src/design-tokens.ts`, web CSS, admin CSS, and mobile theme resolve primary/focus/glow to the Gold family.
- A local contact sheet exists at `tmp-theme-zip-contact-sheet.png` showing the Gold default plus Sapphire/Emerald variants.

If the intended new design is not Gold, the operator must provide the exact newer zip/source package. Do not infer Emerald or Sapphire from memory alone; compare the exact artifact first.

## Local Fixes Prepared After Live Deploy

These changes are in the working tree and should be committed/pushed/redeployed:

- Web plan-limit APIs no longer tell top-tier `PRO` / consumer-free users to upgrade when they hit abuse caps. Address/service caps now return safety-limit language with no `upgradeRequired`.
- Web `/api/moving` now returns a neutral `CONCURRENT_PLAN_LIMIT` payload under consumer-free instead of an upgrade teaser when the active moving-plan cap is hit.
- Mobile address/service list and create flows now distinguish lower-tier upgrade gates from top-tier safety caps.
- Mobile onboarding now mirrors effective `planTier` from `/api/profile` into global theme/auth state before service-limit checks, preventing a stale free cap during first-run onboarding under consumer-free.
- Mobile moving-plan create flow handles the consumer-free concurrent cap explicitly instead of showing a generic failure.
- Mobile workspace/export/connections copy is neutralized from upgrade/pro language to access-review/safety language where consumer-free staging can surface it.
- Mobile i18n no longer overrides the moving access-review fallback with old "unlock with Individual" copy.
- Theme comments that said Sapphire/Aurora in mobile shared primitives were aligned with Move Gold to avoid future audit confusion. Runtime values were already Gold.

## Verification Passed

Host Node is still `v24.12.0` while repo engines request Node `22.x`; pnpm prints engine warnings, but the checks below passed.

- `pnpm --filter @locateflow/web test -- src/lib/plan-limits.test.ts src/app/api/moving/route.test.ts src/app/api/onboarding/briefing/route.test.ts src/app/api/vehicles/decode/route.test.ts src/app/api/addresses/[id]/dossier/route.test.ts`
- `pnpm --filter @locateflow/mobile test -- src/lib/plan-comparison.test.ts src/components/ui/VehicleCheckCard.helpers.test.ts src/lib/home-dossier.test.ts`
- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `DATABASE_URL=mysql://user:pass@localhost:3306/locateflow pnpm --filter @locateflow/db exec prisma validate`
- `pnpm audit:providers:readiness` produced no provider-data diff beyond a timestamp-only generated report, so that timestamp churn was not kept.
- `git diff --check` passed with only CRLF warnings.

Latest full `verify:tests` totals:

- Web: 324 files / 2758 tests passed.
- Admin: 127 files / 779 tests passed.
- Mobile: 34 files / 325 tests passed.
- Shared: 35 files / 388 tests passed.
- Connectors: 15 files / 105 tests passed.

## Remaining Work

Agent should:

- Commit and push the prepared local fixes.
- Redeploy Dokploy staging and verify `/api/build-info` advances beyond `ad9276b11321bf3846b98e62046fa90d7718ad56`.
- Re-run live health/readiness after deploy.
- Use the existing open Chrome/Mustafa session for runtime QA; do not open a fresh Chrome profile unless the operator asks.
- QA authenticated web: dashboard, moving, services, providers, settings/subscription, workspace, route-map/media, export flows.
- QA authenticated admin: overview, users, moves, providers, leads, affiliate/subscriptions, settings, backups/security. Operator may need to complete password/2FA interactively.
- QA mobile/emulator or mobile runtime path: tabs, onboarding, services/providers, moving create/caps, settings/subscription, connections/export/workspace, OAuth handoff, app-lock, staging API config, visual theme.
- Run formal product-design screenshot audit from real staging screenshots and write the audit artifact.
- Run the full Codex Security deep scan workflow only when ready to dedicate the required six-worker scan; tests and focused review are not a substitute for that plugin workflow.

Operator should:

- Provide only interactive credentials/2FA when Chrome asks.
- Provide the exact newer design zip/source if the intended default palette is not Gold.
- No extra env action is needed right now for staging health; env is already sufficient for readiness.
