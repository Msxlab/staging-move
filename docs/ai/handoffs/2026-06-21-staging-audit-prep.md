# Handoff: Staging Audit Prep - 2026-06-21

## Scope

Local pre-install audit for the `Msxlab/staging-move` repo in `C:\Users\Kutay\Documents\staging-move`. The operator asked to read memory and inspect the code deeply before installing/running. No package install, migration, dev server, or browser login has been run yet. A first code-fix pass was applied on branch `codex/staging-audit-2026-06-21` for findings that did not require env or install.

Branch created for this audit memory: `codex/staging-audit-2026-06-21`.

## Live Dokploy Staging Update - 2026-06-21

Dokploy staging was created under the existing `LocateFlow` project as compose service
`Staging Move` (`staging-move-phkdb4`) using the Git provider:

- Repository: `https://github.com/Msxlab/staging-move.git`.
- Branch: `codex/staging-audit-2026-06-21`.
- Compose path: `docker-compose.dokploy.yml`.
- Required Dokploy env isolation keys: `DOKPLOY_COMPOSE_PROJECT_NAME=staging-move`
  and `DOKPLOY_CONTAINER_PREFIX=staging-move`.

Cloudflare staging DNS records were added as DNS-only A records to `89.117.149.77`:

- `staging.locateflow.com`.
- `admin-staging.locateflow.com`.
- `img-staging.locateflow.com`.

Dokploy domains were attached and validated:

- Web: `https://staging.locateflow.com` -> service `web`, port `3000`.
- Admin: `https://admin-staging.locateflow.com` -> service `admin`, port `3001`.
- Imgproxy: `https://img-staging.locateflow.com` -> service `imgproxy`, port `8080`.

Deployment notes:

- Initial Dokploy deploy succeeded with commit `48932b17` (`Make Dokploy compose staging-safe`).
- A follow-up compose fix was required because `cron` did not have a Docker Compose
  profile and therefore started during staging deployment. Commit `57e6b624`
  (`Keep Dokploy cron behind explicit profile`) adds `profiles: ["cron"]` to
  `docker-compose.dokploy.yml`.
- After redeploy, Dokploy final log showed `mysql`, `imgproxy`, `migrate`, `admin`,
  and `web` only in the compose start path; the old `staging-move-cron` container
  remained from the first deploy and was manually stopped in Dokploy.
- Current Dokploy container state after refresh: `staging-move-web` running/healthy,
  `staging-move-admin` running/healthy, `staging-move-migrate` exited `0`,
  `staging-move-mysql` running/healthy, `staging-move-imgproxy` running, and
  `staging-move-cron` exited.

Post-deploy smoke checks:

- Public DNS via `1.1.1.1` resolves all three staging hostnames to `89.117.149.77`.
- `GET https://staging.locateflow.com/api/health` returns `200`, `ready: true`,
  `requiredOk: true`, `missingRequiredCount: 0`.
- `GET https://admin-staging.locateflow.com/api/healthz` returns `200` with
  `{"ok":true,"service":"admin"}`.
- `HEAD https://img-staging.locateflow.com/` returns `200` from `imgproxy`.
- `HEAD https://staging.locateflow.com/` returns `200`.
- `HEAD https://admin-staging.locateflow.com/` returns `307` to `/login`; `/login`
  returns `200`.
- `GET https://staging.locateflow.com/robots.txt` returns `Disallow: /`.
- Web and admin responses include `X-Robots-Tag: noindex, nofollow, noarchive`.

No env secret values were copied into chat or local notes. The smoke tests only used
HTTP responses and masked/indirect Dokploy state.

## Sapphire Theme Follow-up - 2026-06-22

Current product/theme decision remains `LocateFlow + Sapphire` for public web,
web app, admin, and mobile in light/dark. The design zips contain an older Gold
default and Sapphire/Emerald variants; Gold is historical source material, not
the selected runtime theme.

Important Dokploy behavior: the staging compose service is still wired to branch
`codex/staging-audit-2026-06-21`. A direct webhook call or a `refs/heads/main`
payload returns `Branch Not Match`. To redeploy this staging service manually,
send a GitHub-style push payload for
`refs/heads/codex/staging-audit-2026-06-21` after pushing that branch. Do not
record or expose the webhook token.

Live deploy verification before the follow-up cleanup:

- Web and admin `build-info` both reached commit
  `5645d9839334fc51f16a7ea4f7a7337cf6cde201`.
- Web build time: `2026-06-22T02:14:42.243Z`.
- Admin build time: `2026-06-22T02:14:42.237Z`.
- Web/admin health and readiness endpoints returned `200`.
- Public smoke pages returned `200` and `LocateFlow` titles: `/`, `/features`,
  `/why-free`, `/pricing`, `/blog`, `/help`, `/sign-in`, `/sign-up`, and admin
  `/login`.

Follow-up code cleanup: the public home page still had residual `tone-honey`
classes in demo-only marketing components after the first Sapphire pass. Those
were narrowed to `RecognitionChipStorm` and `MobileMockup`, then changed to
Sapphire/primary demo accents. Real warning/caution semantics in app/admin
surfaces remain allowed to use warning tones.

Public header follow-up: the home-page top navigation was expanded so desktop
and mobile expose the same public entrypoints near the top of the page:
`Features`, `Why free`, `Pricing`, `Help`, `Blog`, and `FAQ`. Sign-in and
sign-up remain the right-side auth actions.

Live verification after the header follow-up:

- Runtime code commit `f8cf30160e6a631b1b96b8049c69a2762361596d` reached both
  web and admin staging.
- Web build time: `2026-06-22T02:31:20.339Z`.
- Admin build time: `2026-06-22T02:31:20.354Z`.
- Header HTML contains `Features`, `Why free`, `Pricing`, `Help`, `Blog`, and
  `FAQ`.
- Final cache-busted smoke returned `200` for web health, web ready, admin
  ready, admin healthz, `/`, `/features`, `/why-free`, `/pricing`, `/blog`,
  `/help`, `/sign-in`, `/sign-up`, and admin `/login`.
- Final checked public HTML still had no `>Move<`, `Move app`, `Move Admin`,
  `Move Gold`, `move-gold`, `tone-honey`, `honey`, or `gold` hits.

Live verification after the follow-up cleanup:

- Web and admin `build-info` both reached commit
  `fac3aae390209ab4a9e2435ac68a09c06e990ab7`.
- Web build time: `2026-06-22T02:22:14.625Z`.
- Admin build time: `2026-06-22T02:22:14.632Z`.
- `GET` smoke for web/admin build-info, web health, web ready, admin ready, and
  admin healthz returned `200`.
- Cache-busted public smoke pages returned `200` with `LocateFlow` titles:
  `/`, `/features`, `/why-free`, `/pricing`, `/blog`, `/help`, `/sign-in`,
  `/sign-up`, and admin `/login`.
- Smoke HTML scan found no `>Move<`, `Move app`, `Move Admin`, `Move Gold`,
  `move-gold`, `tone-honey`, `honey`, or `gold` hits on those public pages.

## Read / Inspected

- Repo rules: `AGENTS.md`.
- Product memory: `docs/ai/00_START_HERE.md`, `00_PRODUCT_BRAIN_DASHBOARD.md`, `03_NEXT_AGENT_TASKS.md`, `04_WEEKLY_REVIEW.md`, recent `docs/ai/handoffs/`, `docs/ai/memory/`, `audit-memory-2026-06-12/`, and module audit reports.
- Deploy/QA: `README.deploy.md`, `docs/qa/current-product-local-staging-test-runbook.md`, `docs/deploy/staging-env-inventory.md`, Dockerfiles, compose files, cron workflow.
- Code areas: web/admin/mobile route inventory, Prisma schema, billing/IAP, workspace/connectors, maps, blog/R2, admin auth/RBAC/backup, rate limits, public API routes, mobile router/theme.

