# 01 — Repository Overview (LocateFlow monorepo)

> READ-ONLY audit. Evidence cited from source. Doc/README claims are marked `[needs verification]`.
> Repo root: `C:/Users/Windows/Desktop/Staging/staging-move`

## Repository Structure

| Folder | Job |
| --- | --- |
| `apps/web` | Public marketing site + authenticated consumer app (Next.js App Router). Hosts the bulk of the business API (`apps/web/src/app/api/**`, 171 route files per inventory). |
| `apps/admin` | Internal admin/operator console (separate Next.js App Router app, separate JWT + cookie). |
| `apps/mobile` | Expo / React Native app (expo-router). Talks to the web app's API over HTTP with Bearer JWT. |
| `packages/db` | Prisma schema (`prisma/schema.prisma`, 2696 lines), generated client, soft-delete/optimistic-locking extensions, seeds, migrations. Package `@locateflow/db`. |
| `packages/connectors` | Outbound "address change" connector framework (`src/core`, `src/usps`). Package `@locateflow/connectors`. |
| `packages/shared` | Cross-app domain logic + pure helpers (billing, entitlement, permissions, encryption, redaction, recommendation engine, etc.). Package `@locateflow/shared`. Has a separate mobile barrel `index.mobile.ts`. |
| `scripts/` | 37 operational/audit `tsx` scripts (provider data audits, stripe sync, backfills). |
| `docker/`, `docker-compose*.yml`, `Dockerfile` | Self-hosted + DigitalOcean/Dokploy deployment assets. |
| `.github/workflows/` | `ci.yml` (lint/typecheck/test/security/migrate-status/provider-guards/e2e) and `cron.yml` (production cron dispatcher). |

Workspace is pnpm + turbo: `pnpm-workspace.yaml` globs `apps/*` and `packages/*`; `turbo.json` defines `build/dev/lint/seed`. Node pinned to `22.x`, pnpm `9.15.0` (`package.json`).

## Applications & Packages

- **`@locateflow/web`** — Next.js App Router. Custom JWT auth via `jose` (HS256), httpOnly `user_session` cookie (web) or `Authorization: Bearer` (mobile). Edge middleware does auth/CSRF/rate-limit/CSP/IP-rules; DB-row validation happens in route handlers (`requireDbUserId`/`getUserSession`, re-exported from `apps/web/src/lib/auth.ts` → `@/lib/user-auth`).
- **`@locateflow/admin`** — Next.js App Router. Separate `admin_session` cookie, `ADMIN_JWT_SECRET`, MFA-setup and forced-password-rotation gates, session-fingerprint hijack detection, IP allow/deny with break-glass bypass (`apps/admin/src/middleware.ts`).
- **`@locateflow/mobile`** — Expo/expo-router. Auth state in `useAuthStore`, SecureStore token, OAuth deep-link handoff, IAP reconciliation, push-notification routing (`apps/mobile/app/_layout.tsx`).
- **`@locateflow/db`** — Prisma/MySQL. Exposes `dbUnsafe` (raw) and `db` (soft-delete-extended). Application code must use `db`; `dbUnsafe` is reserved for admin/restore/retention/backup (`packages/db/src/index.ts`).
- **`@locateflow/connectors`** — uniform outbound provider connector contract; only USPS implemented in tree (`packages/connectors/src/index.ts`).
- **`@locateflow/shared`** — pure domain + crypto/redaction helpers shared by all apps.

## Entry Points

- **Web layout** — `apps/web/src/app/layout.tsx`: fonts, next-intl provider, theme/query providers, GA, cookie consent, SEO metadata + robots gating via `isNoIndexEnvironment`, per-request CSP nonce read from `x-nonce`, inline embed-mode bootstrap script, `register-sw.js`.
- **Web middleware** — `apps/web/src/middleware.ts`: IP rules → body-size → CSRF → rate-limit → public-path/session gate → locale cookie → CSP/security headers/no-index. Matcher covers all non-asset pages + `/api/(.*)`.
- **Web instrumentation** — `apps/web/src/instrumentation.ts`: env-readiness warn logging + optional security-alert sink install; never throws.
- **Admin middleware** — `apps/admin/src/middleware.ts`: throws at module load if `ADMIN_JWT_SECRET` missing/<32 chars; IP break-glass, CSRF, in-memory-or-Redis rate limit, MFA/password-rotation gates, fingerprint check, strict CSP.
- **Admin layout** — `apps/admin/src/app/layout.tsx` (present).
- **Mobile entry** — `apps/mobile/index.js` registers the Android home-screen widget task handler (guarded) then hands off to `expo-router/entry`. `apps/mobile/app/_layout.tsx` is the root navigator + `AuthGuard`.

## Architecture Notes

