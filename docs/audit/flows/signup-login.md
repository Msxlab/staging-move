# Flow Audit: Signup / Login / Session

Area slug: `signup-login`
Scope: account creation -> email verification -> sign-in -> JWT session issuance -> post-auth redirect; OAuth (Google/Apple) path; lockout. Web app only (`apps/web`). Evidence is source code; doc claims are marked `[needs verification]`.

---

## 1. Flow Summary & Actors

Actors:
- Anonymous visitor (sign-up / sign-in / forgot-password).
- Authenticated user (session-bearing, may be email-unverified).
- OAuth provider (Google / Apple) — supplies a verified email + provider id.
- Operator (kill-switch via runtime config; impersonation via SUPER_ADMIN).
- Background side effects: transactional email (Resend), admin signup alert, analytics (`trackEvent`), security audit log, security-event sink.

Custom JWT auth via `jose` (HS256), secret `USER_JWT_SECRET` (`apps/web/src/lib/user-jwt-secret.ts`). Session = signed JWT (30d) in an httpOnly cookie `user_session` **plus** a DB row `userLoginSession` (tokenHash-indexed). Middleware does an edge-safe JWT-signature-only check; route handlers do the full DB + fingerprint + canonical-user check via `getUserSession` / `requireDbUserId` (`apps/web/src/lib/user-auth.ts`).

---

## 2. Step-by-step Trace

### A. Account creation (email/password)
1. Trigger: user submits `/sign-up` form (`apps/web/src/app/sign-up/page.tsx:100` `handleSubmit`).
2. State: `loading`, `error`, `done`, `requiresEmailVerification`. On success the page shows a "check email" / "account ready" card; it does **not** auto-sign-in.
3. API: `POST /api/auth/register` (`apps/web/src/app/api/auth/register/route.ts`).
   - Parse + zod (`registerSchema`, password `min(12).max(200)`).
   - Rate limit `auth_register` (email_ip, 6/10min, failClosed) — note: this runs **before** body validation of the password but after JSON parse.
   - `areSignupsKilled()` kill switch -> 503.
   - Legal consents normalized (optional; only enforced when present).
   - `validatePasswordPolicy` (>=12, upper/lower/digit/special).
   - COPPA age gate (inert unless `COPPA_AGE_GATE_ENABLED`).
   - Existence check via **`rawPrisma`** (sees soft-deleted rows) -> 409 for both active and soft-deleted (unless allowlisted QA/store-review email).
   - `hashPassword` (bcrypt cost 12) -> `prisma.user.create`.
   - `ensureSubscriptionDefaults`, (`applyQaPersonaSubscriptionForUser`), `ensureWorkspaceDefaults` — **all awaited sequentially, not in a transaction**.
   - `sendAdminSignupAlert` (fire-and-forget).
   - `recordLegalAcceptance` (awaited if consents).
   - Email verification token (24h) created; `sendEmailVerificationEmail` fire-and-forget.
   - Returns 201 `{ success, userId, emailVerified, requiresEmailVerification }`.
4. DB: `User`, `EmailVerificationToken`, subscription/workspace defaults, `UserEvent` (legal). 
5. Cache invalidation: none relevant.
6. Side effects: admin alert email, verification email, analytics on client.

### B. Email verification
1. Trigger: user clicks emailed link -> `/verify-email/[token]` (`apps/web/src/app/verify-email/[token]/page.tsx`), which immediately `POST`s the token.
2. API: `POST /api/auth/verify-email` (`apps/web/src/app/api/auth/verify-email/route.ts`).
   - IP rate limit 10/10min failClosed; then per-user 5/10min after token lookup.
   - `findUnique` by tokenHash; reject if missing/consumed/expired/deleted-user.
   - Atomic claim in `$transaction`: `updateMany` set `consumedAt` where `consumedAt: null && expiresAt > now` (count must be 1) then set `user.emailVerifiedAt`. Good single-use/race handling.
   - `sendWelcomeEmail` (best-effort). Returns `{ success }`.
3. The pending page `/verify-email` (`apps/web/src/app/verify-email/page.tsx`) is a server component that redirects verified users and offers `ResendVerificationButton` -> `POST /api/auth/resend-verification` (session-gated, IP 5/10min + user 3/30min).