## Confirmed Healthy Or Improved

- Old partner-consent refresh route is gone; cron refresh path uses guarded cron request.
- `docker/web.prod.Dockerfile` and `docker/admin.prod.Dockerfile` start the Next standalone servers without runtime migrations.
- Root `Dockerfile` and root `pnpm start` now start the web server without running `prisma migrate deploy`; migrations remain a separate deploy/migrator concern.
- GitHub cron now has `CRON_SCHEDULER_DISABLED` plus workflow concurrency, and self-hosted Ofelia docs now warn that only one scheduler should target a production domain.
- Admin backup cron now supports optional `BACKUP_CRON_SECRET`; when set, backup cron/retention routes reject the broader `CRON_SECRET`.
- PartnerConsent now has a nullable `activeGrantKey` plus unique `(userId, connectorKey, activeGrantKey)` invariant so only one active `GRANTED` consent can exist per connector; migration also supersedes existing duplicates.
- Workspace sync route now validates `toAddressId` and `fromAddressId` against same workspace, same subject user, active target member, and `deletedAt: null`.
- Address update route gates connector auto-sync by API connector feature and owner/user entitlement before enqueue.
- Manual connector dispatch gates feature and user entitlement before enqueue.
- Connector OAuth config validates HTTPS and manifest host allowlist, uses timeout, and rejects redirects for token exchange.
- Connector dispatch worker has atomic claim and recovery sweep for stale `DISPATCHING` / `SUBMITTED` rows.
- Mobile OAuth runtime requires PKCE challenge/verifier, and `MobileOAuthCode.codeChallenge` is now a DB-required field in this branch; the migration removes legacy NULL/empty handoff rows before adding `NOT NULL`.
- Mover proof upload validates declared and magic-byte MIME; admin document download checks permission, key prefix, and safe response headers.
- Blog HTML write path sanitizes Tiptap HTML; web blog has a separate sanitizer and tests.
- Web route map has authenticated static map route, premium full-map gate, preview fallback, upstream timeout, and no key leakage by design.
- Route-map env docs/examples now include optional `GEOAPIFY_API_KEY`; static code pass found no additional proxy leak/gate issue, but real image rendering still needs staging key, coordinates, and entitlement.
- Required env keys from `packages/shared/src/env-catalog.ts` are now represented in both `.env.example` and `.env.production.example` (`NEXT_PUBLIC_ADMIN_URL` and server-side `SUPPORT_EMAIL` were added).
- Admin API static scan only found public `build-info` and `healthz` as intentionally unauthenticated.
- Admin SQL dump download sanitizes/encodes the attachment filename and has a regression test for CR/LF/header-injection style database names.
- Web/admin export, dossier PDF, backup archive, and mover-document download routes now use safe attachment filename encoding with both `filename` and RFC 5987 `filename*` headers.
- Public tracking event/session routes now sanitize client-supplied analytics/session attributes before DB writes and return 400 for malformed JSON instead of falling through to 500s.
- Admin trusted-device list/revoke responses now send `Cache-Control: no-store` because they include security-device metadata and revocation outcomes.
- User-facing workspace member, invitation, rename, sync, transfer, and managed-sync routes now require membership in a non-deleted workspace before mutating or returning active workspace data; restore/delete remain intentional lifecycle exceptions.
- Admin login success/MFA challenge, session list/revoke, MFA setup, and MFA verify responses now send no-store headers because they include auth state, one-time MFA material, session handles, or security metadata.
- Manual admin backup retention cleanup now requires password/MFA step-up before deleting backup rows or offsite archives; cron backup-secret and dry-run paths remain non-step-up.
- Static web/admin/mobile route-link inventory now reports no literal page/API misses after fixing the mover application terms link from `/legal/terms` to `/terms`; web layout asset references were verified in `apps/web/public`.
- Password reset request returns generic responses, applies rate policy, supersedes old tokens, and avoids account enumeration.
- Public provider endpoints are rate-limited; popularity endpoint has k-anonymity suppression.
- Affiliate postback is HMAC-authenticated and idempotent.
- This branch adds a central `enqueueAddressChange` feature/entitlement gate and regression coverage for disabled feature and workspace-owner entitlement checks.
- This branch adds rate limiting to `/api/help/feedback` and a route test for limiter-before-counter behavior.
- This branch adds `apps/mobile/app/+not-found.tsx` for unknown mobile routes/deep links.
- This branch adds shared `ApiClient` dynamic headers plus mobile selected-workspace persistence so mobile requests can send `x-workspace-id` for workspace-scoped APIs.
- This branch adds encrypted-at-rest storage for new Google Play purchase tokens; `Subscription.purchaseToken` remains as a legacy fallback/read column until old rows are revalidated or migrated with app-runtime encryption.
- This branch aligns mobile runtime theme tokens and NativeWind palette with `packages/shared/src/design-tokens.ts`; component-level hardcoded accents still need screenshot review.
- This branch aligns shared typography tokens, web Tailwind font utilities, display/prose/wordmark styles, and Aurora display fallbacks with the Playfair/DM design system; public SVG/blog art typography still needs visual asset review.
- Static import and mobile API contract scans are clean: local relative/`@/` imports resolve, and mobile API calls map to existing web API routes/methods.
- The env readiness catalog now covers every statically detected runtime env reference after excluding platform and QA-script-only keys; real values were not read.
- The broad staging audit prompt was refreshed with the latest static gates and branch findings so the runtime QA pass repeats route/API/env/i18n/theme/workspace/admin checks instead of relying on memory.
- Portal, CCPA, locale, OAuth, partner-consent OAuth, and admin middleware session cookies now use staging/HTTPS-aware secure-cookie policy and explicit root-scoped expiry where cookies are cleared.
- Admin invite set-password links now prefer configured admin URLs and otherwise fall back to the current request origin, avoiding production hardcode when staging runs with `NODE_ENV=production`.
- This branch upgrades admin middleware route rate limiting from process-local only to Upstash REST when configured, with short fail-closed behavior on configured Redis failures in production-like runtimes.
- This branch shortens mover/partner portal magic-link sessions to 24 hours, supersedes prior mover links on re-request, adds mover per-email throttling, and updates visible expiry copy/tests.

## Fixes Applied On This Branch

