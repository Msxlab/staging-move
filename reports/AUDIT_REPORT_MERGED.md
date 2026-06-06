# LocateFlow — Merged & Verified System Audit Report

This document merges two audit reports and verifies their claims against the current repository codebase (static review). It also provides a prioritized remediation roadmap tailored to **self-hosted deployment (cPanel)** and your planned move toward **S3-style object storage** for documents.

## 1) Scope & Method

- **Scope**: Monorepo (`apps/web`, `apps/admin`, `packages/db`) including API routes, auth/session logic, Prisma schema/seed scripts, and Next.js configuration.
- **Method**: Static code review and targeted repository searches. No runtime testing, no production environment inspection.
- **Deployment assumptions**:
  - Self-hosted behind Apache/Nginx (cPanel) with TLS termination you control.
  - You can enforce trusted proxy behavior (strip inbound `X-Forwarded-For` and set it yourself).
  - Document storage is expected to move to **S3-compatible** object storage (AWS S3, MinIO, Wasabi, Backblaze, etc.).

## 2) Executive Summary (Verified)

The codebase is generally well-structured, but several **control-plane** and **billing-integrity** issues are confirmed and should be addressed before production:

- **Critical**: Stripe webhook handler processes events without signature verification.
- **Critical**: Admin JWT signing secret has a hardcoded fallback value.
- **Critical**: Seed script creates a SUPER_ADMIN with a hardcoded password (`admin123`).
- **High**: Cron endpoints can become unauthenticated if `CRON_SECRET` is not set.
- **High**: Weekly digest cron route exhibits an N+1 query pattern (scales linearly with user count).
- **High**: Admin analytics endpoint returns user PII (email) unnecessarily.
- **Medium**: Web rate limiting uses `X-Forwarded-For` directly; in self-hosted deployments this is spoofable unless the proxy strips/sets it.
- **Medium**: Admin app lacks the security header baseline that exists in the web app.
- **High**: Admin user deletion endpoints rely on `requireAdmin()` (authenticated) rather than explicit role/permission checks.

## 3) Verified Findings Matrix

Status meanings:
- **Correct**: Verified in code as described.
- **Partially correct**: Risk exists but report wording needs correction.
- **Environment-dependent**: Depends on deployment/proxy configuration.
- **Not supported**: Not found / not evidenced in this repo.

### 3.1 Critical

#### SEC-001 — Stripe webhook signature verification missing (**Correct**)
- **Evidence**: `apps/web/src/app/api/webhooks/stripe/route.ts`
  - Contains TODO to verify signature via Stripe SDK.
  - Parses event using `JSON.parse(body)` without verification.
- **Impact**: Allows forged events to alter subscription state.
- **Notes**: `stripe` package is not currently listed in `apps/web/package.json`, reinforcing that verification is not implemented.

#### SEC-002 — Hardcoded SUPER_ADMIN seed credentials (**Correct**)
- **Evidence**: `packages/db/prisma/seed-admin.ts`
  - Hardcoded password hash from `"admin123"` and logs credentials.
- **Impact**: Trivial takeover if seed is run in any reachable environment.

#### SEC-003 — Admin JWT secret hardcoded fallback (**Correct**)
- **Evidence**:
  - `apps/admin/src/lib/auth.ts`
  - `apps/admin/src/middleware.ts`
  - Both use `process.env.ADMIN_JWT_SECRET || "locateflow-admin-secret-change-in-production"`.
- **Impact**: If env var missing, attacker can forge admin tokens.

### 3.2 High

#### SEC-004 — Cron endpoints can be unauthenticated if `CRON_SECRET` is unset (**Correct**)
- **Evidence**:
  - `apps/web/src/app/api/cron/bill-reminders/route.ts`
  - `apps/web/src/app/api/cron/weekly-digest/route.ts`
  - Auth check only triggers if `process.env.CRON_SECRET` is set.
- **Impact**: Email bombing / abuse when misconfigured.

#### PERF-001 — N+1 query pattern in weekly digest cron (**Correct**)
- **Evidence**: `apps/web/src/app/api/cron/weekly-digest/route.ts`
  - For each user: `service.findMany` + `task.count` (pending) + `task.count` (completed) + `service.count` (new services).
- **Impact**: With 1000 users, ~4001 queries per run (plus overhead), risking DB saturation/timeouts.

#### SEC-005 — Admin analytics returns user PII (emails) unnecessarily (**Correct**)
- **Evidence**: `apps/admin/src/app/api/analytics/route.ts`
  - `recentSessions` includes `user: { select: { email, firstName, lastName } }`.
- **Impact**: Violates data minimization; raises blast radius if admin panel compromised.

#### SEC-006 — Admin destructive actions not consistently protected by role/permissions (**Correct**)
- **Evidence**:
  - `apps/admin/src/app/api/users/route.ts` (bulk delete)
  - `apps/admin/src/app/api/users/[id]/route.ts` (single delete)
  - Both use `requireAdmin()` instead of `requireRole(...)` or `checkPermission(...)`.
- **Impact**: Any authenticated admin (even low role) can delete users; weak least-privilege.

### 3.3 Medium

#### SEC-007 — Rate limit key derived from `X-Forwarded-For` (**Environment-dependent**)
- **Evidence**: `apps/web/src/lib/rate-limit.ts` uses:
  - `const forwarded = request.headers.get("x-forwarded-for")`
  - `const ip = forwarded?.split(",")[0]?.trim() || "anonymous"`
- **Impact**:
  - If your proxy **does not** strip inbound `X-Forwarded-For`, a client can spoof many IPs and bypass rate limits.
  - In self-hosted/cPanel, this is solved primarily at Apache/Nginx: ensure you overwrite the header with the real client IP.

