# 2026-06-21 Staging Cap, Theme, and QA Follow-up

## Current Live State

Dokploy staging is running from branch `codex/staging-audit-2026-06-21`.

Live build-info checked after the operator's latest deploy:

- Web: `ad9276b11321bf3846b98e62046fa90d7718ad56`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T20:58:56.503Z`.
- Admin: `ad9276b11321bf3846b98e62046fa90d7718ad56`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T20:58:56.488Z`.

Live health/readiness after env copy:

- Web `/api/health`: healthy, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.
- Admin `/api/ready`: `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`, DB ready.

Follow-up commit `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842` was pushed and manually redeployed in Dokploy.

Post-redeploy live build-info:

- Web: `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T21:36:38.196Z`.
- Admin: `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T21:36:38.203Z`.

Latest recheck after the operator said staging was deployed:

- Checked at `2026-06-21T22:02Z`.
- Web `/api/build-info`: still `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T21:36:38.196Z`.
- Admin `/api/build-info`: still `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built `2026-06-21T21:36:38.203Z`.
- Web `/api/health`: `healthy`, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.
- Admin `/api/ready`: `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`, DB ready.
- Local branch HEAD is `e09bd6990de7c357bc12f383ef01f62e3be5110b`, but that commit is memory/docs-only. No runtime redeploy difference is expected beyond `9d9ae964`.
- Existing Chrome profile/window is present as `LocateFlow Admin - Google Chrome`; do not open a fresh Chrome profile for authenticated QA.

## Theme Decision

The latest committed zip set in `design-src/handoffs/*.zip` resolves to Gold as the default accent.

Evidence:

- Extracted `Admin.dc.html` and `Move.dc.html` expose accent choices `Gold`, `Sapphire`, and `Emerald`, with default `Gold`.
- Gold tokens are the primary/default values: `#CBA45E`, `#DCBC7C`, `#B0852F`.
- Sapphire/teal (`#37C2C9`) and Emerald/green (`#54CB7E`) are present as variants/support accents, not the default route.
- Runtime tokens in `packages/shared/src/design-tokens.ts`, web CSS, admin CSS, and mobile theme resolve primary/focus/glow to the Gold family.
- A local contact sheet exists at `tmp-theme-zip-contact-sheet.png` showing the Gold default plus Sapphire/Emerald variants.

If the intended new design is not Gold, the operator must provide the exact newer zip/source package. Do not infer Emerald or Sapphire from memory alone; compare the exact artifact first.

Source comment cleanup prepared after the color dispute:

- Stale comments saying `corporate blue`, `Aurora cool`, `cool-blue`, or `Sapphire gradient` were aligned to `Move Gold` across web, admin, and mobile source comments. Runtime token values were not changed.
- `apps/web/src/lib/plan-limits.ts` comments now distinguish the flag-off paid ladder from `CONSUMER_FREE`, where eligible consumers resolve to PRO/hasPremium before moving-plan checks.
- Post-cleanup source scan over `apps/web`, `apps/admin`, `apps/mobile`, and `packages/shared/src` has no remaining color-claim hits for `corporate blue`, `cool-blue`, `Aurora cool`, `cool primary`, `cool scale`, or `Sapphire gradient`. Remaining `base Aurora theme` comments are only the theme-system name, not a palette claim.
- `git diff --check` passed after the cleanup with only the repo's existing CRLF warnings.

## Local Fixes Prepared After Live Deploy

These changes are now deployed on staging:

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

Post-deploy runtime smoke:

- Web public `/`, `/features`, `/why-free`, `/blog`, `/sign-in`: `200`.
- Web auth-gated `/dashboard`, `/onboarding`: `307` to sign-in as expected when unauthenticated.
- Admin public `/login`, `/api/healthz`: `200`.
- Admin auth-gated `/users`: `307` to `/login` as expected when unauthenticated.
- Playwright public visual/token smoke: web and admin login render dark, primary token `39 51% 58%`, body background dark, no console/page errors.
- Public screenshots/results saved under `tmp-live-qa-9d9ae964/`.

Latest full `verify:tests` totals:

- Web: 324 files / 2758 tests passed.
- Admin: 127 files / 779 tests passed.
- Mobile: 34 files / 325 tests passed.
- Shared: 35 files / 388 tests passed.
- Connectors: 15 files / 105 tests passed.

## Remaining Work

Agent should:

- Use the existing open Chrome/Mustafa session for authenticated runtime QA; do not open a fresh Chrome profile unless the operator asks.
- QA authenticated web: dashboard, moving, services, providers, settings/subscription, workspace, route-map/media, export flows.
- QA authenticated admin: overview, users, moves, providers, leads, affiliate/subscriptions, settings, backups/security. Operator may need to complete password/2FA interactively.
- QA mobile/emulator or mobile runtime path: tabs, onboarding, services/providers, moving create/caps, settings/subscription, connections/export/workspace, OAuth handoff, app-lock, staging API config, visual theme.
- Run formal product-design screenshot audit from real staging screenshots and write the audit artifact.
- Run the full Codex Security deep scan workflow only when ready to dedicate the required six-worker scan; tests and focused review are not a substitute for that plugin workflow.

Operator should:

- Provide interactive web/admin credentials and 2FA in Chrome when asked. Current Chrome did not have a web staging dashboard session, and the admin login password was not filled.
- Provide the exact newer design zip/source if the intended default palette is not Gold.
- No extra env action is needed right now for staging health; env is already sufficient for readiness.
