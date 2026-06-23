# Module Audit: App Bootstrap / Config / Env

> Area slug: `app-bootstrap-config`. READ-ONLY audit. Evidence = source only.
> Paths are relative to repo root `staging-move/`.

## 1. Module Summary

This module is the application bootstrap and configuration surface for the
two Next.js apps (`apps/web`, `apps/admin`) plus the shared/runtime config and
deploy plumbing:

- **Build config**: `apps/web/next.config.js`, `apps/admin/next.config.js`
  (standalone output, security headers, image remote patterns, bundle
  analyzer, next-intl plugin, webpack React de-dup alias).
- **Startup instrumentation**: `apps/{web,admin}/instrumentation.ts` (Sentry
  request-error capture) and `apps/web/src/instrumentation.ts` (env-readiness
  warn-log + security-alert sink). **Admin has no `src/instrumentation.ts`.**
- **Error monitoring**: `sentry.{client,server,edge}.config.ts` (both apps) +
  the shared `apps/web/src/lib/sentry-options.ts` PII-scrubbing init builder.
  A legacy `apps/web/src/lib/sentry.ts` wrapper also exists.
- **Env contract & readiness**: `packages/shared/src/env-catalog.ts`
  (typed expected-env catalog + `evaluateEnvReadiness`/`buildEnvReadinessWarnings`),
  `apps/web/src/lib/production-readiness.ts` (the real fail/warn validator used
  by `/api/health` and `/api/ready`), `.env.example` (the documented contract).
- **Security middleware**: `apps/web/src/middleware.ts`,
  `apps/admin/src/middleware.ts` (per-request nonce CSP, security headers,
  CSRF, body-size, rate-limit, IP rules, auth gate).
- **Cron auth & schedule**: `apps/web/src/lib/cron-guard.ts`,
  `apps/web/src/lib/internal-secrets.ts`, `.github/workflows/cron.yml`,
  `docker/ofelia.ini`, `apps/web/vercel.json`.
- **Deploy**: root `Dockerfile`, `docker/web.prod.Dockerfile`,
  `docker/admin.prod.Dockerfile`, `docker-compose.prod.yml`,
  `scripts/write-build-info.mjs`, `packages/shared/src/build-info.ts`,
  `apps/{web,admin}/src/app/api/build-info/route.ts`, `turbo.json`,
  `.github/workflows/ci.yml`.

Overall the configuration is unusually mature: nonce-based CSP, scrubbed Sentry,
a typed env catalog, a real readiness probe, least-privilege CI permissions,
and constant-time internal-secret verification. The findings below are mostly
**enforcement gaps and documentation drift** rather than broken security
primitives.

## 2. Related Files

| File | Role |
|---|---|
| `apps/web/next.config.js` | Web build config, static security headers, image hosts, staging noindex |
| `apps/admin/next.config.js` | Admin build config, static security headers (incl. Permissions-Policy) |
| `apps/web/instrumentation.ts` | Sentry server/edge load + `onRequestError` |
| `apps/admin/instrumentation.ts` | Sentry server/edge load + `onRequestError` (no env-readiness) |
| `apps/web/src/instrumentation.ts` | `register()` env-readiness warn-log + security-alert sink |
| `apps/{web,admin}/sentry.{client,server,edge}.config.ts` | Per-runtime `Sentry.init` guarded on DSN |
| `apps/web/src/lib/sentry-options.ts` | Shared `buildSentryOptions` with `beforeSend` PII scrubber |
| `apps/web/src/lib/sentry.ts` | Legacy wrapper (`initSentry`, `captureException/Message`) |
| `packages/shared/src/env-catalog.ts` | Typed EXPECTED-ENV catalog + readiness evaluator |
| `apps/web/src/lib/env-catalog.ts` | Re-export of shared catalog |
| `apps/web/src/lib/production-readiness.ts` | Real fail/warn config validator |
| `apps/{web,admin}/src/app/api/{health,ready}/route.ts` | Liveness + readiness probes |
| `apps/web/src/lib/cron-guard.ts` | Cron auth + per-route rate limit |
| `apps/web/src/lib/internal-secrets.ts` | Constant-time internal-secret verification |
| `apps/web/src/lib/app-url.ts` | Canonical app URL resolution |
| `.env.example` / `.env.docker` | Env contract templates |
| `Dockerfile`, `docker/web.prod.Dockerfile`, `docker/admin.prod.Dockerfile` | Build/runtime images |
| `docker-compose.prod.yml`, `docker/ofelia.ini`, `docker/locateflow-cron-runner.sh` | Self-hosted deploy + scheduler |
| `.github/workflows/ci.yml`, `.github/workflows/cron.yml` | CI gates + production cron trigger |
| `apps/web/vercel.json` | Vercel cron schedule |
| `turbo.json`, `scripts/write-build-info.mjs`, `packages/shared/src/build-info.ts` | Monorepo task graph + build metadata |