| Finding | Files | Status |
| --- | --- | --- |
| STG-001 | `Dockerfile`, `package.json`, `docs/deploy/digitalocean-app-platform-web.md`, `docs/deploy/staging-env-inventory.md`, `docs/ai/memory/RISK_REGISTER.md`, `docs/ai/memory/PROJECT_MAP.md` | Fixed in code/docs; deploy platform run command still needs live verification. |
| STG-002 | `.github/workflows/cron.yml`, `README.deploy.md`, `docker/ofelia.ini`, `docs/deploy/staging-env-inventory.md` | Added explicit scheduler ownership switch/docs; live GitHub repo variable and platform scheduler state still need verification. |
| STG-003 | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260621110000_subscription_purchase_token_encrypted/migration.sql`, `apps/web/src/lib/iap-common.ts`, `apps/web/src/app/api/webhooks/playstore/route.ts`, admin billing/subscription/revalidate/settings routes, profile sanitizer, audit redaction | New Play Store writes store the token in `purchaseTokenEncrypted`, clear plaintext `purchaseToken`, retain hash lookup, and use hash/encrypted presence in admin surfaces; old plaintext rows need runtime revalidation/migration cleanup. |
| STG-004 | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260621100000_partner_consent_active_unique/migration.sql`, `apps/web/src/lib/connector-oauth.ts`, `apps/web/src/lib/connector-oauth.test.ts`, `apps/web/src/lib/partner-consent-refresh.ts`, `apps/admin/src/app/api/connectors/consents/route.ts`, `apps/admin/src/app/api/connectors/consents/route.test.ts` | Fixed in code/schema; migration, Prisma generate, and tests not executed because dependencies/env are not installed. |
| STG-005 | `apps/web/src/lib/connector-runtime.ts`, `apps/web/src/app/api/connector-dispatch/route.ts`, `apps/web/src/app/api/workspaces/[id]/sync/route.ts`, `apps/web/src/lib/connector-runtime.test.ts` | Fixed in code; tests added but not executed because dependencies are not installed. |
| STG-006 | `apps/web/src/app/api/connector-dispatch/route.ts`, `apps/web/src/app/api/connector-dispatch/route.test.ts`, `packages/shared/src/api-client.ts`, `packages/shared/src/api-client.test.ts`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/api.test.ts`, `apps/mobile/src/lib/workspace-selection.ts`, `apps/mobile/src/lib/workspace-selection.test.ts`, `apps/mobile/app/settings/workspace.tsx`, `apps/mobile/src/lib/local-cleanup.ts` | Backend route now resolves workspace scope and passes `workspaceId` to enqueue; mobile now persists selected workspace and sends `x-workspace-id`; install-backed tests and runtime QA still pending. |
| STG-007 | `apps/web/src/app/api/help/feedback/route.ts`, `apps/web/src/app/api/help/feedback/route.test.ts` | Fixed in code; test added but not executed because dependencies are not installed. |
| STG-008 | `apps/admin/src/lib/internal-secrets.ts`, `apps/web/src/lib/internal-secrets.ts`, `apps/admin/src/app/api/cron/backup/route.ts`, `apps/admin/src/app/api/backup/retention/route.ts`, `.github/workflows/cron.yml`, `docker/locateflow-cron-runner.sh`, `docker-compose.prod.yml`, env/config docs | Added optional narrow backup cron secret; install-backed tests and live env verification pending. |
| STG-009 | `apps/mobile/app/+not-found.tsx` | Fixed in code; mobile typecheck not executed because dependencies are not installed. |
| STG-010 | `apps/mobile/src/lib/theme.ts`, `apps/mobile/tailwind.config.ts` | Mobile runtime theme and NativeWind palette now consume/mirror shared Aurora tokens instead of the divergent Sapphire/greige palette; screenshot audit still pending. |
| STG-011 | `apps/admin/src/middleware.ts`, `apps/admin/src/middleware.test.ts` | Admin route limiter now uses Upstash REST when configured and fails closed briefly when configured Redis errors in production-like runtimes; live Upstash env/reachability still needs staging proof. |
| STG-012 | `apps/web/src/lib/mover-portal-auth.ts`, `apps/web/src/lib/partner-portal-auth.ts`, `apps/web/src/app/api/movers/portal/request/route.ts`, `apps/web/src/app/api/partners/portal/request/route.ts`, `apps/web/src/components/movers/mover-portal-login.tsx`, portal auth tests | Portal magic-link sessions now expire after 24 hours, requester copy matches, mover requests have per-IP/per-email throttling, and prior mover links are superseded; install-backed tests and live email/browser proof still pending. |
| STG-015 | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260621120000_mobile_oauth_code_challenge_required/migration.sql`, OAuth init/callback routes, `apps/web/src/app/api/mobile/auth/exchange/route.ts`, `apps/web/src/app/api/mobile/auth/exchange/route.test.ts` | Mobile OAuth handoff rows now require `codeChallenge` at DB level after deleting legacy NULL/empty rows; init/callback comments and exchange validation now require PKCE verifier; Prisma validate/migrate and mobile OAuth smoke still pending. |
| STG-016 | `apps/admin/src/lib/http-download.ts`, `apps/web/src/lib/http-download.ts`, admin CSV/backup/mover-document download routes, web account-export/PDF/dossier routes, related header tests | Dynamic and export attachment filenames now pass through a shared sanitizer and emit `filename*`; install-backed tests still pending. |
| STG-017 | `apps/web/src/app/api/tracking/event/route.ts`, `apps/web/src/app/api/tracking/event/route.test.ts`, `apps/web/src/app/api/tracking/session/route.ts`, `apps/web/src/app/api/tracking/session/route.test.ts` | Public tracking routes now reject malformed JSON, sanitize/truncate client fields to DB limits, and clamp `pageViews`; install-backed tests still pending. |
| STG-018 | `apps/admin/src/app/api/auth/mfa/trusted-devices/route.ts`, `apps/admin/src/app/api/auth/mfa/trusted-devices/route.test.ts` | Trusted-device list/revoke responses now set `Cache-Control: no-store`; install-backed tests still pending. |
| STG-019 | `apps/web/src/app/api/workspaces/[id]/route.ts`, member/invitation/managed-sync/sync/transfer/rename workspace routes, related route tests | Active workspace operations now filter caller membership through a non-deleted `Workspace` and selected workspace lookups use `deletedAt: null`; install-backed tests still pending. |
| STG-020 | `apps/admin/src/app/api/auth/login/route.ts`, `apps/admin/src/app/api/auth/sessions/route.ts`, `apps/admin/src/app/api/auth/mfa/setup/route.ts`, `apps/admin/src/app/api/auth/mfa/verify/route.ts`, related auth route tests | Sensitive admin auth responses now set `Cache-Control: no-store`; install-backed tests still pending. |
| STG-021 | `apps/admin/src/app/api/backup/retention/route.ts`, `apps/admin/src/app/api/backup/retention/route.test.ts` | Manual destructive backup retention now requires password/MFA step-up; dry-run and backup-secret cron paths still bypass step-up as intended. |
| STG-022 | `apps/web/src/app/movers/apply/page.tsx`, route-link static inventory | Mover application legal link now points to the existing `/terms` page instead of missing `/legal/terms`; static web/admin/mobile literal page/API route scan reports zero misses excluding verified public assets. |
| STG-023 | `apps/mobile/src/i18n/messages/en.json`, `apps/mobile/src/i18n/messages/es.json`, namespace-aware i18n static inventory | Mobile vehicle-check recall count now has a base key in addition to plural forms; web/admin/mobile EN/ES parity is clean and no literal i18n call is missing without an explicit fallback. |
| STG-024 | `README.deploy.md`, `docs/deploy/digitalocean-app-platform-web.md` | Deployment smoke docs now use unauthenticated admin `/api/healthz` for liveness and reserve admin `/api/health` for authenticated UI/runtime checks. |
| STG-025 | `packages/shared/src/constants.ts`, `apps/web/src/styles/globals.css`, theme static color inventory | Shared legacy category/status/theme constants and the unused light-mode `text-violet-300` bridge now resolve to Aurora-aligned colors instead of old purple/cyan/Tailwind palette values. |
| STG-026 | `apps/mobile/app/(auth)/sign-in.tsx`, `apps/mobile/android/app/src/main/res/values/colors.xml` | Mobile sign-in Apple OAuth button now matches sign-up's black button so the white Apple mark is visible; Android native `colorPrimary` now uses Aurora primary. |
| STG-027 | `packages/shared/src/design-tokens.ts`, `apps/web/tailwind.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/components/marketing/logo.tsx`, `apps/web/src/styles/globals.css`, `apps/web/src/styles/aurora.css`, `apps/admin/src/app/aurora.css`, web premium display components | Shared typography tokens, Tailwind font utilities, wordmark, blog prose, reveal display, and Aurora display fallbacks now use the Playfair/DM design system instead of stale Fraunces/Geist defaults; legacy font loading remains only for compatibility. |
| STG-028 | `packages/shared/src/env-catalog.ts`, static env/import/API inventories | Optional process-env knobs read by web/admin/mobile are now represented in the readiness catalog, and static import plus mobile-to-web API contract scans report no missing local modules, API routes, or HTTP methods. |
| STG-029 | `docs/ai/prompts/2026-06-21-staging-end-to-end-audit-prompt.md` | The staging audit prompt now explicitly requires pre-install static scans and re-checks for workspace soft-delete, admin no-store, backup step-up, route/i18n/env/theme/typography/API contract, and health endpoint fixes. |
| STG-030 | `apps/web/src/lib/mover-portal-auth.ts`, `apps/web/src/lib/partner-portal-auth.ts`, `apps/web/src/app/api/consent/ccpa/route.ts`, `apps/web/src/app/api/user/locale/route.ts`, OAuth callback routes, partner-consent OAuth callback, `apps/admin/src/middleware.ts`, related tests | Cookie policy drift fixed: staging/preview/HTTPS secure-cookie decisions now use shared/local production-like helpers, and CCPA/OAuth/admin session clears explicitly expire the same root-scoped cookies instead of relying on unscoped `delete()` calls. |
| STG-031 | `apps/admin/src/app/api/team/route.ts`, `apps/admin/src/app/api/team/route.test.ts` | Admin invite set-password URL generation no longer falls back to `https://admin.locateflow.com` solely because `NODE_ENV=production`; env values are normalized first, then the live request origin is used before the final legacy fallback. |

