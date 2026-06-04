# System Audit Report — LocateFlow

- **Date:** 2025-02-12
- **Auditor:** Staff+ Engineer / AppSec Review (automated code audit)
- **Scope:** Full monorepo — `apps/web`, `apps/admin`, `packages/db`, all config files
- **Tooling/Approach:** Static source-code review of all API routes, auth modules, middleware, schema, configuration files, dependency manifests, and infrastructure configs. No dynamic testing performed.
- **Limitations:**
  - `.env` and `.env.local` files are gitignored; live secret values could not be inspected.
  - No access to production infrastructure, cloud console, or secrets manager.
  - No lock-file deep dependency vulnerability scan (no `pnpm audit` run).
  - No runtime/dynamic testing (DAST) performed.
  - No access to Clerk dashboard configuration.

---

## Executive Summary

LocateFlow is a SaaS relocation management platform built as a pnpm/Turborepo monorepo with two Next.js 15 apps (web on port 3000, admin on port 3001) sharing a Prisma/SQLite database. The codebase is functionally rich (~50+ pages, 30+ API routes per app) but has **several critical and high-severity security issues** that must be addressed before any production deployment.

### Key Outcomes

1. **Critical auth bypass in dev mode** — the web app ships a hard-coded `dev-user` authentication bypass that activates whenever Clerk env vars are missing, with an incomplete production guard.
2. **Admin panel has no rate limiting** — login endpoint has zero brute-force protection; no CSRF mitigation on admin API mutations.
3. **Cron endpoints unprotected when `CRON_SECRET` is unset** — the guard is a no-op if the env var is absent.
4. **Referral POST endpoint is fully unauthenticated** — allows anonymous click inflation.
5. **Path traversal risk in document deletion** — `fileUrl` from DB is joined to `process.cwd()` without sanitization.
6. **Admin panel has no security headers** — missing CSP, X-Frame-Options, HSTS, etc.
7. **Weak password policy** — admin passwords require only 6 characters for changes (seed requires 12).
8. **SQLite in production is not viable** — no connection pooling, no concurrent write support, no backup strategy.
9. **No CI/CD pipeline, no automated tests in CI, no SAST/DAST, no dependency scanning.**
10. **Notification preferences stored in AuditLog** — architectural misuse of audit trail as config store.

### If You Only Fix 3 Things, Fix These

| Priority | Finding                           | Why                                                                                   |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| 1        | **SEC-001: Dev auth bypass**      | Any deployment without Clerk vars gives full unauthenticated access to all user data  |
| 2        | **SEC-003: Cron endpoint bypass** | Bill reminder and weekly digest crons are publicly accessible if CRON_SECRET is unset |
| 3        | **SEC-005: Admin brute-force**    | No rate limiting or lockout on admin login allows credential stuffing                 |

---

## Architecture & Data Flow

### Component List

| Component     | Tech                                   | Port | Auth                  |
| ------------- | -------------------------------------- | ---- | --------------------- |
| Web App       | Next.js 15, React 19, Clerk            | 3000 | Clerk (OAuth/session) |
| Admin Panel   | Next.js 15, React 19                   | 3001 | Custom JWT + bcrypt   |
| Database      | Prisma + SQLite                        | —    | Direct file access    |
| File Storage  | Cloudinary (prod) / local disk (dev)   | —    | API keys              |
| Email         | Resend                                 | —    | API key               |
| Payments      | Stripe (webhooks)                      | —    | Webhook signature     |
| Rate Limiting | Upstash Redis (prod) / in-memory (dev) | —    | API tokens            |
| Observability | Sentry scaffold (not installed)        | —    | DSN                   |

### Data Flow Summary

```
Browser ──► Clerk Auth ──► Web App (Next.js) ──► Prisma ──► SQLite
                                    │
                                    ├──► Cloudinary (file uploads)
                                    ├──► Resend (email)
                                    ├──► Stripe (payments/webhooks)
                                    └──► Upstash Redis (rate limiting)

Admin Browser ──► Admin App (Next.js) ──► Prisma ──► SQLite (same DB)
```

### Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│  UNTRUSTED: Internet / Browser                   │
│  ┌───────────────────────┐ ┌──────────────────┐ │
│  │ Web App (Clerk auth)  │ │ Admin (JWT auth) │ │
│  │  - User endpoints     │ │  - Admin CRUD    │ │
│  │  - Public reviews GET │ │  - Moderation    │ │
│  │  - Cron endpoints     │ │  - User mgmt     │ │
│  └──────────┬────────────┘ └────────┬─────────┘ │
│             │     TRUSTED ZONE      │            │
│             ▼                       ▼            │
│        ┌──────────────────────────────┐          │
│        │  SQLite DB (shared, single   │          │
│        │  file, no network boundary)  │          │
│        └──────────────────────────────┘          │
│             │                                    │
│             ▼                                    │
│   ┌─────────────────────────────────────┐        │
│   │ External APIs (Stripe, Clerk,       │        │
│   │ Cloudinary, Resend, Upstash)        │        │
│   └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Sensitive Data Handled