## 3. Related Routes / Screens

No user-facing screens are owned by this module. Relevant HTTP surfaces:

- `GET /api/health` (web + admin) — liveness + coarse env readiness.
- `GET /api/ready` (web + admin) — production readiness; **503** when config fails.
- `GET /api/healthz` (admin) — minimal liveness (`{ ok: true }`).
- `GET /api/build-info` (web + admin) — commit/branch/builtAt/environment.

All four are in the public allow-lists (web middleware `PUBLIC_API_EXACT`/
`PUBLIC_API_PREFIXES`; admin `PUBLIC_EXACT_PATHS`).

## 4. Related APIs

- `apps/web/src/app/api/health/route.ts`, `.../api/ready/route.ts` — call
  `buildReadinessReport` + Runtime Config DB; never echo secret values.
- `apps/admin/src/app/api/ready/route.ts` — admin-local readiness check
  (DATABASE_URL, ADMIN_JWT_SECRET, FIELD_ENCRYPTION_KEY, Upstash); does **not**
  reuse the richer `production-readiness.ts` (separate, thinner logic).
- `apps/admin/src/app/api/healthz/route.ts` — static `{ ok: true }`.
- `apps/{web,admin}/src/app/api/build-info/route.ts` — public build metadata.

## 5. Related Components

None (server/config layer). UI consumers (e.g. an admin env-readiness glance
view) live in other modules; this audit covers the catalog/evaluator they call.

## 6. Related State / Hooks / Stores

None. Configuration is read from `process.env` and the Runtime Config DB layer
(`runtime-config.ts`, out of scope here). The web env-readiness path is a pure
function over an env snapshot (`evaluateEnvReadiness`).

## 7. Related Database / Models

No direct models. `/api/health` and `/api/ready` issue `SELECT 1` via Prisma and
read the Runtime Config table through `getRequiredRuntimeConfigValues`. The
catalog/readiness evaluators themselves are DB-free and pure.

## 8. Impact Map

- **UI**: CSP nonce wiring (`x-nonce`) feeds `layout.tsx` inline scripts; a
  broken CSP build would silently kill hydration (the web/admin comments show
  this is a known sharp edge — admin explicitly removed `'strict-dynamic'`).
- **API**: middleware applies CSRF, body-size, rate-limit, IP-rules, and the
  auth gate to every `/api/*` route. Misconfig here affects the whole API.
- **DB**: readiness probes hit the DB; no schema impact.
- **Auth**: `USER_JWT_SECRET`/`ADMIN_JWT_SECRET` validation; impersonation,
  internal-webhook, cron secrets gate server-to-server boundaries.
- **Admin**: admin lacks the web app's startup env-readiness warn-log.
- **Mobile**: `EXPO_PUBLIC_*` build-time keys documented in the catalog; mobile
  Sentry is a separate `@/lib/sentry`.
- **Notifications / Integrations / Analytics**: feature-activation flags
  (push, digests, FCC, OpenEI, GA/GTM) are all "optional" in the catalog —
  graceful degradation when unset.
- **SEO**: `next.config` + middleware emit `X-Robots-Tag: noindex` for
  staging-like hosts and private paths.
- **Tests**: `production-readiness.test.ts`, `build-info.test.ts` exist; no
  test asserts the startup `register()` wiring or the Docker secret enforcement.

## 9. Buttons / Actions / Functions