## Open Findings / Risks

| ID | Severity | Area | Evidence | Status / Risk |
| --- | --- | --- | --- | --- |
| STG-001 | P1 | Deploy/runtime DB safety | Root `Dockerfile` CMD and root `pnpm start` previously ran `prisma migrate deploy` before serving. | Fixed in this branch; live DigitalOcean/Dokploy run command must be checked so platform config does not still run inline migrations. |
| STG-002 | P1 | Cron operations | `.github/workflows/cron.yml` targets live domains while self-hosted Ofelia can also target the same app. | Mitigated in this branch with `CRON_SCHEDULER_DISABLED`, workflow concurrency, and docs; live scheduler owner must be verified before staging tests. |
| STG-003 | P1 | Mobile IAP token storage | `Subscription.purchaseToken` previously stored reusable Google Play tokens in plaintext alongside `purchaseTokenHash`. | Mitigated in this branch for new writes: tokens go to `purchaseTokenEncrypted`, plaintext is cleared, hash lookup is retained, and admin/web serializers remove both raw/encrypted fields. Legacy plaintext rows remain until revalidated or migrated with app-runtime encryption. |
| STG-004 | P1 | Connector consent uniqueness | `PartnerConsent` had indexes but no DB-level unique active grant for `(userId, connectorKey)`; app code revoked duplicates after create/update. | Fixed in this branch with nullable active-grant unique key and race fallback; migration/generate/runtime tests pending. |
| STG-005 | P1 | Connector entitlement defense in depth | `enqueueAddressChange` did not enforce entitlement internally; current three callers did gate first. | Fixed in this branch, pending install-backed tests. |
| STG-006 | P1 | Workspace/manual connector path | `/api/connector-dispatch` was user-scoped and default-primary-address based; mobile did not send selected workspace context. | Fixed in this branch at backend and mobile API-client layers, pending install-backed tests and runtime QA. |
| STG-007 | P2 | Public help feedback abuse | `/api/help/feedback` incremented article counters with no visible auth/rate-limit. | Fixed in this branch, pending install-backed tests. |
| STG-008 | P2 | Admin backup secret scope | Admin backup/retention cron accepted broad cron auth only. | Mitigated in this branch with optional `BACKUP_CRON_SECRET`; live admin env / GitHub secret still need configuration and verification. |
| STG-009 | P2 | Mobile unknown routes | No `apps/mobile/app/+not-found.tsx` detected; global error boundary exists. | Fixed in this branch with explicit not-found screen, pending mobile typecheck/runtime smoke. |
| STG-010 | P2 | Theme drift | Shared tokens exist, but mobile runtime theme/NativeWind palette had diverged to a separate Sapphire/greige palette. | Mitigated in this branch by binding mobile runtime colors to shared tokens and aligning NativeWind dark palette; component-level hardcoded accents and web/admin/mobile visual parity still need screenshot audit after app run. |
| STG-011 | P2 | Rate-limit centralization | Web limiter supports Redis health; admin middleware general limiter was process-local. | Mitigated in this branch by adding an Upstash REST path to admin middleware; Redis env/reachability and behavior under load still need staging verification. |
| STG-012 | P2 | Portal magic links | Mover/partner portal tokens previously acted as 14-day/multi-day sessions until revoked/expired; mover requests also lacked per-email throttling and did not supersede old links. | Mitigated in this branch with 24-hour TTL, visible copy update, mover per-email throttling, and single active link per mover/partner; live email delivery, link entry, logout, and expired/revoked behavior still need browser proof. |
| STG-013 | P2 | Route map staging proof | Static map proxy/component/mobile helper pass is coherent and env examples now include `GEOAPIFY_API_KEY`, but real Geoapify rendering requires staging key, real coordinates, and eligible plan. | Must verify with browser/mobile after env/app run. |
| STG-014 | P2 | Live service integrations | Stripe, store IAP, R2/imgproxy, email, Redis, Sentry, backups, OAuth, maps all need runtime proof. | Static audit cannot prove credentials, webhooks, DNS, callbacks, or object storage behavior. |
| STG-015 | P3 | Mobile OAuth DB invariant | Runtime rejected PKCE-less mobile OAuth exchange while DB still allowed nullable `codeChallenge`; exchange request validation also allowed an omitted verifier before returning a structured policy error. | Mitigated in this branch with a `NOT NULL` migration after pruning legacy NULL/empty handoff rows, stale comments removed, and `code_verifier` required at request validation; install-backed Prisma validation and mobile OAuth smoke still pending. |
| STG-016 | P2 | Download header consistency | Several export/PDF/download routes emitted `Content-Disposition` with ad hoc `filename="..."`; dynamic route IDs and stored filenames could reach the header after local sanitizers with inconsistent behavior. | Mitigated in this branch with shared admin/web attachment helpers, RFC 5987 `filename*`, and CR/LF regression tests on dynamic download paths; install-backed tests still pending. |
| STG-017 | P3 | Public tracking payload robustness | `/api/tracking/session` accepted client browser/device/location fields without schema-length normalization, while `/api/tracking/event` could throw 500s on malformed JSON or non-string event/page/session values. | Mitigated in this branch with JSON parse guards, string sanitization/truncation, safe batch fallbacks, and page-view clamping; install-backed tests still pending. |
| STG-018 | P3 | Admin security response cache | `/api/auth/mfa/trusted-devices` returned device metadata without an explicit no-store header. | Mitigated in this branch by adding `Cache-Control: no-store` to list and revoke responses; install-backed tests still pending. |
| STG-019 | P2 | Workspace soft-delete route consistency | Several `/api/workspaces/[id]/*` user-facing routes authorized by membership alone, so a retained membership row could allow roster/invite/sync/rename/transfer operations against a soft-deleted workspace. | Mitigated in this branch by requiring caller membership through a non-deleted workspace and guarding selected workspace lookups with `deletedAt: null`; restore/delete lifecycle routes remain deliberate exceptions. |
| STG-020 | P2 | Admin auth response cache | Admin login success/MFA challenge, session list/revoke, MFA setup, and MFA verify responses returned auth state, one-time MFA setup material, session revoke handles, or security metadata without consistent no-store headers. | Mitigated in this branch by adding no-store/no-cache headers and regression coverage; install-backed tests still pending. |
| STG-021 | P2 | Admin backup retention step-up | Manual `/api/backup/retention` could delete local backup rows and, when enabled, offsite backup archives with SUPER_ADMIN permission but without password/MFA step-up. | Mitigated in this branch by requiring step-up for non-cron, non-dry-run retention cleanup; install-backed tests still pending. |
| STG-022 | P3 | Missing page/link target | `apps/web/src/app/movers/apply/page.tsx` linked to `/legal/terms`, but the public Terms page is `/terms` and no `/legal/terms` page exists. | Fixed in this branch; static literal route/API target scan for web, admin, and mobile now reports zero page/API misses excluding verified static assets. |
| STG-023 | P3 | i18n fallback debt | Mobile vehicle-check recall copy was called via the base key while only plural-suffixed keys existed; broader mobile scan also shows some strings intentionally protected by inline fallback copy. | Fixed the no-fallback raw-key case by adding the base key in EN/ES; fallback-backed mobile copy remains localization debt to review before release. |
| STG-024 | P3 | Deployment smoke endpoint mismatch | README/DigitalOcean smoke docs used admin `/api/health` as if it were public and returned `.status`, but admin `/api/health` requires admin permission and returns detailed `overall`; public liveness is `/api/healthz`. | Fixed docs; runtime still needs browser/curl smoke after deploy. |
| STG-025 | P3 | Legacy theme constants drift | `packages/shared/src/constants.ts` still exported old Tailwind/purple/cyan category/status/theme colors, and web light-mode kept a `text-violet-300` purple bridge. | Fixed shared constants and the web bridge to Aurora-aligned values; runtime screenshots still pending. |
| STG-026 | P3 | Mobile platform/UI color drift | Android native `colorPrimary` still used an old dark blue, and mobile sign-in's Apple button used white background with a white Apple mark. | Fixed Android primary to Aurora and made sign-in Apple button black/white consistent with sign-up; device/browser screenshots still pending. |
| STG-027 | P3 | Typography token/source drift | Shared typography tokens and web Tailwind utilities still treated Fraunces/Geist as canonical while web/admin/mobile layouts had moved to Playfair Display, DM Sans, and DM Mono; web wordmark also referenced a non-existent `--fraunces` CSS variable. | Fixed shared tokens, web Tailwind, wordmark, prose/reveal styles, and Aurora display fallbacks to use Playfair/DM; legacy font imports remain as compatibility fallbacks and public SVG/blog assets still need visual review. |
| STG-028 | P3 | Env readiness catalog drift | Static env scan found runtime env references that existed in code/examples but were not represented in the combined env/runtime catalog, so readiness output could omit optional staging knobs. | Added optional process-env definitions and aliases to `EXPECTED_ENV_KEYS`; static env scan now reports `missing combined catalog=0`. Optional runtime-config example-file parity remains operator/docs debt, not a runtime blocker. |
| STG-029 | P3 | Staging prompt completeness | The broad audit prompt predated the newest route/API/env/theme/admin/workspace fixes and did not explicitly require the new static gates. | Updated the prompt so the next runtime pass repeats these checks systematically. |
| STG-030 | P2 | Cookie/session staging consistency | Static cookie inventory found portal, CCPA, and locale cookies using `NODE_ENV=production` instead of the staging/HTTPS-aware policy, and OAuth/admin-session clear paths using unscoped `cookies.delete()` for cookies written at `Path=/`. | Mitigated in this branch with shared/local secure-cookie helpers, explicit `Path=/` expiry for CCPA/OAuth/admin-session clears, and regression tests/source assertions; install-backed tests and browser cookie proof still pending. |
| STG-031 | P2 | Admin invite URL staging drift | `apps/admin/src/app/api/team/route.ts` built invite set-password links from configured admin URL when present, but otherwise returned `https://admin.locateflow.com` whenever `NODE_ENV=production`; staging builds also use `NODE_ENV=production`, so missing admin URL config could email production admin links. | Mitigated in this branch by normalizing configured URLs and falling back to `request.nextUrl.origin` before the legacy production default; install-backed route test and live invite email proof still pending. |
| STG-032 | P3 | Uptime cron staging target drift | `/api/cron/uptime-check` defaulted web/admin probe targets to production domains whenever env overrides were absent, and admin invite's final fallback still used `NODE_ENV=production`; staging builds can also run with `NODE_ENV=production`. | Mitigated in this branch by making production URL fallbacks require explicit production `APP_ENV`/`VERCEL_ENV` or no explicit env plus `NODE_ENV=production`; staging/preview/local fall back to localhost unless `UPTIME_*`/admin URL env is configured. Install-backed uptime tests and staging cron proof still pending. |
| STG-033 | P2 | Web nested interactive markup | Static JSX scan found 29 `Link`/anchor blocks containing nested `<button>` elements across dashboard-adjacent web pages, settings, services, address, support, notification, empty-state, and upgrade-prompt surfaces. This matched prior live QA concerns and can break click/focus semantics. | Fixed in this branch by moving button classes onto the `Link`/anchor where the action is navigation, leaving real mutation controls as buttons, and adding `apps/web/src/app/interactive-nesting-regression.test.ts`. Static scanner now reports `count=0`; install-backed Vitest run still pending. |
| STG-034 | P2 | Email HTML sanitizer link hardening | Shared/admin email sanitizers added `rel="noopener noreferrer"` only when a `<a target="_blank">` link had no existing `rel`; if user/template HTML supplied `rel="nofollow"` or similar, the sanitized output preserved target blank without opener isolation. | Fixed in both sanitizer copies by merging existing rel tokens with `noopener noreferrer`; admin regression coverage and shared sanitizer regression coverage were added. Install-backed tests remain blocked by missing dependencies/Node mismatch, and shared-package tests remain outside the current root test script. |
| STG-035 | P3 | Shared package test gate gap | `packages/shared/src` contains multiple `*.test.ts` files, but `packages/shared/package.json` has no `test` script and root `verify:tests` does not include `@locateflow/shared`, so shared-only regression tests can be orphaned. | Recorded as a follow-up; do not change dependency/test scripts without explicit approval. Minimum fix is to add an approved shared Vitest script/dependency path and include it in `verify:tests`, then run existing shared tests. |
| STG-036 | P3 | Source text hygiene | `packages/shared/src/email-html-sanitizer.ts` contained literal NUL/control bytes inside the subject-control-character regex, and `apps/admin/src/app/(admin)/insights/insights-data.ts` used literal NUL bytes as a template-literal delimiter. These made text tools classify TypeScript source as binary. | Fixed by replacing the sanitizer control-character range with escaped `[\x00-\x1F\x7F]` and the insights delimiter with `\u0000` escapes; buffer-level NUL scan now reports `nul_source_files=0` and `git diff --check` passes. |

