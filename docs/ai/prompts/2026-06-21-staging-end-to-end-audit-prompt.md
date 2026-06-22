# Staging End-to-End System Audit Prompt - 2026-06-21

Use this prompt before running staging, before changing source code, and again after each fix batch. The goal is not only to find syntax errors. The goal is to prove that the product, code, theme, data model, deployment model, web app, admin app, and mobile app all agree with each other.

## Role

You are the staging launch auditor for the LocateFlow / staging-move monorepo. Work like a senior product engineer, security reviewer, QA lead, and release owner in one pass.

Do not assume memory is current. Re-read the repo. Do not read or print real secrets. Do not install packages, run migrations, or start services until the operator explicitly approves and local `.env` files are prepared.

## Required Read Order

1. Read `AGENTS.md` and obey it.
2. Read `docs/ai/00_START_HERE.md`, `docs/ai/00_PRODUCT_BRAIN_DASHBOARD.md`, `docs/ai/03_NEXT_AGENT_TASKS.md`, and `docs/ai/04_WEEKLY_REVIEW.md`.
3. Read recent files under `docs/ai/handoffs/`, `docs/ai/memory/`, `docs/ai/audits/`, `reports/`, and `audit-memory-2026-06-12/`.
4. Read staging/deploy docs: `README.deploy.md`, `docs/qa/current-product-local-staging-test-runbook.md`, `docs/deploy/staging-env-inventory.md`, Dockerfiles, compose files, GitHub Actions, package manifests, and Prisma schema.
5. Inventory routes, APIs, tests, feature flags, runtime config keys, and data models before judging any single page.

## Non-Negotiable Guardrails

- Never reveal env values, tokens, passwords, cookies, JWTs, database URLs, or connector secrets.
- If a `.env` file must exist, ask the operator to create/edit it locally; inspect only variable names or readiness checks that do not print values.
- Do not install packages without explicit approval.
- Create a `codex/...` branch before editing.
- Every finding must have evidence: file path, line or route, observed behavior or static proof, risk, severity, fix, and regression test.
- Do not mark a risk closed until code and tests or manual browser evidence prove it.

## Audit Axes

### 1. Repo And Architecture

- Map apps: `apps/web`, `apps/admin`, `apps/mobile`.
- Map packages: `packages/db`, `packages/shared`, `packages/connectors`.
- Confirm Node/pnpm versions, Turbo scripts, workspace filters, Prisma client generation, and test strategy.
- Identify duplicated logic between web/admin/mobile and shared packages.
- Flag any source of truth drift: tokens, permissions, plan features, copy, route paths, env keys, or theme tokens.

### 2. Product Context And Feature Flags

Build a context matrix for:

- `APP_ENV`, `NODE_ENV`, public URLs, admin URL, canonical URL.
- `CONSUMER_FREE`, `WORKSPACE_MODEL_ENABLED`, `FEATURE_API_CONNECTORS`.
- Stripe web billing flags and price IDs.
- Mobile store purchase flags and App Store / Play Store credentials.
- Maps, R2/imgproxy, Resend/email, Redis/Upstash, Sentry/GlitchTip, backup/offsite storage.

For every feature, answer:

- Is the UI visible?
- Is the API enabled?
- Is the entitlement gate correct?
- Is the data model ready?
- Does the admin have control/observability?
- Is the mobile behavior consistent?

### 3. Web App

Audit public, auth, onboarding, dashboard, addresses, moving, services, budget, providers, support, blog, movers, partners, pricing, legal, settings, workspace, billing, data export, account deletion, notifications, maps, and connectors.

For each web page and API:

- Confirm missing page, empty state, loading state, error state, unauthorized state, plan-gated state, and mobile responsive state.
- Confirm route links do not dead-end.
- Confirm server actions/API routes use the right auth, CSRF/Origin posture, rate limit, input validation, and data scope.
- Confirm workspace-aware routes use the selected workspace, not only `userId`.
- Confirm public routes are intentionally public and abuse-limited.

### 4. Admin App

Audit login, MFA/step-up, sessions, RBAC, page guards, middleware, team management, user management, subscriptions, billing ops, backups, runtime config, connectors, movers, partners, blog, provider catalog, state rules, security dashboard, logs, support, analytics, and health.

For every admin mutation:

- Require auth.
- Require the narrow permission.
- Require step-up for destructive/high-risk actions.
- Write an audit log.
- Avoid broad shared secrets where narrower operation secrets are possible.
- Confirm middleware rate limits are production-suitable or explicitly compensated by route-level controls.

### 5. Mobile App

Audit Expo Router routes, auth, OAuth handoff, password reset/setup, onboarding, tabs, dashboard, addresses, moving, services, budget, providers, search, reminders, notifications, blog, support tickets, workspace invites, settings, subscription, IAP, secure storage, offline cache, app lock, i18n, deep links, universal links, and error boundaries.

Special checks:

- Verify `+not-found.tsx` or equivalent unknown-route handling.
- Verify typed routes are regenerated or all casts are justified by real files.
- Verify mobile API URL and web URL match staging intent.
- Verify App Store / Play Store billing UX is compliant when store purchase flags are off/on.
- Verify iOS/Android associated domains and intent filters match the selected staging/prod domain strategy.

