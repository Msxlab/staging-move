# 2026-06-21 Staging Workspace, Theme, and Deploy Follow-up

## Live Deploy Check

- Existing Chrome window/profile was used only; no new Chrome profile/window was opened.
- Chrome profile shown in the browser chrome was `MUSTAFA (axtrasolutions.com)`.
- Dokploy `Staging Move` deployments tab shows the latest successful deployment as `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842` (`Fix consumer-free caps and theme audit memory`), status `Done`.
- Live `/api/build-info` also reports web/admin running `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built around `2026-06-21T21:36:38Z`.
- Local/GitHub branch HEAD is newer (`138d6353` before this pass), but the newer commits before this fix were memory/comment-only. Staging is healthy, but "fully deployed to HEAD" is not true until Dokploy rebuilds a commit newer than `9d9ae964`.
- Admin login in the existing Chrome tab rendered the dark Move Admin page with Gold/champagne primary CTA. The password field was already filled, so no sign-in submit was clicked.

## Theme Decision

- The committed design zip bundle under `design-src/handoffs/*.zip` / extracted `design-src/initial-check-requested/project` resolves to default `Gold`.
- Direct source evidence:
  - `Admin.dc.html` exposes `Gold`, `Sapphire`, `Emerald`, with default `Gold`.
  - `Move.dc.html` exposes `Gold`, `Sapphire`, `Emerald`, with default `Gold`.
  - Default Gold tokens are `#CBA45E`, `#DCBC7C`, and `#B0852F`.
- `Sapphire` and `Emerald` are variants/support choices in the pushed zip bundle, not the default.
- The separate `NEW GENERATION/` folder is `Champagne & Rose` / orange-rose (`#D4846A`, `#EDB99D`, `#A85A42`, plus `#f97316` in prototypes). This likely explains the operator's memory that the theme was not Gold.
- Do not switch runtime away from Gold unless the product decision is explicitly that `NEW GENERATION/` supersedes the pushed design zip bundle.

## Code Finding Fixed

Found a consumer-free cross-logic drift:

- `apps/web/src/app/(app)/layout.tsx` used raw `getEffectiveEntitlement` for app shell plan theming and workspace nav visibility.
- `apps/web/src/lib/workspace-routes.ts` used raw entitlement for owner plan labels and seat limits in consumer-facing workspace summaries.
- `apps/web/src/lib/workspace-context.ts` used raw entitlement for consumer workspace request context.

Impact:

- With `CONSUMER_FREE` on, API gates could resolve a pure free/no-row consumer to PRO while app shell/workspace context still saw the raw free/no-access state. That could hide the Workspace nav, apply the wrong plan accent, or report the wrong consumer-facing seat summary.

Fix:

- Consumer-facing app shell/workspace reads now call `resolveConsumerEntitlement`.
- Ownership reconciliation remains raw by design, preserving the H3 rule that lapsed/refunded real Stripe/store/admin rows are not reactivated by the consumer-free override.
- Added `apps/web/src/lib/workspace-routes.test.ts`.
- Updated `apps/web/src/lib/workspace-context-resolver.test.ts` to mock the consumer entitlement resolver.
- Cleaned misleading source comments that still named `Champagne/Rose` or old Edition labels while runtime tokens are Move Gold. Runtime color values were not changed.

## Verification

Host quick check:

- `pnpm --filter @locateflow/web test -- src/lib/workspace-routes.test.ts src/lib/workspace-context-resolver.test.ts src/lib/consumer-entitlement.test.ts` passed: 3 files / 8 tests. Host Node remains `v24.12.0`, so pnpm prints the expected engine warning.

Docker Node 22 canonical checks:

- Focused web tests passed: `pnpm --filter @locateflow/web test -- src/lib/workspace-routes.test.ts src/lib/workspace-context-resolver.test.ts src/lib/consumer-entitlement.test.ts`.
- Web typecheck passed: `pnpm --filter @locateflow/web exec tsc --noEmit`.
- Full typecheck passed: `pnpm verify:typecheck`.
- Full test suite passed: `pnpm verify:tests`.
- Prisma schema validate passed with dummy syntactic MySQL URL: `DATABASE_URL=mysql://user:pass@localhost:3306/locateflow pnpm --filter @locateflow/db exec prisma validate`.
- `git diff --check` passed with only expected CRLF warnings on Windows checkout.

## Remaining Work

Agent:

- Commit/push this fix and memory update.
- Trigger or ask for Dokploy redeploy after push; then verify `/api/build-info` moves past `9d9ae964`.
- After deploy, continue authenticated QA on existing Chrome session only: web dashboard/moving/services/providers/settings/workspace/export and admin overview/users/moves/providers/leads/affiliate/subscriptions/settings/backups/security.
- Run mobile/emulator QA when an emulator/device path is available: tabs, onboarding, services/providers, moving caps, settings/subscription, connections/export/workspace, OAuth handoff, app lock, staging API config, visual theme.
- Run the formal product-design screenshot audit from real staging screenshots.
- Run the full Codex Security deep scan workflow only when the required six-worker scan can be completed honestly.

Operator:

- If the intended palette is not Gold, provide or identify the exact source that supersedes the current pushed zip bundle; likely candidate is `NEW GENERATION/`, but this needs an explicit product decision.
- Complete admin/web login or 2FA inside the existing Chrome session when authenticated QA reaches protected surfaces.
- No new env action is currently needed for readiness; live health/readiness remains OK.