- **PII:** names, emails, addresses, phone numbers, family details, children info
- **Financial:** Stripe customer IDs, subscription data, budget/expense data, account numbers
- **Auth:** bcrypt password hashes (admin), Clerk tokens (web), JWT sessions
- **Documents:** user-uploaded files (PDF, images) — leases, IDs, medical records, tax docs
- **Tracking:** IP addresses, user agents, device info, geolocation, page views

---

## Top Priority Fixes (Ranked)

| Rank | ID      | Severity | Area           | One-line Fix                                                                       |
| ---- | ------- | -------- | -------------- | ---------------------------------------------------------------------------------- |
| 1    | SEC-001 | Critical | Auth           | Remove dev auth bypass or add ironclad env guard                                   |
| 2    | SEC-003 | Critical | Auth           | Fail-closed when CRON_SECRET is unset                                              |
| 3    | SEC-005 | High     | Auth           | Add rate limiting + lockout to admin login                                         |
| 4    | SEC-004 | High     | Auth           | Add authentication to referral POST endpoint                                       |
| 5    | SEC-006 | High     | Path Traversal | Sanitize file paths in document deletion                                           |
| 6    | SEC-002 | High     | AuthZ          | Admin CRUD routes use only `requireAdmin()` — no RBAC enforcement                  |
| 7    | SEC-007 | High     | Headers        | Add security headers to admin panel                                                |
| 8    | SEC-008 | High     | CSRF           | Add CSRF protection to admin panel mutations                                       |
| 9    | SEC-009 | Medium   | Auth           | Strengthen admin password policy (min 12 chars, complexity)                        |
| 10   | SEC-010 | Medium   | Session        | Admin JWT has no revocation; deactivated admins stay logged in until token expires |
| 11   | REL-001 | High     | Database       | Replace SQLite with PostgreSQL for production                                      |
| 12   | SEC-011 | Medium   | Tracking       | Session PATCH has no ownership check (IDOR)                                        |

---

## Findings (Detailed)

### Security

---

#### SEC-001 — Dev Authentication Bypass Allows Full Unauthenticated Access

- **Severity:** Critical
- **Confidence:** High
- **Category:** AuthN
- **Affected:** `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`

**Status note: this finding is historical context from the pre-migration Clerk implementation and does not reflect the current in-house JWT auth stack.**

```typescript
// apps/web/src/lib/auth.ts:5-27
const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

if (!hasClerk) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("AUTH_NOT_CONFIGURED...");
  }
  console.warn("⚠️  Using dev auth bypass (dev-user) — NOT FOR PRODUCTION");
  const devClerkId = "dev-user";
  // ... auto-creates user and returns userId
}
```

```typescript
// apps/web/src/middleware.ts:71-78
: isDev
    ? async (req: NextRequest) => {
        const csrfBlocked = applyCsrfCheck(req);
        if (csrfBlocked) return csrfBlocked;
        // ... NO auth check at all, just NextResponse.next()
      }
```

**Impact:** If deployed without Clerk env vars (e.g., staging misconfiguration, CI preview deploy), **every API route is accessible without authentication**. The middleware path for `isDev` skips all auth. The `requireDbUserId()` function auto-creates a dev user and returns a valid userId. An attacker gets full CRUD access to all user data.

**Likelihood:** High — environment misconfiguration is common; `NODE_ENV` can be `production` in build but the middleware check uses a separate `isDev` variable.

**Recommendation:**

1. Remove the dev bypass entirely. Use Clerk's test keys for local development.
2. If a bypass is truly needed, gate it on an explicit `DEV_AUTH_BYPASS=true` env var that is **never** set in CI/CD or deployment configs.
3. The middleware `isDev` check should be removed — use the Clerk middleware unconditionally.

**Verification:** Deploy without Clerk env vars and confirm all `/api/*` routes return 401/503.

---

#### SEC-002 — Admin RBAC Not Enforced on Most Routes

- **Severity:** High
- **Confidence:** High
- **Category:** AuthZ / Broken Access Control
- **Affected:** All admin API routes except `/api/team`

**Evidence:**

Most admin routes use only `requireAdmin()` which checks if the user is any active admin, regardless of role:

```typescript
// apps/admin/src/app/api/providers/route.ts:98
const session = await requireAdmin(); // MODERATOR can create providers

// apps/admin/src/app/api/users/route.ts:104
const session = await requireAdmin(); // VIEWER can delete users!

// apps/admin/src/app/api/providers/bulk/route.ts:7
const session = await requireAdmin(); // Any admin can bulk-delete
```