## Staging/Local Run Blockers To Ask Operator

1. Package install approval: `pnpm install --frozen-lockfile` must be explicitly approved.
2. Node version: repo expects `22.x`; current local Node observed as `24.12.0`. Decide whether to switch to Node 22 locally or run through Docker.
3. DB choice: local Docker MySQL vs external staging DB.
4. Env files: operator should create/edit local `.env` files without pasting secrets in chat.
5. Chrome/Dokploy login: `https://server.perfnext.com/dashboard/projects` login for `Mustafa@axtrasolutions.com` will need password and possibly 2FA when we reach that step.

## Verification Attempted

- `git diff --check` passed.
- Required env-key comparison between `packages/shared/src/env-catalog.ts`, `.env.example`, and `.env.production.example` now reports no missing `classification: "required"` keys.
- `pnpm --filter @locateflow/web test -- src/lib/connector-runtime.test.ts src/app/api/help/feedback/route.test.ts src/app/api/connector-dispatch/route.test.ts` did not run: repo dependencies are not installed and local Node is `v24.12.0` while package engines require `22.x`.
- `pnpm --filter @locateflow/web test -- src/lib/iap-common.test.ts src/app/api/webhooks/playstore/route.test.ts src/app/api/profile/route.test.ts` did not run for the same reason: `vitest` is unavailable because `node_modules` is missing, and Node is `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/admin test -- src/middleware.test.ts` did not run for the same reason: `vitest` is unavailable because `node_modules` is missing, and Node is `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/mobile test -- src/lib/api.test.ts src/lib/workspace-selection.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node engine mismatch.
- `pnpm --filter @locateflow/mobile lint` did not run for the same reason: no `node_modules`, `tsc` unavailable, Node engine mismatch.
- `pnpm --filter @locateflow/shared lint` did not run for the same reason: no `node_modules`, `tsc` unavailable, Node engine mismatch.
- `pnpm --filter @locateflow/db exec prisma validate` did not run: `prisma` is unavailable because `node_modules` is missing, and local Node is `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/web test -- src/lib/mover-portal-auth.test.ts src/lib/partner-portal-auth.test.ts` was not run for the same reason: no `node_modules`, `vitest` unavailable, Node engine mismatch.
- `pnpm --filter @locateflow/web test -- src/app/api/consent/ccpa/route.test.ts src/app/api/user/locale/route.test.ts src/lib/mover-portal-auth.test.ts src/lib/partner-portal-auth.test.ts src/app/api/auth/oauth/apple/callback/route.test.ts src/app/api/partner-consents/oauth/callback/route.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/admin test -- src/middleware.test.ts` was retried after the cookie-expiry middleware update and did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/admin test -- src/app/api/team/route.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/web test -- src/app/api/cron/uptime-check/route.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/admin test -- src/app/api/team/route.test.ts` was retried after final production-fallback hardening and did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/web test -- src/app/interactive-nesting-regression.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/admin test -- src/lib/email-template-sanitizer.test.ts` did not run for the same reason: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm test -- packages/shared/src/email-html-sanitizer.test.ts` did not run because the root package has no `test` script; local Node is also `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/web test -- src/app/api/mobile/auth/exchange/route.test.ts src/lib/mobile-oauth.test.ts src/app/api/auth/oauth/google/route.test.ts src/app/api/auth/oauth/apple/route.test.ts` was not run for the same reason: no `node_modules`, `vitest` unavailable, Node engine mismatch.
- Prisma migration validation for `20260621110000_subscription_purchase_token_encrypted` and `20260621120000_mobile_oauth_code_challenge_required` remains blocked by the same missing-dependencies/Node-version issue.
- `pnpm --filter @locateflow/admin test -- 'src/app/api/backup/[id]/download/route.test.ts' 'src/app/api/movers/applications/[id]/documents/[documentId]/download/route.test.ts'` did not run: no `node_modules`, `vitest` unavailable, Node `v24.12.0` instead of required `22.x`.
- `pnpm --filter @locateflow/web test -- 'src/app/api/addresses/[id]/dossier/pdf/route.test.ts'` did not run for the same missing-dependencies/Node-version reason.
- `pnpm --filter @locateflow/web test -- src/app/api/tracking/event/route.test.ts src/app/api/tracking/session/route.test.ts` did not run for the same missing-dependencies/Node-version reason.
- `pnpm --filter @locateflow/admin test -- src/app/api/auth/mfa/trusted-devices/route.test.ts` did not run for the same missing-dependencies/Node-version reason.
- `pnpm --filter @locateflow/web test -- "src/app/api/workspaces/[id]/route.test.ts" "src/app/api/workspaces/[id]/sync/route.test.ts" "src/app/api/workspaces/[id]/managed-sync/route.test.ts" "src/app/api/workspaces/[id]/transfer/route.test.ts" "src/app/api/workspaces/[id]/members/[memberId]/route.test.ts" "src/app/api/workspaces/[id]/invitations/route.test.ts"` did not run for the same missing-dependencies/Node-version reason.
- `pnpm --filter @locateflow/admin test -- "src/app/api/auth/login/route.test.ts" "src/app/api/auth/sessions/route.test.ts" "src/app/api/auth/mfa/setup/route.test.ts" "src/app/api/auth/mfa/verify/route.test.ts" "src/app/api/auth/mfa/trusted-devices/route.test.ts"` did not run for the same missing-dependencies/Node-version reason.
- `pnpm --filter @locateflow/admin test -- "src/app/api/backup/retention/route.test.ts"` did not run for the same missing-dependencies/Node-version reason.
- Static route-link inventory run with local Node reported zero literal page/API target misses for web/admin/mobile after the `/terms` fix. This is regex-based static evidence only; runtime navigation still needs browser/emulator QA after install.
- Namespace-aware static i18n inventory reports: web EN/ES `1351/1351`, admin `408/408`, mobile `1361/1361`, all with zero locale-parity diffs; web/admin have zero missing literal keys, and mobile has zero no-fallback missing literal keys after the vehicle-check recall base-key fix.
- Static API guard inventory counted 171 web and 124 admin API route files. Admin mutation guard candidates were zero; web unguarded mutation candidates were expected public flows with rate-limit/token/feature-gate/generic-response controls. GET candidates were expected public build-info/catalog/invite/product/campaign surfaces.
- Runtime/deploy docs pass found and fixed the admin health smoke mismatch: public liveness is `/api/healthz`; authenticated detailed health remains `/api/health`.
- Theme/token static pass found and fixed old purple/cyan color drift in shared constants and the web light-mode `text-violet-300` bridge; targeted old-palette search now reports no matches for the audited legacy hexes.
- Mobile platform/theme pass found and fixed Android native `colorPrimary` drift plus the invisible sign-in Apple mark; targeted search confirmed the old `#023c69` and `#0A0F1C` values are gone from those files.
- Typography/theme static pass found and fixed stale Fraunces/Geist canonical references in shared design tokens, web Tailwind, wordmark, prose/reveal styles, and Aurora display fallbacks; source-code search now reports no `--fraunces`, `--font-fraunces`, or `var(--font-display, Fraunces...)` references outside intentional legacy font loading/fallback notes.
- Static local import path scan reports no missing relative or `@/` alias modules across web/admin/mobile/shared after correcting the mobile alias root to `apps/mobile/src`.
- Static mobile API contract scan reports 171 web API route files, 200 mobile API calls, 108 unique mobile endpoints, zero missing routes, and zero method mismatches.
- Static env reference scan reports 202 runtime env references and `missing combined catalog=0` across `env-catalog.ts` + `runtime-config.ts` after excluding platform/QA-script-only keys; no real `.env` values were read.
- Static cookie inventory now shows no direct `secure: process.env.NODE_ENV === "production"` cookie writers in web/admin source, and the only remaining `cookies.delete()` calls are auth helpers that also perform explicit expiry writes.
- Static production-domain fallback review found and mitigated uptime/admin-invite staging drift; rerun `apps/web/src/app/api/cron/uptime-check/route.test.ts` and `apps/admin/src/app/api/team/route.test.ts` after install.
- Static web interactive nesting scan now reports `count=0` for `<Link>`/`<a>` blocks containing nested `<button>` elements under `apps/web/src/app` and `apps/web/src/components`; a Vitest regression guard was added for the same rule.
- Static external-link scan found only `window.open` calls that already pass `noopener,noreferrer` plus generated sanitizer strings; email sanitizer code was hardened so existing rel tokens cannot suppress opener isolation.
- Product Design audit preflight reports no saved product-design user context file, so current audits rely on repo-local design tokens/source until browser screenshots can be captured.
- Codex Security config preflight ran with bundled Python and returned `status: incomplete` because active multi-agent mode/capacity is unknown; this parent-agent audit cannot honestly claim the full delegated repository-wide Codex Security scan workflow is complete.
- Broad staging audit prompt updated with the latest pre-install static gates and branch-specific re-check list.
- Runtime QA evidence is recorded in `docs/ai/audits/staging-runtime-qa-2026-06-21/README.md` with screenshots for web home, pricing, auth redirect, and Dokploy containers. A focused follow-up fixed the public cookie-consent banner footprint by making it a compact non-modal region with bounded height and auth-surface compact mode; `pnpm --filter @locateflow/web test src/components/shared/cookie-consent.test.ts` and `pnpm --filter @locateflow/web lint` pass in Docker Node 22. Live browser recapture is still required after redeploy.
- After the operator reported a staging theme drift, a static theme baseline found admin aliases were not actually mirroring web/shared Aurora: `--rose` and `--brand-orange` resolved to honey in admin global/scoped CSS while web/shared resolve them to the cool-blue primary. Fixed `apps/admin/src/app/globals.css` and `apps/admin/src/app/aurora.css` so legacy primary aliases stay cool-blue and `foil/amber` remain honey/champagne. Added `apps/admin/src/app/aurora-theme-regression.test.ts`; focused admin test, focused cookie test, full `pnpm verify:typecheck`, and full `pnpm verify:tests` pass in Docker Node 22. The operator said the real external theme source is not in Downloads and will be provided separately, so final token/font/asset diff against that source remains pending.

