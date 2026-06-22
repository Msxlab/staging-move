# Flow Audit: Admin Impersonation

Scope: Admin login -> MFA step-up -> impersonate a user -> scoped actions in the web app -> audit log.
Read-only audit. Evidence is source code only; doc/comment claims are marked [needs verification].

---

## 1. Flow Summary & Actors

Actors:
- SUPER_ADMIN operator (admin app, `apps/admin`).
- Target end user (`User` model, web app `apps/web`).
- Web app internal handoff endpoint (server-to-server, secret-authenticated).

Intended flow (per route docstrings):
1. Admin signs in at `apps/admin/src/app/login/page.tsx` -> `POST /api/auth/login` (password + MFA + optional trusted-device).
2. Admin opens a user detail page and triggers impersonation -> `POST /api/users/:id/impersonate` (`apps/admin/src/app/api/users/[id]/impersonate/route.ts`).
3. That route enforces SUPER_ADMIN + password/MFA step-up, then calls the web app `POST /api/internal/impersonate` (`apps/web/src/app/api/internal/impersonate/route.ts`) authenticated by `IMPERSONATION_HANDOFF_SECRET`.
4. Web mints a 15-minute user JWT, writes a `UserLoginSession` row with `impersonatedByAdminId`, returns a one-time handoff token + `handoffUrl`.
5. Client POSTs the token to `POST /api/auth/impersonate-handoff` (`apps/web/src/app/api/auth/impersonate-handoff/route.ts`), which consumes the handoff row, mints a browser `user_session` cookie, and redirects to `/dashboard`.
6. The web app shows a persistent banner (`apps/web/src/components/layout/impersonation-banner.tsx`); per the docstrings every mutation during impersonation is meant to be audited via `recordImpersonatedMutation` (`apps/web/src/lib/impersonation-audit.ts`).

KEY GAP found during the trace: **No UI entry point invokes step 2** (see `admin-impersonation-01`), and **`recordImpersonatedMutation` is never called by any route** (see `admin-impersonation-02`), so the "scoped actions" and "audit log per request" portions of the flow do not actually exist in the running product.

---

## 2. Step-by-step Trace

### Step A — Admin authentication (prerequisite)
- Trigger: operator submits the admin login form. Component: `apps/admin/src/app/login/page.tsx` -> `fetch("/api/auth/login")`.
- State: `mfaRequired` toggled on 403 `requiresMfa`. On success `window.location.assign("/")`.
- API: `POST /api/auth/login` (admin). Session is a JWT cookie `admin_session`, IP-bucket + UA fingerprinted, DB-tracked in `AdminSession` (`apps/admin/src/lib/auth.ts:144-174, 230-298`).
- Role/MFA: `requireRole` re-reads role from DB and forces MFA enrollment for MFA-required roles (`auth.ts:347-378`).

### Step B — Start impersonation
- Trigger: intended to be a button on the user-detail page. **None exists** (see Findings).
- File: `apps/admin/src/app/api/users/[id]/impersonate/route.ts`.
- Authz: `requirePermission("users","canUpdate",{ minimumRole:"SUPER_ADMIN" })` (route.ts:36-38). SUPER_ADMIN short-circuits `checkPermission` (`auth.ts:703`).
- Step-up: `requirePasswordConfirm(session, confirmPassword, { operation:"user_impersonation", requireMfa:true, mfaCode, backupCode, ... })` (route.ts:57-64). On failure writes `USER_IMPERSONATION_FAILED` audit and returns 403 (route.ts:65-82).
- Target lookup: `prisma.user.findFirst({ where:{ id:userId, deletedAt:null } })` (route.ts:84-87); 404 + audit if missing (route.ts:88-101).
- Handoff secret: `getInternalCallerSecret("impersonation")`; 503 + audit if unset (route.ts:113-134).
- Cross-app call: `fetch(`${webBase}/api/internal/impersonate`, { Authorization: Bearer <secret>, body:{ userId, adminId, ttlMinutes:15 } })` (route.ts:136-149). Non-OK -> 502 + audit (route.ts:151-170).
- Audit: `USER_IMPERSONATION_STARTED` with masked email, `expiresAt`, `reasonLength` only (route.ts:178-190).
- Side effect: `notifyUserOfAdminChange(...)` records an in-app `Notification` + de-bounced email to the user (route.ts:195-204; helper `apps/admin/src/lib/user-notify.ts`).
- Response: `{ handoffUrl, handoffMethod:"POST", handoffToken, expiresAt, userEmail }` (route.ts:206-212).