The `checkPermission()` function exists in `auth.ts` but is **never called** by any API route. The `AdminPermission` model with fine-grained `canRead/canCreate/canUpdate/canDelete` per resource is populated during seeding but never checked.

**Impact:** A VIEWER-role admin can delete users, modify providers, bulk-delete data, change security settings, etc. The RBAC system is decorative only.

**Recommendation:** Replace `requireAdmin()` with `requireRole("ADMIN")` for write operations, and call `checkPermission(session.adminId, resource, action)` for fine-grained control. Apply the principle of least privilege.

**Verification:** Create a VIEWER admin and attempt a DELETE on `/api/users`. Should return 403.

---

#### SEC-003 — Cron Endpoints Bypass Auth When CRON_SECRET Is Unset

- **Severity:** Critical
- **Confidence:** High
- **Category:** AuthN
- **Affected:** `apps/web/src/app/api/cron/bill-reminders/route.ts`, `apps/web/src/app/api/cron/weekly-digest/route.ts`

**Evidence:**

```typescript
// apps/web/src/app/api/cron/bill-reminders/route.ts:12-15
const authHeader = req.headers.get("authorization");
if (
  process.env.CRON_SECRET &&
  authHeader !== `Bearer ${process.env.CRON_SECRET}`
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

The condition is `process.env.CRON_SECRET && ...` — if `CRON_SECRET` is not set, the entire auth check is skipped. The endpoint becomes publicly accessible.

**Impact:** Anyone can trigger bill reminder and weekly digest emails for all users, causing spam and potential phishing vector (emails appear legitimate from the LocateFlow domain). Also exposes user emails and financial data in the response.

**Recommendation:** Invert the logic — fail closed:

```typescript
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Verification:** Unset CRON_SECRET and call `GET /api/cron/bill-reminders`. Should return 401.

---

#### SEC-004 — Referral Click Tracking Is Unauthenticated

- **Severity:** High
- **Confidence:** High
- **Category:** AuthN
- **Affected:** `apps/web/src/app/api/referral/route.ts`

**Evidence:**

```typescript
// apps/web/src/app/api/referral/route.ts:42-54
export async function POST(req: NextRequest) {
  const { action, code } = await req.json(); // No auth check!

  if (action === "track_click" && code) {
    const ref = await p.referralCode.findUnique({ where: { code } });
    if (ref) {
      await p.referralCode.update({
        where: { id: ref.id },
        data: { clicks: { increment: 1 } },
      });
    }
    return NextResponse.json({ success: true });
  }
  // ...
}
```

**Impact:** Any unauthenticated user can inflate click counts for any referral code by sending repeated POST requests. This corrupts referral analytics and could be used to game the reward system.

**Recommendation:** Add rate limiting per IP for unauthenticated click tracking, or require authentication.

**Verification:** Send 100 POST requests to `/api/referral` with a valid code. Click count should not increase beyond rate limit threshold.

---

#### SEC-005 — Admin Login Has No Rate Limiting or Account Lockout

- **Severity:** High
- **Confidence:** High
- **Category:** AuthN / Brute Force
- **Affected:** `apps/admin/src/app/api/auth/login/route.ts`, `apps/admin/src/middleware.ts`

**Evidence:**

The admin login endpoint at `/api/auth/login` is in the `PUBLIC_PATHS` array (middleware line 11) and has no rate limiting. The admin app has no rate-limiting middleware at all (unlike the web app).

```typescript
// apps/admin/src/middleware.ts:11
const PUBLIC_PATHS = ["/login", "/api/auth/login"];
```

Additionally, the login response distinguishes between "User not found" (line 17) and "Wrong password" (line 27), which enables username enumeration:

```typescript
if (!admin) {
  return NextResponse.json({ error: "User not found" }, { status: 401 });
}
// ...
if (!valid) {
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
```

**Impact:** Attackers can brute-force admin credentials with no throttling. Different error messages reveal whether an email exists in the admin system.

**Recommendation:**

1. Add rate limiting (e.g., 5 attempts per 15 minutes per IP).
2. Implement account lockout after N failed attempts.
3. Use a generic error message: "Invalid email or password."

---

#### SEC-006 — Path Traversal in Document Deletion

- **Severity:** High
- **Confidence:** Medium
- **Category:** Path Traversal
- **Affected:** `apps/web/src/app/api/documents/[id]/route.ts`

**Evidence:**

```typescript
// apps/web/src/app/api/documents/[id]/route.ts:43-49
if (doc.fileUrl) {
    try {
        const filePath = path.join(process.cwd(), "public", doc.fileUrl);
        await unlink(filePath);
    } catch { ... }
}
```

If `doc.fileUrl` contains `../../../etc/passwd` or similar traversal sequences (stored in DB from a compromised upload flow or direct DB manipulation), `path.join` will resolve it and `unlink` will delete the file.

**Impact:** Arbitrary file deletion on the server if an attacker can control the `fileUrl` value in the database.