## 2026-06-21 Dokploy Staging Runtime + Fix Pass

- Dokploy staging app `staging-move-phkdb4` was deployed under the LocateFlow project from branch `codex/staging-audit-2026-06-21` using `docker-compose.dokploy.yml`.
- Cloudflare DNS-only A records were attached for `staging.locateflow.com`, `admin-staging.locateflow.com`, and `img-staging.locateflow.com`.
- Dokploy domains were mapped to web `3000`, admin `3001`, and imgproxy `8080`.
- Initial deploy succeeded and live smoke checks passed for web `/api/health`, web `/api/ready`, admin `/api/healthz`, imgproxy `/`, public web pages, admin login redirect, noindex headers, and build-info endpoints.
- Found and fixed Dokploy cron startup risk by keeping `cron` behind the explicit `cron` Compose profile; the old first-deploy cron container was stopped manually in Dokploy.
- Found and fixed live homepage H1 accessibility spacing by adding an explicit `aria-label` and regression test.
- Found and fixed build-info branch drift by preferring generated `.build-info.json` deployment identity over stale runtime branch env. Temp `.git` regression check proved stale `SOURCE_BRANCH=main` no longer overrides `codex/staging-audit-2026-06-21`.
- Closed shared package verification gap: root `verify:typecheck` and `verify:tests` now include `@locateflow/shared`; shared got a direct `test` script and Vitest dependency.
- Fixed mobile staging-preview/preview EAS profiles so internal QA builds target `https://staging.locateflow.com/api` rather than production.
- Fixed stale mobile workspace header behavior: server returns structured `STALE_WORKSPACE_SELECTION` 409 instead of silently falling back to another workspace; mobile clears `locateflow.selectedWorkspaceId` on that response.
- Fixed app-lock recovery bypass: locked state can no longer disable the app lock without successful auth; logout/local cleanup uses explicit `allowWhileLocked`.
- Narrowed default mobile OAuth HTTPS callback allowlist to canonical `locateflow.com` to match native app-link config; alternate hosts require explicit `MOBILE_OAUTH_REDIRECT_URIS`.
- Fixed admin forced password-change endpoint so only admins with `mustChangePassword=true` can use it; normal admin password changes remain on the step-up route.
- Hardened admin invite set-password URL generation: production/staging require configured HTTPS admin URL and fail before admin/token creation if config is insecure or missing.
- Fixed connector OAuth entitlement mismatch: workspace-member OAuth initiate/callback now checks the workspace owner entitlement while still storing consent on the acting user.
- Shifted CI migration job from `prisma migrate deploy` to `prisma migrate status`; deploy environment remains migration owner.
- Made `docker/migrate.Dockerfile` migrate-only by default and moved `seed-admin` to an explicit `bootstrap` profile in `docker-compose.prod.yml`.
- Parameterized Dokploy DB prep/copy compose project/container/volume names and require explicit staging/prod identifiers to prevent volume/container collisions.
- Added non-leaky admin `/api/ready` and made web `/api/ready` return only counts/status publicly.
- Live Dokploy follow-up found admin became `running (unhealthy)` when the Docker
  healthcheck used strict `/api/ready`; because Dokploy/Traefik then stopped
  routing `admin-staging.locateflow.com`, admin healthchecks were changed back
  to liveness `/api/healthz` in Dokploy/prod compose while `/api/ready` remains
  the explicit readiness/config gate for QA.
