# LocateFlow System Map - Source-Derived

Status: current source map, generated from code/config only.

## Monorepo Shape

- Root: pnpm + Turbo monorepo, Node engine `22.x`.
- Apps: `apps/web`, `apps/admin`, `apps/mobile`.
- Shared packages: `packages/shared`, `packages/db`, `packages/connectors`.
- Database: Prisma schema in `packages/db/prisma/schema.prisma`, currently 78 models and 1 enum.
- Provider data: seed catalogs and coverage overrides under `packages/db/prisma/seed-data`.
- Connector framework: `packages/connectors/src/core` plus USPS connector.

## Web App

- Framework: Next.js 16 / React 19.
- Route surface: 238 app route files, including 159 API route files.
- Public/product pages: landing, pricing, legal, blog, help, moving/state/city pages, movers portal/apply.
- Authenticated app: dashboard, addresses, services, moving plans, providers, budget, notifications, support, settings, workspace.
- API families:
  - Auth, OAuth, password reset, MFA, mobile auth.
  - Account delete/restore, GDPR/export, consent/legal acceptance.
  - Address CRUD, address validation/autocomplete, dossier/PDF.
  - Provider catalog, provider details/compare/recommendations/saved/feedback/revalidate.
  - Moving plans, generated move tasks, budget, services.
  - Workspaces, invitations, managed sync, partner consent.
  - Stripe checkout/portal/subscription actions and Stripe/App Store/Play/Resend webhooks.
  - Cron jobs for billing, notifications, digests, retention, provider stats, uptime/synthetic monitors.
  - Connectors and connector dispatch.
- Edge/security boundary: `apps/web/src/middleware.ts` handles security headers, CSP nonce, CSRF, body-size checks, path allowlists, rate limiting, JWT pre-checks, and trusted client IP resolution. Route handlers still perform DB/session checks.

## Admin App

- Framework: Next.js 16 / React 19.
- Route surface: 178 app route files, including 117 API route files.
- Admin pages: analytics, billing, blog, connectors, email templates, feature flags, help center, logs, movers, provider governance, providers/coverage/logo, reports, runtime config, security, settings, subscriptions, tickets/support, team, users, waitlist, workspaces.
- API families:
  - Admin auth, MFA, sessions, set-password, force password change.
  - Admin RBAC/permissions via `requireAdmin`, `requireRole`, `requirePermission`.
  - Provider CRUD/bulk/merge/coverage/logo/governance.
  - Runtime config, feature flags, email templates, help center.
  - Backup/import/export/sql dump/verify, reports/logs/security dashboard.
  - Movers applications and sponsored placements.
  - User/subscription actions, impersonation, hard delete with OTP/step-up.
- Edge/security boundary: `apps/admin/src/middleware.ts` handles admin CSP/security headers, CSRF/body-size, route rate limits, IP rules/break-glass logging, JWT pre-check, MFA and password-change gates. API handlers still enforce DB role/permission.

## Mobile App

- Framework: Expo SDK 55 / React Native 0.83 / Expo Router.
- Route surface: 53 app screen/layout files.
- Main areas: auth, tabs dashboard/addresses/services/moving/more, address/service CRUD, providers/compare/detail, budget, help/tickets, blog, notifications, reminders, onboarding, OAuth/deep links, reset password, workspace invite, settings.
- Auth: mobile bearer JWT stored via Expo SecureStore in `src/lib/auth-store.ts`; request identity headers are included for session fingerprint consistency.
- Local storage: UI preferences, plan tier, offline/dashboard/widget snapshots in AsyncStorage; logout cleanup wipes sensitive snapshots and offline caches.
- IAP: `src/lib/iap.ts` uses `expo-iap`; server verification is the source of truth before `finishTransaction`.
- Release: `apps/mobile/eas.json` uses remote EAS app version source, production auto-increment, production API base `https://locateflow.com/api`.

## Shared Domain

- `packages/shared`: API client, recommendation engine, billing/entitlement, provider coverage, provider integrity, runtime config helpers, validators, relocation/move-task logic, encryption helpers, timezone/intl helpers.
- `packages/db`: Prisma client wrapper with soft-delete extension, provider coverage metadata, seed scripts, migrations.
- `packages/connectors`: connector manifest/registry/executor/dispatcher/retry/circuit-breaker/OAuth/state helpers and USPS implementation.

## Critical Data Flows

- Provider recommendations:
  1. Web API resolves user/workspace scope.
  2. Loads profile, addresses, services, active moving plan, recommendation feedback.
  3. Queries active providers by effective state and `ServiceProviderCoverage`.
  4. Resolves coverage model from DB override, curated metadata, or ZIP/state heuristic.
  5. Tiers coverage via exact ZIP, ZIP prefix, polygon, state, or live address.
  6. Optionally enriches internet via FCC lookup and electric via OpenEI lookup.
  7. Scores in shared recommendation engine and clusters results.
- Address dossier:
  1. Web API gates by user/workspace and feature entitlement.
  2. Uses saved address coordinates.
  3. Calls FEMA flood/NRI, NCES, NWS, EPA radon/water, AirNow, and Pro-only Census/neighborhood/schools.
  4. Mobile renders only honest section rows and hides degraded sections.
- Billing:
  1. Web Stripe checkout/portal and mobile IAP verify both update shared Subscription rows.
  2. Stripe/App Store/Play webhooks use signed payload/idempotency flows.
  3. Entitlements feed dashboard, workspace seats, plan theme, and mobile visible purchase cards.
- Connectors:
  1. User consent/config gates connector dispatch.
  2. Address-change events enqueue connector dispatch rows.
  3. Cron worker executes outbox and records fallback/actions.

## Verified Commands

- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/db exec tsc --noEmit`
- `pnpm --filter @locateflow/connectors exec tsc --noEmit`
- `pnpm --filter @locateflow/web test`
- `pnpm --filter @locateflow/admin test`
- `pnpm --filter @locateflow/mobile test`
- `pnpm --filter @locateflow/connectors test`

Note: all commands warn that local Node is `v24.12.0` while repo engine requests `22.x`.