**Likelihood:** Medium — requires either a DB injection or a bug in the upload flow that allows path manipulation.

**Recommendation:**

```typescript
const resolved = path.resolve(path.join(process.cwd(), "public"), doc.fileUrl);
const publicDir = path.resolve(path.join(process.cwd(), "public"));
if (!resolved.startsWith(publicDir)) {
  console.warn("Path traversal blocked:", doc.fileUrl);
  return; // Don't delete
}
await unlink(resolved);
```

---

#### SEC-007 — Admin Panel Missing All Security Headers

- **Severity:** High
- **Confidence:** High
- **Category:** Security Headers
- **Affected:** `apps/admin/next.config.js`

**Evidence:**

```javascript
// apps/admin/next.config.js (entire file)
const nextConfig = {
  transpilePackages: ["@locateflow/db"],
};
module.exports = nextConfig;
```

The web app has comprehensive security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). The admin panel has **none**.

**Impact:** Admin panel is vulnerable to clickjacking, MIME-type sniffing attacks, and lacks CSP protection against XSS. As a high-privilege application, this is especially dangerous.

**Recommendation:** Copy the `headers()` configuration from `apps/web/next.config.js` to `apps/admin/next.config.js`, adjusting CSP directives as needed for the admin domain.

---

#### SEC-008 — Admin Panel Has No CSRF Protection

- **Severity:** High
- **Confidence:** High
- **Category:** CSRF
- **Affected:** `apps/admin/src/middleware.ts`

**Evidence:**

The web app middleware includes a `applyCsrfCheck()` function that validates Content-Type on mutations. The admin middleware has no such check:

```typescript
// apps/admin/src/middleware.ts — no CSRF check
export async function middleware(request: NextRequest) {
  // ... only JWT check, no CSRF
}
```

**Impact:** If an admin visits a malicious page, the attacker can forge requests to the admin API (the `sameSite: "lax"` cookie is sent on top-level navigations). POST-based state changes (delete users, create admins, etc.) are vulnerable.

**Recommendation:** Add the same `applyCsrfCheck()` Content-Type validation from the web app middleware to the admin middleware. Consider adding a CSRF token for form submissions.

---

#### SEC-009 — Weak Admin Password Policy

- **Severity:** Medium
- **Confidence:** High
- **Category:** Auth
- **Affected:** `apps/admin/src/app/api/auth/password/route.ts`, `apps/admin/src/app/api/team/route.ts`

**Evidence:**

```typescript
// apps/admin/src/app/api/auth/password/route.ts:15-17
if (newPassword.length < 6) {
  return NextResponse.json(
    { error: "New password must be at least 6 characters" },
    { status: 400 },
  );
}
```

The seed script enforces 12 characters, but password changes only require 6. Team member creation has **no password validation at all** (line 48 just hashes whatever is provided):

```typescript
// apps/admin/src/app/api/team/route.ts:48
const hashedPassword = await bcrypt.hash(body.password, 12);
```

**Impact:** Admins can set weak passwords (e.g., "123456") making brute-force trivial.

**Recommendation:** Enforce minimum 12 characters, require mixed case/numbers/symbols. Apply the same validation in both password change and team creation endpoints.

---

#### SEC-010 — Admin JWT Cannot Be Revoked

- **Severity:** Medium
- **Confidence:** High
- **Category:** Session Management
- **Affected:** `apps/admin/src/lib/auth.ts`

**Evidence:**

The JWT is a stateless token with 24h expiry. When an admin is deactivated (`isActive = false`), `requireAdmin()` checks the DB, but:

1. The middleware only verifies the JWT signature — it does **not** check `isActive`:

```typescript
// apps/admin/src/middleware.ts:32-34
try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next(); // Passes even if admin is deactivated
}
```

2. The role is embedded in the JWT at login time and never re-checked. If a SUPER_ADMIN demotes another admin, the old JWT still has the elevated role.

**Impact:** Deactivated admins can still access pages (middleware passes) until their JWT expires in 24 hours. API routes that call `requireAdmin()` will catch it, but page loads will succeed.

**Recommendation:** Add a DB check in middleware (check `isActive` with a cached lookup), or use short-lived JWTs (15 min) with a refresh token mechanism. On role change/deactivation, invalidate all sessions.

---

#### SEC-011 — IDOR in Session Tracking PATCH

- **Severity:** Medium
- **Confidence:** High
- **Category:** AuthZ / IDOR
- **Affected:** `apps/web/src/app/api/tracking/session/route.ts`

**Evidence:**

```typescript
// apps/web/src/app/api/tracking/session/route.ts:53-62
const { sessionId, pageViews } = await request.json();
if (!sessionId)
  return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

await prisma.userSession.update({
  where: { id: sessionId },
  data: {
    lastActivity: new Date(),
    pageViews: pageViews || undefined,
  },
});
```