### C. Sign-in (password)
1. Trigger: `/sign-in` form (`apps/web/src/app/sign-in/page.tsx:98`).
2. API: `POST /api/auth/login` -> `handlePasswordLogin(request, { clientType: "web", exposeBearerToken: false })` (`apps/web/src/lib/password-login.ts`).
   - Pre-parse IP burst limit (`public_read`).
   - zod parse.
   - Per-(email,IP) `auth_login` policy limit (12/15min) — key omits UA deliberately.
   - `isLoginLocked(lockKey)` (5 failures/15min -> 30min lock; Redis with fail-closed-in-prod, else in-memory) — checked **before** bcrypt.
   - `prisma.user.findFirst({ where: { email, deletedAt: null }})`.
   - If no user or no passwordHash: `equalizePasswordTiming` (constant-time anti-enumeration), record failure, return generic 401.
   - `verifyPassword` (bcrypt). On fail: audit `LOGIN_FAILED`, record failure, generic 401.
   - Store-review accounts auto-verify + provision.
   - MFA (only after correct password): if `mfaEnabled && mfaSecret`, require `mfaCode`/`backupCode` (403 `requiresMfa`), per-(user,method) `mfa_verify` limit, TOTP or single-use backup-code (atomic `updateMany` guarded by old JSON value).
   - `clearLoginFailures`; QA persona; compute fingerprint (`generateMobileFingerprint`/`generateFingerprint`); `createUserSession` (JWT + DB row + cookie). Audit `LOGIN`.
   - Returns `{ success, user: {...} }` (no token for web). `emailVerified` returned for the client gate.
3. Client: if `data.user.emailVerified === false` -> `router.replace('/verify-email?redirect=...')`; else `router.replace(redirectTo)`.

### D. Session issuance / validation
- `createUserSession` (`user-auth.ts:253`): signs JWT with `userId,email,fp,fpMode`, 30d expiry; stores `userLoginSession` row (tokenHash = sha256(jwt), expiresAt 30d); sets httpOnly `user_session` cookie (`secure` per `shouldUseSecureSessionCookies`, sameSite=lax, maxAge 30d).
- `getUserSession` (`user-auth.ts:469`): collects cookie + bearer candidates; per candidate: jwtVerify -> DB `userLoginSession` lookup (isActive) -> userId match -> email claim -> fingerprint check (UA-bound web, version-stripped UA mobile, with legacy fallbacks) -> expiry -> canonical user via `rawPrisma` (must exist + not deleted). Invalidates session + clears cookie on terminal failures.
- Middleware (`apps/web/src/middleware.ts`): IP allow/block, body-size, CSRF, rate-limit, then signature-only JWT check for gated API + page routes. No DB at the edge.

### E. Post-auth redirect
- Password flow: client-side only — `redirectTo` from `?redirect=` normalized by `normalizeAppRedirectPath` (allow-list of app prefixes). Email-unverified users sent to `/verify-email`. Onboarding/legal gating is **not** applied on the password path client redirect (only the email-verified flag is).
- OAuth flow: server computes `getPostAuthUserState` + `resolvePostAuthRedirect` (verification -> legal -> onboarding -> requested), so OAuth applies the full gate; password sign-in does not (the `/onboarding` page enforces its own gate server-side `[needs verification]`).

### F. OAuth (Google / Apple)
- Init `GET /api/auth/oauth/google` / `/apple`: builds authorize URL; stores state/PKCE (Google) or state/nonce (Apple, with a **DB `oAuthState` row**) in httpOnly cookies; optional mobile handoff cookies.
- Callback Google `GET .../google/callback`: verify cookie `state` == query `state`; exchange code (PKCE); verify id_token (JWKS, iss, aud); require `email_verified`; `findOrLinkOAuthUserWithStatus`; mobile-handoff branch OR `createUserSession`; compute post-auth redirect; welcome / oauth-linked notice emails.
- Callback Apple `POST .../apple/callback` (form_post, CSRF-exempt): cookie state + nonce; **atomic single-use `oAuthState.updateMany`**; exchange; verify id_token + nonce; require `isAppleEmailVerifiedClaim`; first-login name; same link/session path.
- Account linking `findOrLinkOAuthUserWithStatus` (`user-auth.ts:812`): existing OAuth link -> reuse; else existing user by **email (rawPrisma)** -> link provider + mark verified; soft-deleted user -> blocked; else kill-switch then create new user + workspace defaults + admin alert.

---

## 3. Happy-path Correctness

