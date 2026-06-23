# Module Audit: Admin Auth & Security

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> `staging-move/`. Line numbers cited where practical.

## 1. Module Summary

The admin panel runs a **custom JWT auth stack fully separate from consumer auth**:
a dedicated `ADMIN_JWT_SECRET` (jose HS256), an `admin_session` cookie
(`httpOnly`, `sameSite=strict`), an `AdminUser`/`AdminSession`/`AdminLoginLog`
data model, and an Edge-Runtime middleware gate. Authorization is a 4-tier role
hierarchy (`VIEWER < MODERATOR < ADMIN < SUPER_ADMIN`) plus a per-resource
`AdminPermission` matrix that **fails closed** (absence of a row = denied; only
SUPER_ADMIN short-circuits). Sensitive mutations are protected by a **step-up
password (+ MFA) confirmation** with a distributed (Redis) bad-attempt lockout.
The module also implements: login rate-limiting + lockout + login log, adaptive
new-network MFA challenge, MFA enrollment gates for ADMIN/SUPER_ADMIN, IP
allow/deny rules with break-glass, session fingerprinting (anti-hijack),
single-use expiring set-password/invite tokens, forced first-login rotation, and
SUPER_ADMIN→user impersonation with audit + handoff secret.

Overall the design is unusually mature for an admin panel. The findings below are
mostly hardening gaps and a few real trust-boundary / enumeration issues, not
wholesale auth bypasses.

## 2. Related Files

Core auth/session:
- `apps/admin/src/middleware.ts` — Edge gate: IP rules, rate limit, CSRF, body
  size, CSP/nonce, JWT verify, must-change gate, MFA-setup gate, fingerprint.
- `apps/admin/src/lib/auth.ts` — session create/get/destroy, `requireAdmin`,
  `requireRole`, `requirePermission`, `checkPermission`, `requirePasswordConfirm`.
- `apps/admin/src/lib/page-guard.ts` — server-side page gates.
- `apps/admin/src/lib/admin-roles.ts` — MFA-required role set.
- `apps/admin/src/lib/admin-permissions.ts` — resource enum, role enum, default matrix.
- `apps/admin/src/lib/auth-step-up-store.ts` — Redis/in-memory step-up grace + lockout.
- `apps/admin/src/lib/session-fingerprint.ts` — IP-bucket+UA fingerprint.
- `apps/admin/src/lib/ip-rules.ts` — IP rule parse/match/cache.
- `apps/admin/src/lib/admin-known-ip.ts` — adaptive known-network signal + alert email.
- `apps/admin/src/lib/admin-mfa-trusted-device.ts` — trusted-device cookie/token.
- `apps/admin/src/lib/admin-invite.ts` — single-use set-password tokens.
- `apps/admin/src/lib/internal-secrets.ts` — shared-secret verification (constant time).
- `apps/admin/src/lib/totp.ts` — TOTP + backup codes.
- `apps/admin/src/lib/audit.ts` — `writeAdminAudit`, `getAuditRequestMeta`.
- `apps/admin/src/lib/security-monitor.ts` — anomaly tracking + alerts (in-memory).
- `packages/shared/src/trusted-client-ip.ts` — proxy-header IP resolver.
- `apps/web/src/lib/impersonation-audit.ts` — records impersonated mutations.

APIs:
- `apps/admin/src/app/api/auth/{login,logout,me,password,set-password,force-password-change,login-history,sessions}/route.ts`
- `apps/admin/src/app/api/auth/mfa/{setup,verify,disable,trusted-devices}/route.ts`
- `apps/admin/src/app/api/team/route.ts`, `apps/admin/src/app/api/team/[id]/route.ts`
- `apps/admin/src/app/api/security/route.ts`, `.../security/key-rotation/route.ts`, `.../security/dashboard/route.ts`
- `apps/admin/src/app/api/internal/ip-rules/route.ts`, `.../internal/security-event/route.ts`
- `apps/admin/src/app/api/users/[id]/impersonate/route.ts`
- `apps/web/src/app/api/internal/impersonate/route.ts`, `apps/web/src/app/api/auth/impersonate-handoff/route.ts`

Pages: `apps/admin/src/app/login/page.tsx`, `.../set-password/page.tsx`,
`.../set-password/change/page.tsx`, `.../(admin)/{team,security,security/dashboard,settings/two-factor,forbidden}/page.tsx`.

Migration: `packages/db/prisma/migrations/20260422224000_admin_session_login_log/migration.sql`.

## 3. Related Routes / Screens

- `/login` (public) — password + MFA/backup-code form.
- `/set-password` (public, token-gated) — invite landing.
- `/set-password/change` (authenticated, outside `(admin)` group) — forced rotation.
- `/settings/two-factor` — MFA enrollment (gate target).
- `/forbidden` — insufficient-role landing.
- `/(admin)/team` — admin roster + RBAC matrix editor (page-guard: `admin_users.canRead`, min ADMIN).
- `/(admin)/security`, `/(admin)/security/dashboard` — IP rules, GDPR, readiness, anomaly view.

## 4. Related APIs

Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`PATCH /api/auth/password`, `GET|POST /api/auth/set-password`,
`POST /api/auth/force-password-change`, `GET|POST /api/auth/sessions`,
`GET /api/auth/login-history`.
MFA: `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`,
`POST /api/auth/mfa/disable`, `GET /api/auth/mfa/trusted-devices`.
Team/RBAC: `GET|POST /api/team`, `PATCH|DELETE /api/team/[id]`.
Security: `GET|POST /api/security`, `POST /api/security/key-rotation`,
`GET /api/security/dashboard`.
Internal (shared-secret): `GET /api/internal/ip-rules`,
`POST /api/internal/security-event`, `POST /api/internal/impersonate` (web).
Impersonation: `POST /api/users/[id]/impersonate` (admin),
`POST /api/auth/impersonate-handoff` (web).