### Step C — Mint impersonation session (web internal)
- File: `apps/web/src/app/api/internal/impersonate/route.ts`.
- Authz: `verifyInternalAuth(authHeader,"impersonation")` constant-time compare against `IMPERSONATION_HANDOFF_SECRET` (route.ts:42-45; `apps/web/src/lib/internal-secrets.ts:36-78`). CRON_SECRET explicitly not accepted.
- Validation: zod, `ttlMinutes` capped 1..15, server re-caps `Math.min(ttlMinutes,15)` (route.ts:32-56).
- Target re-check: `findFirst({ id, deletedAt:null })` (route.ts:58-64).
- JWT: `SignJWT({ userId, email, impersonatedByAdminId:adminId })` HS256, `${ttlSeconds}s` expiry, signed with USER_JWT_SECRET. **No `fp` claim** -> the resulting browser cookie is not UA/IP-bound (route.ts:66-77).
- DB op: `userLoginSession.create` with `impersonatedByAdminId`, `deviceType:"IMPERSONATION"`, `isActive:true`, `expiresAt` (route.ts:83-101). Schema-compat fallback drops the column if missing.
- Response: `{ token, handoffUrl, expiresAt, userEmail }` (route.ts:109-114).

### Step D — Exchange handoff token for browser cookie
- File: `apps/web/src/app/api/auth/impersonate-handoff/route.ts`. Public route (middleware allow-list `apps/web/src/middleware.ts:106-109`).
- Token only accepted in POST body (GET redirects to sign-in) (route.ts:188-203).
- Verify JWT; require `impersonatedByAdminId` + `userId` string claims (route.ts:24-44).
- Find the handoff `UserLoginSession` by `tokenHash` with `impersonatedByAdminId != null`, `isActive:true` (route.ts:46-82).
- Consume atomically: `updateMany({ where:{ id, isActive:true, expiresAt:{gt:now} }, data:{ isActive:false } })`; require `count===1` (route.ts:97-113). Prevents replay for the JWT's full TTL.
- Mint browser JWT (carrying `impersonatedByAdminId`) + create a second `UserLoginSession`, set `user_session` cookie `httpOnly, sameSite:lax, secure?`, `maxAge` = remaining window (route.ts:115-185).
- Audit: `AdminAuditLog` `IMPERSONATE_HANDOFF` (route.ts:159-175).
- Redirect 307 -> `/dashboard`.

### Step E — Scoped actions during impersonation
- Banner: `ImpersonationBanner` reads `/api/auth/me` -> `getUserSession().impersonatedByAdminId` (`apps/web/src/lib/user-auth.ts:660-674`).
- The impersonated cookie is an ordinary user session for ALL route handlers. Middleware (`apps/web/src/middleware.ts`) and `getUserSession` apply no extra restriction for impersonated sessions.
- Per-mutation audit (`recordImpersonatedMutation`) is **defined but never invoked** by any route handler (only its own test calls it). Mutating user routes such as `apps/web/src/app/api/auth/security/route.ts` do not call it.
- User-side sensitive actions are gated by `verifyUserStepUp` (`apps/web/src/lib/user-step-up.ts`), which requires the USER's own password/MFA — credentials the admin does not possess — so those specific actions (account deletion, data export, workspace transfer) are effectively blocked. Non-step-up mutations are not blocked.

---

## 3. Happy-path Correctness

When driven directly via API, the backend chain is coherent: SUPER_ADMIN + step-up -> secret-authenticated internal mint -> one-time handoff -> cookie. Replay protection (atomic consume), TTL capping (<=15m server-side), token-not-in-URL, masked-email audit, and a non-dismissible banner are all implemented and unit-tested (`route.test.ts` files for all three endpoints). The handoff token is single-use; a second exchange returns `impersonation-session-consumed`.

However, the happy path is not reachable through the product UI (no caller), and the audit guarantee for in-session actions is not wired up. See Findings.

---

## 4. Edge Cases & Reverse-logic