Config-layer functions (no UI buttons):

1. **`register()` (web `src/instrumentation.ts`)** — used by Next at server
   start. Expected: warn on missing required env in prod-like deploy + install
   security-alert sink. Actual: matches. Loading/disabled/permission: N/A.
   Error state: fully swallowed (`try/catch` → never blocks boot). **Edge
   case**: only runs for `NEXT_RUNTIME === "nodejs"`; admin has no equivalent.

2. **`buildEnvReadinessWarnings()` / `evaluateEnvReadiness()`
   (`packages/shared/src/env-catalog.ts`)** — pure. Expected: report
   presence/absence + masked hint, never raw secret. Actual: matches; secret
   keys force a heavy mask even if strategy is mis-set (`buildMaskedHint`).
   Edge case: `missingRequired` only true when `productionLike` — local dev
   silent by design.

3. **`buildReadinessReport()` (`production-readiness.ts`)** — used by
   `/api/health` + `/api/ready`. Expected: fail in prod-like / warn in dev for
   weak/missing secrets, localhost URLs, placeholder values. Actual: matches;
   `hasMinSecret` rejects `REPLACE`/`test*`/`dev*` and <32 chars.

4. **`guardCronRequest()` (`cron-guard.ts`)** — used by web `/api/cron/*`.
   Expected: verify `CRON_SECRET` then rate-limit by route+IP. Actual: matches.
   **Edge case (documented)**: when Upstash is unconfigured it proceeds WITHOUT
   rate limiting (auth-only) to avoid 429-ing every job; fails closed only on a
   real Redis error.

5. **`verifyInternalAuth()` (`internal-secrets.ts`)** — constant-time
   (`safeEqual`) bearer check, per-kind secret separation, emits a security
   event on mismatch. Actual: matches; cron may fall back to `CRON_SECRET`,
   internal/impersonation never do.

6. **`getConfiguredAppUrl()` (`app-url.ts`)** — resolves APP_URL /
   NEXT_PUBLIC_APP_URL, validates protocol, throws only in billing-prod-like
   env, else falls back to `http://localhost:3000`.

7. **`readBuildInfo()` (`build-info.ts`)** — pure; returns `unknown` for any
   unresolved field. No secrets read.

8. **`headers()` async (both `next.config.js`)** — static security headers +
   `/sw.js` cache rules + staging `X-Robots-Tag` (web only).

## 10. UI/UX Audit

- **CSP hydration fragility** — both middlewares carry long comments about
  `'strict-dynamic'` breaking onClick / hydration (web keeps it, admin removed
  it). Evidence: `apps/web/src/middleware.ts:702-734`,
  `apps/admin/src/middleware.ts:194-224`. Impact: a future CSP edit can
  silently kill all client interactivity with no build-time signal.
  Recommendation: add a Playwright smoke test that asserts a nonced inline
  script executes and a lazy chunk loads under the production CSP. Priority: Medium.
- **No env-readiness surface for operators on admin** — the catalog supports an
  admin glance view, but admin never runs `buildEnvReadinessWarnings` at start.
  Priority: Low.

## 11. Logic Audit

Expected flow: server boots → `instrumentation.register()` runs once → Sentry
loads if DSN present → web logs missing-required env → security sink installs →
requests flow through middleware. Findings:

- **Asymmetric startup wiring** — `apps/web/src/instrumentation.ts` runs the
  env-readiness warn-log; **admin has no `src/instrumentation.ts`**, only the
  Sentry-only root `apps/admin/instrumentation.ts`. A misconfigured admin
  deploy gets no loud startup signal (only `/api/ready` 503). (See
  `app-bootstrap-config-02`.)