## 5. Related Components

- `apps/admin/src/app/login/page.tsx` — client login/MFA form.
- `apps/admin/src/app/set-password/change/force-password-change-client.tsx` — rotation form.
- Team/security page client components (RBAC editor, IP-rule editor) — out of
  deep scope here but consume the APIs above; server APIs remain authoritative.
- `AuroraBackground` — decorative only.

## 6. Related State / Hooks / Stores

- Server: `cookies()` (admin_session), Prisma (`AdminUser`, `AdminSession`,
  `AdminLoginLog`, `AdminAuditLog`, `AdminPermission`, `AdminSetPasswordToken`,
  `IPRule`, `RateLimitLog`, `AdminMfaTrustedDevice`).
- Distributed: Upstash Redis for login RL, step-up grace/lockout, key-rotation lock.
- In-memory module state: IP-rule cache (`ip-rules.ts`), rate-limit fallback maps
  (`middleware.ts`, `login/route.ts`), step-up fallback maps
  (`auth-step-up-store.ts`), anomaly trackers (`security-monitor.ts`).
- Client: login form `useState` (email/password/mfa/backup/rememberDevice).

## 7. Related Database / Models

`AdminSession` (tokenHash sha256, ipAddress, userAgent, isActive, expiresAt) and
`AdminLoginLog` (email, success, failReason, ip, ua, mfaUsed/Method) created by
migration `20260422224000`. `tokenHash` is `VARCHAR(64)` (sha256 hex). FK
`AdminSession.adminUserId → AdminUser ON DELETE CASCADE`;
`AdminLoginLog.adminUserId → AdminUser ON DELETE SET NULL`. Other models referenced:
`AdminPermission`, `AdminSetPasswordToken`, `AdminAuditLog`, `IPRule`,
`RateLimitLog`, `GDPRRequest`, `UserLoginSession` (`impersonatedByAdminId`).

## 8. Impact Map

| Area | Impact |
|---|---|
| UI | Login + MFA + forced-rotation forms; team RBAC matrix editor; security/IP-rule UI. Permission map drives display-only button gating (`page-guard.ts`). |
| API | All admin mutations gated by `requirePermission`/`requireRole` + step-up; CSRF + body-size + rate-limit in middleware. |
| DB | Session rows authoritative for revocation; permission rows authoritative for RBAC; audit rows for forensics. |
| Auth | Fully separate admin JWT/secret/cookie from consumer auth. JWT carries `role/mfaEnabled/mcp/fp` for Edge gating; DB re-read in `requireRole`. |
| Admin | Self-service password/MFA; SUPER_ADMIN manages roster + IP rules + key rotation + impersonation. |
| Mobile | N/A — admin panel is web-only (no mobile screens reference admin auth). |
| Notifications | New-network login email; impersonation notifies target user (in-app + email). |
| Integrations | Upstash Redis (RL/step-up/lock); email (invite/alert); web app (impersonation handoff via `IMPERSONATION_HANDOFF_SECRET`). |
| Analytics | `AdminLoginLog`, `AdminAuditLog`, `RateLimitLog`, security-monitor events. |
| SEO | Admin is `noindex/nofollow/noarchive` (middleware + robots). |
| Tests | Extensive unit tests for ip-rules, step-up, audit, invite, permissions, fingerprint; gaps on full login/middleware integration flows. |

## 9. Buttons / Actions / Functions

**Login submit** (`login/page.tsx:31`) → `POST /api/auth/login`.
- Expected: password → 403 `requiresMfa` if MFA enabled/new network → MFA step → session.
- Actual: matches. Loading state via `loading` (button `disabled={loading}`). Error via toast; unified "Invalid email or password" (no enumeration in *message*). Success → `window.location.assign("/")`.
- Permission: none (public). Rate limit: 5/15min/(email+ip) login, 4/5min MFA.
- Edge cases: empty fields blocked by `required`; backup-code path toggled; `rememberDevice` only sent with mfaCode.

**MFA setup / verify / disable** (`mfa/setup|verify|disable/route.ts`).
- Setup: step-up password confirm (no MFA, since not yet enrolled); generates secret + 8 backup codes; QR rendered server-side (no secret leak to 3rd party). Verify: TOTP check → `mfaEnabled=true`, reissue JWT. Disable: step-up **with** `requireMfa:true` → wipes secret/backup, revokes sessions + trusted devices.
- Permission: `requireAdmin` (self only). Error/success returned JSON; client opens modal on 403.

**Change password** (`auth/password/route.ts`) → step-up (`requireMfa:true`) → complexity check (≥12, upper/lower/digit) → rehash → revoke all sessions + trusted devices → expire cookies.

**Set password (invite)** (`auth/set-password/route.ts`) → consume single-use token → set password, `mustChangePassword=false`, revoke sessions.

**Forced rotation** (`auth/force-password-change/route.ts`) → authenticated, no step-up (intentional), rejects if not flagged, rejects same-as-current, reissues JWT `mcp:false`.

**Create / invite admin** (`team/route.ts POST`) → SUPER_ADMIN + step-up(MFA) → invite flow (random seed pw + emailed token) or explicit pw → seeds default matrix.