- Password policy enforced server-side (`validatePasswordPolicy`) and client `minLength={12}`.
- Verification + reset tokens: opaque 32-byte random, stored only as sha256 hash, single-use via atomic `updateMany`, TTL-bounded (24h verify / 1h reset). Correct.
- Login: bcrypt verify, MFA after password, lockout + rate-limit layered, audit + session created. Correct.
- Session: signed JWT + DB row + fingerprint; logout invalidates DB row and clears cookie across domain candidates; password reset/confirm destroys all sessions. Correct.
- OAuth: id_token cryptographically verified (JWKS + iss + aud), `email_verified` required, Apple nonce + single-use DB state. Correct.
- User-enumeration defenses: forgot-password generic response; login timing equalizer; MFA challenge only post-password. Good.

---

## 4. Edge Cases & Reverse-Logic

- Auth/role: middleware gates pages/APIs; route handlers re-check DB session. `requireVerifiedUser` adds the verification gate for sensitive routes. Sound layering.
- Empty/invalid input: zod guards on every route; malformed forgot-password returns generic success (anti-enumeration).
- Network failure: client flows set `networkError`; server email sends are best-effort (`.catch`).
- Double-submit / idempotency: token consume + backup-code + mobile-oauth-code all use atomic guarded `updateMany`. Register has **no idempotency** — a duplicate submit hits the unique-email constraint and surfaces 409 (acceptable) but see SL-03 for partial-failure orphaning.
- Token expiry: verify (24h), reset (1h), JWT/session (30d), OAuth state cookies (10min), Apple DB state (10min), mobile code (5min). All enforced.
- Race conditions: verify/reset claim is race-safe. Login lockout counter under Redis uses INCR; in-memory fallback is per-instance (not shared) — see SL-05.
- Stale data: `getUserSession` re-reads canonical user via `rawPrisma` each call; deleted users are rejected and session invalidated.
- Direct deep-link entry: middleware redirects unauthenticated page hits to `/sign-in?redirect=<path>`; `redirect` is allow-listed on consumption.
- Reverse-logic: `needsEmailVerificationGate` only gates **password-only** accounts (OAuth-linked or verified pass). Intentional and consistent.

---

## 5. Security Review (per step)

- **AuthZ at each step**: middleware (edge JWT) + handler (DB session) double-check. Verified routes add `requireVerifiedUser`. OK.
- **IDOR / workspace scoping**: not directly in this flow; session is bound to its own `userId`; OAuth link keyed on provider id / email match.
- **Validation**: zod everywhere; redirect allow-list; mobile redirect-URI allow-list; PKCE pattern checks.
- **Rate limiting**: layered (IP burst + per-email policy + hard lockout + per-user verify/resend). Strong.
- **Secrets/PII**: OAuth error bodies never logged (status-only); emails hashed in OAuth logs; `passwordHash`/`mfaSecret` never returned by `/api/auth/me`. Good.
- Findings: SL-01 (Google OAuth callback has no replay/single-use state binding, unlike Apple), SL-02 (OAuth email-match auto-link relies solely on provider `email_verified`), SL-04 (in-memory lockout/rate-limit fallback is per-instance), SL-06 (CSRF/origin not enforced on the JSON login/register because they are bearer-style + sameSite=lax cookie — documented design, noted for completeness).

---

## 6. Reliability

- SL-03: register performs `user.create` then several awaited non-transactional steps (`ensureSubscriptionDefaults`, `ensureWorkspaceDefaults`, `recordLegalAcceptance`, store-review provisioning, verification-token create). A throw after `user.create` returns 500 and leaves an **orphaned user** (email now taken, no workspace, possibly no verification token). Because public signup rejects existing emails (active or soft-deleted), the user cannot retry with the same email and cannot self-recover. Medium.
- Email side effects are best-effort with `.catch` + structured logs (good), but a failed verification-email send still returns 201 "check your email" with no resend affordance until the user signs in (the resend endpoint requires a session). See SL-07 (Low).
- Loading/empty/error UX present on all client pages (spinners, error banners, `role="alert"`).
- Redis-down behavior: lockout `isLoginLocked` fails **closed** in production (returns locked+unavailable) — protects against brute force during outage but can cause a brief global login-unavailable window. Acceptable trade-off; noted under SL-04.

---

## 7. Cross-module Impact