- **No hard startup gate; `BUILD_PHASE` enforcement is fictional in code** —
  both prod Dockerfiles claim that leaving `BUILD_PHASE` unset makes "the
  runtime validator throw on first request" (`docker/web.prod.Dockerfile:40-47,
  117-119`; `docker/admin.prod.Dockerfile:36-42, 105-107`). `grep` for
  `BUILD_PHASE` finds **zero** TypeScript references — no validator reads it.
  The only runtime protection is per-operation throws in `encryption.ts`
  (`encrypt`/`decrypt` throw in prod when key missing) and `user-jwt-secret.ts`
  (`validateUserJwtSecret` throws), plus the `/api/ready` 503. There is no
  holistic "refuse traffic until secrets present" gate. (See
  `app-bootstrap-config-03`.)
- **Catalog comment drift** — `env-catalog.ts:114` says FIELD_ENCRYPTION_KEY
  "Missing silently writes un-encrypted PII," but `encryption.ts:38-46` now
  throws in production. Doc-only, but misleading for an operator. (Low.)
- **`detectProductionLike` divergence** — three slightly different prod-like
  detectors exist: `env-catalog.ts` (`production/staging/preview` + NODE_ENV +
  DIGITALOCEAN_APP_ID), `production-readiness.ts` (`production/staging` only,
  no `preview`), and admin `ready/route.ts` (`production/staging/preview`).
  A `preview` deploy is "production-like" to the catalog but only "warn" to
  `production-readiness`. (Low, `app-bootstrap-config-06`.)

## 12. Reverse Logic Audit

- **Unauthorized user → config probes**: `/api/ready`, `/api/health`,
  `/api/build-info`, admin `/api/ready`/`/api/healthz` are public by design.
  `/api/ready` (web) returns failing **key names** + messages to anyone
  (`apps/web/src/app/api/ready/route.ts:54-82`; the route comment deems this
  acceptable). Admin `/api/ready` returns only a count, not names. (Info/Low,
  `app-bootstrap-config-05`.)
- **Empty data / missing env**: handled — warnings, not crashes.
- **API error**: Sentry `beforeSend` strips request body, cookies,
  `authorization`/`cookie` headers, user email/IP, and scrubs message/breadcrumb
  free text (`sentry-options.ts:24-57`). Solid.
- **Slow network**: readiness probes use 2.5s `withTimeout` race.
- **Double-click / direct route access / role change / token expiry**: governed
  by middleware auth (out of this module's core), not config.
- **Mobile viewport / dark theme**: N/A (server/config).
- **Stale data**: build-info and readiness responses set `Cache-Control:
  no-store`.

## 13. Security Audit

### app-bootstrap-config-01 — Self-hosted compose does not enforce "required-in-production" secrets
- **Severity**: Medium
- **Affected Area**: `docker-compose.prod.yml` (web + admin services), deploy.
- **Evidence**: Web service uses `INTERNAL_WEBHOOK_SECRET: ${INTERNAL_WEBHOOK_SECRET:-}`
  and `IMPERSONATION_HANDOFF_SECRET: ${IMPERSONATION_HANDOFF_SECRET:-}` (default
  empty) and `ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET}` (bare → empty + warn) at
  `docker-compose.prod.yml:136-138`. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/
  `RESEND_API_KEY`/`EMAIL_FROM` are also bare `${VAR}` (lines 147-155). Only
  `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, `USER_JWT_SECRET`, `NEXT_PUBLIC_*_URL`
  use the hard-fail `:?` form (lines 133-135, 122-123). The catalog and
  `production-readiness.ts` classify INTERNAL_WEBHOOK_SECRET and
  IMPERSONATION_HANDOFF_SECRET as **required** (`production-readiness.ts:225-243`).
- **Risk**: A self-hosted Docker deploy can start with these "required" secrets
  empty. `verifyInternalAuth` then rejects all internal-webhook and
  impersonation traffic (IP-rule cache refresh, security-event fan-out break),
  degrading security telemetry; an empty `ADMIN_JWT_SECRET` on the web service
  weakens the impersonation-handoff verification surface.
- **Defensive Abuse Scenario (high-level)**: an operator misses a value during a
  rushed redeploy; the stack comes up "green" (web/admin liveness pass) while
  security event fan-out is silently dead, so a real attack on the login surface
  produces no alerts.
- **Prevention**: switch these to `${VAR:?...}` in `docker-compose.prod.yml`, or
  add a single pre-flight validation step.
- **Detection**: `/api/ready` returns 503 + the failing key names, and the web
  startup warn-log lists them — but only if someone looks.