- Auth/role: MODERATOR/ADMIN cannot impersonate (minimumRole SUPER_ADMIN + SUPER_ADMIN-only short-circuit). Good.
- Step-up bypass: grace-window cache in `requirePasswordConfirm` (`auth.ts:500-507`) means a prior `user_impersonation`-scoped confirm within `DEFAULT_CONFIRM_GRACE_MS` (10 min) is reused. Cache key is scoped per-operation and per-assurance (`scopedStepUpCacheKey`), so a password-only confirm for another op cannot satisfy the MFA-required impersonation confirm. Acceptable but means a second impersonation within 10 min needs no re-auth.
- Empty/invalid input: missing body -> step-up fails closed (route.ts:54-56). zod guards internal route.
- Network failure: internal `fetch` rejection -> 502 Response + `USER_IMPERSONATION_FAILED` audit (route.ts:147-170). Good.
- Double-submit/idempotency: handoff consume is atomic (`updateMany count===1`). But the admin route is NOT idempotent — each call mints a new handoff session row; multiple clicks create multiple active impersonation sessions (low impact, all expire <=15m).
- Token expiry: handoff route checks `expiresAt <= now` -> redirect `impersonation-expired` (route.ts:89-93). Browser cookie maxAge bounded to remaining window.
- Partial failure: if `userLoginSession.create` in the internal route succeeds but the response is lost, the admin route returns 502 and the orphan handoff row simply expires unused. Acceptable.
- Stale data: target re-checked for `deletedAt:null` in BOTH admin and internal routes. A user soft-deleted between the two checks is still caught by the internal route.
- Direct deep-link: `/api/auth/impersonate-handoff` is public but requires a valid USER_JWT_SECRET-signed token AND a matching active DB row, so it cannot be abused without the secret-minted token.
- No `fp` claim on the impersonation JWT: the cookie is portable across devices for up to 15 minutes (intentional per comment, but see security note).

---

## 5. Security Review

Authz at each step: SUPER_ADMIN gate (admin route), shared-secret (internal route), signed-token + DB row (handoff). Constant-time secret compare. Token never in URL. These are sound.

