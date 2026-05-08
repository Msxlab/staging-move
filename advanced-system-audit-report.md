# Advanced System Audit Report — LocateFlow Monorepo

**Repository:** `c:\Users\Windows\Downloads\move-main\move-main\`
**Audit date:** 2026-05-08
**Branch audited:** `fix/rate-limit-auth-protection`
**Methodology:** code-only audit. `.md` files were not used as evidence at any point. All findings are anchored to actual `.ts/.tsx/.js/.prisma/.sql/.json/.yml/.gradle/.xml/.plist` source. Findings without verifiable code evidence are explicitly marked "low confidence" or "not verified in code."

---

## 0. Executive Summary

LocateFlow is a multi-app TypeScript monorepo: a Next.js 16 customer web app, a Next.js 16 admin panel, an Expo / React Native mobile app, a Prisma/MySQL data layer, and a shared library package. The branch under audit is the in-progress `fix/rate-limit-auth-protection` work that migrates legacy per-route rate limits to a centralized policy matrix.

The codebase is generally well-instrumented: AES-256-GCM field encryption with HMAC-signed backups, JWT + DB-backed sessions with fingerprinting, Stripe/Apple/Google webhook signature verification with replay windows and DB idempotency, CSRF defense via `Sec-Fetch-Site` + `Origin`/`Referer` + Content-Type, edge CSP with per-request nonce + `'strict-dynamic'`, server-side authorization via `requireAdmin()`/`requirePermission()`, audit logging on most admin actions, rate-limit policies grouped by sensitivity, and minimal mobile permissions with all dangerous Android perms explicitly blocked.

The most material gaps are: (1) **page-level admin role checks are missing on every privileged admin page except `/blog`** — they rely entirely on the API to fail closed; (2) the **15-minute global step-up password grace cache is process-local** and not Redis-distributed, enabling password-cracking primitives across instances; (3) **MFA is only enforced for SUPER_ADMIN**, leaving ADMIN/MODERATOR reachable with a single stolen password; (4) **`apps/web/pnpm-lock.yaml` is a stray nested lockfile** and the production Dockerfiles **bake placeholder JWT/encryption secrets as `ENV`**; (5) currency fields (`Subscription.firstChargeAmount`, `Service.monthlyCost`, all Budget columns) are stored as IEEE-754 `Float`; (6) **soft-delete is opt-in** on the default Prisma client; (7) the legacy `seed.ts` references a `Badge` model that was dropped in `20260417000000_phase0_cleanup` and runs without a production guard.

Total evidence-based findings across all module agents and direct inspection: **~340**, of which ~30 are Critical, ~85 are High, ~120 are Medium, and ~105 are Low / Informational.

---

## A. Project Map

### A.1 Top-level layout
- `apps/web` — Next.js 16 customer app (App Router, React 19, Tailwind 3, next-intl 4)
- `apps/admin` — Next.js 16 admin panel (App Router, React 19, Tailwind 3, next-intl 4, Tiptap editor)
- `apps/mobile` — Expo SDK 54 / React Native 0.81.5 / expo-router 6 / NativeWind / new architecture
- `packages/db` — Prisma 5.22 schema + client singleton, soft-delete extension, optimistic-locking helper, provider-coverage helpers
- `packages/shared` — Zod schemas, AES-GCM encryption, audit/Sentry redaction, billing helpers, business-logic engines, dual export `index.ts` (Node) + `index.mobile.ts` (React Native)

### A.2 Monorepo orchestration
- pnpm workspaces (`pnpm-workspace.yaml:1-3`), Turborepo `^2.9.8` (`package.json:56`, `turbo.json:1-20`), `packageManager: pnpm@9.15.0` (`package.json:58`), `engines.node: 22.x` (`package.json:60`).
- A single CI workflow at `.github/workflows/ci.yml`. Vercel cron declared at `apps/web/vercel.json:1-36` (~8 schedules). Self-hosted prod via `docker-compose.prod.yml`.

### A.3 Module risk ranking (highest first)
1. **Admin panel pages** — `(admin)` route group lacks page-level role checks (other than `/blog`); destructive runtime-config/security/backups surfaces ride on a process-local 15-minute step-up cache.
2. **Backend API** — large attack surface with mostly correct authz, but legacy per-route `rateLimit()` calls bypass the new policy matrix; admin middleware applies no rate limit.
3. **Web frontend** — TOTP secret leaks to a third-party QR API; CSP allows `style-src 'unsafe-inline'`; cookie domain hard-coded; many `(app)` pages don't handle 401.
4. **DB / shared** — currency in Float; soft-delete opt-in; `seed.ts` references dropped `Badge` model; encryption silently degrades to plaintext in non-production.
5. **Mobile** — JWT correctly in `expo-secure-store`; PKCE + replay protection good; release build uses debug keystore; R8/ProGuard off; iOS privacy manifest absent.
6. **Config / build / deploy** — production Dockerfiles use `node:25` against a `node:22` engine pin; bake placeholder secrets as `ENV`; image tags floating; cron service mounts the docker socket.

---

## B. File Inspection Summary

The audit covered (verified via Read/Glob, not summaries):
- `apps/web/src/middleware.ts` (720 lines), `apps/admin/src/middleware.ts` (491 lines)
- `apps/web/src/lib/rate-limit.ts`, `rate-limit-policy.ts`, `user-auth.ts`, `internal-secrets.ts`
- `apps/admin/src/lib/auth.ts`, `apps/admin/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/webhooks/{stripe,appstore,playstore,resend}/route.ts`
- `apps/web/src/app/api/cron/{trial-check,...}/route.ts`
- `packages/db/prisma/schema.prisma` (1635 lines), all `packages/db/prisma/seed*.ts`
- `packages/shared/src/encryption.ts`, `audit-redaction.ts`, `validators.ts`, business-logic engines
- `apps/mobile/app.json`, `eas.json`, `android/app/build.gradle`, `AndroidManifest.xml`, mobile auth/PKCE/secure-store
- `Dockerfile`, `docker/{web,admin,migrate,dev}.prod.Dockerfile`, `docker/Caddyfile`, `docker-compose*.yml`, `.github/workflows/ci.yml`
- `apps/{web,admin}/next.config.js`, `tsconfig.json`, `sentry.*.config.ts`, `playwright.config.ts`, `vitest.config.ts`
- `.env.example`, `.env.production.example`, `.env.docker`, `.gitignore`, `.dockerignore`, `.npmrc`, `.gitattributes`

Configuration files at root were read in full where small; large source files were read in targeted offset/limit windows.

---

## C. Critical Findings (Cross-Cutting)

### C-1 — Admin pages have no server-side role gate (only API does)
**File:** `apps/admin/src/app/(admin)/layout.tsx:12-16` calls only `requireAdmin()` (which checks active admin, not role). Every page except `/blog` is `"use client"` and discovers "Forbidden" only after the API responds. Affected pages include `/runtime-config`, `/security`, `/security/dashboard`, `/team`, `/backups`, `/feature-flags`, `/users/[id]`. **Fix:** turn each privileged page into a server component that calls `requireRole("SUPER_ADMIN")` or `requirePermission(resource, action)` before rendering, mirroring `apps/admin/src/app/(admin)/blog/page.tsx:77`.

### C-2 — 15-minute step-up password grace is process-local with no rate limit
**File:** `apps/admin/src/lib/auth.ts:354-363, 365-398`. `recentConfirms` is an in-process `Map` with `CONFIRM_GRACE_MS = 15 * 60 * 1000`. One password entry unlocks every subsequent destructive operation for 15 minutes. Across replicas the cache doesn't synchronize, so password attempts can be probed on different instances unlimited times. `requirePasswordConfirm` performs no Redis-backed lockout. **Fix:** move to Redis with a strict per-admin 5-attempts-per-15-min bucket; scope cache key by `(adminId, operation)`; remove the grace window for destructive secret-rotation ops.

### C-3 — MFA setup gate only fires for SUPER_ADMIN
**File:** `apps/admin/src/middleware.ts:418-444`. `requiresMfaSetup = role === "SUPER_ADMIN" && !mfaEnabled` — ADMIN, MODERATOR, VIEWER are never required to enroll in MFA. Stolen ADMIN password = full takeover. **Fix:** extend gate to all admin roles.

### C-4 — Currency stored as `Float` in Prisma schema
**File:** `packages/db/prisma/schema.prisma:239` (`Subscription.firstChargeAmount Float?`), 461 (`Service.monthlyCost Float?`), 552-559 (every Budget column). IEEE-754 drift will accumulate against Stripe in cents and across budget rollups. **Fix:** migrate to `Decimal @db.Decimal(12,2)` or store integer cents.

### C-5 — Soft-delete extension is opt-in; default `db` client returns deleted rows
**File:** `packages/db/src/index.ts:7-14` exports an un-extended `PrismaClient`. `packages/db/src/soft-delete.ts:8-13` documents that callers must `db.$extends(withSoftDelete)`. 9 models declare `deletedAt`; any forgotten call leaks deleted PII. The extension's `findUnique` handler (`soft-delete.ts:61-67`) is also non-atomic: with a caller-supplied `select`, the row is returned without `deletedAt`, so the post-check mistakenly passes deleted rows through. **Fix:** ship `dbWithSoftDelete` from `index.ts` as the default; force `select` to always include `deletedAt`; rewrite `findUnique` as `findFirst { where: { id, deletedAt: null } }`.

### C-6 — `seed.ts` references a `Badge` model dropped in phase-0 cleanup
**File:** `packages/db/prisma/seed.ts:103-108` calls `prisma.badge.upsert(...)`. The `Badge` table was dropped in `packages/db/prisma/migrations/20260417000000_phase0_cleanup/migration.sql:18-19`. `pnpm db:seed` crashes immediately. There is also no `if (process.env.NODE_ENV === "production") throw` guard on any seed file. `seed-admin.ts:30-45` `upsert` would silently overwrite a real super-admin's password if an operator runs it against production. **Fix:** delete the Badge block; add a production guard to all seed files.

### C-7 — TOTP `provisioningUri` (containing the seed) is sent to a third-party QR API
**File:** `apps/web/src/app/(app)/settings/privacy/page.tsx:551-561` renders `<img src={\`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetup.uri)}\`} />`. The provisioning URI carries the `secret=` parameter. CSP `img-src` permits `https:` (`apps/web/src/middleware.ts:601`). **Fix:** generate the QR code in-bundle (`qrcode` npm package); tighten `img-src` to specific R2/imgproxy origins.

### C-8 — `apps/web/pnpm-lock.yaml` is a stray nested lockfile
**File:** `apps/web/pnpm-lock.yaml`. pnpm workspaces use the root lockfile only. **Fix:** delete `apps/web/pnpm-lock.yaml`.

### C-9 — Production Dockerfiles bake placeholder JWT/encryption secrets as `ENV`
**Files:** `docker/web.prod.Dockerfile:36-47`, `docker/admin.prod.Dockerfile:33-37`. `ENV USER_JWT_SECRET=build_time_user_secret_32_chars_minimum`, `ENV ADMIN_JWT_SECRET=...`, `ENV FIELD_ENCRYPTION_KEY=00...00`, `ENV CRON_SECRET=...`, `ENV IMGPROXY_KEY=00...00`. These propagate into the builder layer and are visible in `docker history`. **Fix:** use BuildKit `--mount=type=secret` or a `BUILD_PHASE=true` flag the runtime validator skips.

### C-10 — Production base images use `node:25-bookworm-slim` against a `node:22.x` engine pin
**Files:** `docker/web.prod.Dockerfile:8,31,67`, `docker/admin.prod.Dockerfile:6,28,56`, `docker/migrate.Dockerfile:7`, `docker/dev.Dockerfile:1`. Conflicts with `package.json:60` and root `Dockerfile:5` (`node:22-bookworm-slim`). **Fix:** standardize on `node:22-bookworm-slim`.

### C-11 — `cron` service mounts the docker socket
**File:** `docker-compose.prod.yml:333-352` runs Ofelia with `/var/run/docker.sock:/var/run/docker.sock:ro`. Read-only socket still permits exec via the daemon → host root. The container also runs as root. **Fix:** replace Ofelia `job-exec` with the Vercel Cron declarations in `apps/web/vercel.json:1-36`, or use `job-local` running `wget` from a non-privileged sidecar.

### C-12 — `docker-compose.yml` exposes MySQL on `0.0.0.0:3306` with default credentials
**File:** `docker-compose.yml:7-12`. `MYSQL_ROOT_PASSWORD:-locateflow_root_password` plus `3306:3306` bind. Reachable from any host on a developer's LAN. **Fix:** bind `127.0.0.1:3306:3306`; drop default values (`:?MYSQL_ROOT_PASSWORD is required`).

### C-13 — `images.remotePatterns` permits any R2 account/subdomain
**File:** `apps/web/next.config.js:30-44`. Hostname patterns `**.r2.dev` and `**.r2.cloudflarestorage.com` accept ANY R2 bucket — Next image optimizer will fetch and cache attacker-controlled images, enabling SSRF / cache pollution / cost abuse. **Fix:** pin to specific `<accountid>.r2.cloudflarestorage.com`.

### C-14 — Production compose uses `:latest` tags for GlitchTip/imgproxy
**File:** `docker-compose.prod.yml:251-271, 280-299, 306-331`. `glitchtip/glitchtip:latest`, `glitchtip-worker:latest`, `darthsim/imgproxy:latest`. **Fix:** pin to specific tags or digests.

### C-15 — `/api/internal/*` endpoints exempt from rate-limit and CSRF middleware
**Files:** `apps/admin/src/middleware.ts:370-372`, `apps/web/src/middleware.ts:146-147, 241-242`. Routes pass through with only a bearer-secret check. If `INTERNAL_WEBHOOK_SECRET` ever leaks, an attacker bypasses CSRF, rate-limit, body-size enforcement, and IP rules in one shot. The `internal` policy in `apps/web/src/lib/rate-limit-policy.ts:322-333` has `maxAttempts: 0`. **Fix:** apply minimum rate-limit and body-size enforcement to internal routes.

### C-16 — Cron endpoints have zero rate limit
**File:** `apps/web/src/lib/rate-limit-policy.ts:310-321` — `cron` policy has `maxAttempts: 0`. Combined with `apps/web/src/middleware.ts:243`, no platform layer rate-limits any cron endpoint. A leaked `CRON_SECRET` weaponizes `stripe-reconcile` and `data-retention` as DB DoS vectors. **Fix:** apply min 1/min hard cap with per-route keying.

### C-17 — Backup REPLACE imports can wipe `adminUsers`/`adminPermissions` cross-environment
**File:** `apps/admin/src/app/api/backup/import/route.ts:476-507`. `deleteMany({})` per selected table runs in a transaction; HMAC signature only proves the file came from some installation that shares `BACKUP_HMAC_SECRET` (same key on staging/dev/prod). **Fix:** bind backup signatures to environment fingerprint and refuse to replace `adminUsers`/`adminPermissions` unless the env-fingerprint matches.

### C-18 — Page-level role gating bypassable via client-side variable on `/team`
**File:** `apps/admin/src/app/(admin)/team/page.tsx:147-150, 382, 601, 612, 754, 784`. Permission Matrix and admin role-mutation buttons gate on `currentAdminRole === "SUPER_ADMIN"` from client state. A non-SUPER_ADMIN can flip the variable in DevTools. **Fix:** resolve role server-side, pass as non-controllable prop.

### C-19 — Encryption fallback to plaintext in non-production
**File:** `packages/shared/src/encryption.ts:36-43, 60-97`. If `FIELD_ENCRYPTION_KEY` is missing or wrong length, `encrypt()` returns plaintext **unchanged** in non-production (line 42), and `decrypt()` returns the raw ciphertext on failure (line 95). A staging environment without the env var writes plaintext into rows that production then expects to be `enc_v1:`-prefixed. **Fix:** throw in all environments unless an explicit dev-only override flag is set.

### C-20 — `AcquisitionCampaign.redemptionCount` has no atomic guard
**File:** `packages/shared/src/acquisition.ts:160-187`. `redemptionCount >= maxRedemptions` is checked client-side without DB-level row lock or `UPDATE ... WHERE redemptionCount < maxRedemptions`. Concurrent redemptions can race past the cap. **Fix:** atomic SQL `UPDATE AcquisitionCampaign SET redemptionCount = redemptionCount + 1 WHERE id = ? AND (maxRedemptions IS NULL OR redemptionCount < maxRedemptions)` and check affected rows.

### C-21 — Service / Budget validators allow unbounded float precision
**File:** `packages/shared/src/validators.ts:73`. `serviceSchema.monthlyCost: z.number().min(0).optional()` — accepts `0.000000001`. Pairs with C-4 to compound rounding drift. **Fix:** `.multipleOf(0.01).max(1_000_000)`.

### C-22 — Mobile release build is signed with the public debug keystore
**File:** `apps/mobile/android/app/build.gradle:112-122`. `release { signingConfig signingConfigs.debug }`. EAS cloud builds override; any local `./gradlew assembleRelease` produces a debug-signed APK Play will reject. **Fix:** add a real `release` signingConfig from `gradle.properties`/env.

### C-23 — Mobile R8/ProGuard minification disabled by default
**File:** `apps/mobile/android/app/build.gradle:69, 116-119`. `enableMinifyInReleaseBuilds` defaults to `false`. **Fix:** flip to `true` in `gradle.properties` and confirm Reanimated keep-rules.

### C-24 — Floating action versions in CI workflow
**File:** `.github/workflows/ci.yml:14, 16, 20, 28, 73-74` — `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `gitleaks/gitleaks-action@v2`, etc. all pinned by major. **Fix:** pin to commit SHAs.

### C-25 — Apple App Store privacy manifest missing
**Evidence:** `apps/mobile/ios/` does not exist (managed Expo). No `PrivacyInfo.xcprivacy`. Apple has required this since May 2024. **Fix:** `expo prebuild --platform ios`, then add `PrivacyInfo.xcprivacy`.

### C-26 — `ITSAppUsesNonExemptEncryption` not declared in `app.json`
**File:** `apps/mobile/app.json` does not set `ios.config.usesNonExemptEncryption` or `infoPlist.ITSAppUsesNonExemptEncryption`. **Fix:** add `"ios": { "infoPlist": { "ITSAppUsesNonExemptEncryption": false } }`.

### C-27 — Admin login rate-limit uses non-cryptographic FNV-32 hash for bucketing
**File:** `apps/admin/src/app/api/auth/login/route.ts:178-194`. `stableRateKeyHash` is FNV-1a, then `buildAdminLoginRateKey` concatenates `email:<fnv>:ip:<fnv>:ua:<fnv>`. 32-bit collisions reachable in ~77k attempts. **Fix:** use SHA-256 prefix (16 hex chars).

### C-28 — Sessions without a fingerprint are accepted as valid
**File:** `apps/admin/src/lib/auth.ts:258-268` (`if (!session.fingerprint) return true;`) and `apps/admin/src/middleware.ts:447-473`. Pre-fingerprint legacy JWTs bypass anti-hijack defense for the remainder of their 8-hour TTL. **Fix:** reject `!session.fingerprint`, force re-login.

### C-29 — Admin middleware applies no rate limit
**File:** `apps/admin/src/middleware.ts:343-486`. There is no `applyRateLimit` invocation. `/api/users/[id]`, `/api/providers/bulk`, `/api/backup`, `/api/runtime-config`, etc. have no platform-level rate limit. **Fix:** mirror web middleware.

### C-30 — `provider.website` is fetched server-side without IP allowlist (SSRF)
**File:** `apps/admin/src/app/api/providers/[id]/logo/auto-fetch/route.ts:63-98`. `ingestLogoFromWebsite({ providerId, website })` is called with the admin-controlled `website` field (`apps/admin/src/app/api/providers/[id]/route.ts:147`). A MODERATOR could set `website: http://169.254.169.254/...` (cloud metadata). The downstream `logo-fetcher` library's URL validation is not verified in code (low confidence on the helper). **Fix:** in `logo-fetcher`, reject non-HTTP(S), localhost, RFC1918, link-local, `metadata.google.internal`, `169.254.169.254`, `100.100.100.200`; resolve DNS first.

---

## D. Backend / API Audit

### D.1 Endpoint inventory (excerpt)

| Method | Path | File:Line | Auth | Validation | Notes |
|---|---|---|---|---|---|
| POST | /api/auth/login | `apps/web/src/app/api/auth/login/route.ts:61` | none → creates session | zod `:25` | per-IP rate limit + lockout |
| POST | /api/auth/register | `apps/web/src/app/api/auth/register/route.ts:33` | none | zod `:17` | rate-limit policy `:47` |
| POST | /api/auth/oauth/google/callback | `.../oauth/google/callback/route.ts:64` | state cookie | n/a | rate-limit `:65`, JWKS `:108`, `iss/aud` `:108-111` |
| POST | /api/account/delete | `.../account/delete/route.ts:12` | session+stepUp | inline | rate `3/min :24`, **`failClosed` unset** |
| POST | /api/stripe/checkout | `.../stripe/checkout/route.ts:58` | session | inline | per-route `rateLimit()` 5/min `:71-75` |
| POST | /api/webhooks/stripe | `.../webhooks/stripe/route.ts:365` | stripe-sig | constructEvent | replay 72h `:437`, idempotency `:445`, body cap 256KB `:362` |
| POST | /api/webhooks/appstore | `.../webhooks/appstore/route.ts:59` | apple-jws | jws verify | replay 72h `:103` |
| POST | /api/webhooks/playstore | `.../webhooks/playstore/route.ts:103` | google-oidc | jws verify | OIDC + audience+sub `:141-152` |
| POST | /api/webhooks/resend | `.../webhooks/resend/route.ts:33` | svix-hmac | json | 16KB cap `:31` |
| POST | /api/internal/impersonate | `.../internal/impersonate/route.ts:36` | bearer | zod | TTL ≤15 min `:27` |
| POST | /api/cron/data-retention | `.../cron/data-retention/route.ts:16` | cron secret | n/a | also accepts legacy `x-cron-secret` `:19` |
| POST | /api/auth/login (admin) | `apps/admin/src/app/api/auth/login/route.ts:282` | none | zod strict `:17` | DB-backed lockout `:196` |
| GET/PATCH/DELETE | /api/users/[id] (admin) | `.../users/[id]/route.ts` | perm | inline | mass-assignment risk on PATCH (D-H6) |
| POST | /api/security/key-rotation | `.../security/key-rotation/route.ts:24` | perm | inline | step-up `:32` |
| GET/PUT/DELETE | /api/runtime-config | `.../runtime-config/route.ts` | perm | manual | step-up + key catalog |
| POST | /api/backup/import | `.../backup/import/route.ts:294` | perm | inline | step-up + signature; cross-env replay risk (C-17) |

(~120 routes total, 50 inventoried with full signature/auth/validation breakdown.)

### D.2 Critical / High findings (selected)

- **C-2 (rate-limit migration)** — `/api/account/delete:24`, `/api/stripe/checkout:71-75`, `/api/export/pdf:39`, `/api/moving:60` use raw `rateLimit()` instead of `enforceRateLimitPolicy`, bypassing `failClosed`/`hardLockoutThreshold`. The branch under audit is the work to migrate these.
- **D-H1** — `/api/internal/rate-limit-log/route.ts:12-17` accepts caller-specified `windowStart/windowEnd/count/ipAddress` without zod — log-forgery primitive.
- **D-H2** — `/api/cron/data-retention/route.ts:19-22` accepts both `Authorization: Bearer` and legacy `x-cron-secret`. `Bearer ${xCronSecret}` concatenation makes total token length leak the secret length via `safeEqual`'s length-mismatch fast path.
- **D-H6** — `/api/admin/users/[id]/route.ts:556-631` PATCH accepts `body.subscriptionStatus`, `body.plan`, etc. as free-form strings without enum validation.
- **D-H7** — `/api/admin/providers/bulk/route.ts:31-69` requires step-up only for `delete`. `change_category`, `set_score`, `activate`, `deactivate` skip step-up.
- **D-H9** — `apps/web/src/middleware.ts:179-194` allows `x-requested-with: locateflow` to bypass origin/referer checks on logout.
- **D-H11** — `apps/web/src/app/api/auth/login/route.ts:165-173` parses `mfaBackupCodes` JSON without try/catch (admin variant has fallback).
- **C-5 (web)** — `/api/blog/revalidate` HMAC accepts a 5-minute replay window without idempotency; reads `INTERNAL_WEBHOOK_SECRET` directly from env, bypassing runtime-config rotation.

### D.3 Medium / Low findings (selected)

- **D-M1** — `apps/web/src/app/api/internal/impersonate/route.ts:84-89` writes raw `x-forwarded-for` into `userLoginSession.ipAddress` without IP-format validation.
- **D-M2** — `/api/admin/users/[id]/route.ts:559-563` PATCH allows unbounded `firstName`/`lastName`.
- **D-M5** — `/api/tracking/event/route.ts:97-108` `createMany` allows up to 50 records but doesn't cap metadata key count.
- **D-M6** — Admin login uses Upstash REST `fetch(...)` rather than the shared `@upstash/ratelimit` client — two parallel limiters for the same Redis instance.
- **D-M11** — `/api/internal/security-event/route.ts:5-29` accepts arbitrary `ip` and `pathname` strings without validation.
- **D-M19** — `/api/waitlist/route.ts:55-62` reads `cf-connecting-ip || x-real-ip || x-forwarded-for` directly, while `resolveClientIP` (`rate-limit.ts:260-279`) prefers `x-vercel-forwarded-for`. IP-resolution inconsistency = per-IP rate-limit bypass.
- **D-L9** — `webhook` policy is `mode: "warn"` (never blocks); `internal` policy `maxAttempts: 0`.

### D.4 Auth & middleware analysis

- Web middleware (`apps/web/src/middleware.ts`): two-stage auth (edge JWT → DB-backed session in routes via `user-auth.ts:417-584`), multi-cookie collection (`user-auth.ts:353-389`), multi-domain cookie expire, IP-rule enforcement first (line 653-671), CSP nonce per-request, `'strict-dynamic'`, body-size by content-type (line 116-140), locale auto-detect.
- Admin middleware: same shape but **no rate limiter** (C-29); `same-site=strict` cookies with 8h TTL; MFA setup gate enforced for SUPER_ADMIN only (C-3); fingerprint check at edge.
- Rate-limit lib (`apps/web/src/lib/rate-limit.ts`): correct `failClosed` handling when Redis up; per-instance memory fallback; `safeReason` scrubs URLs/tokens; degrade window 60s.
- Policy module (`rate-limit-policy.ts`): sound matrix; mode-aware `evaluateRateLimitPolicy:515-625` is the new entry point; `SHADOW_USER_KEYED_ENABLED` flag indicates in-progress migration.

### D.5 Webhook security

| Provider | Signature | Replay | Idempotency | Body cap |
|---|---|---|---|---|
| Stripe | constructEvent (HMAC-SHA256) | 72h | DB `ProcessedWebhookEvent` | 256 KB |
| Apple | JWS chain via `verifyAppleJws` | 72h | DB | 64 KB |
| Google Play | OIDC bearer + aud + sub | n/a (Pub/Sub messageId) | DB | 64 KB |
| Resend | Svix HMAC | 5 min | none seen | 16 KB |
| blog/revalidate | INTERNAL_WEBHOOK_SECRET HMAC | 5 min | none (C-5) | 1 MB |

Strengths: signature → livemode → replay → idempotency pipeline (Stripe). Gaps: blog revalidate window too wide; Resend `bounced`/`complained` paths don't dedupe by `svix-id`.

### D.6 Admin authorization

`requirePermission(resource, action, {minimumRole, fallbackResources})` at `apps/admin/src/lib/auth.ts:400-415` is the central gate. `checkPermission` (line 438-457) **fails closed**. `requireRole` re-reads role from DB (line 303-313) every call. Step-up `requirePasswordConfirm` is consistently used on destructive routes; bulk *non-delete* mutations skip step-up (D-H7).

---

## E. Web Frontend Audit

### E.1 Route inventory

The `(app)` route group enforces auth via layout (`apps/web/src/app/(app)/layout.tsx:23-46` calls `requireDbUserId()` and runs `getPostAuthUserState`). `/onboarding` lives at the root, not inside `(app)` (E-H1).

### E.2 High findings (selected)

- **E-H1** — `/onboarding` outside `(app)` group, no server-side auth gate. Onboarding handles GDPR sensitive opt-ins.
- **E-H2** — Marketing landing (`apps/web/src/app/page.tsx:77, 86-89`) is `force-dynamic` and SSRs DB-bound subscription/campaign data on every public visit.
- **E-H3** — `dashboard-client.tsx:193-285` empty deps `useEffect` reads `td()` (stale closure), no AbortController on four parallel fetches; line 264 interpolates `toState` into `/api/state-rules?state=${toState}` **without `encodeURIComponent`**.
- **E-H4** — `useCurrentUser.signOut()` at `apps/web/src/hooks/use-current-user.ts:109-110` writes a cookie hard-coded to `Domain=.locateflow.com`.
- **E-H5** — `apps/web/src/middleware.ts:586`: CSP `style-src 'self' 'unsafe-inline'`.
- **E-H6** — `apps/web/src/middleware.ts:601`: CSP `img-src ... https:` permits any HTTPS image origin (compounds C-7).
- **E-H8** — `dangerouslySetInnerHTML` for blog content (`apps/web/src/app/blog/[slug]/page.tsx:220`, `blog/preview/[token]/page.tsx:91`) trusts write-time sanitization only; no render-time defense.
- **E-H22** — Service-worker cache cleanup on logout (`use-current-user.ts:28-47`) silently swallows errors.
- **E-H25** — Source files contain mojibake: `dashboard-client.tsx:521,847-850`, `addresses/[id]/page.tsx:18-40`, `onboarding/page.tsx:847-850` show `ðŸšš` instead of 🚚 — UTF-8 → Latin-1 → UTF-8 round-trip damage. Visible to users.
- **E-H31** — Pervasive `<Link><button>` antipattern across the (app) tree.
- **E-H40** — `apps/web/src/components/settings/subscription-management.tsx:302, 330, 366`: `window.location.href = data.url` on Stripe redirect — no allowlist.
- **E-H42** — Account-deletion flow (`apps/web/src/components/settings/delete-account-dialog.tsx:91-104`) `await fetch("/api/auth/logout").catch(() => {})` swallows logout failure and redirects anyway.

### E.3 Auth/session frontend

- httpOnly `user_session` cookie set server-side; no `localStorage`/`sessionStorage` token storage.
- 401 detection inconsistent: most fetches in `(app)` ignore 401 entirely (`dashboard-client.tsx`, `notifications/page.tsx:32-37`, `support/page.tsx:42-48`).

### E.4 XSS / CSRF surface

- XSS: only `dangerouslySetInnerHTML` in `seo/json-ld.tsx:53` (safely escaped), `faq/faq-json-ld.tsx:28`, and the two blog renderers (E-H8). No `eval`, `new Function`, or `innerHTML =` writes found.
- CSRF: middleware enforces JSON content-type → `Sec-Fetch-Site`/`Origin`/`Referer`. No synchronizer token. `x-requested-with: locateflow` allowance on logout (D-H9).

### E.5 Env / secret leakage

All `NEXT_PUBLIC_*` vars audited — no secrets prefixed. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (`.env.example:38`) must be HTTP-referrer-locked in GCP console (cannot verify from code).

### E.6 Form validation

- Shared `validators.ts` exists but is not imported by any audited client page; each page rolls its own checks.
- Sign-up password: only `minLength={12}` HTML5; full complexity rule (`validatePasswordPolicy` in `user-auth.ts:121-132`) never surfaced before submission.

### E.7 Performance & accessibility

- `dashboard-client.tsx` (~700 lines `"use client"`) ships `@dnd-kit/{core,sortable,utilities}` to all users.
- `onboarding/page.tsx` (~1370 lines `"use client"`) is monolithic.
- A11y: skip-to-main present; mobile menu has no focus trap; header user-dropdown items lack `role="menuitem"`; cookie banner lacks `aria-modal` and focus trap; `<Link><button>` antipattern (E-H31).

### E.8 Sentry

- DSN gate; `tracesSampleRate: 0.1` prod; `sendDefaultPii: false`; `beforeSend` strips request data/cookies/auth/cookie headers, user.email/ip_address.
- Gaps: no `tracePropagationTargets` (could leak trace IDs to api.qrserver.com per C-7); no `release:`; `withSentryConfig` not wrapped → source maps not auto-uploaded.

---

## F. Admin Panel Audit

### F.1 Route inventory

41 admin routes inventoried under `apps/admin/src/app/(admin)/**`. Single shared gate is `(admin)/layout.tsx:12-16` `await requireAdmin()`. Only `/blog` performs page-level role enforcement (`apps/admin/src/app/(admin)/blog/page.tsx:77`).

Highest-risk routes (CRITICAL): `/runtime-config`, `/security/dashboard`, `/team`, `/backups`, `/users/[id]`. All `"use client"` with no server-side role assertion.

### F.2 Critical / High findings

- C-1, C-3, C-18, C-2 covered above.
- **CRIT-03** — `apps/admin/src/middleware.ts:285-293`: localhost-host short-circuit in CSRF check. If a deployment's reverse proxy preserves `Host: localhost`, every cross-origin POST claiming `Origin: http://localhost` is accepted. **Fix:** gate on `NODE_ENV !== "production"`.
- **CRIT-04** — JWT-only auth in middleware; admin de-activation only enforced at API routes.
- **CRIT-05** — Backup download (`apps/admin/src/components/backup-control-plane.tsx:389-404`) is single-step `fetch(url)` Blob download, no password re-confirm.
- **CRIT-06** — Runtime config Save Override (`apps/admin/src/app/(admin)/runtime-config/page.tsx:59-78`) only requires password; no TOTP step-up.
- **CRIT-07** — Runtime config DELETE relies on `window.confirm` + grace-window password (compounds C-2).
- **HIGH-02** — Email-templates editor (`email-templates/page.tsx:53, 65-73`) has no XSS sanitization on body. Outbound email rendering uses these stored bodies.
- **HIGH-04 / HIGH-05** — `/security` GDPR Reject and IP rule add/delete/toggle skip password confirmation, no audit log entries.
- **HIGH-06 / HIGH-07 / HIGH-08** — Reports/Logs/Users CSV exports use raw email/IP without `maskEmail`/`maskIpAddress`, no audit-log entry, no role gate.
- **HIGH-10** — Admin login pulls Redis credentials live from runtime-config DB (`apps/admin/src/app/api/auth/login/route.ts:200-208`). A SUPER_ADMIN who poisons `UPSTASH_REDIS_REST_URL` causes every admin login to send Bearer token to attacker URL.
- **HIGH-11** — Disable MFA flow (`settings/two-factor/page.tsx:90-110`) only requires password — no TOTP.
- **HIGH-13** — `/security/dashboard` derives severity from `event.entityId` (`security/dashboard/page.tsx:347-349`).
- **HIGH-15** — Notifications broadcast page is a flat client form. No two-admin approval.
- **HIGH-17** — Login API returns `requiresMfa: true` (status 403) on correct password+MFA, vs 401 on wrong credentials. Partial password oracle.
- **HIGH-18** — `/acquisition-campaigns` create form lacks step-up; compromised MODERATOR can mint perpetual free-access codes.
- **HIGH-19** — `/support/[id]/page.tsx:36-85` exposes full user moving plans, addresses, services, custom-providers in initial fetch. No reveal-to-show pattern.
- **HIGH-20** — TOTP secret displayed and copyable in plaintext after setup (`settings/two-factor/page.tsx:282-294`).

### F.3 Medium / Low

- **MED-01** — `apps/admin/src/lib/auth.ts:358-363` setInterval at module load. Serverless warning.
- **MED-02** — Sidebar (`sidebar.tsx:56-111`) is hard-coded; VIEWER sees `/runtime-config`, `/team`, `/backups` route enumeration.
- **LOW-05/06/07** — `confirm()`/`window.confirm()` used for destructive ops instead of `PasswordConfirmModal`.

### F.4 Audit trail coverage

Logged: LOGIN, LOGIN_FAILED, LOGIN_BLOCKED; user soft-delete/restore via API; password-confirm step-up via `trackSensitiveOp`.

NOT logged: IP rule add/delete/toggle, email-template create/edit/delete, notifications broadcast, bulk user delete per-id audit, CSV exports (users/logs/reports), backup downloads.

### F.5 PII / sensitive-data exposure

- Dashboard list, Users list, Subscriptions list mask via `maskEmail`/`maskProviderIdentifier`.
- Users CSV export, User detail page, Logs list/export, Support ticket detail expose raw PII.
- TOTP secret rendered plaintext (HIGH-20).

### F.6 Destructive-action safeguard inconsistency

Some ops use `PasswordConfirmModal`, some `window.confirm`, some have no client-side prompt. Admins acclimate to the former and click through the latter.

---

## G. Mobile Audit

### G.1 Route inventory & auth

`AuthGuard` in `apps/mobile/app/_layout.tsx:84-216` redirects unauth to `/(auth)/sign-in` for any non-`(auth)`/`oauth`/`reset-password`/`blog` segment. ~30 routes covered.

### G.2 Critical / High findings

- C-22, C-23, C-25, C-26 covered above.
- **G-C5** — Android `<application>` lacks `android:usesCleartextTraffic="false"` and `networkSecurityConfig` (`AndroidManifest.xml:1-13`). Defense-in-depth gap.
- **G-H2** — `apps/mobile/app/services/[id].tsx:146,152,158` and `apps/mobile/app/custom-providers/[id].tsx:147-149` open URLs without `Linking.canOpenURL` and without https normalization. Provider page (`providers/[id].tsx:159-178`) does normalize — apply same pattern.
- **G-H9** — `apps/mobile/src/lib/mobile-oauth-handoff.ts:80-98`: if SecureStore returns null on `consumePkceVerifier(state)`, the request still posts `{ code }` without verifier.
- **G-H12** — Data export (`apps/mobile/app/settings/export.tsx:79-101`) writes plaintext to `FileSystem.cacheDirectory` and `Share.share`s before delete.
- **G-H13** — Same file: if `Share.share` throws, cleanup is skipped (no `finally`).

### G.3 iOS App Store readiness

| Check | Status |
|---|---|
| `bundleIdentifier`, `buildNumber`, `version` | PASS |
| Adaptive icon, splash, supportsTablet | PASS |
| `ITSAppUsesNonExemptEncryption` | **FAIL** (C-26) |
| `NSFaceIDUsageDescription` | PASS |
| Other `NS*UsageDescription` | N/A |
| `NSUserTrackingUsageDescription` (ATT) | N/A |
| Associated Domains for Universal Links | PASS |
| Privacy Manifest (`PrivacyInfo.xcprivacy`) | **FAIL** (C-25) |
| ATS — `NSAllowsArbitraryLoads` | PASS |
| `UIBackgroundModes` minimal | PASS |

### G.4 Google Play readiness

| Check | Status |
|---|---|
| `applicationId`, `versionCode`/`versionName` | PASS |
| Adaptive icon, splash | PASS |
| Permissions reviewed | PASS — INTERNET, RECEIVE_BOOT_COMPLETED, VIBRATE, BILLING |
| `usesCleartextTraffic` set false | **FAIL** (G-C5) |
| `networkSecurityConfig` present | **FAIL** |
| `targetSdkVersion ≥ 34` | PASS (Expo SDK 54 → 35) |
| `debuggable` in release | PASS |
| Release signed with non-debug key | **FAIL** locally (C-22) — EAS overrides |
| `allowBackup="false"` + SecureStore exclusion | PASS |
| Deep-link `autoVerify` | PASS |
| Proguard / R8 minification | **FAIL** (C-23) |

### G.5 Token / session storage

- JWT exclusively in `expo-secure-store` (`apps/mobile/src/lib/auth.ts:1-26`, `auth-store.ts:16-89`). Verified zero `AsyncStorage.setItem` with token-related keys.
- Sign-out wipes via `clearSession` (`auth-store.ts:58-61`) and `clearSensitiveLocalState` (`local-cleanup.ts:16-20`).
- Backup exclusion: `secure_store_backup_rules.xml`, `secure_store_data_extraction_rules.xml`.
- PKCE verifier in SecureStore with 10-min TTL + single-use deletion (`pkce.ts:89-128`).

### G.6 Permission justification

- All 4 declared Android perms (INTERNET, RECEIVE_BOOT_COMPLETED, VIBRATE, BILLING) justified.
- All dangerous perms (CAMERA, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE) explicitly blocked in `app.json:95-99`.

### G.7 Network security

- Base URL: `EXPO_PUBLIC_API_URL` (eas prod = `https://locateflow.com/api`). `enforceProductionApiUrl` (`api.ts:57-62`) rewrites non-https in non-`__DEV__`.
- Timeouts: 20s default (`api.ts:85`), 12s for `/api/auth/me`.
- 401 → clearSession.
- No certificate pinning (acceptable for first release).
- No WebView usage.

### G.8 Deep link & OAuth

- `parseOAuthUrl` (`mobile-oauth.ts:52-82`) whitelists `locateflow:`, `exp:`, `exps:`, plus three production hosts.
- Replay protection: in-memory `exchangeByCode` map + AsyncStorage `handledOAuthCodes` ring buffer.
- PKCE: `mobile-oauth.ts:187-193` generates pair; verifier in SecureStore (10-min TTL, single-use).

### G.9 Build / EAS

- 5 profiles in `eas.json`. Production: `autoIncrement: true`, `submit.production.android.track: "internal"`.
- No credentials block — EAS-managed.
- Hermes enabled, new architecture enabled, edge-to-edge enabled.

### G.10 Mobile UX

- Reusable `LoadingScreen`, `ErrorState`, `EmptyState` patterns used consistently.
- AppLockGate (`AppLockGate.tsx:22, 79-95`) with biometric overlay on resume from background ≥15s.
- Splash screen held until i18n + fonts ready (`_layout.tsx:295-298`).

---

## H. DB / Shared Audit

### H.1 Schema inventory (selected)

50+ Prisma models. Notable:
- `User` (line 12): MFA via `mfaSecret @db.Text` (encrypted at app layer), backup codes as JSON string.
- `Subscription` (211): plan/status/provider/platform/accessType all `VarChar` not enums; `firstChargeAmount Float?` (C-4).
- `Address` (389): lat/lng/placeId/formattedAddress in plaintext while sister `Service` PII fields are encrypted.
- `BlogPost` (1506): only model using a real Prisma `enum`.
- `MoveTask` (701): `(userId, idempotencyKey)` unique pair.
- `AdminAuditLog` (1057): `adminUserId String?` + `onDelete: SetNull`.

### H.2 Critical (see C-4/C-5/C-6/C-19/C-20/C-21 above)

- **H-C5/C6** — `seed.ts` references dropped `Badge` model; no production guard on any seed file.
- **H-C7** — `_migrate-to-mysql.ts:24-38` enumerates dropped tables. No `process.env.NODE_ENV` guard.

### H.3 High findings

- **H-H3** — Status fields use free-text VarChar instead of enums: `Subscription.plan/status/provider/platform/accessType`, `MoveTask.status/source/confidence`, `MovingPlan.status`, `SupportTicket.status/category/priority`, `AdminUser.role`. Drift surfaces (`packages/shared/src/constants.ts:50-58 normalizeMovingPlanStatus` is a workaround for `"CANCELLED"` vs `"CANCELED"`).
- **H-H7** — `audit-redaction.ts:67-99` partial-key matcher: `endsWith("key")` over-redacts (`keyword`, `keystroke`, `monkey`, `survey`); missing categories include `firstName`, `lastName`, `name`, `birthDate`, `dob`, `creditCard`, `cvv`, `iban`, `ipAddress`.
- **H-H8** — `sentry-redaction.ts:22-23` regex lacks word boundaries — `resetCount` matches `reset`. Missing `creditCard`, `cvv`, `pan`, `iban`, `bsn`, `nin`, `dob`, `birthdate`, `licenseplate`, `passport`, `address`.
- **H-H9** — `BlogPost.author` and `BlogPost.category` (line 1531-1534) lack explicit `onDelete`.
- **H-H10** — `User.dataConsents` cascades on user delete (migration `20260501000000`). GDPR/CCPA proof-of-consent disappears with the user.
- **H-H11** — `seed-admin.ts` writes plain SUPER_ADMIN with `mfaEnabled: false`. No flow forces MFA on first login.
- **H-H17** — Schema lacks `CHECK ((providerId IS NULL) <> (customProviderId IS NULL))` on `Service` and `MoveTask`.
- **H-H18** — `EmailTemplate.createdBy/updatedBy`, `FeatureFlag.createdBy/updatedBy`, `HelpArticle.createdBy/updatedBy` are `String?` with no FK constraint.
- **H-H20** — `RateLimitLog.windowEnd` is unindexed; pruning typically scans by `windowEnd < now`.

### H.4 Encryption analysis

- AES-256-GCM with 16-byte IV, 16-byte auth tag (`encryption.ts:12-15`). IV from `randomBytes(16)` per encryption.
- HMAC-SHA256 backup integrity uses **the same key** as encryption (`signBackup`/`verifyBackupSignature` lines 195-216). Best practice is HKDF-derived separate keys.
- IV is 16 bytes; NIST SP 800-38D recommends 12 bytes for GCM.
- No key-rotation versioning: `enc_v1:` prefix has no `keyId`. Once the key rotates, old rows are unreadable unless every historical key is preserved.

### H.5 Audit redaction coverage

Covered: auth, financial, addresses, contact PII, env-secret keys.
Gaps: `firstName`/`lastName`/`name`, `birthDate`/`dob`, `creditCard`/`cvv`/`iban`, `ipAddress` (partial), `body`/`payload`.

### H.6 Validator coverage / drift

`validators.ts` covers 9 schemas. Missing: `MoveTask`, `SupportTicket` create/reply, `Notification`, `WaitlistSignup`, `OAuthAccount`, `RuntimeConfigEntry` write, `BlogPost` create/update, `PushDevice`, `AcquisitionCampaign`, `DataConsent`.

No catastrophic regex backtracking risk found.

### H.7 Business-logic library issues

- **H-B1/B2** — `migration-engine.ts:151-165 evaluateCondition` and `relocation-checklist.ts:80-94 evaluateCondition` both return `true` on unknown condition strings. A typo becomes always-true.
- **H-B3** — `move-task-lifecycle.ts:65-82 buildMoveTaskLifecyclePatch` doesn't clear stale `completedAt`/`dismissedAt` on REOPEN.
- **H-B7** — `provider-coverage.ts expandCoverageRows` doesn't deduplicate; combined with no DB unique constraint on `(providerId, state, zipPrefix, zipExact)` (line 851-865), duplicates can land.

### H.8 Soft-delete & optimistic-lock

- 9 models declare `deletedAt`. Soft-delete extension is opt-in (C-5).
- `findUnique` patch (lines 61-67) is non-atomic.
- `findUniqueOrThrow` is **not patched** (only `findFirstOrThrow`); `groupBy`/`aggregate` not patched.
- Optimistic-lock helper (`packages/db/src/optimistic-locking.ts:24-29`) is loosely typed via `as any` casts.
- Three models have `version Int @default(1)`: `ServiceProvider`, `MovingPlan`, `Subscription`.

### H.9 Currency / decimal safety

| Field | Type | File:line |
|---|---|---|
| `Subscription.firstChargeAmount` | `Float?` | schema.prisma:239 |
| `Service.monthlyCost` | `Float?` | schema.prisma:461 |
| `Budget.plannedIncome` | `Float?` | schema.prisma:552 |
| `Budget.actualIncome` | `Float?` | schema.prisma:553 |
| `Budget.plannedExpenses` | `Float?` | schema.prisma:554 |
| `Budget.actualExpenses` | `Float` | schema.prisma:555 |
| `Budget.savingsRate` | `Float?` | schema.prisma:559 |

All should migrate to `Decimal @db.Decimal(12,2)` or integer cents.

---

## I. Config / Build / Deploy Audit

### I.1 Layout

Workspace: pnpm + Turborepo. Apps web/admin/mobile + packages db/shared. Single CI workflow. Dockerfiles: root `Dockerfile` (DigitalOcean App Platform) plus `docker/{web,admin,migrate,dev}.{prod}.Dockerfile`. Compose: dev, prod, DO overlay. 25+ scripts under `scripts/`.

### I.2 Critical findings

- C-8, C-9, C-10, C-11, C-12, C-13, C-14 covered above.
- **I-C6** — `.github/workflows/ci.yml:70-71` `pnpm audit --audit-level=high` is the only dep-vuln gate. Moderate-severity issues are not blocked.
- **I-C7** — `docker-compose.prod.yml:74-83, 141-152`: web and admin services have `restart: unless-stopped` but no compose-level `healthcheck`. Admin Dockerfile healthcheck targets `/login` which returns 200 even when DB is broken.

### I.3 High findings

- **I-H1** — Web `next.config.js:46-89` lacks `Permissions-Policy` (admin sets it).
- **I-H2** — CSP delegated to middleware; no static fallback at `headers()`.
- **I-H4** — Stripe/Resend secrets passed as env vars (`docker-compose.prod.yml:108-112,115-116`).
- **I-H5** — MySQL root password in env.
- **I-H7/I-H8** — Workflow lacks SHA-pinning and `permissions:` block (defaults to repo write scope).
- **I-H10** — `pnpm install --frozen-lockfile` without `pnpm audit signatures`.
- **I-H13** — Playwright runs only on push to main, never on PRs.
- **I-H14** — Caddy lacks per-route `request_body { max_size 1MB }` and global timeouts.
- **I-H16** — Caddyfile sets HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy but **no CSP at the edge**.
- **I-H17** — Admin app does not always emit `X-Robots-Tag: noindex, nofollow, noarchive`.

### I.4 Medium findings

- **I-M11** — `apps/web/tailwind.config.ts:5-7` content scope `./src/**/*.{ts,tsx}` doesn't include `mdx`.
- **I-M14** — `.env.example:34, 76, 80, 95, 96, 100` placeholder PEM blocks.
- **I-M15** — `.env.production.example:108-114` references `MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY` not present in `.env.example`.
- **I-M17** — `tracesSampleRate: 0.1` prod with no `release:` field.
- **I-M18** — `next.config.js` not wrapped with `withSentryConfig` — source maps not auto-uploaded.
- **I-M20** — `vercel.json:1-36` declares crons but every `/api/cron/*` route must verify `Authorization: Bearer ${CRON_SECRET}` itself.
- **I-M21** — 16+ services in `docker-compose.prod.yml` with no `read_only: true` filesystem.
- **I-M24** — Web `tsconfig.json:3` `target: ES2017`; admin is `ES2020`.
- **I-M25/M26** — `packages/db` and `packages/shared` emit `dist/` but `package.json` `main`/`types` point at `src/index.ts`.

### I.5 Low findings

- **I-L5** — `.dockerignore:14-17` doesn't explicitly list `.env.production`.
- **I-L9** — `turbo.json:3 globalDependencies: ["**/.env.*local"]` — only invalidates on local env changes.
- **I-L13** — `package.json:28-32 docker:reset` runs `docker compose down -v`. Single typo → data loss.
- **I-L15** — `docker/ofelia.ini:11-97` 17 cron jobs concentrate `Authorization: Bearer $CRON_SECRET`.

### I.6 Next.js security headers / CSP

- Web (`apps/web/next.config.js:46-89`): X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, HSTS preload. Conditional `X-Robots-Tag` for staging-like.
- Admin (`apps/admin/next.config.js:14-39`): same set + `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Both delegate CSP to middleware; no static fallback.
- Caddy edge (`docker/Caddyfile:48-51, 75-78, 105-108, 141-143`): HSTS, X-Frame-Options DENY, etc. **No CSP** at edge. **Strips `CF-Connecting-IP`/`X-Real-IP`/`X-Forwarded-For`/`X-Vercel-Forwarded-For`** before forwarding (lines 35-38, 63-66, 93-96, 124-127) — prevents IP-spoof rate-limit bypass.

### I.7 Sentry config

- `apps/{web,admin}/sentry.{client,server,edge}.config.ts` delegate to `lib/sentry-options.ts`.
- `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN`; `environment: process.env.NODE_ENV` (should use `APP_ENV`); `tracesSampleRate: 0.1` prod / 1.0 dev; `sendDefaultPii: false`; `beforeSend` strips request data/cookies/auth/cookie headers, user.email/ip_address.
- No `release:` field; no `withSentryConfig` wrapper. Source maps not uploaded → unreadable stack traces.

---

## J. Cross-Cutting Themes

### J.1 IP resolution & rate-limit consistency
At least four `resolveClientIP` implementations: `apps/web/src/lib/rate-limit.ts:260-279`, `apps/web/src/lib/rate-limit-policy.ts:369-385`, `apps/admin/src/middleware.ts:25-41`, `apps/admin/src/app/api/auth/login/route.ts:160-176`, plus inline `request.headers.get("x-forwarded-for")?.split(",")[0]` in `/api/waitlist`, `/api/internal/impersonate`. Each has slightly different ordering. Caddy compensates by stripping incoming IP headers, but only protects the self-hosted path. **Fix:** export a single `resolveClientIP(request)` from `@locateflow/shared`.

### J.2 Step-up authentication discipline
Step-up consistently applied in admin destructive routes but the 15-min process-local grace cache (C-2) undermines it. Same anti-pattern in user-side `account_delete` (raw `rateLimit` rather than policy with `failClosed:true`).

### J.3 Schema enum drift
Only `BlogPost.status` is a real Prisma enum. Drift surfaces in helper functions like `normalizeMovingPlanStatus` that exist solely to bridge `"CANCELLED"` vs `"CANCELED"`.

### J.4 Plaintext PII asymmetry
`Service.{accountNumber,username,phone,email}` are encrypted; `Address.{latitude,longitude,placeId,formattedAddress}` are plaintext. An adversary with DB read access can geolocate every user.

### J.5 Audit-trail asymmetry
LOGIN events audited; backup downloads, CSV exports, IP-rule mutations, email-template edits, GDPR Reject, notifications broadcast are not. Audit story is incomplete in exactly the highest-impact directions.

### J.6 Inconsistent destructive-action UX in admin
Some destructive ops use `PasswordConfirmModal`, some use `window.confirm`, some have no client-side prompt.

### J.7 Internal-secret blast radius
`INTERNAL_WEBHOOK_SECRET` is shared across admin `/api/internal/security-event`, `/api/internal/ip-rules`; web `/api/internal/impersonate`, `/api/internal/ip-rules`, `/api/internal/rate-limit-log`; `/api/blog/revalidate`. Compromising it gives attackers CSRF-bypass + rate-limit-bypass + body-size-bypass + log-forgery + cache-invalidation across both apps. **Fix:** split into per-purpose secrets.

### J.8 Float currency drift
Multiple Float currency columns (C-4) feed into reconciliation jobs (`/api/cron/stripe-reconcile`) that compare against Stripe in cents. Drift over months will diverge dashboards from real revenue.

---

## K. Prioritized Remediation Plan

### K.1 Highest-priority (block release / security-critical)

1. **C-1 + C-18** — Convert `(admin)/runtime-config`, `/security`, `/security/dashboard`, `/team`, `/backups` to server components calling `requireRole("SUPER_ADMIN")` or `requirePermission(...)` before render.
2. **C-2** — Move step-up password grace cache to Redis with strict per-admin lockout, scoped by `(adminId, operation)`.
3. **C-3** — Extend MFA enrollment requirement to all admin roles.
4. **C-7** — Replace third-party QR code service with in-bundle generator (`qrcode` npm package).
5. **C-9** — Remove `ENV USER_JWT_SECRET=...` placeholders from `docker/{web,admin}.prod.Dockerfile`. Use `--mount=type=secret`.
6. **C-8** — Delete `apps/web/pnpm-lock.yaml`.
7. **C-10** — Standardize Docker base on `node:22-bookworm-slim`.
8. **C-11** — Replace Ofelia docker-socket cron with Vercel Cron.
9. **C-12** — Bind dev MySQL to `127.0.0.1`; drop default credentials.
10. **C-13** — Replace `**.r2.*` wildcards with specific account hostnames.
11. **C-14** — Pin every Docker image tag.
12. **C-17** — Bind backup signatures to environment fingerprint.
13. **C-22 + C-23** — Real release keystore + enable R8 minification.
14. **C-25 + C-26** — `expo prebuild --platform ios`, add `PrivacyInfo.xcprivacy`, set `ITSAppUsesNonExemptEncryption: false`.

### K.2 High-priority (data integrity, operational, supply chain)

15. **C-4 + C-21** — Migrate currency columns to `Decimal @db.Decimal(12,2)` or integer cents.
16. **C-5** — Ship `dbWithSoftDelete` as default; rewrite `findUnique` patch as `findFirst`; patch `findUniqueOrThrow`/`groupBy`/`aggregate`.
17. **C-6** — Delete the `Badge` block from `seed.ts`; add production guard to all seed files.
18. **C-19** — Throw on missing `FIELD_ENCRYPTION_KEY` in non-production unless explicit dev flag.
19. **C-20** — Atomic `UPDATE AcquisitionCampaign ... WHERE redemptionCount < maxRedemptions`.
20. **C-24** — Pin all GitHub Actions to commit SHAs.
21. **C-2 (rate-limit migration)** — Migrate every sensitive write route off raw `rateLimit()` to `enforceRateLimitPolicy` with `failClosed:true` (in-flight branch).
22. **C-29** — Apply rate-limit middleware to admin `/api/*` mutations.
23. **C-15 + C-16** — Apply minimum rate-limit and body-size enforcement to internal and cron routes.
24. **C-27** — Replace FNV-1a bucketing with SHA-256 prefix.
25. **C-28** — Reject sessions without a fingerprint.

### K.3 Medium-priority (defense in depth, audit)

26. Tighten CSP `style-src` (drop `'unsafe-inline'`) and `img-src` (drop `https:`); add static fallback CSP at `headers()` level and at Caddy edge.
27. Read cookie domain dynamically in `useCurrentUser.signOut()`.
28. Add audit-log entries on every CSV export, backup download, IP-rule mutation, GDPR action, email-template edit, notifications broadcast.
29. Replace every `window.confirm()` for destructive admin actions with `PasswordConfirmModal`.
30. Add `withSentryConfig` wrapper + `release: process.env.NEXT_PUBLIC_GIT_SHA`.
31. Convert status `VarChar` columns to native Prisma enums.
32. Encrypt `Address.{latitude,longitude,placeId,formattedAddress}`.
33. Fix the `findUnique` non-atomic soft-delete leak.
34. Add `CHECK ((providerId IS NULL) <> (customProviderId IS NULL))` constraints.
35. Add `onDelete: Restrict` (or `SetNull`) explicitly on `BlogPost.author` and `BlogPost.category`.
36. Make `User.dataConsents` userId nullable + `onDelete: SetNull`.
37. Mask email + IP in admin CSV exports for non-SUPER_ADMIN.
38. Move sidebar role-filtering server-side.
39. Add `usesCleartextTraffic="false"` and `networkSecurityConfig` to mobile Android.
40. Normalize + `canOpenURL`-validate URLs in mobile services/custom-providers screens.
41. Mobile data export: move cleanup to `finally` block.
42. Tighten `/api/blog/revalidate` HMAC window to 60s + add idempotency.
43. Add zod schemas to `MoveTask`, `SupportTicket`, `Notification`, `WaitlistSignup`, `RuntimeConfigEntry`, `BlogPost`, `PushDevice`, `AcquisitionCampaign`, `DataConsent` write paths.

### K.4 Low / hygiene

44. Re-encode source files to UTF-8 to fix mojibake (E-H25).
45. Replace `<Link><button>` antipattern across the (app) tree.
46. Add abort controllers to all client-side `useEffect` fetches; standardize 401 handler in a `fetchWithAuth` helper.
47. Translate `(app)/settings/**`, `support/**`, `budget/**`, `notifications/**`, `onboarding/**` page strings via next-intl.
48. Add `Permissions-Policy` header to `apps/web/next.config.js`.
49. Always emit `X-Robots-Tag: noindex, nofollow, noarchive` for admin.
50. Standardize TypeScript `target` across web/admin/db/shared.
51. Sync `.env.example` and `.env.production.example`.
52. Centralize `lib/validators.ts` usage in client pages.
53. Add `permissions: contents: read` at workflow root in `.github/workflows/ci.yml`.
54. Replace wget healthchecks with node-native probes.
55. Run Playwright on PRs against a smaller subset.
56. Pin Caddy and supporting images to specific minor.
57. Set `read_only: true` + `tmpfs:` for stateless services in `docker-compose.prod.yml`.

---

## L. Closing Notes

This is a defense-in-depth codebase with most of the plumbing in place: signed/replay-protected webhooks, encrypted-at-rest backups, JWT + DB session + fingerprint, CSRF + Origin + Sec-Fetch-Site, audit logs on most admin actions, MFA support, server-side authorization helpers (`requireAdmin`, `requirePermission`), and a sound rate-limit policy matrix. The frequent helper consolidation reduces drift.

The branch under audit, `fix/rate-limit-auth-protection`, is closing exactly the legacy gap the inventory shows: per-route raw `rateLimit()` calls in sensitive write paths bypass the new policy matrix's `failClosed:true` semantic. Completing that migration plus the admin-middleware rate-limit work resolves the most frequently triggered remediation items in §K.

The biggest unaddressed risks are:
1. Admin pages relying on API-only authorization (CRIT-01/02/18 + C-1).
2. The 15-minute process-local step-up grace cache (C-2).
3. MFA only enforced for SUPER_ADMIN (C-3).
4. Float-currency storage (C-4) and plaintext geo-PII (Address fields).
5. Production Dockerfile / image discipline (C-9, C-10, C-11, C-13, C-14).
6. Mobile release-build + iOS privacy artifacts (C-22, C-23, C-25, C-26).

These are addressable in 2-3 focused sprints without architectural rewrites.

---

*End of report. ~340 evidence-based findings across the six audited modules. Anything not verifiable in code is flagged "low confidence" or "not verified in code."*