- **Analysis (root cause)**: compose enforcement was applied selectively to a
  subset of secrets; the catalog's "required" classification was never mirrored
  into the compose `:?` guards.
- **Recommendation**: align compose `:?` guards with the catalog's `required`
  set; gate the `web`/`admin` `depends_on` on a readiness pre-check.
- **Tests To Add**: a compose-lint/CI assertion that every catalog-`required`
  key uses `:?` in `docker-compose.prod.yml`.

### app-bootstrap-config-02 — Admin lacks startup env-readiness warn-log
- **Severity**: Low
- **Affected Area**: `apps/admin` startup.
- **Evidence**: `apps/admin/instrumentation.ts` only loads Sentry; no
  `apps/admin/src/instrumentation.ts` exists (Glob: none). Web has the
  readiness warn-log in `apps/web/src/instrumentation.ts:14-35`.
- **Risk**: a misconfigured admin container (missing ADMIN_JWT_SECRET,
  FIELD_ENCRYPTION_KEY, Upstash) has no loud DO/Docker log line; the only signal
  is the `/api/ready` 503 which an operator must actively probe.
- **Prevention/Recommendation**: add an admin `src/instrumentation.ts` that runs
  the same `buildEnvReadinessWarnings()` (admin keys) at boot.
- **Detection**: admin `/api/ready` 503.
- **Analysis**: env-readiness was implemented for web (audit F-006) and never
  ported to admin.
- **Tests To Add**: assert admin `register()` emits warnings when a required key
  is absent in a prod-like snapshot.

### app-bootstrap-config-03 — Documented "BUILD_PHASE strict gate that throws on first request" does not exist in code
- **Severity**: Low
- **Affected Area**: deploy docs vs. runtime behavior.
- **Evidence**: `docker/web.prod.Dockerfile:40-47,117-119` and
  `docker/admin.prod.Dockerfile:36-42,105-107` claim the runtime validator
  "throws on first request" when `BUILD_PHASE` is unset. `grep BUILD_PHASE`
  across `**/*.ts` → **no matches**. Actual runtime protection is per-operation:
  `encryption.ts:38-46` throws in prod, `user-jwt-secret.ts:5-10` throws.
- **Risk**: false sense of a fail-fast boot gate. A deploy missing, e.g.,
  STRIPE_WEBHOOK_SECRET or RESEND_API_KEY will boot and serve traffic; failures
  appear only when the dependent code path runs.
- **Prevention/Recommendation**: either implement a real `BUILD_PHASE`-aware
  startup gate (throw in `register()` when `!BUILD_PHASE` and a required key is
  missing) or correct the Dockerfile comments to describe the actual
  per-operation + `/api/ready` 503 behavior.
- **Detection**: `/api/ready` 503.
- **Analysis**: documentation written ahead of (or after removal of) an enforcement
  mechanism that no longer exists in code.
- **Tests To Add**: a unit test pinning the intended behavior (throw-on-boot vs.
  warn-only) so the doc and code can't drift again.

### app-bootstrap-config-04 — Public `/api/build-info` discloses commit SHA / branch / environment unauthenticated
- **Severity**: Low
- **Affected Area**: `apps/{web,admin}/src/app/api/build-info/route.ts`.
- **Evidence**: both routes `GET` return `readBuildInfo(...)` (commitSha,
  sourceBranch, builtAt, environment) with no auth; both apps list
  `/api/build-info` as public.
- **Risk**: an attacker fingerprints the exact deployed commit and branch name,
  easing targeting of known-vuln versions / mapping internal branch naming.
- **Defensive Abuse Scenario (high-level)**: recon — pull the SHA, diff against a
  public mirror or changelog to learn which fixes are not yet deployed.
- **Prevention/Recommendation**: gate `/api/build-info` behind admin/internal
  auth, or reduce the public payload to a short build id without branch name.
- **Detection**: access logs to `/api/build-info` from non-operator IPs.
- **Analysis**: build-info was designed as an operator convenience and left public.
- **Tests To Add**: assert the public payload omits `sourceBranch` (or the route
  requires auth).