- Live smoke also showed admin `/api/ready` was still behind admin middleware
  and returned 401 externally; middleware public/break-glass health paths now
  include `/api/ready` without opening child paths.
- Added `CRON_SCHEDULER_OWNER` guards for GitHub cron and Ofelia cron runner so only the declared scheduler owner fires production cron endpoints.

### Verification Completed After Docker Node 22 Setup

- Docker Node 22 install path used named `node_modules` volumes and `pnpm install --frozen-lockfile`; host Node remains `v24.12.0`, so local host runtime is still not the canonical test runtime.
- Focused regression tests passed for shared build-info/API client, web readiness/API gates/workspace/mobile OAuth/connector OAuth/landing a11y, admin force-password-change/team/ready, and mobile release-config/API/app-lock/OAuth handoff.
- Full `pnpm verify:typecheck` passed in Docker Node 22.
- Full `pnpm verify:tests` passed in Docker Node 22.
- `pnpm --filter @locateflow/db exec prisma validate` passed with a dummy syntactic `DATABASE_URL`.
- `git diff --check` passed; only expected CRLF warnings were printed.
- `docker compose -f docker-compose.dokploy-dbprep.yml config` and `docker compose -f docker-compose.dokploy-dbcopy.yml config` were checked with staging identifiers and produced distinct `locateflow-staging-*` containers plus `locateflow-staging_mysql_data`.
- `docker compose -f docker-compose.prod.yml config` was checked with dummy env and showed migrate runs only `prisma migrate deploy`; inactive `seed-admin` no longer makes base config require seed env.

## 2026-06-21 Design Zip / LocateFlow Sapphire Integration Pass