**Update / delete admin** (`team/[id]/route.ts`) → ADMIN+ for non-sensitive; SUPER_ADMIN + step-up(MFA) for role/pw/activation/permissions; last-SUPER_ADMIN guard; no self-promote/self-deactivate; cannot edit equal/higher role; revokes target sessions on sensitive change. Delete = archive (anonymize, deactivate, wipe MFA).

**IP-rule add/delete/toggle, GDPR update** (`security/route.ts POST`) → ADMIN+ permission + step-up(MFA); whitelist add/enable requires SUPER_ADMIN break-glass; broad CIDR requires break-glass; **self-lockout guard** simulates post-change rule set and refuses if current IP would be blocked.

**Key rotation** (`security/key-rotation/route.ts`) → SUPER_ADMIN + step-up(MFA) + distributed lock + dry-run preflight.

**Impersonate user** (`users/[id]/impersonate/route.ts`) → SUPER_ADMIN + step-up(MFA) → web internal handoff → audit + user notification. Token returned for POST-only handoff (never in URL).

**Sessions list/revoke** (`auth/sessions/route.ts`) → self by default; `all` requires SUPER_ADMIN; cross-admin revoke requires step-up; revoke handles are HMAC-signed, 5-min TTL.

## 10. UI/UX Audit

- **Login error reset** (`login/page.tsx:60-63`): on error during MFA step, clears codes — good. Evidence: lines 58-66. Impact: avoids stale code resubmission. Priority: Info.
- **No explicit lockout countdown** in login UI: `Retry-After` header / 429 body returns `retryAfterSeconds`, but the client only shows `data.error` toast (line 59). Impact: operator doesn't see when they can retry. Recommendation: surface `retryAfterSeconds`. Priority: Low.
- **`rememberDevice` defaults true** (`login/page.tsx:22`) and is auto-checked. Impact: trusted-device cookie created by default reduces future MFA friction; acceptable but worth a conscious default. Priority: Info.
- **Dark/light theme**: form uses CSS variables (`bg-background`, `text-foreground`, `border-input`), so it adapts to theme. No hardcoded colors in the login form. Priority: Info.
- **Accessibility**: inputs have `<label htmlFor>` pairs, `autoComplete`, `inputMode="numeric"`, `one-time-code`. Submit button has visible disabled state. No obvious a11y gaps in login. Priority: Info.

## 11. Logic Audit

- **Expected flow** (login → gate → page) is coherent. JWT carries `role/mfaEnabled/mcp/fp`; middleware gates on claims (Edge, no DB), and `requireRole`/page-guard **re-read role + isActive + mfaEnabled from DB** (`auth.ts:351-360`, `page-guard.ts:132-150`) so stale JWT claims cannot escalate. Good.
- **Forced-rotation gate** runs before MFA gate in middleware (`middleware.ts:704-763`) so a new admin owns their password first. Page-guard re-checks `mustChangePassword` from DB. Consistent.
- **Permission fail-closed** (`auth.ts:690-709`, `page-guard.ts:92-118`): missing rows = denied; SUPER_ADMIN short-circuits. Demotion revokes because current role is read fresh. Good.
- **Step-up grace** is per-(admin, session-scope, operation, assurance) keyed (`auth.ts:427-435`), so a cached confirm for one operation cannot satisfy a different operation. Good.
- **Race conditions**: set-password/invite token consumption is atomic via `updateMany` guarded on `consumedAt:null` (`admin-invite.ts:118-129`); backup-code consumption uses an optimistic `updateMany` on the prior JSON string (`auth.ts:609-613`, `login/route.ts:517-521`) — concurrent reuse of the same backup code loses the CAS. Good.
- **Stale cache risk**: IP-rule cache is per-instance, ≤60s lag, fail-open (`ip-rules.ts:50-55, 240-262`). A freshly-added BLACKLIST takes up to ~60s/instance to apply. Documented tradeoff; see SEC finding below.
- **`refreshSessionCookie` ordering** (`auth.ts:182-228`): invalidates old DB row, mints new JWT+cookie, then creates the new DB row. If the DB `create` fails (`.catch(() => null)`), the JWT is valid but `getSession` will not find a matching active row and will clear the cookie on next request — fail-safe but could surprise an admin mid-MFA-enable. Reliability note below.

## 12. Reverse Logic Audit

- **Unauthorized user**: no `admin_session` → API 401 / page redirect to `/login` (`middleware.ts:682-688`). API routes additionally call `requireAdmin`/`requirePermission`.
- **Empty data**: `checkPermission` denies when no permission rows (fail-closed).
- **API error**: audit writes never throw (`audit.ts:138-145`); login swallows logging failures.
- **Slow network / Redis down**: login RL and step-up **fail closed** when Redis is *configured but erroring* (503), **fail open to in-memory** when Redis is *unconfigured* (documented). IP rules fail open.
- **Double-click**: idempotent confirms via grace window; backup codes are CAS-consumed; impersonation handoff row is consumed once (`impersonate-handoff/route.ts:98-113`).
- **Stale data / role change**: role re-read from DB in `requireRole`/page-guard; sensitive admin updates revoke target sessions.
- **Direct route access**: page-guard runs server-side before render; middleware blocks API.
- **Mobile viewport**: login form is responsive (`max-w-md`, flex center). 
- **Dark theme**: theme tokens used.
- **Token expiry**: expired JWT → catch clears cookie + 401/redirect (`middleware.ts:795-805`); `getSession` cross-checks DB `expiresAt`.
- **Session fingerprint mismatch**: middleware emits `SESSION_HIJACK_ATTEMPT`, expires cookie, 401/redirect (`middleware.ts:766-792`). Note coarse /24 bucket — see finding `admin-auth-security-06`.