### app-bootstrap-config-05 — Web `/api/ready` exposes failing config key names publicly
- **Severity**: Info / Low
- **Affected Area**: `apps/web/src/app/api/ready/route.ts`.
- **Evidence**: route returns `failures: [{ key, message }]` via
  `summarizeReadinessForResponse`; the route comment (`route.ts:11-16`)
  explicitly judges this safe ("learns nothing they couldn't infer from a 500").
  Admin `/api/ready` returns only `missingRequiredCount` (no names).
- **Risk**: enumerates which secrets/keys are currently mis-set (names + human
  messages), a mild recon aid on a degraded deploy.
- **Recommendation**: consider matching admin's count-only public shape and
  moving key-level detail behind auth; at minimum keep values out (already the case).
- **Tests To Add**: snapshot test asserting no secret value ever appears in the body.

### Non-findings verified (defensive confirmation)
- **CSP present & nonce-based** — `buildCspHeader` in both middlewares; the
  `next.config` comment that CSP is emitted per-request is **accurate** (I
  initially could not find middleware due to a glob mismatch; confirmed present
  at `apps/web/src/middleware.ts:702`, `apps/admin/src/middleware.ts:194`).
- **Source maps not exposed** — no `productionBrowserSourceMaps`, no
  `withSentryConfig`, no `SENTRY_AUTH_TOKEN` in build; client source maps are
  not served and not uploaded (confirmed; `grep` only hits docs/lockfile).
- **Sentry PII scrubbing** — `sentry-options.ts` strips body/cookies/auth/user
  PII and scrubs free text. The legacy `sentry.ts:initSentry` (a second,
  non-scrubbing `Sentry.init`) is **not called** anywhere in app code
  (only referenced in test mocks), so it does not create a competing
  unscrubbed init; `captureException/Message` operate on the config-file init.
- **`.dockerignore` / `.gitignore`** exclude `.env`, `.env.docker`,
  `.env*.local`, `.env.production` — real secrets are not shipped in the image
  or repo.
- **CI gates real** — `ci.yml` runs tsc (web+admin), tests, prisma validate,
  gitleaks secret scan, prod-dependency audit; least-privilege
  `permissions: contents: read`; no `ignoreBuildErrors`/`ignoreDuringBuilds` in
  either `next.config.js`.
- **E2E secret hardening** — `ci.yml:186-194` fails the job if
  USER_JWT_SECRET/ADMIN_JWT_SECRET are not configured as repo secrets (inline
  fallback secrets were removed — good).
- **Cron auth** — `cron.yml` and `ofelia.ini` both send `Authorization: Bearer
  $CRON_SECRET`; `verifyInternalAuth` is constant-time; scheduler-ownership
  guards (`CRON_SCHEDULER_DISABLED`, `CRON_SCHEDULER_OWNER`) prevent double-firing.

## 14. Performance Audit

- **Middleware cost per request** — every `/api/*` request runs IP-rule check,
  CSRF, body-size, rate-limit (Redis round-trip), plus a per-request CSP nonce
  (`crypto.getRandomValues`). The shadow user-keyed limiter adds a 2nd Redis
  round-trip and is correctly **off by default**
  (`RATE_LIMIT_SHADOW_USER_KEYED_ENABLED`). Acceptable.
- **Readiness probes** — `/api/health` and `/api/ready` each do a DB `SELECT 1`
  plus Runtime Config read; both bounded by 2.5s timeouts and `no-store`. The
  Docker healthcheck hits `/api/ready` every 30s (web compose) which runs the
  full validator + DB probe each time; fine at that cadence.
- **Image optimizer** — web `remotePatterns` allow broad `**.r2.dev` and
  `**.r2.cloudflarestorage.com` wildcards (`next.config.js:40-54`). Non-`dangerouslyAllowSVG`
  (default), so images are sanitized; the wildcard slightly widens the proxy
  surface (any subdomain) but severity is low. Admin has no remotePatterns.
- No N+1 / unnecessary renders apply to this server-config module.

## 15. Reliability Audit

- **Error boundary**: `instrumentation.onRequestError = Sentry.captureRequestError`
  wires App Router route/RSC errors into Sentry (both apps).