Concerns:
- `admin-impersonation-02` (audit gap): in-session mutations are not attributed. The product cannot answer "what did the admin do while acting as this user", defeating the forensic purpose stated in the impersonation docstrings.
- `admin-impersonation-04` (no positive scoping): the impersonated session is a full-privilege user session. Any non-step-up user mutation (e.g., revoking the user's other login sessions via `/api/auth/security` `revoke_other_sessions`, editing profile, changing preferences, initiating billing flows) is allowed and unlogged. There is no allow/deny list restricting what an impersonator may do.
- `admin-impersonation-05` (portable cookie): the impersonation JWT omits `fp`, so the 15-minute cookie is not bound to the admin's browser/device. If the cookie leaks (logs, proxy, shared machine) it is replayable from anywhere until expiry. The single-use protection is on the HANDOFF token, not on the final browser cookie.
- `admin-impersonation-06` (transparency debounce): `notifyUserOfAdminChange` suppresses the email (keeps only in-app notification) if any admin-change notification was sent to that user in the prior 5 minutes (`user-notify.ts:92-126`). An admin who edits the user and then impersonates within 5 minutes silences the impersonation email — weakening the GDPR-aligned transparency the route claims.
- IDOR / workspace scoping: not applicable to the start flow (SUPER_ADMIN intentionally crosses tenants). Once impersonating, normal per-user/workspace scoping in downstream routes applies to the impersonated identity.
- Rate limiting: admin middleware applies route rate limiting (`apps/admin/src/middleware.ts:657`), and `requirePasswordConfirm` has its own failure lockout (8 failures / 5 min). Adequate.
- Secrets/PII: audit stores only masked email + `reasonLength`. However the raw operator `reason` string is interpolated into the user-facing notification/email and stored unredacted in `Notification.metadata` (`impersonate/route.ts:200`, `user-notify.ts:119-123`) — low severity but worth noting if reasons may contain internal/case data.

---

## 6. Reliability

- Audit writes never throw (`writeAdminAudit`, `recordImpersonatedMutation` use `.catch`). Good.
- Handoff consume is transactional via conditional `updateMany`. Good.
- Schema-compat fallbacks tolerate a missing `impersonatedByAdminId` column, but on that legacy path the impersonation marker is silently dropped from the created session row (internal route.ts:99-101), so the banner and any future audit would not fire. [needs verification of whether the column is guaranteed present in the target DB] — the column IS in `schema.prisma:155`, so the fallback should be dead in a migrated DB.
- Loading/empty/error UX: cannot be assessed — there is no UI for this flow.
- No transaction wraps the two-session create across the internal + handoff routes; orphan rows expire harmlessly.

---

## 7. Cross-module Impact

- DB: `UserLoginSession.impersonatedByAdminId` (`packages/db/prisma/schema.prisma:137-161`), `AdminAuditLog` (shared across both apps, `:1347-1363`).
- Auth: `apps/web/src/lib/user-auth.ts` surfaces `impersonatedByAdminId`; `apps/admin/src/lib/auth.ts` step-up.
- Notifications/email: `apps/admin/src/lib/user-notify.ts` (in-app + email).
- Secrets: `IMPERSONATION_HANDOFF_SECRET` via `internal-secrets.ts` in both apps.
- Audit shared field-length mismatch: web `impersonation-audit.ts:38` slices `action` to 20 chars (legacy `VarChar(20)`), while the current `AdminAuditLog.action` is `VarChar(64)` (`schema.prisma:1358`). Not a runtime bug (20<64) but inconsistent and would silently truncate any future action label >20 chars written via that helper. Low/Info.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| admin-impersonation-01 | High | Dead Code | `POST /api/users/:id/impersonate` has no UI caller anywhere in admin or web | Documented flow is unreachable through the product; either an unfinished feature shipping dead backend surface, or an undocumented API-only capability that bypasses the UX controls reviewers assume exist | Either build the UI entry (button + handoff POST) or remove/flag the endpoint; confirm intended exposure | `apps/admin/src/app/api/users/[id]/impersonate/route.ts`; `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx` |
| admin-impersonation-02 | High | Logic | `recordImpersonatedMutation` is never invoked by any route handler (only its own test) | The core guarantee ("every mutation during impersonation writes an AdminAuditLog row") does not exist; in-session admin actions are unattributable forensically | Call `recordImpersonatedMutation` from mutating web routes (or centralize in a wrapper) when `session.impersonatedByAdminId` is set | `apps/web/src/lib/impersonation-audit.ts`; `apps/web/src/app/api/**/route.ts` |
| admin-impersonation-04 | Medium | Security | Impersonated session is a full-privilege user session with no action allow/deny scoping | An impersonator can perform any non-user-step-up mutation as the user (profile edits, session revocation, preference/billing flows) with no restriction and no audit (see -02) | Define an impersonation policy: block destructive/self-security actions while impersonating, or at minimum audit them | `apps/web/src/lib/user-auth.ts`; `apps/web/src/middleware.ts`; `apps/web/src/app/api/auth/security/route.ts` |
| admin-impersonation-05 | Medium | Security | Impersonation browser cookie omits the `fp` claim, so it is not device/UA-bound for the 15-min window | A leaked impersonation cookie is replayable from any device until expiry; single-use protection covers only the handoff token, not the final cookie | Bind the minted browser session to the admin's UA (or a short, IP-bucketed fp); shorten TTL; consider re-validating origin | `apps/web/src/app/api/internal/impersonate/route.ts:66-77`; `apps/web/src/app/api/auth/impersonate-handoff/route.ts:119-127` |
| admin-impersonation-06 | Low | Reliability | Impersonation transparency email is suppressed by the 5-min `notifyUserOfAdminChange` debounce | If the admin edited the user within 5 min before impersonating, the user never receives the impersonation email (only an in-app notice), weakening the stated GDPR transparency | Exempt the `impersonationStarted` change from the email debounce, or send a dedicated always-on impersonation email | `apps/admin/src/lib/user-notify.ts:92-126`; `apps/admin/src/app/api/users/[id]/impersonate/route.ts:195-204` |
| admin-impersonation-07 | Low | Security | Operator-typed `reason` is stored/sent unredacted in user-facing notification + `Notification.metadata`, while the audit log stores only `reasonLength` | Asymmetric handling: free-text possibly containing internal/case context is exposed to the user and persisted unredacted, but is NOT in the admin audit trail | Decide a single policy: redact/cap the reason for the user-facing surface and/or include a redacted reason in the audit row | `apps/admin/src/app/api/users/[id]/impersonate/route.ts:200`; `apps/admin/src/lib/user-notify.ts:119-123` |
| admin-impersonation-08 | Info | Data | Web `impersonation-audit.ts` slices `action` to 20 chars; current `AdminAuditLog.action` is `VarChar(64)` | Inconsistent length cap; would silently truncate future action labels >20 chars written via this helper | Align the slice to 64 (schema) for consistency | `apps/web/src/lib/impersonation-audit.ts:38`; `packages/db/prisma/schema.prisma:1358` |
| admin-impersonation-09 | Info | Reliability | Admin impersonate route is non-idempotent; repeated calls mint multiple active impersonation sessions | Multiple short-lived sessions per target (low impact; all expire <=15m) | Optional: dedupe active impersonation sessions per (admin,user) before minting | `apps/admin/src/app/api/users/[id]/impersonate/route.ts:136-149` |

---

## 9. Flow TODO

- Confirm intended exposure of `POST /api/users/:id/impersonate` (UI feature vs. API-only). [admin-impersonation-01]
- Wire `recordImpersonatedMutation` into mutating web routes or a shared handler. [admin-impersonation-02]
- Decide and implement an impersonation action policy (block vs. audit). [admin-impersonation-04]
- Bind the impersonation browser cookie to the admin device and/or shorten TTL. [admin-impersonation-05]
- Exempt impersonation notice from the email debounce. [admin-impersonation-06]
- [needs verification] Confirm the `impersonatedByAdminId` schema-compat fallback paths are dead in the deployed DB (column exists in schema).