- Billing: `ensureSubscriptionDefaults` on every signup/login path.
- Workspace: `ensureWorkspaceDefaults` on create (password + OAuth-new).
- Notifications/email: verification, welcome, password-changed, oauth-linked, admin signup alert.
- Mobile: shares `handlePasswordLogin` and the OAuth callbacks (handoff branch + `consumeMobileOAuthExchangeCode` with PKCE).
- Analytics: `sign_up_started/completed` client events.
- Admin: impersonation handoff mints a `user_session` (claim `impersonatedByAdminId`) surfaced by `/api/auth/me`.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| signup-login-01 | Medium | Security | Google OAuth callback validates `state` only by cookie equality; no server-side single-use / replay binding (Apple uses an atomic DB `oAuthState` row + nonce). | If the short-lived authorize `code` + `state` cookie are captured (e.g. proxy/log leak) before consumption, there is no server-side replay guard beyond the provider's own one-time code; defense-in-depth is asymmetric vs Apple. | Add a DB-backed single-use state (and optional nonce) for Google mirroring the Apple path; consume atomically in the callback. | apps/web/src/app/api/auth/oauth/google/route.ts, apps/web/src/app/api/auth/oauth/google/callback/route.ts:101-107, apps/web/src/app/api/auth/oauth/apple/callback/route.ts:144-156 |
| signup-login-03 | Medium | Reliability | `POST /api/auth/register` creates the user then runs several awaited, non-transactional steps; a failure after `user.create` returns 500 and orphans the account (email taken, no workspace), and public re-signup rejects existing emails so the user cannot recover. | Stuck/unusable accounts; support burden; email permanently blocked for that user. | Wrap user + defaults in a transaction or make post-create steps idempotent/retry-safe; on failure roll back or hard-delete the half-created user; consider a "resume signup" path. | apps/web/src/app/api/auth/register/route.ts:161-223 |
| signup-login-02 | Low | Security | OAuth email-match auto-links a provider to an existing password account whenever provider `email_verified` is true (no notice-before-link / explicit confirm). | A provider account controlled by someone who proves the same verified email is auto-linked; mitigated by `email_verified` requirement and a post-hoc `oauth-linked` security email, but linking is silent at decision time. | Keep the post-link security email (already present); consider requiring an authenticated session or explicit confirm before linking a new provider to an existing password account. | apps/web/src/lib/user-auth.ts:860-923, apps/web/src/app/api/auth/oauth/google/callback/route.ts:283-305 |
| signup-login-04 | Low | Reliability | Login lockout + general rate limit fall back to an in-process `Map` when Upstash Redis is not configured; counters are per-instance and reset on deploy/restart. | On multi-instance/serverless deployments without Redis, lockout/rate-limit is weakened (attacker can spread attempts across instances). Production fails closed for lockout reads, but the failure counter itself is local. | Ensure Redis is mandatory in production (or document/enforce); add a startup assertion when `NODE_ENV=production` and Upstash config is absent. | apps/web/src/lib/login-lockout.ts:33,113-120,158-174, apps/web/src/lib/rate-limit.ts |
| signup-login-05 | Low | Logic | Password sign-in client redirect only applies the email-verified gate (`emailVerified === false`), not the legal/onboarding gate that the OAuth server path applies via `resolvePostAuthRedirect`. | A returning password user who never completed legal/onboarding could be routed straight to `redirectTo`; relies on the target page's own server-side gate to re-route. | Confirm `/onboarding`/app pages enforce the legal+onboarding gate server-side `[needs verification]`; if not, apply `getPostAuthUserState`/`resolvePostAuthRedirect` on the login response too. | apps/web/src/app/sign-in/page.tsx:120-133, apps/web/src/lib/post-auth-redirect.ts:35-63 |
| signup-login-06 | Info | Security | `/api/auth/login` and `/api/auth/register` are CSRF-exempt mutations relying on JSON content-type + sameSite=lax cookie; no token/origin check on these two. | Login/register CSRF is low-risk (no pre-existing session to abuse; lax cookie + JSON requirement), but worth recording as an explicit accepted design. | Document the accepted risk; optionally enforce same-origin `Origin`/`Sec-Fetch-Site` on these like the logout path does. | apps/web/src/middleware.ts:191-299 |
| signup-login-07 | Low | Reliability | If the signup verification email fails to send, the user still sees "check your email" and the only resend path (`/api/auth/resend-verification`) requires an authenticated session the user does not yet have. | User with a failed first email is stuck until they sign in (which routes them to /verify-email where resend is available) — recoverable but unintuitive. | Surface a resend affordance on the sign-up "check email" screen, or allow a rate-limited unauthenticated resend by email (anti-enumeration generic response). | apps/web/src/app/sign-up/page.tsx:131-163, apps/web/src/app/api/auth/resend-verification/route.ts:19-31 |

---

## 9. Flow TODO

- Verify `/onboarding` and gated app pages enforce the legal+onboarding gate server-side (closes SL-05 uncertainty).
- Confirm production deploy mandates Upstash Redis (SL-04).
- Consider DB-backed Google OAuth state parity with Apple (SL-01).
- Add transactional/recoverable registration (SL-03).