- **Fail-open vs fail-closed**: `register()` swallows all errors (must not block
  boot — correct). `guardCronRequest` fails **open** on unconfigured Upstash
  (documented trade-off to avoid 429-ing every job) but fails **closed** on real
  Redis errors. Admin route limiter falls back to in-memory and warns once.
- **Partial failure**: feature-flag/optional keys degrade gracefully per the
  catalog; the readiness validator distinguishes fail vs warn so a missing
  optional integration does not 503 the deploy.
- **Monitoring/logging**: env-readiness warn-log (web only — see -02), security
  sink, Sentry. The cron uptime job is the total-outage backstop.
- **Gap**: no startup hard-stop on missing required secrets (see -03); the
  process serves traffic in a degraded state and relies on `/api/ready` being
  wired to the orchestrator.

## 16. Dead Code / Cleanup

- **`apps/web/src/lib/sentry.ts:initSentry`** — appears **unused** in app code
  (`grep` finds it only in test mocks like `route.test.ts`). `captureException`/
  `captureMessage` from the same file ARE widely used. The `initSentry` function
  + its non-scrubbing `Sentry.init` block is effectively dead and, if ever
  called, would create a competing init without the `beforeSend` scrubber.
  Recommend removing `initSentry` (and the setup-wizard doc comment) to prevent
  accidental future use. [confirmed unused in app code; test mocks only]
- **`uptime` job in `cron.yml`** — gated `if: false` (kept as historical
  context). Intentional, documented; not a bug but is dead workflow YAML.
- **Duplicate prod-like detectors** (catalog vs production-readiness vs admin
  ready) — candidate for consolidation (see -06).

## 17. Tests

Existing:
- `packages/shared/src/env-catalog` — no dedicated test found for the evaluator
  (the catalog is large but untested) [needs verification of coverage elsewhere].
- `apps/web/src/lib/production-readiness.test.ts` — covers the readiness validator.
- `packages/shared/src/build-info.test.ts` — covers `readBuildInfo`.

Missing / suggested:
- **Unit**: `evaluateEnvReadiness` — required-missing in prod-like vs silent in
  dev; alias satisfaction (EMAIL_FROM ← RESEND_FROM); secret masking never leaks.
- **Unit**: assert `register()` (web) emits warnings and never throws when env is
  broken; assert admin parity once -02 is fixed.
- **Integration**: `/api/ready` returns 503 + key names when a required key is
  removed; `/api/build-info` payload shape (post -04 decision).
- **E2E**: production-CSP smoke — a nonced inline script runs and a lazy chunk
  loads (guards the hydration fragility in -10).
- **CI lint**: compose `:?` coverage of catalog-`required` keys (guards -01).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| app-bootstrap-config-01 | Medium | Security | `docker-compose.prod.yml` does not hard-fail on several catalog-"required" secrets (INTERNAL_WEBHOOK_SECRET, IMPERSONATION_HANDOFF_SECRET default empty; ADMIN_JWT_SECRET/STRIPE/RESEND bare) | Self-hosted deploy can boot with security/billing/email secrets empty; internal webhook + impersonation + security fan-out silently break | Use `${VAR:?}` for all catalog-required keys; add a pre-flight check | `docker-compose.prod.yml:136-155`, `production-readiness.ts:225-243` |
| app-bootstrap-config-02 | Low | Reliability | Admin has no startup env-readiness warn-log (`src/instrumentation.ts` absent) | Misconfigured admin deploy has no loud boot signal; only `/api/ready` 503 | Add admin `src/instrumentation.ts` running `buildEnvReadinessWarnings()` | `apps/admin/instrumentation.ts`, `apps/web/src/instrumentation.ts:14-35` |
| app-bootstrap-config-03 | Low | Architecture | Dockerfile-documented `BUILD_PHASE` "throws on first request" gate does not exist in code | False sense of fail-fast boot; missing secrets surface only when dependent path runs | Implement a real `register()` gate or correct the Dockerfile comments | `docker/web.prod.Dockerfile:40-47`, `docker/admin.prod.Dockerfile:36-42` |
| app-bootstrap-config-04 | Low | Security | Public `/api/build-info` discloses commit SHA + branch + environment | Version/branch fingerprinting aids targeting | Gate behind auth or drop branch from public payload | `apps/web/src/app/api/build-info/route.ts`, `apps/admin/.../build-info/route.ts` |
| app-bootstrap-config-05 | Low | Security | Web `/api/ready` exposes failing config key names publicly | Mild recon on a degraded deploy | Match admin's count-only public shape; key detail behind auth | `apps/web/src/app/api/ready/route.ts:54-82` |
| app-bootstrap-config-06 | Low | Logic | Three divergent "production-like" detectors (`preview` handled inconsistently) | A `preview` deploy is prod-like to the catalog but only warn-level to `production-readiness` | Consolidate into one shared `isProductionLike(env)` | `env-catalog.ts:1465-1473`, `production-readiness.ts:26,109-115`, `apps/admin/.../ready/route.ts:9-12` |
| app-bootstrap-config-07 | Low | Dead Code | `apps/web/src/lib/sentry.ts:initSentry` unused (non-scrubbing second init) | If ever called, bypasses PII scrubber | Remove `initSentry` + setup-wizard comment | `apps/web/src/lib/sentry.ts:17-40` |
| app-bootstrap-config-08 | Info | Logic | `env-catalog.ts` comment says FIELD_ENCRYPTION_KEY "silently writes un-encrypted PII" but `encrypt()` now throws in prod | Misleading operator doc | Update the catalog description | `env-catalog.ts:114`, `encryption.ts:38-46` |