The endpoint verifies the user is authenticated but does **not** verify that the `sessionId` belongs to the authenticated user. Any authenticated user can update any other user's session data.

**Impact:** Authenticated users can manipulate other users' session tracking data (page views, last activity). Low direct impact but corrupts analytics.

**Recommendation:** Add ownership check: `where: { id: sessionId, userId: user.id }`.

---

#### SEC-012 — Email Template HTML Injection (Stored XSS via Email)

- **Severity:** Medium
- **Confidence:** Medium
- **Category:** XSS / Injection
- **Affected:** `apps/web/src/lib/email.ts`

**Evidence:**

```typescript
// apps/web/src/lib/email.ts:63
<strong>${data.userName}</strong>,
// ...
<strong>${data.serviceName}</strong> (${data.category})
```

User-controlled values (`userName`, `serviceName`, `category`) are interpolated directly into HTML email templates without escaping.

**Impact:** If a user sets their name to `<script>alert(1)</script>` or a service provider name contains HTML, it will be rendered in email clients that support HTML. Most modern email clients sanitize scripts, but HTML/CSS injection for phishing is still possible.

**Recommendation:** HTML-encode all user-supplied values before interpolation. Create a helper: `const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]!))`.

---

#### SEC-013 — CSP Allows `unsafe-eval` and `unsafe-inline`

- **Severity:** Medium
- **Confidence:** High
- **Category:** Security Headers
- **Affected:** `apps/web/next.config.js:27`

**Evidence:**

```
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline' ...
```

**Impact:** `unsafe-eval` allows `eval()` and similar, weakening XSS protections. `unsafe-inline` for both scripts and styles significantly reduces CSP effectiveness.

**Recommendation:** Replace `unsafe-inline` with nonce-based CSP. Remove `unsafe-eval` (likely only needed for dev HMR — use a dev-only relaxation).

---

#### SEC-014 — Notification Preferences Abusing AuditLog Table

- **Severity:** Low
- **Confidence:** High
- **Category:** Architecture / Data Integrity
- **Affected:** `apps/web/src/app/api/notifications/route.ts`

**Evidence:**

```typescript
// Storing notification preferences in AuditLog:
await prisma.auditLog.create({
  data: {
    userId,
    action: "NOTIFICATION_PREFS",
    entityType: "config",
    entityId: userId,
    changes: JSON.stringify(prefs),
  },
});
```

A `NotificationPreference` model already exists in the schema but this API route stores preferences in the `AuditLog` table instead.

**Impact:** Audit log pollution; preferences are retrieved by scanning audit logs (O(n)), creating multiple entries over time. The actual `NotificationPreference` model is unused.

**Recommendation:** Use the existing `NotificationPreference` model. The audit log should be write-only for audit purposes.

---

### Reliability / Correctness

---

#### REL-001 — SQLite Is Not Production-Viable

- **Severity:** High
- **Confidence:** High
- **Category:** Database / Reliability
- **Affected:** `packages/db/prisma/schema.prisma:6`

**Evidence:**

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Two Next.js apps (web + admin) share the same SQLite file. SQLite does not support concurrent writes well (WAL mode helps but is single-writer). There is no connection pooling, no replication, no point-in-time recovery.

**Impact:** Under concurrent load: `SQLITE_BUSY` errors, data corruption risk, no horizontal scaling, no backup/restore strategy, data loss on server failure.

**Recommendation:** Migrate to PostgreSQL (Prisma supports it with minimal schema changes). Use a managed service (Supabase, Neon, RDS).

---

#### REL-002 — Weekly Digest Sends to ALL Users Without Opt-Out Check

- **Severity:** Medium
- **Confidence:** High
- **Category:** Correctness / Compliance
- **Affected:** `apps/web/src/app/api/cron/weekly-digest/route.ts:25-32`

**Evidence:**

```typescript
const users = await prisma.user.findMany({
  select: { id: true, email: true, firstName: true, lastName: true },
});
// Iterates over ALL users, no opt-out check
```

No check against `NotificationPreference` or the `weeklySummary` preference. All users receive the digest regardless of preference.

**Impact:** CAN-SPAM / GDPR compliance violation. Users who opt out of weekly summaries still receive them.

**Recommendation:** Filter users by their notification preferences before sending.

---

#### REL-003 — Bill Reminder Date Logic Breaks Across Month Boundaries

- **Severity:** Medium
- **Confidence:** Medium
- **Category:** Correctness
- **Affected:** `apps/web/src/app/api/cron/bill-reminders/route.ts:24-26`

**Evidence:**

```typescript
const currentDay = now.getDate(); // e.g., 29
const futureDay = futureDate.getDate(); // e.g., 1 (if reminderDays=3 and now is Jan 29)

const services = await prisma.service.findMany({
  where: {
    billingDay: { gte: currentDay, lte: futureDay }, // 29 <= billingDay <= 1 → always false
  },
  // ...
});
```