## 13. Security Audit

### admin-auth-security-01 — Web impersonation endpoint trusts an unverified `adminId` (audit attribution spoof / over-broad handoff secret)
- **Severity**: High
- **Affected Area**: `apps/web/src/app/api/internal/impersonate/route.ts:41-101`; consumed by `apps/admin/src/app/api/users/[id]/impersonate/route.ts`.
- **Evidence**: The web endpoint authenticates *only* the shared `IMPERSONATION_HANDOFF_SECRET` (line 43). It then mints a full user-session JWT for any `userId` and stamps `impersonatedByAdminId = adminId` straight from the request body (`bodySchema` lines 34-39, JWT lines 69-77, session lines 83-92). There is **no check that `adminId` corresponds to a real, active, SUPER_ADMIN `AdminUser`**. The admin-side route does enforce SUPER_ADMIN + step-up before calling, but the web endpoint cannot rely on that — it trusts the secret alone.
- **Risk**: Any process able to present the handoff secret (a compromised admin container, a leaked env var, an SSRF that can reach the internal endpoint with the secret) can impersonate **any user** and attribute the action to **any `adminId` string** of its choosing, including a non-existent or innocent admin — poisoning the forensic audit trail (`IMPERSONATE_HANDOFF` / `USER_IMPERSONATION_STARTED` rows key off this value).
- **Defensive Abuse Scenario (high-level)**: An attacker who obtains the handoff secret submits `{userId: <victim>, adminId: <arbitrary>}`; the web app issues a logged-in victim session and writes audit rows blaming the chosen adminId. Investigators chasing the audit log are misdirected.
- **Prevention**: On the web side, look up `adminId` against the admin user store (or a shared read model) and reject if absent/inactive/insufficient-role; or carry a signed assertion of the acting admin (not a raw string) from the admin app. Keep the handoff secret out of any SSRF-reachable surface.
- **Detection**: Alert on `impersonate` calls whose `adminId` does not match a known active SUPER_ADMIN; reconcile admin-side `USER_IMPERSONATION_STARTED` against web-side `IMPERSONATE_HANDOFF`.
- **Analysis (root cause)**: Trust fully delegated to the shared secret; the receiving service does no semantic validation of the actor claim it is asked to persist.
- **Recommendation**: Validate `adminId` server-side on the web endpoint and treat the audit actor as authoritative only after that check. [needs verification of whether the web app has access to AdminUser rows in the same DB — both apps import `@/lib/db`, suggesting a shared DB.]
- **Tests To Add**: handoff with non-existent/inactive adminId is rejected; audit actor cannot be set to an arbitrary string.

### admin-auth-security-02 — Default `compat` proxy mode trusts client-supplied IP headers (IP-rule / rate-limit / fingerprint integrity)
- **Severity**: High
- **Affected Area**: `packages/shared/src/trusted-client-ip.ts:18-28, 67-99`; consumers: `middleware.ts:83-89` (IP rules + RL + fingerprint), `login/route.ts:198-204` (login RL + known-IP), `audit.ts:152-159`.
- **Evidence**: When `TRUSTED_PROXY_HEADERS` is unset/`auto`/`compat`, the resolver returns the first parseable value of `cf-connecting-ip`, then `x-real-ip`, then `x-forwarded-for` (lines 93-98) **without any trusted-proxy allowlist**. `TRUSTED_PROXY_HEADERS` is not present in `.env.example` (the env contract), so the default-`compat` path is what ships unless an operator opts into `vercel`/`cloudflare`/`standard`/`none`.
- **Risk**: If the admin app is reachable not strictly behind a single trusted proxy that strips/overwrites these headers, a client can forge its source IP. That undermines: (a) IP allow/deny rules (`evaluateIPAccessForRules`) — a blacklisted attacker spoofs an allowed IP; (b) per-IP login rate-limit / lockout keys (`buildAdminLoginRateKey`) — rotate the spoofed IP to dodge the 5/15min lockout; (c) session fingerprint IP bucket — weakens anti-hijack binding; (d) "known network" adaptive MFA — spoof a known /24 to suppress the new-location MFA challenge; (e) audit IP accuracy.
- **Defensive Abuse Scenario (high-level)**: An attacker brute-forcing the login rotates a forged `x-forwarded-for` per request so the per-IP counter never accumulates, while also spoofing a previously-seen /24 to avoid the new-network MFA step-up.
- **Prevention**: Require an explicit `TRUSTED_PROXY_HEADERS` value matched to the real edge (`cloudflare`/`vercel`/`standard`) in production; document it in `.env.example`; consider failing closed (treat IP as `unknown`) when production-like and the mode is unset, rather than defaulting to `compat`.
- **Detection**: Monitor for many distinct source IPs sharing one fingerprint/UA; alert on `x-forwarded-for` chains inconsistent with the known edge.
- **Analysis (root cause)**: A convenience default (`compat`) trusts forwarded headers to ease local/dev setups, but the same default governs production unless overridden, and the override is undocumented.
- **Recommendation**: Treat `compat` as dev-only; require an explicit mode in production-like runtimes and add it to the env contract.
- **Tests To Add**: in production-like config with mode unset, forged `x-forwarded-for` does not change the resolved IP / does not bypass the login lockout.