## 19. Module TODO

- [ ] **app-bootstrap-config-01** (Medium) — Hard-fail compose on all
  catalog-required secrets. Reason: degraded-but-green prod boot. Related:
  `docker-compose.prod.yml`, `production-readiness.ts`, `env-catalog.ts`.
  Suggested fix: change `:-`/bare `${VAR}` to `${VAR:?...}` for
  INTERNAL_WEBHOOK_SECRET, IMPERSONATION_HANDOFF_SECRET, ADMIN_JWT_SECRET (web),
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, EMAIL_FROM; add a
  CI compose-lint. Dependencies: none. Complexity: low. Risk of change: medium
  (could block deploys that currently run with optional gaps — verify each key
  is truly required for the operator's topology first).
- [ ] **app-bootstrap-config-02** (Low) — Add admin startup env-readiness
  warn-log. Related: `apps/admin/instrumentation.ts`, shared env-catalog.
  Fix: new `apps/admin/src/instrumentation.ts` mirroring web. Dependencies:
  none. Complexity: low. Risk: low.
- [ ] **app-bootstrap-config-03** (Low) — Make the `BUILD_PHASE` story true:
  either implement a boot-time required-secret throw guarded on
  `process.env.BUILD_PHASE !== "true"`, or rewrite the Dockerfile comments to
  describe per-operation throws + `/api/ready` 503. Related: both prod
  Dockerfiles, `apps/web/src/instrumentation.ts`. Complexity: low–med. Risk:
  medium (a boot-throw changes crash semantics — must keep degraded-console
  access in mind, matching the existing "never throw at import" principle).
- [ ] **app-bootstrap-config-04** (Low) — Auth-gate or trim `/api/build-info`.
  Related: both build-info routes, web/admin middleware public lists.
  Complexity: low. Risk: low (operator tooling may read it — confirm callers).
- [ ] **app-bootstrap-config-05** (Low) — Reduce web `/api/ready` public body to
  a count (key detail behind auth). Related: `production-readiness.ts`
  summarizer, web ready route. Complexity: low. Risk: low.
- [ ] **app-bootstrap-config-06** (Low) — Extract one shared `isProductionLike`.
  Related: env-catalog, production-readiness, admin ready route. Complexity: low.
  Risk: medium (changes which deploys are treated as prod-like — review `preview`).
- [ ] **app-bootstrap-config-07** (Low) — Remove dead `initSentry`. Related:
  `apps/web/src/lib/sentry.ts`, its test mocks. Complexity: low. Risk: low.
- [ ] **app-bootstrap-config-08** (Info) — Fix FIELD_ENCRYPTION_KEY catalog
  description. Related: `env-catalog.ts`. Complexity: low. Risk: low.