When the reminder window spans a month boundary (e.g., Jan 29 + 3 days = Feb 1), `currentDay` (29) > `futureDay` (1), so the `gte/lte` query returns zero results. Bills due in the first days of the next month are never reminded.

**Impact:** Users miss bill reminders when the billing day is in the first few days of the next month.

**Recommendation:** Handle month-boundary logic with proper date ranges instead of raw day-of-month comparison.

---

#### REL-004 — `prisma as any` Casts Throughout Codebase

- **Severity:** Medium
- **Confidence:** High
- **Category:** Code Quality / Type Safety
- **Affected:** Multiple files across both apps

**Evidence:**

```typescript
// apps/web/src/lib/feature-flags.ts:3
const p = prisma as any;
// apps/web/src/app/api/referral/route.ts:5
const p = prisma as any;
// apps/admin/src/app/api/security/route.ts:7
const p = prisma as any;
```

This pattern is used for ~10+ models added after the initial Prisma generation. The comment in the memory notes: "due to Windows file lock preventing Prisma client regeneration."

**Impact:** Zero type safety on these models. Runtime errors from typos or schema mismatches will not be caught at compile time. This is a development workflow issue that should be resolved.

**Recommendation:** Fix the Prisma client regeneration issue (close dev servers, run `pnpm db:generate`). Remove all `as any` casts.

---

#### REL-005 — Race Condition in Referral Code Generation

- **Severity:** Low
- **Confidence:** Medium
- **Category:** Concurrency
- **Affected:** `apps/web/src/app/api/referral/route.ts:24-26`

**Evidence:**

```typescript
let code = generateCode();
let exists = await p.referralCode.findUnique({ where: { code } });
while (exists) {
  code = generateCode();
  exists = await p.referralCode.findUnique({ where: { code } });
}

referralCode = await p.referralCode.create({ data: { userId: user.id, code } });
```

TOCTOU race: between checking for existence and creating the record, another request could create the same code. With SQLite's limited concurrency this is unlikely but would throw a unique constraint violation.

**Recommendation:** Wrap in a try-catch and retry on unique constraint violation, or use a UUID-based code.

---

### Performance / Scalability

---

#### PERF-001 — N+1 Queries in Weekly Digest Cron

- **Severity:** Medium
- **Confidence:** High
- **Category:** Performance
- **Affected:** `apps/web/src/app/api/cron/weekly-digest/route.ts:37-106`

**Evidence:**

```typescript
for (const user of users) {
  // Iterates ALL users
  const [services, tasks, completedTasks] = await Promise.all([
    prisma.service.findMany({ where: { userId: user.id, isActive: true } }),
    prisma.task.count({ where: { userId: user.id, completed: false } }),
    prisma.task.count({
      where: {
        userId: user.id,
        completed: true,
        completedAt: { gte: weekAgo },
      },
    }),
  ]);
  // ... 3 more queries per user
}
```

For N users, this executes 5N+ database queries sequentially. With 1000 users, that's 5000+ queries.

**Impact:** Cron job timeout, database lock contention (especially with SQLite), degraded performance for all users during the cron run.

**Recommendation:** Batch queries — fetch all services, tasks, and counts in bulk, then group by userId in application code. Or use raw SQL with aggregation.

---

#### PERF-002 — Admin Provider List Defaults to 500 Items Per Page

- **Severity:** Low
- **Confidence:** High
- **Category:** Performance
- **Affected:** `apps/admin/src/app/api/providers/route.ts:10`

**Evidence:**

```typescript
const perPage = parseInt(searchParams.get("perPage") || "500");
```

No upper bound enforced. An attacker or misconfigured client could request `perPage=100000`.

**Impact:** Memory exhaustion, slow responses, potential DoS.

**Recommendation:** Cap `perPage` to a reasonable maximum (e.g., `Math.min(parseInt(...), 100)`).

---

#### PERF-003 — Feature Flag Cache Is Module-Scoped (Not Request-Scoped)

- **Severity:** Low
- **Confidence:** Medium
- **Category:** Reliability
- **Affected:** `apps/web/src/lib/feature-flags.ts:12-14`

**Evidence:**

```typescript
let flagCache: Map<string, FeatureFlag> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;
```

In serverless (Vercel), module-scoped variables may or may not persist between invocations, depending on cold starts. The cache behavior is unpredictable.

**Recommendation:** For serverless deployments, use a shared cache (Redis/Upstash) or accept per-request DB lookups (the query is lightweight).

---

### DevOps / CI/CD / Infrastructure

---

#### DEVOPS-001 — No CI/CD Pipeline

- **Severity:** High
- **Confidence:** High
- **Category:** DevOps
- **Affected:** Repository root