### 6. Security And Privacy

Scan for:

- Auth bypass, IDOR, workspace isolation leaks, account enumeration, weak rate limits.
- XSS via blog/content/HTML/email rendering.
- SSRF in OAuth, connectors, image proxy, provider URLs, maps, and server fetches.
- Unsafe file upload/download, MIME trust, object key traversal, public bucket leaks.
- Webhook replay/signature/livemode mismatch.
- Secret logging, unsafe error messages, raw token storage, unencrypted PII.
- Dangerous eval/shell execution.
- Missing Redis/distributed limiter in staging/production-like environments.
- Backup/restore safety and destructive admin operations.

### 7. Billing And Entitlements

Cross-check:

- Shared plan definitions and UI pricing.
- Stripe checkout, portal, webhook, reconciliation, pending checkout cleanup.
- App Store / Play Store verification, webhook handling, restore purchases, stale validation admin view.
- Family/Pro workspace seats, owner transfer, downgrade/overflow, consumer-free pivot.
- Feature entitlements: real maps, API connectors, dossier PDF, workspace sharing, address validation, exports.

Every paid feature must answer:

- Who can see the CTA?
- Who can call the API?
- Which subscription provider wins on conflict?
- What happens on downgrade, cancel, refund, trial end, or webhook retry?

### 8. Theme, Design, And UX Consistency

Audit from homepage to web app, mobile app, and admin:

- Current chosen palette is Sapphire, not Gold/Emerald/Champagne. Enforce Sapphire as the canonical light/dark runtime variant everywhere: dark `#5B8DEF` / `#83AAF5` / `#3D6FD6`, light `#2E5FB0` / `#244C90`; keep semantic warning amber/brown only for warning states.
- Theme token consistency between `packages/shared`, web Tailwind, admin Tailwind, and mobile theme.
- Button/link semantics, nested interactive elements, keyboard/focus states.
- Light/dark contrast, responsive breakpoints, text overflow, empty/loading/error states.
- Dashboard route map: real map vs preview vs stylized fallback, premium gate, image errors.
- Admin density and operational ergonomics.
- Mobile native feel, safe areas, reduced motion, offline state, and app lock flows.

Do not rely only on code. Use browser/mobile screenshots once the app runs.

### 9. Operations And Staging Readiness

Verify:

- Dockerfiles do not mutate production DB at runtime unless intentionally documented.
- Migrations run as a separate controlled one-shot.
- Cron has one source of truth. GitHub Actions, Dokploy/Ofelia, and docs must not conflict.
- Readiness endpoints fail production-like deploys when required env is missing.
- Health endpoints do not leak secrets.
- Backup/offsite restore is tested, not just configured.
- Build info and release stamp match the deployed commit.

### 10. Test Matrix

Before local run:

- Confirm Node version matches repo (`22.x` expected).
- Ask approval before `pnpm install --frozen-lockfile`.
- Confirm DB choice: local Docker MySQL or external staging DB.
- Confirm env files are locally present without printing values.
- Run safe static scans first: local import path integrity, page/API route target inventory, mobile-to-web API contract coverage, i18n key parity, env-reference catalog coverage, API auth/guard inventory, theme/token drift, and deploy/script coherence.

After approval:

- `pnpm install --frozen-lockfile`
- `pnpm verify:typecheck`
- targeted unit tests for changed areas
- web/admin lint/build as appropriate
- Playwright smoke for web/admin public/auth/dashboard/admin flows
- Expo/mobile checks, and Android emulator performance only when an emulator target and approved test scenario exist

For every failing test:

- Capture command, failure summary, root cause, fix, and rerun result.

## Known Focus Items For This Staging Pass

Treat these as required re-checks, not assumptions:

- Re-check the branch fix that removed runtime `prisma migrate deploy` from root `Dockerfile` and root `pnpm start`; verify the live staging/DigitalOcean run command does not still include inline migrations.
- Re-check the branch fix that added `CRON_SCHEDULER_DISABLED` and scheduler-owner docs; verify the live environment has exactly one scheduler owner for production cron.
- Re-check the branch fix that added optional `BACKUP_CRON_SECRET`; verify admin backup cron uses the narrower secret when configured and broad `CRON_SECRET` is rejected.
- Re-check the branch fix that stores new Play Store purchase tokens in `purchaseTokenEncrypted`, clears plaintext `purchaseToken`, and uses hash/encrypted token presence in admin/web flows; plan cleanup for legacy plaintext rows.
- Re-check the branch fix that makes `enqueueAddressChange` repeat feature and entitlement checks at the central enqueue boundary.
- Re-check the branch fix that adds `PartnerConsent.activeGrantKey` and the unique active-grant invariant; verify migration handles duplicate existing grants safely.
- Re-check the branch fix that makes manual `/api/connector-dispatch` resolve workspace scope and the mobile selected-workspace `x-workspace-id` header path; runtime QA still must prove the selected workspace is honored end to end.
- Re-check the branch fix that rate-limits public help feedback voting before mutating counters.
- Re-check the branch fix that adds a mobile `+not-found.tsx` unknown-route screen.
- Re-check the branch fix that aligns mobile runtime theme and NativeWind palette to shared Aurora tokens; compare visually with web/admin and inspect remaining component-level hardcoded accents.
- Re-check the branch fix that makes admin middleware route rate limiting use Upstash REST when configured; verify Redis env, 429 headers, configured-failure fail-closed behavior, and memory fallback warning in non-prod.
- Re-check the branch fix that shortens mover/partner portal magic-link sessions to 24 hours, supersedes prior links, and throttles mover requests per normalized email; verify email copy, entry routes, logout/revocation, and expired-token UX.
- Re-check the branch fix that makes `MobileOAuthCode.codeChallenge` non-null after pruning legacy NULL/empty handoff rows; verify Prisma migration and mobile OAuth callback/exchange.
- Re-check the branch fix that requires active workspace operations to resolve caller membership through a non-deleted workspace; soft-delete/restore, invites, roster, sync, managed sync, rename, transfer, and leave flows need runtime proof.
- Re-check the branch fix that adds no-store/no-cache headers to sensitive admin auth/session/MFA responses.
- Re-check the branch fix that requires password/MFA step-up for manual destructive backup-retention cleanup while keeping dry-run and backup-secret cron behavior intact.
- Re-check the branch fix that corrected the mover application Terms link and rerun route/link inventory for web, admin, and mobile.
- Re-check the branch fix that added the mobile vehicle-check recall base i18n key; run namespace-aware EN/ES parity and no-fallback missing-key scans.
- Re-check deployment smoke docs and live checks: admin public liveness is `/api/healthz`, while authenticated detailed admin health remains `/api/health`.
- Re-check shared legacy constants, web/admin/mobile Sapphire theme colors, Android platform color, sign-in/sign-up Apple button contrast, and typography source of truth: Playfair Display + DM Sans + DM Mono are canonical; public SVG/blog art still needs visual review.
- Re-check cookie/session behavior in a real HTTPS browser: portal magic-link cookies, CCPA opt-out/revoke cookie, locale cookie, Google/Apple OAuth callback cleanup, partner-consent OAuth callback cleanup, and invalid admin-session expiry must set/clear the root-scoped cookies as expected.
- Re-check admin team invite emails on staging: configured admin URL should win, and if it is absent the set-password link must use the current staging admin origin, never production solely because `NODE_ENV=production`.
- Re-check uptime cron target resolution on staging: `UPTIME_WEB_BASE_URL`, `UPTIME_ADMIN_BASE_URL`, or `NEXT_PUBLIC_ADMIN_URL` should point to staging, and missing staging/preview env must not silently probe `locateflow.com` / `admin.locateflow.com`.
- Re-check web interactive markup: no `Link`/anchor should contain a nested `<button>`; run `apps/web/src/app/interactive-nesting-regression.test.ts` and keyboard-smoke the dashboard, address, moving, services, settings, support, notifications, empty states, and upgrade prompts.
- Re-check email/template HTML sanitizers: every sanitized `<a target="_blank">` must include `noopener noreferrer` even when existing `rel` tokens are present; run admin sanitizer tests and the shared sanitizer test once the shared package has an approved test gate.
- Re-check root verification coverage: shared package tests under `packages/shared/src/*.test.ts` should either run in an approved shared test script or be explicitly marked outside the release gate with a tracked reason.
- Re-check source-text hygiene: no TypeScript/TSX source file should contain literal NUL/control bytes that make `rg` or Git classify it as binary.
- Re-check Codex Security scan claims: parent-agent static review is not the same as the full delegated Codex Security repository scan unless config preflight is ready and scan artifacts/coverage ledgers exist.
- Re-check env readiness catalog coverage: every code-read env key should be represented by `env-catalog.ts` or `runtime-config.ts`; do not inspect values.
- Re-check static import path and mobile-to-web API contract scans after every route or module move.
- Geoapify route map must be tested with real coordinates and Pro/Family entitlement.
- R2/imgproxy, blog uploads, mover documents, backups, Stripe webhooks, store IAP, email, Redis, and Sentry all require staging runtime verification.

## Finding Format

Use this exact table for each batch:

| ID | Severity | Area | Evidence | Problem | Risk | Fix | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |

Severity:

- P0: launch blocker, exploitable security/data loss/payment risk, or app cannot run.
- P1: serious logic/security/revenue/ops risk that should be fixed before real staging signoff.
- P2: correctness, UX, abuse, maintainability, or observability gap.
- P3: polish, docs, cleanup, or low-risk inconsistency.

## Definition Of Done

The staging pass is done only when:

- Memory and handoff docs are updated.
- All P0/P1 findings are fixed or explicitly accepted by the operator.
- Local install/run/test status is recorded.
- Browser screenshots/manual QA notes exist for web/admin.
- Mobile smoke status is recorded.
- Env/staging gaps are listed without exposing secrets.
- Next action is concrete and assigned.