### admin-auth-security-03 — CSRF middleware has a header-absent pass-through window for non-logout mutations
- **Severity**: Medium
- **Affected Area**: `apps/admin/src/middleware.ts:355-429` (`applyCsrfCheck`).
- **Evidence**: For all `/api` mutations the middleware requires `application/json`/`multipart` content-type (good). For **non-logout** routes the only origin/referer enforcement is: pass if `sec-fetch-site` is `same-origin`/`none` (line 391); else if an `origin` header is present and mismatched → 403 (line 401); else if `!origin && referer` and referer mismatched → 403 (line 409). A request that sends **no `Origin`, no `Referer`, and no `Sec-Fetch-Site`** (older browsers, some non-browser clients) reaches the handler. (The stricter `Sec-Fetch-Site !== same-origin` rejection at lines 375-390 is gated on `isLogout` only.)
- **Risk**: Pure header-absent CSRF window. **Strongly mitigated** by the `admin_session` cookie being `sameSite=strict` (`auth.ts:61`), which prevents the browser from attaching the session on cross-site requests in the first place, and by the JSON content-type requirement (a cross-origin HTML form cannot set `application/json`). The residual risk is non-browser/legacy clients or a future cookie SameSite regression.
- **Defensive Abuse Scenario (high-level)**: A forged cross-context request that manages to omit all three headers and still carry the cookie would not be blocked by the origin/referer logic; defense rests entirely on SameSite-strict + JSON content-type.
- **Prevention**: Apply the same `Sec-Fetch-Site` strictness used for logout to all mutations, OR require a positive same-origin signal (reject when `origin`, `referer`, and `sec-fetch-site` are all absent on a state-changing request).
- **Detection**: Log mutations lacking all of origin/referer/sec-fetch-site.
- **Analysis (root cause)**: Origin/referer checks are written as "block on mismatch" rather than "require a valid same-origin signal," so total absence passes.
- **Recommendation**: Fail closed when no same-origin signal is present on a mutation. Keep SameSite-strict as defense-in-depth.
- **Tests To Add**: POST with JSON body and no origin/referer/sec-fetch-site is rejected.

### admin-auth-security-04 — Username enumeration via response-timing side channel
- **Severity**: Medium
- **Affected Area**: `apps/admin/src/app/api/auth/login/route.ts:375-392`.
- **Evidence**: The message is unified ("Invalid email or password"), but the **work path differs**: for an unknown/inactive email the route returns immediately after the `findUnique` (lines 378-384) **without running `bcrypt.compare`**; for a known active email it runs `bcrypt.compare` (cost-12, lines 386-392) before returning the same message. The measurable timing delta (one bcrypt hash) is a classic account-enumeration oracle.
- **Risk**: An attacker can distinguish "email exists / is active" from "does not" by timing, narrowing targets for credential stuffing — despite the unified message and rate limit (the RL is keyed on email+IP, so probing many distinct emails from rotating IPs is not strongly bounded, compounding with finding 02).
- **Defensive Abuse Scenario (high-level)**: Measure median response time across an email list to harvest valid admin addresses, then focus password attacks.
- **Prevention**: Run a constant-cost dummy `bcrypt.compare` against a fixed hash when the admin is absent/inactive so both branches do equal work.
- **Detection**: Alert on high-volume login attempts spanning many distinct unknown emails.
- **Analysis (root cause)**: Early return before the hash comparison creates an unequal-work timing oracle.
- **Recommendation**: Add a constant-time decoy comparison on the not-found path.
- **Tests To Add**: response time for unknown vs known email is statistically indistinguishable (or at least a decoy compare is invoked).

### admin-auth-security-05 — IP-rule cache is fail-open with up to ~60s/instance ban lag
- **Severity**: Medium
- **Affected Area**: `apps/admin/src/lib/ip-rules.ts:50-55, 220-262`.
- **Evidence**: `checkIPAccess` serves a per-instance in-memory snapshot refreshed at most once per `CACHE_TTL_MS = 60s`; refresh failures are swallowed and the previous snapshot is served (`refreshCache` catch, lines 234-237; backoff lines 252-258). Documented as intentional "fail-open by design" (module header lines 16-19).
- **Risk**: A newly-written BLACKLIST rule does not take effect for up to ~60s per instance, and if the internal `/api/internal/ip-rules` endpoint is unreachable, deny rules silently stop updating (fail-open). An attacker actively being banned mid-incident retains access during the lag/outage window.
- **Defensive Abuse Scenario (high-level)**: During active abuse, an operator adds a BLACKLIST rule; the attacker continues for the cache window, and if the internal endpoint is degraded, indefinitely.
- **Prevention**: Accept the lag as a documented tradeoff but consider a shorter TTL for BLACKLIST-only refresh, a write-through signal, or fail-closed for explicitly banned IPs when refresh is failing. Auth still gates everything behind this (the IP rule is a coarse pre-filter, not the only control).
- **Detection**: Alert when `refreshCache` fails repeatedly (currently silent).
- **Analysis (root cause)**: Edge-module cache cannot be invalidated by Node route writes; TTL + fail-open chosen for availability.
- **Recommendation**: Add observability on refresh failures; evaluate fail-closed for active BLACKLIST entries.
- **Tests To Add**: stale-window behavior; refresh-failure path keeps serving previous snapshot.

