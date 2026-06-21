# 2026-06-21 Staging Workspace, Theme, and Deploy Follow-up

## 2026-06-21 Sapphire Override

- Operator explicitly clarified after the earlier Gold interpretation: "Mavi olan sapphire ise onu istemistim ben her yerde light dark." Treat Sapphire as the product decision for web, admin, mobile, public assets, and light/dark mode.
- This supersedes the earlier conclusion that the zip bundle's default Gold state should remain runtime default. The zip/prototype evidence still shows Gold/Sapphire/Emerald variants, but the chosen variant is now Sapphire.
- Canonical Sapphire tokens from the design sources:
  - Dark accent: `#5B8DEF`; secondary/highlight: `#83AAF5`; pressed/deep: `#3D6FD6`.
  - Light accent: `#2E5FB0`; deep readable accent: `#244C90`.
  - Semantic warning remains amber/brown where the UI is warning-specific, e.g. `#7A5418`; do not force all semantic warning states to blue.
- Current local pass switched shared design tokens, web/admin CSS variables, Tailwind tokens, public SVG/OG assets, mobile theme/app colors, map fallback colors, and relevant tests from Gold to Sapphire.
- Added explicit web/admin TypeScript path aliases for `@locateflow/connectors` and shared/db workspace packages so Docker/Linux verification does not depend on Windows `node_modules` symlink targets.
- Gold drift scan over `apps` and `packages/shared/src` is clean for theme tokens; the only remaining hit is the non-theme phrase "golden rule" in the connector webhook comment.

Verification after Sapphire pass:

- `git diff --check` passed with only expected Windows CRLF warnings.
- Clean Docker Node 22 workspace: `DATABASE_URL=mysql://user:pass@localhost:3306/staging_move pnpm --filter @locateflow/db exec prisma validate --schema prisma/schema.prisma` passed.
- Clean Docker Node 22 workspace: `pnpm verify:typecheck` passed.
- Clean Docker Node 22 workspace: all package tests passed via `pnpm --filter @locateflow/web/admin/mobile/shared/connectors test -- --reporter=dot`.
- The clean Docker install needed ephemeral `strict-ssl=false` / `NODE_TLS_REJECT_UNAUTHORIZED=0` only because this local network/container cannot verify registry/Prisma binary certificates. Do not copy that setting into repo, Dokploy, or production env.

Not yet done for the Sapphire pass:

- Commit, push, and Dokploy redeploy the Sapphire changes.
- Verify staging `/api/build-info` for web/admin reports the new commit.
- Use the existing Chrome/Dokploy session only; do not open a new Chrome.
- Capture/inspect live web/admin screenshots for Sapphire light/dark, then continue authenticated QA and mobile QA.

## Live Deploy Check

- Existing Chrome window/profile was used only; no new Chrome profile/window was opened.
- Chrome profile shown in the browser chrome was `MUSTAFA (axtrasolutions.com)`.
- Dokploy `Staging Move` deployments tab shows the latest successful deployment as `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842` (`Fix consumer-free caps and theme audit memory`), status `Done`.
- Live `/api/build-info` also reports web/admin running `9d9ae9643c19eb2c24948f0bc85d6d1e5795d842`, branch `codex/staging-audit-2026-06-21`, built around `2026-06-21T21:36:38Z`.
- Local/GitHub branch HEAD is newer (`138d6353` before this pass), but the newer commits before this fix were memory/comment-only. Staging is healthy, but "fully deployed to HEAD" is not true until Dokploy rebuilds a commit newer than `9d9ae964`.
- Admin login in the existing Chrome tab rendered the dark Move Admin page with Gold/champagne primary CTA. The password field was already filled, so no sign-in submit was clicked.

Post-fix redeploy:

- Commit `d434a37dae0dad804259d8c488cdcffd44f8c946` (`Fix consumer-free workspace theme drift`) was pushed to `codex/staging-audit-2026-06-21`.
- Dokploy manual deployment was started from the existing Chrome/Dokploy session and completed.
- Web `/api/build-info`: `d434a37dae0dad804259d8c488cdcffd44f8c946`, built `2026-06-21T22:29:31.531Z`.
- Admin `/api/build-info`: `d434a37dae0dad804259d8c488cdcffd44f8c946`, built `2026-06-21T22:29:31.531Z`.
- Web `/api/health`: `healthy`, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.
- Admin `/api/ready`: `ready: true`, `database: ready`, `requiredOk: true`, `missingRequiredCount: 0`.
- Public route smoke after deploy: web `/`, `/features`, `/why-free`, `/blog`, `/sign-in` returned `200`.
- Auth-gated route smoke after deploy: web `/dashboard` and `/onboarding` returned `307` to sign-in; admin `/users` returned `307` to `/login`.
- Admin public smoke after deploy: `/login` and `/api/healthz` returned `200`.
- Existing Chrome `Move Admin` tab was hard-refreshed after deploy and still rendered the dark Gold/champagne admin sign-in. The prefilled password field was not submitted.

## Theme Decision

- Historical note from the earlier pass: the committed design zip bundle under `design-src/handoffs/*.zip` / extracted `design-src/initial-check-requested/project` resolves to default `Gold`.
- Direct source evidence:
  - `Admin.dc.html` exposes `Gold`, `Sapphire`, `Emerald`, with default `Gold`.
  - `Move.dc.html` exposes `Gold`, `Sapphire`, `Emerald`, with default `Gold`.
  - Default Gold tokens are `#CBA45E`, `#DCBC7C`, and `#B0852F`.
- `Sapphire` and `Emerald` are variants/support choices in the pushed zip bundle, not the default.
- The separate `NEW GENERATION/` folder is `Champagne & Rose` / orange-rose (`#D4846A`, `#EDB99D`, `#A85A42`, plus `#f97316` in prototypes). This likely explains the operator's memory that the theme was not Gold.
- Superseded product decision: operator chose Sapphire explicitly for all light/dark surfaces. Runtime should now be Sapphire, not Gold.

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

- Commit and push the current Sapphire pass, then trigger Dokploy redeploy from the existing Chrome session only.
- Verify web/admin build-info, health/readiness, public route smoke, and auth redirect smoke against the new commit.
- Screenshot-check web/admin live light/dark Sapphire after deploy; Gold/champagne primary CTAs should be treated as drift.
- Continue authenticated QA on the existing Chrome session only: web dashboard/moving/services/providers/settings/workspace/export and admin overview/users/moves/providers/leads/affiliate/subscriptions/settings/backups/security.
- Run mobile/emulator QA when an emulator/device path is available: tabs, onboarding, services/providers, moving caps, settings/subscription, connections/export/workspace, OAuth handoff, app lock, staging API config, visual theme.
- Run the formal product-design screenshot audit from real staging screenshots.
- Run the full Codex Security deep scan workflow only when the required six-worker scan can be completed honestly.

Operator:

- Palette decision is now clear: Sapphire/blue everywhere in light and dark.
- Complete admin/web login or 2FA inside the existing Chrome session when authenticated QA reaches protected surfaces.
- No new env action is currently needed for readiness; live health/readiness remains OK.