- **Rendering** — Next.js App Router (RSC) for both web apps; `output: standalone` implied by `scripts/prepare-*-standalone.mjs` and Dockerfile. Mobile is client-rendered Expo.
- **Data layer** — Prisma → MySQL, single shared client with a soft-delete extension; optimistic locking helper present. Multi-tenant via workspaces (`migrate-to-workspaces.ts`, workspace-purge cron).
- **Auth** — Custom `jose` HS256 JWTs. Web/mobile share `USER_JWT_SECRET`; admin uses `ADMIN_JWT_SECRET`. Middleware verifies the JWT signature only (edge, no DB); route handlers enforce DB-row state (active/expiry/fingerprint/email-verified).
- **Billing** — Stripe on web (`api/webhooks/stripe`), Apple/Google IAP on mobile (`api/webhooks/appstore`, `api/webhooks/playstore`, `api/mobile/iap`).
- **Deployment** — Primary target DigitalOcean App Platform via `Dockerfile` (standalone). Alternatives: Dokploy + self-hosted docker-compose (with ofelia scheduler). Cron dispatched by `.github/workflows/cron.yml` hitting `/api/cron/*` with `CRON_SECRET`.

## Risky Areas (first-glance surfaces, pointers for deeper area audits)

1. **Dual/triple cron-scheduler ambiguity.** `apps/web/vercel.json` declares 11 Vercel `crons`, while `.github/workflows/cron.yml` says "production runs on DigitalOcean" and dispatches a *different* (larger) set on its own schedule, and `docker/ofelia.ini` is a third scheduler. Only one should own a domain; overlap risks double-sends / double-billing reconciliation. The GitHub workflow self-gates on `CRON_SCHEDULER_OWNER`/`CRON_SCHEDULER_DISABLED`, but `vercel.json` and ofelia have no such mutual interlock. (`apps/web/vercel.json`, `.github/workflows/cron.yml:33-61`)

2. **Large hand-maintained public-route allowlists in middleware.** `apps/web/src/middleware.ts:26-126` enumerates public paths/prefixes by hand (`PUBLIC_PATHS`, `PUBLIC_API_PREFIXES`, `PUBLIC_API_EXACT`, `PUBLIC_API_GET`). `matchesPathOrChild` makes a public prefix cover all children; any new sensitive route nested under a public prefix would silently be exposed. High-value target for the auth/API area audit.

3. **Middleware auth is signature-only at the edge.** `hasValidSession` (`apps/web/src/middleware.ts:575-607`) accepts ANY validly-signed, unexpired JWT — no DB revocation/active check at the edge. Correctness depends entirely on every route handler calling `requireDbUserId`/`getUserSession`. A handler that forgets is exposed to revoked/disabled sessions. Verify per-route in the API audit. `[needs verification]`

4. **CSP divergence between apps.** Web uses `'strict-dynamic'` + `'unsafe-inline'` on `style-src` and broad `img-src https:` (`middleware.ts:702-734`); admin deliberately removed `'strict-dynamic'` (`apps/admin/src/middleware.ts:194-224`). Both keep `style-src 'unsafe-inline'`. Worth a focused theme/security pass.

5. **Admin rate-limiter in-memory fallback.** When Redis is unconfigured, admin route limits use a per-process `Map` (`apps/admin/src/middleware.ts:431-552`); across multiple instances this under-counts. It fails *closed* only in production-like runtimes when Redis was configured-but-erroring; an env with no Redis at all silently uses memory.

6. **Staging directory vs no-index reliance.** The audited tree is `staging-move`; public exposure of a staging deploy is gated only by host/env heuristics (`apps/web/src/lib/seo.ts:11` `STAGING_HOST_PATTERN`, `isNoIndexEnvironment`, `shouldBlockForRequestHosts`). A staging host that doesn't match the regex (custom domain) would be indexable. Verify deploy env values in the SEO area audit.

7. **`dbUnsafe` discipline.** `packages/db/src/index.ts` exposes a soft-delete-bypassing client; a misuse in application code would leak soft-deleted rows. Grep for `dbUnsafe` usage in the data audit.

8. **Connector framework is largely unimplemented in-tree.** Only USPS ships (`packages/connectors/src/index.ts`); the admin "connectors" pages and `connector-dispatch` cron imply a broader runtime registry (`apps/web/src/lib/connector-registry.ts`) whose real provider coverage needs verification.

9. **Many secrets/flags via env only.** `.env.example` (~12 KB) and `.env.production.example` (~17 KB) define a very large env contract; instrumentation only warns (never fails) on missing required vars (`apps/web/src/instrumentation.ts`). A dropped secret degrades silently. Confirm the required-set in the config audit.

## Missing / Unclear Areas

- **No `vercel.json` at admin or root** — only `apps/web/vercel.json`. Whether Vercel is an active prod target (vs DigitalOcean) is unclear and interacts with risk #1. `[needs verification]`
- **Mobile e2e / build verification** is documented as on-device only (`apps/mobile/index.js` widget note) — not covered by CI.
- **`NEW GENERATION/`, `SYSTEM_AUDIT_REPORT/`, `audit-memory-*/`, `reports/`, `previews/`, `design-src/`** top-level dirs are non-source artifacts; not evidence, ignored for findings.
- Exact production scheduler ownership (`CRON_SCHEDULER_OWNER` value) is an env var not in the repo — cannot confirm which scheduler is live. `[needs verification]`