### admin-auth-security-06 — Coarse, self-referential session fingerprint (weak anti-hijack binding)
- **Severity**: Low
- **Affected Area**: `apps/admin/src/lib/session-fingerprint.ts:12-49`; `middleware.ts:766-792`.
- **Evidence**: The fingerprint binds IP at **/24** (IPv4) or **/64** (IPv6) plus normalized UA/accept-language/sec-ch-ua (lines 42-49). It is stored as the JWT `fp` claim and re-validated by recomputing from the *current* request headers (`middleware.ts:769-775`). Because the comparison material is fully attacker-influenceable (all from request headers) and the IP bucket is coarse, a stolen cookie replayed from the **same /24 and same UA** passes. With finding 02 (spoofable IP), the IP component can be forged outright.
- **Risk**: Reduced protection against cookie theft when the attacker is on the same network block or can spoof IP headers and clone the UA. This is defense-in-depth, not the primary control.
- **Defensive Abuse Scenario (high-level)**: Cookie exfiltrated and replayed from the same office /24 with a matching UA string is accepted.
- **Prevention**: Bind the fingerprint to a server-issued high-entropy value stored in the session row (not derivable from request headers), in addition to the coarse network heuristic.
- **Detection**: The existing `SESSION_HIJACK_ATTEMPT` event fires only on mismatch; consider anomaly detection on impossible-travel between buckets.
- **Analysis (root cause)**: Fingerprint material is entirely client-controlled; coarse bucketing trades security for ISP-churn tolerance.
- **Recommendation**: Add a server-side session secret to the binding; keep the IP/UA heuristic as a secondary signal.
- **Tests To Add**: same-/24 + same-UA replay is rejected once a server-side binding is added.

### admin-auth-security-07 — MFA-required role can self-disable MFA (transient required-role-without-MFA state)
- **Severity**: Low
- **Affected Area**: `apps/admin/src/app/api/auth/mfa/disable/route.ts:50-63`; gate in `middleware.ts:735-763` and `auth.ts:358-360`.
- **Evidence**: `mfa/disable` lets any authenticated admin (including ADMIN/SUPER_ADMIN, which `adminRoleRequiresMfa` flags as required) disable MFA after step-up. It revokes sessions immediately. On next login/request the middleware MFA-setup gate and `requireRole` (`FORBIDDEN` when required+!mfaEnabled) force re-enrollment. So this is a **self-imposed re-enrollment**, not a privilege bypass, but it does briefly produce a "required role, MFA off" account state and forces a re-setup loop.
- **Risk**: Operational friction / potential confusion; not a direct security bypass because the gates re-force enrollment and sensitive step-up `requireMfa` paths refuse when role-required+!enrolled (`auth.ts:577-587`).
- **Prevention**: For MFA-required roles, either block self-disable outright or require enrolling a replacement factor in the same transaction.
- **Detection**: `MFA_DISABLED` audit already written; alert when the actor is an MFA-required role.
- **Analysis (root cause)**: Disable is role-agnostic; the enforcement that "required roles must have MFA" lives only at the gates, not at the disable action.
- **Recommendation**: Reject self-disable for ADMIN/SUPER_ADMIN (or require re-enroll), aligning the action with the gate policy.
- **Tests To Add**: ADMIN/SUPER_ADMIN disable is rejected or immediately requires re-enroll.