**Evidence:** No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Dockerfile`, no `docker-compose.yml` found in the repository.

**Impact:** No automated testing, no dependency scanning, no SAST, no build verification. All deployments are manual.

**Recommendation:** Create a GitHub Actions workflow with: lint, type-check, test, dependency audit, build verification.

---

#### DEVOPS-002 — No Automated Tests for API Routes

- **Severity:** Medium
- **Confidence:** High
- **Category:** Testing
- **Affected:** `apps/web/src/lib/__tests__/` (only 5 unit test files for lib utilities)

**Evidence:** Vitest is configured but only tests utility functions. There are zero integration tests for any API route. The admin app has no test configuration at all.

**Impact:** Regressions in auth, RBAC, data access go undetected. Security fixes cannot be verified automatically.

**Recommendation:** Add API route integration tests covering auth, authorization, input validation, and edge cases.

---

#### DEVOPS-003 — No Dockerfile or Deployment Configuration

- **Severity:** Medium
- **Confidence:** High
- **Category:** Infrastructure
- **Affected:** Repository root

**Evidence:** No Dockerfile, no K8s manifests, no Terraform/Pulumi files, no Vercel config (`vercel.json`).

**Impact:** No reproducible deployments, no infrastructure-as-code, no environment parity.

**Recommendation:** Add Dockerfiles for both apps, or add `vercel.json` configurations if deploying to Vercel.

---

#### DEVOPS-004 — Sentry Not Installed (Scaffold Only)

- **Severity:** Medium
- **Confidence:** High
- **Category:** Observability
- **Affected:** `apps/web/src/lib/sentry.ts`

**Evidence:**

```typescript
// Dynamic import so the app works without @sentry/nextjs installed
const Sentry = require("@sentry/nextjs");
```

`@sentry/nextjs` is not in `package.json`. The `captureException` calls throughout the app silently fall back to `console.error`.

**Impact:** No error tracking, no alerting, no visibility into production errors.

**Recommendation:** Install Sentry and configure DSN, or use an alternative error tracking service.

---

### Documentation / Operability

---

#### DOC-001 — No README with Setup Instructions

- **Severity:** Low
- **Confidence:** High
- **Category:** Documentation
- **Affected:** Repository root

**Evidence:** No `README.md` in repository root. The only docs are `RELOCATION_MANAGER_SPEC.md` (product spec) and `AUDIT_REPORT_MERGED.md` (previous audit).

**Impact:** New developers cannot set up the project. Deployment procedures are undocumented. Incident response is ad-hoc.

**Recommendation:** Create a README with: prerequisites, setup steps, env var documentation, development workflow, deployment guide.

---

#### DOC-002 — No Database Migration Strategy

- **Severity:** Medium
- **Confidence:** High
- **Category:** Operability
- **Affected:** `packages/db/`

**Evidence:** The `prisma/migrations` directory contents are unclear, but `db push` is used (schema push without migrations) per the scripts. No documented rollback procedure.

**Impact:** Schema changes in production are destructive (no down migration). No way to audit what changed when.

**Recommendation:** Use Prisma Migrate (`prisma migrate dev` / `prisma migrate deploy`) instead of `prisma db push`. Maintain a migrations history.

---

## Quick Wins (< 1 day each)

| #   | Action                                                            | Finding  |
| --- | ----------------------------------------------------------------- | -------- |
| 1   | Fix cron auth to fail-closed (`if (!secret \|\| header !== ...)`) | SEC-003  |
| 2   | Add rate limiting to admin login (in-memory counter, 5/15min)     | SEC-005  |
| 3   | Unify login error message to "Invalid email or password"          | SEC-005  |
| 4   | Add auth check to referral POST                                   | SEC-004  |
| 5   | Add `path.resolve` guard to document deletion                     | SEC-006  |
| 6   | Copy security headers config to admin `next.config.js`            | SEC-007  |
| 7   | Add CSRF Content-Type check to admin middleware                   | SEC-008  |
| 8   | Set password minimum to 12 chars in all endpoints                 | SEC-009  |
| 9   | Add ownership check to tracking session PATCH                     | SEC-011  |
| 10  | Cap `perPage` parameters with `Math.min()`                        | PERF-002 |
| 11  | HTML-escape email template interpolations                         | SEC-012  |
| 12  | Add `where: { userId }` to chat session lookups in assistant API  | SEC-011  |

---

## Medium-term Hardening Plan (1–4 weeks)

### Week 1: Critical Auth & Access Control

- [ ] Remove or gate the dev auth bypass (SEC-001)
- [ ] Implement RBAC enforcement on all admin API routes (SEC-002)
- [ ] Add admin login rate limiting and account lockout (SEC-005)
- [ ] Fix cron auth (SEC-003), referral auth (SEC-004)
- [ ] Add path traversal guard (SEC-006)

### Week 2: Security Headers, CSRF, Session Management

- [ ] Add security headers to admin panel (SEC-007)
- [ ] Add CSRF protection to admin panel (SEC-008)
- [ ] Implement JWT revocation or short-lived tokens (SEC-010)
- [ ] Strengthen password policy (SEC-009)
- [ ] Fix CSP to remove `unsafe-eval` (SEC-013)

### Week 3: Database, Performance, Correctness

- [ ] Migrate from SQLite to PostgreSQL (REL-001)
- [ ] Fix bill reminder month-boundary logic (REL-003)
- [ ] Fix weekly digest to check notification preferences (REL-002)
- [ ] Resolve `prisma as any` casts (REL-004)
- [ ] Optimize N+1 queries in cron jobs (PERF-001)
- [ ] Use `NotificationPreference` model (SEC-014)

### Week 4: CI/CD, Testing, Observability

- [ ] Create GitHub Actions CI pipeline (DEVOPS-001)
- [ ] Add API route integration tests (DEVOPS-002)
- [ ] Install and configure Sentry (DEVOPS-004)
- [ ] Write README and deployment docs (DOC-001)
- [ ] Set up Prisma Migrate for production (DOC-002)
- [ ] Add Dockerfile or Vercel config (DEVOPS-003)

---

## Suggested Automated Checks

### SAST / Linting

- **ESLint security plugin:** `eslint-plugin-security` — catches unsafe regex, eval, etc.
- **Semgrep:** Run `semgrep --config=p/owasp-top-ten` for OWASP pattern matching
- **TypeScript strict mode:** Enable `strict: true` in all `tsconfig.json` files

### Dependency Scanning

- **`pnpm audit`** — run in CI on every PR
- **Snyk or Socket.dev** — deeper supply chain analysis
- **Renovate or Dependabot** — automated dependency updates

### Secret Scanning

- **Gitleaks** — scan for hardcoded secrets in git history
- **GitHub Secret Scanning** — enable if using GitHub

### Testing

- **Vitest** — extend existing setup to cover API routes
- **Playwright** — E2E tests for critical flows (login, CRUD, admin)
- **Coverage threshold** — enforce minimum coverage in CI

### CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm --filter @locateflow/web test
      - run: pnpm audit --audit-level=high
```

