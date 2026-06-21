# 2026-06-21 Staging Deploy, Theme, and Runtime QA

## Current Live Staging Before Latest Push

Dokploy `Staging Move` (`staging-move-phkdb4`) was redeployed from branch
`codex/staging-audit-2026-06-21`.

Live build-info currently reports the last pushed code deploy, not the latest
local audit fixes below:

- Web: `9929a7d6f03864ab9166af9119a7cdf6fb92be28`, built at `2026-06-21T20:29:55.756Z`.
- Admin: `9929a7d6f03864ab9166af9119a7cdf6fb92be28`, built at `2026-06-21T20:29:55.750Z`.

Latest live health check after the operator copied staging envs:

- Web `/api/health`: `200`, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.
- Admin `/api/ready`: `200`, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`.

## Theme Conclusion

The design zip bundle currently committed under `design-src/handoffs/*.zip` resolves to
Gold as the default accent, with Sapphire and Emerald present as variants.

Evidence from the latest zip scan:

- `Admin.dc.html` mentions Gold, Sapphire, and Emerald; default detection resolves to Gold.
- Most frequent accent tokens include `#CBA45E`, `#DCBC7C`, and `#B0852F`.
- Sapphire `#37C2C9` and Emerald `#54CB7E` are present, but they are variant/support accents rather than the default route.

Runtime theme drift was found after the first successful deploy: fresh sessions rendered the public web in light mode because `next-themes` used `defaultTheme="system"` and the QA/browser system resolved to light. The design source and CSS root default are dark/gold, so the web `ThemeProvider` now defaults fresh sessions to `dark` while keeping Light and System available in the toggle.

## Fixes Completed In This Runtime Pass

- `ae1d53be` kept `/features` and `/why-free` public. Before the fix both routes redirected to `/sign-in`, even though the design bundle includes public Features and Why Free pages.
- `9929a7d6` changed fresh web sessions to the dark Move Gold theme and added a regression test.
- Pending local fix: web subscription settings now shows the Consumer Free panel only after the effective entitlement is active and on an included paid-tier access level (`INDIVIDUAL`, `FAMILY`, or `PRO`). This closes a web/mobile logic drift where a lapsed/manual/admin-derived row could render as "Free, everything included" while the effective entitlement was inactive or free-tier.
- Pending local fix: public `/features` and `/why-free` copy no longer exposes internal "design bundle / route mapping" implementation language to users.

## Verification Passed

- `pnpm --filter @locateflow/web test -- src/middleware.test.ts`
- `pnpm --filter @locateflow/web test -- src/components/theme-provider.test.tsx src/middleware.test.ts`
- `pnpm --filter @locateflow/web test -- src/components/settings/subscription-management.helpers.test.ts src/lib/consumer-entitlement.test.ts`
- `pnpm --filter @locateflow/web test -- src/components/settings/subscription-management.helpers.test.ts src/lib/consumer-entitlement.test.ts src/app/landing-accessibility-regression.test.ts src/app/interactive-nesting-regression.test.ts`
- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `git diff --check`

Latest full test count after pending local fixes:

- Web: 324 files / 2757 tests passed.
- Admin: 127 files / 779 tests passed.
- Mobile: 34 files / 324 tests passed.
- Shared: 35 files / 388 tests passed.
- Connectors: 15 files / 105 tests passed.

Note: local host Node is `v24.12.0`, while the repo declares Node `22.x`.
The tests pass locally with an engine warning; Dokploy image/build remains the
authoritative Node 22 runtime path.

Live HTTP QA after `9929a7d6`:

- Web public: `/`, `/features`, `/why-free`, `/blog`, `/sign-in` returned `200`.
- Web auth-gated: `/dashboard`, `/onboarding` redirected to sign-in as expected.
- Admin public: `/login`, `/api/healthz`, `/api/ready` returned `200`.
- Admin auth-gated: `/users` redirected to `/login` as expected.
- Imgproxy root returned `200`.

Live Playwright visual QA after `9929a7d6`:

- Fresh sessions rendered with `<html class="dark">`.
- Web body background resolved to `rgb(9, 14, 22)`.
- Primary token resolved to `39 51% 58%`, matching the Gold `#CBA45E` family.
- Public web, Features, Why Free, Sign In, Admin Login, and mobile-width public pages loaded without console errors or page errors.

Local screenshot evidence generated during this pass:

- `tmp-theme-zip-contact-sheet.png`
- `tmp-live-qa-9929a7d6/live-contact-sheet.png`

## Remaining Work

- Authenticated web runtime QA still needs a staging user session: dashboard, moving, services, providers, settings/subscription, workspace flows, route-map/media, export flows.
- Authenticated admin runtime QA still needs admin login/2FA: overview, users, moving, providers, leads, affiliate, subscriptions, settings, backups/security.
- Native mobile/emulator QA is still pending: tabs, settings/subscription, services/providers, OAuth handoff, app-lock, staging API config, and mobile visual theme.
- Product Design screenshot audit can now use the latest dark/gold staging screenshots, but the full formal audit pass is not yet complete.
- The full Codex Security deep scan six-worker workflow is still not honestly complete in this thread; prior work covered tests/static security review, not the plugin's full delegated scan.
- Push and redeploy the pending local fixes, then confirm web/admin `/api/build-info` match the new pushed commit.
- If the operator has a newer external design zip that is not the one now committed in `design-src/handoffs`, compare that exact file before changing the palette again.

## Operator / Agent Split

Operator should provide or complete interactive credentials only outside chat: web test user login, admin login and 2FA, and any newer external design zip if the intended default is not Gold.

Agent should continue with authenticated web/admin/mobile QA, fix any runtime or theme drift found there, redeploy Dokploy after code changes, and update this memory trail after each verified pass.