### admin-auth-security-08 — Session revoke-handle secret falls back to a hardcoded dev default
- **Severity**: Low
- **Affected Area**: `apps/admin/src/app/api/auth/sessions/route.ts:17-23`.
- **Evidence**: `getRevokeHandleSecret()` chains `ADMIN_SESSION_HANDLE_SECRET || ADMIN_JWT_SECRET || JWT_SECRET || AUTH_SECRET || "dev-admin-session-revoke-handle-secret"`. If none of the env vars are set, a **publicly-known constant** keys the HMAC that signs session revoke handles. (In practice `ADMIN_JWT_SECRET` is required ≥32 chars by middleware/auth, so the literal fallback is effectively unreachable in a correctly-configured deploy — hence Low.)
- **Risk**: In a misconfigured environment lacking all four secrets, revoke-handle signatures become forgeable, enabling crafted handles to target arbitrary session rows (revoke is still gated by `requireAdmin` + step-up for cross-admin, limiting blast radius).
- **Prevention**: Remove the literal fallback; throw if no secret is configured (mirroring `ADMIN_JWT_SECRET`'s hard requirement).
- **Detection**: Startup assertion / config check.
- **Analysis (root cause)**: Defensive default-to-constant to avoid crashes in dev.
- **Recommendation**: Fail closed on missing secret.
- **Tests To Add**: missing-secret config throws rather than using the literal.

### Items reviewed and found sound (no finding)
- **XSS**: strict CSP with per-request nonce, no `unsafe-inline` script in prod, `frame-ancestors 'none'` (`middleware.ts:194-224`). New-location email escapes interpolated values (`admin-known-ip.ts:39-43, 59-71`).
- **Injection**: Prisma parameterized queries throughout; zod `.strict()` body schemas on login/team/set-password.
- **Set-password token security**: 32-byte base64url tokens, only sha256 stored, single-use atomic consume, 48h TTL, supersede-prior (`admin-invite.ts`). Strong.
- **Internal shared-secret auth**: constant-time compare, per-kind secrets, no cross-broadening (`internal-secrets.ts:18-46`).
- **RBAC matrix**: fail-closed, last-SUPER_ADMIN guard, no self-promote/self-deactivate, no editing equal/higher role, MFA-gated step-up on sensitive changes (`team/[id]/route.ts`).
- **Impersonation (admin side)**: SUPER_ADMIN-only, step-up MFA, target-not-deleted check, token never in URL, user notified, audited (`users/[id]/impersonate/route.ts`).
- **Secret logging**: limiter errors scrub URLs/Bearer/long tokens before logging (`middleware.ts:455-462`, `login/route.ts:165-172`); audit payload redacted (`audit.ts:100-105`).

## 14. Performance Audit

- `requireAdmin` does a `findUnique` per request + a `lastActivity` `updateMany` on every gated request (`auth.ts:322, 337-341`) — a write on every API call. Acceptable for admin volume but is an avoidable write amplification; could be throttled (e.g. update at most every N seconds).
- `requireRole` adds a second `adminUser.findUnique` after `requireAdmin` (`auth.ts:351`) — two reads of the same row per permissioned request. Could be merged.
- `requirePermission` → `requireRole` → `checkPermission` performs a **third** `findUnique` (`auth.ts:695`, with `include: permissions`). Three sequential admin reads per gated mutation. N+1-ish per request; cacheable within the request.
- Session listing caps at 100 / candidate scan at 500 (`sessions/route.ts:79, 126`) — bounded.
- Middleware runs IP-rule check + rate limit + fingerprint hash (SHA-256) per request — cheap; fingerprint uses WebCrypto.
- No image/bundle concerns in this module (login page is light).

## 15. Reliability Audit

- **Audit never throws** (`audit.ts:138-145`) — operator actions don't 500 on logging failure; tradeoff is silent audit gaps (logged to console).
- **Login is resilient**: login-log writes wrapped in try/catch (`login/route.ts:97`), email best-effort, rate-limit fail-open when Redis absent / fail-closed when Redis errors (503).
- **`refreshSessionCookie`** new-row `create` is `.catch(() => null)` (`auth.ts:219-225`): if it fails, the freshly-issued JWT has no matching active DB row, so the very next `getSession` clears the cookie → admin bounced to login mid-MFA-enable/rotation. Fail-safe but degrades UX; no retry/monitoring.
- **Key rotation** uses a distributed lock + dry-run preflight + partial-failure audit metadata — robust.
- **Partial failure**: team update wraps user+permissions in `$transaction` (`team/[id]/route.ts:193-209`); session revoke is outside the transaction (acceptable — revocation is additive safety).
- **Monitoring/logging**: security-monitor is **in-memory only** (`security-monitor.ts:35-72`), so anomaly counters reset on deploy/restart and don't aggregate across instances — brute-force/credential-stuffing detection is best-effort per-instance. The hard limiters (login RL, step-up lockout) are the real control; this is supplementary alerting.

## 16. Dead Code / Cleanup

- `apps/admin/src/lib/auth-cookie.test.ts` exists but there is **no `auth-cookie.ts`** source file in `lib/` — the cookie helpers live in `auth.ts`. The test name suggests a former standalone module. [needs verification that the test targets `auth.ts` exports rather than a deleted file.]
- `PUBLIC_PREFIX_PATHS` is an empty array (`middleware.ts:33`) and the `isPublicPath` prefix branch can never match — minor dead branch; harmless, likely a placeholder for future public prefixes.
- `validateFingerprint` (`auth.ts:304-314`) is exported but the live fingerprint check is performed inline in middleware; confirm callers. [needs verification — could be used by tests/other routes.]
- No abandoned routes detected in scope; every API in the inventory maps to a page or internal caller.

## 17. Tests

Existing (unit) — strong coverage on primitives:
- `ip-rules.test.ts`, `auth-step-up.test.ts`, `auth-step-up-store.test.ts`,
  `admin-permissions.test.ts`, `admin-permissions-seed-parity.test.ts`,
  `admin-roles.test.ts`, `admin-invite.test.ts`, `session-fingerprint.test.ts`,
  `auth-cookie.test.ts`, `page-guard.test.ts`, `audit.test.ts`,
  `internal-secrets.test.ts`, `middleware.test.ts` (CSP/public-path/RSC only),
  `packages/shared/src/trusted-client-ip.test.ts`,
  `apps/web/src/app/api/internal/impersonate/route.test.ts`,
  `apps/web/src/app/api/auth/impersonate-handoff/route.test.ts`.

Missing / suggested:
- **Login integration**: enumeration timing parity; lockout after 5 attempts;
  MFA-required gate; new-network MFA challenge ignoring trusted-device cookie;
  backup-code single-use CAS under concurrency.
- **CSRF middleware**: header-absent mutation rejection (finding 03).
- **Proxy IP**: production-mode-unset forged `x-forwarded-for` does not bypass RL
  (finding 02).
- **Impersonation web endpoint**: reject unknown/inactive `adminId` (finding 01).
- **Session fingerprint**: same-/24 replay (finding 06).
- **RBAC e2e**: ADMIN cannot edit/elevate another ADMIN/SUPER_ADMIN; last-SUPER_ADMIN
  protection; demotion revokes access via fresh role read.
- **MFA disable** for required roles (finding 07).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| admin-auth-security-01 | High | Security | Web impersonate endpoint trusts unverified `adminId` | Spoofable audit actor; broad blast radius if handoff secret leaks | Validate adminId (exists/active/role) server-side on web | `apps/web/src/app/api/internal/impersonate/route.ts` |
| admin-auth-security-02 | High | Security | Default `compat` proxy mode trusts client IP headers | IP rules, login RL/lockout, fingerprint, known-IP MFA all spoofable | Require explicit `TRUSTED_PROXY_HEADERS` in prod; document; fail closed | `packages/shared/src/trusted-client-ip.ts`, `apps/admin/src/middleware.ts`, `.../api/auth/login/route.ts` |
| admin-auth-security-03 | Medium | Security | CSRF header-absent pass-through for non-logout mutations | Residual CSRF if SameSite/JSON defenses regress; legacy clients | Require a positive same-origin signal on all mutations | `apps/admin/src/middleware.ts` |
| admin-auth-security-04 | Medium | Security | Login username enumeration via bcrypt timing | Account discovery despite unified message | Constant-cost decoy compare on not-found path | `apps/admin/src/app/api/auth/login/route.ts` |
| admin-auth-security-05 | Medium | Reliability | IP-rule cache fail-open + ~60s ban lag | Banned IP retains access during lag/refresh outage | Observability on refresh fail; fail-closed for active BLACKLIST | `apps/admin/src/lib/ip-rules.ts` |
| admin-auth-security-06 | Low | Security | Coarse, header-derived session fingerprint | Weak cookie-theft binding (same /24 + UA passes) | Add server-side session secret to the binding | `apps/admin/src/lib/session-fingerprint.ts`, `middleware.ts` |
| admin-auth-security-07 | Low | Logic | MFA-required role can self-disable MFA | Transient required-role-without-MFA + re-setup loop | Block self-disable for ADMIN/SUPER_ADMIN or require re-enroll | `apps/admin/src/app/api/auth/mfa/disable/route.ts` |
| admin-auth-security-08 | Low | Security | Revoke-handle HMAC has hardcoded dev-default fallback | Forgeable handles only if all secret envs unset (unlikely) | Remove literal fallback; fail closed | `apps/admin/src/app/api/auth/sessions/route.ts` |
| admin-auth-security-09 | Info | Performance | 3 sequential AdminUser reads + per-request lastActivity write on gated calls | Write amplification / extra reads | Memoize admin row per request; throttle lastActivity | `apps/admin/src/lib/auth.ts` |
| admin-auth-security-10 | Info | Reliability | security-monitor anomaly counters are in-memory only | Detection resets per deploy / not cross-instance | Back anomaly counters with Redis or accept as supplementary | `apps/admin/src/lib/security-monitor.ts` |
| admin-auth-security-11 | Info | Dead Code | `auth-cookie.test.ts` with no `auth-cookie.ts`; empty `PUBLIC_PREFIX_PATHS`; possibly-unused `validateFingerprint` | Minor clutter | Confirm and prune/rename | `apps/admin/src/lib/auth-cookie.test.ts`, `middleware.ts`, `auth.ts` |

## 19. Module TODO

- [ ] **admin-auth-security-01 (High)** — Validate `adminId` on web impersonate endpoint. Reason: spoofable audit actor / over-trusted secret. Files: `apps/web/src/app/api/internal/impersonate/route.ts`. Fix: look up adminId (active + SUPER_ADMIN) before minting/persisting; reject otherwise. Dependencies: shared DB access to AdminUser [needs verification]. Complexity: low. Risk of change: low.
- [ ] **admin-auth-security-02 (High)** — Require explicit `TRUSTED_PROXY_HEADERS` in production; add to `.env.example`; fail closed when unset in prod-like runtimes. Files: `packages/shared/src/trusted-client-ip.ts`, deployment env. Fix: change default behavior for prod; document. Dependencies: knowledge of the real edge (CF/DO/Vercel). Complexity: low. Risk of change: medium (misconfig could mark all IPs unknown).
- [ ] **admin-auth-security-03 (Medium)** — Fail closed on mutations lacking origin/referer/sec-fetch-site. Files: `apps/admin/src/middleware.ts`. Fix: extend the same-origin requirement beyond logout. Dependencies: none. Complexity: low. Risk of change: medium (could break non-browser internal callers — exclude `/api/internal`/`/api/cron`, already excluded).
- [ ] **admin-auth-security-04 (Medium)** — Add constant-cost decoy bcrypt on unknown-email login path. Files: `apps/admin/src/app/api/auth/login/route.ts`. Fix: compare against a fixed dummy hash when admin absent/inactive. Dependencies: none. Complexity: low. Risk of change: low.
- [ ] **admin-auth-security-05 (Medium)** — Add refresh-failure observability and evaluate fail-closed for active BLACKLIST. Files: `apps/admin/src/lib/ip-rules.ts`. Fix: log/alert on refresh failure; optional shorter TTL for deny rules. Dependencies: alerting. Complexity: medium. Risk of change: medium (fail-closed could lock out on internal-endpoint outage).
- [ ] **admin-auth-security-06 (Low)** — Bind session fingerprint to a server-issued secret stored on the session row. Files: `apps/admin/src/lib/session-fingerprint.ts`, `auth.ts`, `middleware.ts`. Dependencies: session schema. Complexity: medium. Risk of change: medium (invalidates existing sessions).
- [ ] **admin-auth-security-07 (Low)** — Block MFA self-disable for ADMIN/SUPER_ADMIN or require replacement factor. Files: `apps/admin/src/app/api/auth/mfa/disable/route.ts`. Complexity: low. Risk of change: low.
- [ ] **admin-auth-security-08 (Low)** — Remove hardcoded revoke-handle secret fallback; fail closed. Files: `apps/admin/src/app/api/auth/sessions/route.ts`. Complexity: low. Risk of change: low.
- [ ] **admin-auth-security-09 (Info)** — Memoize the admin row across `requireAdmin`/`requireRole`/`checkPermission`; throttle `lastActivity`. Files: `apps/admin/src/lib/auth.ts`. Complexity: medium. Risk of change: low.
- [ ] **admin-auth-security-10 (Info)** — Back security-monitor counters with Redis or document as supplementary. Files: `apps/admin/src/lib/security-monitor.ts`. Complexity: medium. Risk of change: low.
- [ ] **admin-auth-security-11 (Info)** — Confirm and prune dead code (`auth-cookie.test.ts` target, empty `PUBLIC_PREFIX_PATHS`, `validateFingerprint`). Complexity: low. Risk of change: low.