---

## Appendix

### Files/Areas Reviewed

| Area                 | Files Reviewed                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema**           | `packages/db/prisma/schema.prisma` (1058 lines, 35+ models)                                                                                              |
| **Web Auth**         | `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`                                                                                                 |
| **Admin Auth**       | `apps/admin/src/lib/auth.ts`, `apps/admin/src/middleware.ts`                                                                                             |
| **Web API Routes**   | All 32 route files in `apps/web/src/app/api/`                                                                                                            |
| **Admin API Routes** | All 20+ route files in `apps/admin/src/app/api/`                                                                                                         |
| **Libraries**        | `rate-limit.ts`, `storage.ts`, `validators.ts`, `email.ts`, `audit.ts`, `feature-flags.ts`, `family-access.ts`, `sentry.ts`, `ai-moderation.ts`, `db.ts` |
| **Config**           | `next.config.js` (both), `package.json` (all 3), `turbo.json`, `.env.example`, `.gitignore`, `pnpm-workspace.yaml`                                       |
| **Seed Scripts**     | `seed-admin.ts`                                                                                                                                          |
| **PWA**              | `public/sw.js`                                                                                                                                           |

### Configuration Notes

- **Database URL:** SQLite file-based (`file:./dev.db`), shared between web and admin apps
- **Admin JWT Secret:** Example value `change-me-to-a-long-random-secret-at-least-32-chars` — must be changed in production
- **Admin Seed Credentials:** `admin@locateflow.com` / env-configured password (min 12 chars enforced in seed only)
- **bcrypt rounds:** 12 (adequate)
- **JWT expiry:** 24 hours (acceptable but consider shorter for admin)
- **Cookie settings:** httpOnly, secure in production, sameSite lax, path / — reasonable
- **Rate limits:** 120 reads/min, 30 writes/min (web only, via Upstash or in-memory)

### Open Questions / Assumptions

1. **Is there a separate staging environment?** If so, does it have Clerk configured? (SEC-001 risk)
2. **Are Vercel Cron or external cron jobs configured?** If not, bill reminders and weekly digests are never sent.
3. **Is the admin panel intended to be internet-facing?** If so, network-level access control (VPN, IP allowlist) is strongly recommended.
4. **Are there plans to add multi-tenancy?** Current userId-based access control assumes single-tenant per user.
5. **What is the expected user count for production launch?** SQLite will struggle beyond ~100 concurrent users.
6. **Is GDPR compliance required?** The `GDPRRequest` model exists but the actual data export/deletion workflow is not fully implemented (no automated processing).
7. **Stripe API version `2024-06-20`** is hardcoded — confirm this matches the Stripe dashboard configuration.