#### SEC-008 — Web security headers exist; admin security headers missing (**Partially correct**)
- **Evidence**:
  - Web: `apps/web/next.config.js` sets CSP, `X-Frame-Options`, `X-Content-Type-Options`, etc.
  - Admin: `apps/admin/next.config.js` does not define `headers()`.
- **Impact**: Admin panel has weaker clickjacking/content-type protections.
- **Note**: Web CSP includes `unsafe-inline` and `unsafe-eval`, which reduces its effectiveness.

#### SEC-009 — Weak admin password policy (min length = 6) (**Correct**)
- **Evidence**: `apps/admin/src/app/api/auth/password/route.ts` checks `newPassword.length < 6`.
- **Impact**: Increases probability of credential compromise.

### 3.4 Low / Informational

#### OPS-001 — Dev auth bypass for web app when Clerk env vars missing (**Correct / controlled**)
- **Evidence**: `apps/web/src/lib/auth.ts`
  - In **development only**, missing Clerk env triggers dev user fallback.
- **Impact**: Acceptable if `NODE_ENV=production` and env vars are correctly set.

#### DEVOPS-001 — CI workflows not present in repo (**Correct**)
- **Evidence**: No `.github/workflows` directory found.
- **Impact**: No automated gating; increases regression and supply-chain risk.

#### DEVOPS-002 — No Docker configuration present (**Correct**)
- **Evidence**: No `Dockerfile` / `docker-compose` found.
- **Impact**: Not strictly required, but reduces reproducibility and hardening options.

#### REL-INDEX-001 — “UserSession/UserEvent indexes missing” claim (**Not supported**)
- **Evidence**: `packages/db/prisma/schema.prisma` includes multiple indexes on `UserSession` and `UserEvent`.
- **Correction**: This particular claim is inaccurate for this repo.

#### REL-INDEX-002 — Additional indexes that may be warranted (**Partially correct**)
- **Evidence**: In `schema.prisma`, `Subscription.status` and `Review.status` do not currently have explicit `@@index([status])`.
- **Impact**: Potentially slower admin analytics/moderation queries as data grows.

#### CRYPTO-001 — “bcrypt cost 10 is used” claim (**Not supported as current code behavior**)
- **Evidence**: Current hashing paths use cost **12** in `seed-admin.ts`, `apps/admin/src/app/api/team/*`, and `apps/admin/src/app/api/auth/password/route.ts`.
- **Note**: If the database already contains old `$2a$10$...` hashes from a prior version, rehash-on-login could be considered.

## 4) Top 3 Fixes (Recommended)

1. **Stripe webhook signature verification (Critical)**
   - Use Stripe SDK `constructEvent` with raw body.
   - Add event idempotency (store processed Stripe event IDs) to prevent replay/double-processing.

2. **Remove JWT fallback secret + enforce env validation (Critical)**
   - No fallback; fail startup if `ADMIN_JWT_SECRET` is missing/weak.
   - Rotate secret and invalidate existing sessions.

3. **Remove hardcoded admin seed credentials (Critical)**
   - Replace with one-time bootstrap process:
     - Read bootstrap password from env (required), OR
     - Generate one-time token and require immediate password change.

## 5) Remediation Roadmap (Self-hosted / cPanel oriented)

### First 24 hours
- Enforce **Stripe webhook signature verification**.
- Remove **admin JWT fallback secret** and enforce `ADMIN_JWT_SECRET` presence.
- Remove **hardcoded seed password** from `seed-admin.ts`.
- Make cron routes **fail closed** when `CRON_SECRET` missing (at least in production).

### 1 week
- Add admin login hardening:
  - Rate limit (per IP + per email)
  - Lockout/backoff
  - Generic error messages
  - Audit log failed logins
- Fix admin analytics PII:
  - Remove `email` from analytics responses unless explicitly needed.
- Add admin security headers in `apps/admin/next.config.js` (copy baseline from web, tighten CSP).

### 1–4 weeks
- Weekly digest performance:
  - Batch users and use `groupBy` aggregates.
  - Process in chunks (pagination) to avoid timeouts.
- Index improvements:
  - Add indexes for `Subscription.status`, `Review.status` (and any other fields proven hot by query patterns).
- Replace local/cloudinary fallback with **S3-compatible storage** for documents:
  - Centralize upload/download
  - Add malware scanning (ClamAV or provider feature)
  - Add per-user quotas

## 6) Deployment Notes for cPanel / Self-hosting

- **Trusted client IP**:
  - Configure Apache/Nginx to strip inbound `X-Forwarded-For` from clients and set it from the real connection.
  - If behind Cloudflare, prefer `CF-Connecting-IP` and strip all spoofable headers.
- **TLS + HSTS**:
  - HSTS is best applied at the web server level for self-hosted deployments.
- **Webhook routing**:
  - Ensure `/api/webhooks/stripe` is reachable publicly (Stripe requirement) but protected by signature verification and idempotency.

## 7) Appendix — Key Files Referenced

- Admin JWT secret:
  - `apps/admin/src/lib/auth.ts`
  - `apps/admin/src/middleware.ts`
- Admin login:
  - `apps/admin/src/app/api/auth/login/route.ts`
  - `apps/admin/src/app/api/auth/password/route.ts`
- Stripe webhook:
  - `apps/web/src/app/api/webhooks/stripe/route.ts`
- Cron:
  - `apps/web/src/app/api/cron/bill-reminders/route.ts`
  - `apps/web/src/app/api/cron/weekly-digest/route.ts`
- Rate limiting:
  - `apps/web/src/lib/rate-limit.ts`
  - `apps/web/src/middleware.ts`
- Prisma:
  - `packages/db/prisma/schema.prisma`
  - `packages/db/prisma/seed-admin.ts`