- Design source inventory was rechecked from `design-src/handoffs/Initial check requested-handoff (7).zip` extracted under `design-src/initial-check-requested/project`.
- Source files present: public web shell/home (`Web.dc.html`, `Move Web.dc.html`), public pages (`Web Features.dc.html`, `Web Why-Free.dc.html`, `Web Blog.dc.html`, `Web Login.dc.html`, `Web Onboarding.dc.html`), mobile/app screens (`Move.dc.html`, `Index.dc.html`, `Onboarding.dc.html`, `Auth.dc.html`, `Providers.dc.html`, `CustomProviders.dc.html`, `Search.dc.html`, `Reminders.dc.html`, `Help.dc.html`, `Invitations.dc.html`, `DossierScene.dc.html`), admin (`Admin.dc.html`), and shared mascot/source art (`Raccoon.dc.html`).
- Source design files still carry the old `Move` label and default Gold theme variants. The product decision for staging is explicit: runtime brand is `LocateFlow`, and the selected visual direction is Sapphire/blue for both light and dark modes.
- Homepage integration updated `apps/web/src/app/page.tsx` to use a new `HeroPhoneShowcase` component based on the zip's animated phone/route concept, adapted to LocateFlow copy and Sapphire tokens.
- Public web brand cleanup now covers homepage, pricing, about, FAQ/help, blog metadata/OpenGraph, legal/policy pages, provider coverage, moving guide CTAs, partner/mover portals, app install prompt, manifests, SVG logos, service-worker/offline copy, and AI-discovery/legal summaries.
- Mobile brand cleanup now covers Expo app name, app lock, onboarding, notifications, subscription/settings, help/version footer, widget copy, push channel name, and mobile SVG app icons. Internal code identifiers such as `MoveWidget`, `MoveTask`, and move-domain model names remain unchanged.
- Admin brand cleanup now covers metadata/manifests, sidebar/wordmark, admin logo SVGs, offline/service-worker copy, and visible support/settings/admin-shell labels while preserving move-domain labels such as move date, move tasks, and moving plans.
- Binary icon corruption risk from a PowerShell text rewrite was detected and corrected by restoring PNG/ICO assets from the last good commit; only text/SVG/manifest branding changes remain in this pass.
- Static brand-risk scan after cleanup reports no user-facing old-product-name hits for the audited public/app/legal/help/marketing patterns; remaining `Move` hits are code identifiers, comments, move-domain terms, tests for generic marker behavior, or external/legal phrases such as FMCSA "Protect Your Move".
- `git diff --check` passes after the design/branding edits, with only expected CRLF warnings.
- Runtime proof still needed after deploy: Chrome screenshot pass for homepage hero, features/why-free/blog/login/onboarding/help/legal pages, admin login/dashboard, mobile preview/emulator surfaces, OpenGraph image route, and light/dark Sapphire parity.

### Post-deploy follow-up

- Dokploy webhook deploy was triggered from the existing Chrome/Dokploy session without opening a new Chrome window. The webhook requires a GitHub-style `push` payload with the branch ref; a blank call returns `Branch Not Match`.
- Staging web/admin build-info confirmed deployed commit `0f634f2980f55e0bc710ca079a18423f4ba322c8` on `codex/staging-audit-2026-06-21`. Web `/api/health` and `/api/ready` returned healthy/ready; admin `/api/build-info` matched the same commit.
- Existing Chrome initially showed a stale `/sign-up` shell with old branding. A cache-busted navigation to `/sign-up?lfqa=0f634f29` confirmed the deployed auth shell renders `LocateFlow`; the stale view was tab/cache state, not current source.
- Live homepage cache-busted screenshot confirmed the LocateFlow Sapphire homepage and animated phone hero are serving on staging.
- Follow-up source cleanup removed remaining user-facing old-product-name references from JSON-LD, OpenGraph, how-it-works, DPA/refund, blog preview fallback, partner consent, settings/subscription/cancel survey/appearance copy, help Spanish copy, and shared provider action descriptions. Domain labels such as `Move date`, `Move-in`, `Move tasks`, and moving-plan terminology remain intentional.
- Verification for the follow-up cleanup: `git diff --check`, `pnpm --filter @locateflow/web test -- src/components/seo/json-ld.test.ts`, `pnpm verify:typecheck`, and `pnpm verify:tests` passed locally. Local runtime is Node `v24.12.0`, so pnpm printed the expected repo-engine warning for Node `22.x`; a Docker Node 22 retry was blocked by host Windows `node_modules` lacking Rollup's Linux optional native package.

## 2026-06-22 Sapphire Theme Drift Correction Pass

- The latest design zips were rechecked: the prototype files still contain Gold
  as a default and `Move` labels, but Sapphire variants are present. Current
  product decision remains `LocateFlow + Sapphire` for staging.
- Found residual premium/plan theme drift after the earlier branding deploy:
  admin Pro plan cards, web plan class globals, admin plan distribution colors,
  shared `planColors`, premium sticker/medallion SVG highlights, mobile Family
  badge, web export PDF buttons, subscription/account notification chips,
  homepage risk/mobile CTA accents, and onboarding progress were still capable
  of rendering Gold/honey/Family teal in non-warning contexts.
- Fixed those to Sapphire pass-throughs. Plan classes/selectors are retained for
  compatibility (`plan-free`, `plan-family`, `plan-pro`, admin `au-plan-*`), but
  all now resolve to LocateFlow Sapphire in light/dark. Amber/honey is reserved
  for warning/caution/pending states only; green remains semantic success/healthy.
- Mobile theme logic was cross-checked: `applyPlanPalette` is intentionally a
  pass-through, so Free/Individual/Family/Pro do not recolor the app. Stale
  comments in auth/session, subscription, invite, dashboard, and theme files were
  updated to avoid future reintroduction of plan-specific palettes.
- Free-pivot logic was reread: consumer read paths still apply
  `CONSUMER_FREE` through `resolveConsumerEntitlement` /
  `buildUnifiedEntitlementSnapshot`, while admin/billing truth remains raw. The
  targeted free-pivot and mobile visibility tests passed.
- Brand check: manifests, web/admin metadata, OpenGraph, mobile app name, and
  visible product labels remain `LocateFlow`. Internal/domain identifiers such as
  `MoveWidget`, `MoveTask`, `MoveCommandCenter`, "Move date", and moving-plan
  labels remain intentional.
- Verification completed locally on host Node `v24.12.0` (repo wants Node
  `22.x`, so pnpm prints engine warnings): `git diff --check` passed with CRLF
  warnings only; targeted web theme tests passed (45 tests); mobile targeted
  tests passed (21 tests); shared entitlement tests passed (33 tests); targeted
  web free-pivot tests passed (100 tests); full `pnpm verify:typecheck` passed;
  full `pnpm verify:tests` passed (web 2760, admin 779, mobile 325, shared 388,
  connectors 105 tests); Prisma validate passed using a dummy syntactic MySQL
  `DATABASE_URL` because no real local `.env` file is present.
- Security/diff note: no dependency files changed and a diff-level secret/auth
  keyword scan found no secret values or auth behavior changes. `pnpm audit
  --audit-level high` timed out after roughly 124 seconds, so it is not counted
  as completed evidence.
- Pending after this pass: commit/push this correction, trigger Dokploy redeploy,
  then confirm staging `/api/build-info` and cache-busted web/admin pages render
  the pushed commit and Sapphire theme.

## Minimum Env Categories Needed For Real Tests

Do not paste values into chat. Set locally.

- Core URLs: app, admin, site/canonical URLs.
- Database: `DATABASE_URL`.
- Auth/security: user/admin JWT secrets, field encryption key, cron/backup-cron/internal/impersonation secrets.
- Redis/Upstash for production-like limiter/readiness proof.
- Email provider and support/admin alert recipients.
- Stripe test keys, webhook secret, and test price IDs for web billing.
- Mobile IAP credentials/product IDs only if store flows are in scope.
- R2/imgproxy for blog/mover document/media tests.
- Geoapify/maps key for route map tests.
- OAuth credentials/redirect allowlists if Google/Apple login is in scope.
- Sentry/GlitchTip DSNs if observability proof is in scope.
- Backup/offsite storage env if restore proof is in scope.

## Recommended Next Pass

After operator approval and local env prep:

1. Switch/use Node 22.
2. Run `pnpm install --frozen-lockfile`.
3. Generate Prisma client and run targeted static gates.
4. Run typecheck and targeted tests around workspace/connectors/IAP/public API.
5. Start web/admin locally, then browser-test public, auth, dashboard, route map, billing, admin login/RBAC, backup/status, blog/media, movers/partners.
6. Start Expo/mobile or emulator only after web API is stable; verify OAuth handoff, tabs, subscription, workspace invite, offline/cache, and unknown route behavior.
7. Fix P0/P1 issues first, add regression tests, and update this handoff.
