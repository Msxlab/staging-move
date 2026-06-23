# Module Audit: Authentication & Session

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> (`apps/web/...`). Items that could not be confirmed from code are tagged
> `[needs verification]`.

## 1. Module Summary

Custom JWT + cookie + DB-tracked session auth (no next-auth). Sessions are
`jose` HS256 JWTs signed with `USER_JWT_SECRET`, mirrored to a
`UserLoginSession` row keyed by `sha256(token)` and validated on every request
(`getUserSession`). Web uses an httpOnly `user_session` cookie; mobile uses
`Authorization: Bearer`. Supports email+password login (shared
`handlePasswordLogin`), Google/Apple OAuth (web redirect + mobile PKCE handoff +
Apple-native), TOTP MFA with bcrypt-hashed backup codes, password reset / email
verification via opaque hashed tokens, step-up re-auth for sensitive actions,
SUPER_ADMIN impersonation handoff, login lockout, and a layered rate-limit
policy. Middleware (`src/middleware.ts`) does edge JWT signature checks, CSRF,
body-size, IP rules, rate limiting, and CSP.

Overall the module is mature and defense-in-depth is evident (timing
equalization, fail-closed lockout, fingerprint binding, MFA-mandatory step-up,
session invalidation on password change/reset). The findings below are mostly
gaps and asymmetries rather than gross flaws.

## 2. Related Files

- `apps/web/src/lib/user-auth.ts` — core session lifecycle, JWT sign/verify, fingerprint, OAuth account link, password hashing.
- `apps/web/src/lib/auth.ts` — re-export shim.
- `apps/web/src/lib/user-jwt-secret.ts` — secret validation + cached key.
- `apps/web/src/lib/password-login.ts` — shared web/mobile password login handler (lockout, MFA, audit).
- `apps/web/src/lib/login-lockout.ts` — per-subject failure tracker (Upstash → memory).
- `apps/web/src/lib/oauth.ts` — state/PKCE, Google/Apple token exchange, id_token decode, trusted-host origin.
- `apps/web/src/lib/mobile-oauth.ts` — mobile redirect URI allow-list, PKCE verify, exchange-code mint/consume.
- `apps/web/src/lib/user-step-up.ts` — re-auth (password / TOTP / backup) for sensitive ops.
- `apps/web/src/lib/totp.ts` — RFC 6238 TOTP, backup code gen/verify.
- `apps/web/src/lib/safe-redirect.ts` — app redirect allow-list.
- `apps/web/src/lib/post-auth-redirect.ts` — post-auth routing (verify/legal/onboarding).
- `apps/web/src/lib/email-verification-gate.ts` — verification gating predicate.
- `apps/web/src/lib/user-security-audit.ts` — audit log wrapper.
- `apps/web/src/lib/rate-limit-policy.ts`, `rate-limit.ts`, `internal-secrets.ts`.
- `apps/web/src/middleware.ts` — auth enforcement, CSRF, CSP, rate limit, IP rules.
- Routes under `apps/web/src/app/api/auth/**`, `api/mobile/auth/**`, `api/internal/impersonate`.
- Pages: `sign-in`, `sign-up`, `forgot-password`, `reset-password/[token]`, `verify-email`, `account/setup-password`.

## 3. Related Routes / Screens

- Pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password/[token]`, `/verify-email`, `/verify-email/[token]`, `/account/setup-password`, `/account/delete`.
- APIs (auth): login, logout, me, register, forgot-password, reset-password, verify-email, resend-verification, password/change, password/reset/{request,confirm}, mfa/{setup,confirm,disable}, oauth/{google,apple}/{,callback}, oauth/providers, security, impersonate-handoff.
- APIs (mobile): mobile/auth/{login,exchange,apple/native}.
- Internal: internal/impersonate.

## 4. Related APIs

See §3. Notable cross-module callers of session helpers: every `(app)` API route
calls `requireDbUserId` / `requireVerifiedUser`; export & account/delete use
`verifyUserStepUp`.

## 5. Related Components

`components/ui/password-input`, `components/shared/loading-state`
(`AuthFormSkeleton`), `components/marketing/logo` (Wordmark). Sign-in/up forms are
client components in the page files.

## 6. Related State / Hooks / Stores

Client local `useState` in sign-in/up/reset forms. `/api/auth/me?optional=1`
hydrates global auth state. No global store in scope; session truth lives in the
cookie/JWT + `UserLoginSession`.

## 7. Related Database / Models

`User` (passwordHash, mfaEnabled, mfaSecret, mfaBackupCodes, emailVerifiedAt,
deletedAt), `OAuthAccount`, `MobileOAuthCode`, `UserLoginSession`
(tokenHash, isActive, expiresAt, impersonatedByAdminId, fp via JWT),
`OAuthState` (Apple state+nonce, single-use), `PasswordResetToken`,
`EmailVerificationToken`, `AuditLog` / `AdminAuditLog`. (`UserSession` model at
prisma line 1148 appears legacy/separate from `UserLoginSession`
— `[needs verification]` whether still used by auth.)

## 8. Impact Map

- **UI**: sign-in/up, MFA challenge, reset/verify flows, OAuth buttons, security/sessions screen.
- **API**: all authenticated endpoints depend on `getUserSession`/`requireDbUserId`.
- **DB**: session create/invalidate, token tables, audit logs.
- **Auth**: this module *is* auth.
- **Admin**: impersonation handoff mints a user session from an admin-issued token.
- **Mobile**: bearer sessions, PKCE OAuth handoff, Apple-native, version-independent fingerprint.
- **Notifications**: security notice emails (password-changed, mfa-enabled/disabled, oauth-linked), signup alerts, welcome.
- **Integrations**: Google/Apple OAuth, Upstash Redis (lockout/rate limit).
- **Analytics**: `UserEvent`/audit log security events.
- **SEO**: middleware noindex on all auth pages.
- **Tests**: `__tests__` for most auth routes; gaps noted in §17.

## 9. Buttons / Actions / Functions

**Sign-in submit** (`sign-in/page.tsx` `handleSubmit`): POST `/api/auth/login`.
Loading state via `loading`; submit disabled while loading. Error state shown in
`role="alert"`. 403+`requiresMfa` switches to MFA input. Permission: public.
Edge: on `requiresMfa` it sets loading=false correctly; on email-unverified
redirects to `/verify-email`. Good.

**Continue with Google/Apple**: `window.location.href` to init route with
`redirect`. Disabled when provider unconfigured (`aria-disabled`+`disabled`). No
loading spinner on full-page navigation (acceptable).

**Login (server)** `handlePasswordLogin`: pre-parse IP burst limit → schema →
`auth_login` policy limit → lockout check → user lookup → timing-equalized bcrypt
→ MFA → session create + audit. Loading/disabled N/A (server). Error states:
429/401/403/503 with codes. Permission: public. Edge cases handled: unknown vs
OAuth-only account both run dummy bcrypt (anti-enumeration); MFA failures count
toward lockout; backup code consumed via CAS `updateMany`.

**Register** `POST /api/auth/register`: rate-limited, kill-switch, password
policy, age gate (flagged), rejects existing (active+soft-deleted), QA/store
reset path, creates user + verification token. Permission: public.

**Forgot / reset request** `POST /api/auth/password/reset/request`: always returns
generic success (anti-enumeration), recipient throttle (5min), supersedes old
tokens. **Reset confirm**: token claim via transactional `updateMany` CAS,
verifies email, destroys all sessions, security email.

**Verify email** `POST /api/auth/verify-email`: IP + per-user rate limit, CAS
token claim, sets emailVerifiedAt, welcome email.

**MFA setup/confirm/disable**: setup requires password; confirm requires TOTP;
disable requires password **AND** second factor (fail-closed). All per-user rate
limited via `mfa_verify`.

**Password change** `PATCH /api/auth/password/change`: requires current password,
new policy, rotates all sessions, re-issues current. (No dedicated rate-limit
policy — see auth-session-07.)

**OAuth callbacks**: verify id_token against provider JWKS (iss+aud),
email_verified required, link/create user, mobile handoff or session create,
post-auth redirect. Apple additionally consumes a DB `OAuthState` row + nonce.

**Impersonation handoff** `POST /api/auth/impersonate-handoff`: verifies admin JWT,
finds active impersonation session by tokenHash, single-use consume, mints
browser session scoped to remaining TTL, audit breadcrumb.

**Logout**: invalidates session row, clears cookie across domain candidates.

## 10. UI/UX Audit

- **Finding (Low, UI/UX)** Sign-in OAuth buttons use `disabled:opacity-100` with a
  custom disabled style; disabled Google button keeps full opacity and only
  `cursor-not-allowed` — the unavailable state is conveyed mostly by label text
  swap (`googleUnavailable`). Evidence: `sign-in/page.tsx:189,198`. Impact: low
  discoverability of disabled state. Recommendation: add a clearer visual
  affordance (muted text/icon) and `title`. Priority: Low.
- **Finding (Low, Accessibility)** MFA input auto-focuses and strips non-digits;
  good. But the MFA challenge has no "use a backup code" affordance on the web
  sign-in form (`sign-in/page.tsx` only sends `mfaCode`), although the API
  accepts `backupCode`. Evidence: `sign-in/page.tsx:108-110` vs
  `password-login.ts:39,341`. Impact: a user who lost their authenticator cannot
  use a backup code from the web sign-in UI. Recommendation: expose a backup-code
  field. Priority: Low/Medium (recovery UX).
- **Finding (Info, Accessibility)** Error banner uses `role="alert"` — good.
  Inputs have associated `<label htmlFor>`. No obvious WCAG blockers in scope.

## 11. Logic Audit

- Expected flow (web): cookie JWT → middleware signature check → route
  `requireDbUserId` → DB row + fingerprint + canonical user. Confirmed coherent.
- `getUserSession` iterates *all* same-name cookie candidates and bearer; only
  clears the cookie when a cookie-sourced candidate failed
  (`user-auth.ts:485-689`). Reasonable for duplicate host/domain cookies.
- **fingerprint** is UA-only for web (no IP), UA-minus-version for mobile, with
  legacy fallbacks. Sound rationale documented; the legacy fallbacks are
  time-bounded by 30-day TTL. Stale risk: low.
- **State mismatch (Google vs Apple)**: Apple consumes a single-use DB
  `OAuthState` row (`apple/callback/route.ts:144-156`); Google validates state by
  cookie equality only (`google/callback/route.ts:101-107`) — see
  auth-session-03.
- **Race conditions**: backup-code consumption and token claims use CAS
  (`updateMany` with prior value / `usedAt: null`), correctly preventing
  double-spend. Mobile exchange code uses the same pattern.
- `getUserSession` performs a DB read + canonical user read per request and
  updates `lastActivity` non-blocking. Acceptable.

## 12. Reverse Logic Audit

- **Unauthorized**: middleware returns 401 for API, redirect to `/sign-in` for
  pages. Route handlers re-check via DB (`requireDbUserId`). Good defense-in-depth.
- **Token expiry**: JWT `exp` + DB `expiresAt` both enforced; expired DB row →
  invalidate + clear cookie.
- **Role change / account deletion**: `findCanonicalSessionUser` uses `rawPrisma`
  and rejects `deletedAt`. Soft-deleted user is force-logged-out.
- **Direct route access**: page middleware gates non-public paths.
- **Double-click**: login lockout/rate-limit + idempotent token CAS reduce harm.
- **Stale data**: `/api/auth/me` is `no-store`.
- **Mobile viewport / dark theme**: sign-in left panel hidden `< lg`; dark
  variants present on OAuth buttons. No issues found in scope.
- **Slow network / API error**: sign-in catches network error → toast; OAuth
  callbacks redirect with `?error=` codes mapped to localized messages.
- **Token-expiry edge (impersonation)**: handoff mints session capped to remaining
  TTL and single-use consumes the source row — replay-resistant.

## 13. Security Audit

### auth-session-01 — Google OAuth callback lacks DB-backed single-use state (CSRF/replay asymmetry) — Medium
- **Severity**: Medium
- **Affected Area**: `apps/web/src/app/api/auth/oauth/google/callback/route.ts:101-107`; init `oauth/google/route.ts:83-86`.
- **Evidence**: Google state is validated only by comparing the `state` query
  param to the `oauth_state_google` httpOnly cookie (`cookieState !== state`).
  There is no server-side single-use record. Apple, by contrast, persists and
  atomically consumes an `OAuthState` row + nonce
  (`apple/callback/route.ts:144-156`, `apple/route.ts:70-78`).
- **Risk**: The cookie-bound state still mitigates classic login-CSRF, but the
  Google authorization `code`/`state` pair is not made single-use server-side, so
  a captured callback URL (e.g. via Referer/log/history while the 10-min cookie is
  still present in the same browser) could be replayed. PKCE verifier is also a
  cookie, so possession of the browser cookies is the only gate. The asymmetry
  with Apple suggests the stronger control was intended.
- **Defensive Abuse Scenario (high-level)**: An attacker who can observe a
  victim's callback URL and reuse the victim's still-valid OAuth cookies replays
  the exchange. Primary residual protection is the short cookie TTL and Google's
  own one-time `code`.
- **Prevention**: Mint a single-use `OAuthState` row for Google as for Apple and
  consume it atomically in the callback.
- **Detection**: Count `state-mismatch` redirects; alert on replays of the same
  state hash.
- **Analysis (root cause)**: Google flow predates the DB-state hardening added for
  Apple's cross-site `form_post`; never back-ported.
- **Recommendation**: Add DB-backed single-use state to the Google callback.
- **Tests to add**: replayed-state rejection; missing-cookie rejection (note
  there is currently **no** `google/callback/route.test.ts`).

### auth-session-02 — No dedicated brute-force limit on TOTP/backup step-up inside `verifyUserStepUp` — Medium
- **Severity**: Medium
- **Affected Area**: `apps/web/src/lib/user-step-up.ts:15-137` and its callers
  (`api/export/route.ts`, `api/export/pdf/route.ts`, `api/account/delete/route.ts`).
- **Evidence**: `verifyUserStepUp` verifies password/TOTP/backup codes with no
  internal attempt counter. Callers apply route policies (`export_data`,
  `export_pdf`, `account_delete`) which are coarse per-user and not MFA-specific;
  unlike `password-login.ts`, the step-up TOTP path is not wired to
  `mfa_verify`/lockout.
- **Risk**: An attacker holding a valid session (e.g. shared device, stolen
  bearer) could attempt many TOTP/backup guesses against a sensitive action up to
  the route's coarse limit, weakening the second-factor gate on data export and
  account deletion. TOTP space is 1e6 with ±1 step window.
- **Defensive Abuse Scenario (high-level)**: Session-holder repeatedly submits
  account-delete/export step-up with guessed codes within the route's broader
  allowance.
- **Prevention**: Route step-up TOTP/backup verification through the
  `mfa_verify` policy + lockout, keyed by user, before accepting the code.
- **Detection**: Emit `MFA_FAILURE_BURST` from step-up failures (already done in
  login, not in step-up).
- **Analysis**: Step-up was designed as a one-shot re-auth and relied on caller
  rate limits, which are tuned for cost not credential guessing.
- **Recommendation**: Add an MFA-specific limiter inside `verifyUserStepUp` (or a
  shared wrapper) and emit security events on failure.
- **Tests to add**: lockout after N bad step-up codes.

### auth-session-03 — Apple init sets state cookie `SameSite=None` and stores nonce in cookie that the callback trusts — Low/Medium
- **Severity**: Low (Medium if relay/dev assumptions break)
- **Affected Area**: `apps/web/src/app/api/auth/oauth/apple/route.ts:84-97`,
  `apple/callback/route.ts:136-181`.
- **Evidence**: Apple state/nonce/redirect cookies are `sameSite: "none"` +
  secure (required for cross-site `form_post`). The callback compares
  `payload.nonce !== cookieNonce` and also checks the DB `OAuthState`, which is
  good — but the nonce trust chain still includes a `SameSite=None` cookie.
- **Risk**: `SameSite=None` cookies are attached on cross-site requests; combined
  with the CSRF exemption for `/api/auth/oauth/apple/callback`
  (`middleware.ts:201`), the callback's anti-forgery rests entirely on the
  DB-state single-use consume + nonce match. This is acceptable but concentrates
  risk on the `OAuthState` consume being correct.
- **Defensive Abuse Scenario (high-level)**: Forged `form_post` to the callback
  fails because the attacker cannot produce a matching unconsumed `OAuthState`
  row; the residual risk is a bug in that consume path.
- **Prevention**: Keep DB-state consume authoritative (already done); ensure
  `OAuthState` TTL and uniqueness on `stateHash` are enforced at the DB level.
- **Detection**: Alert on `state-mismatch`/`invalid-nonce` Apple redirects.
- **Analysis**: Inherent to Apple `form_post`; mitigations are present.
- **Recommendation**: Document and unit-test the consume path (exists for Apple).
  Verify a unique index on `OAuthState.stateHash` `[needs verification]`.

### auth-session-04 — `impersonate-handoff` is a public, unauthenticated POST gated only by the JWT in the body (no rate limit, no admin re-check) — Low/Medium
- **Severity**: Low/Medium
- **Affected Area**: `apps/web/src/app/api/auth/impersonate-handoff/route.ts`;
  listed in `middleware.ts:108-109` `PUBLIC_API_EXACT`.
- **Evidence**: The route is public; it accepts a token, verifies it with the
  *same* `USER_JWT_SECRET`, finds an active impersonation session by `tokenHash`
  with `impersonatedByAdminId != null`, single-use consumes, and mints a browser
  cookie. There is no per-route rate limit in the handler and no re-verification
  that the admin still has impersonation rights at exchange time (only that the
  DB row was created with an admin id).
- **Risk**: The token is high-value (grants a logged-in user session). It is
  single-use and short-lived (≤15 min) and requires the DB row, which is strong.
  Residual: no throttle on guessing/replaying tokens, and admin authorization is
  not re-checked at handoff (revoking the admin between mint and exchange does not
  block the exchange).
- **Defensive Abuse Scenario (high-level)**: An attacker who obtains the handoff
  token (e.g. from logs despite POST-only design) within the TTL can redeem it.
  Brute-forcing the token is infeasible (signed JWT), so the main control is
  protecting the token in transit.
- **Prevention**: Add a coarse rate limit on the handoff endpoint; optionally
  re-check `AdminUser` active/permission at exchange.
- **Detection**: Audit breadcrumb exists (`IMPERSONATE_HANDOFF`); alert on failed
  exchanges.
- **Analysis**: Designed around single-use DB row; admin-liveness re-check was out
  of scope.
- **Recommendation**: Add rate limiting and consider admin-liveness re-validation.
- **Tests to add**: replay after consume (exists), expired token, admin-deleted
  between mint/exchange.

### auth-session-05 — id_token decode helper present but unverified-by-design; ensure it is never used for trust — Info
- **Severity**: Info
- **Affected Area**: `apps/web/src/lib/oauth.ts:352-361` `decodeJwtPayload`.
- **Evidence**: `decodeJwtPayload` parses a JWT body **without signature
  verification**. Grep shows it is defined but **not referenced** anywhere in
  `apps/web/src`. Callbacks correctly use `jose.jwtVerify` + JWKS.
- **Risk**: Latent foot-gun: a future caller could trust unverified claims.
- **Recommendation**: Remove the unused helper (dead code, see auth-session-08) or
  rename to make non-verification explicit; add a lint guard.

### auth-session-06 — Login response leaks `mfaEnabled` and account flags; acceptable but note enumeration surface — Info/Low
- **Severity**: Info
- **Affected Area**: `password-login.ts:430-446`, `mobile/auth/exchange/route.ts:89-105`.
- **Evidence**: Successful login returns `mfaEnabled`, `hasPasswordLogin`,
  `needsPasswordSetup`. This is only returned **after** successful auth, so it is
  not a pre-auth enumeration oracle. Pre-auth paths (forgot-password, login
  failure) are correctly generic and timing-equalized
  (`password-login.ts:141-150,235-253`).
- **Risk**: Minimal — post-auth disclosure to the authenticated user only.
- **Recommendation**: None required; documented for completeness.

### Positive controls observed (no finding)
- Cookies: `httpOnly`, `secure` in prod/staging/preview/https, `sameSite=lax`
  (auth) / `none` only for Apple cross-site (`user-auth.ts:200-207`,
  `apple/route.ts:90`).
- Secret: `USER_JWT_SECRET` required ≥32 chars (`user-jwt-secret.ts:5-10`).
- HS256 pinned in both sign and verify (`user-auth.ts:275,509`,
  `middleware.ts:595`) — no `alg:none` downgrade.
- Open-redirect: `normalizeAppRedirectPath` allow-lists prefixes, blocks `//`,
  `\`, control chars, `/api`, `/auth` (`safe-redirect.ts`).
- Anti-enumeration: generic forgot-password response, dummy bcrypt timing
  equalizer, soft-deleted users indistinguishable.
- MFA disable / step-up are second-factor-mandatory and fail-closed.
- Password reset & change invalidate all sessions.
- Lockout fails closed on Redis outage in production (`login-lockout.ts:105-109`).
- `email_ip` rate-limit key deliberately omits attacker-controlled UA
  (`rate-limit-policy.ts:399-405`).
- Mobile PKCE verifier checked constant-time (`mobile-oauth.ts:91-105`).

## 14. Performance Audit

- `getUserSession`/`requireDbUserId` do ~2 DB reads + a non-blocking
  `lastActivity` write per request; `crypto.subtle` SHA-256 for token hash per
  request. Acceptable for the traffic shape; not an N+1.
- `bcrypt` cost 12 on login + a dummy hash on the no-user path — intentional cost,
  acceptable.
- OAuth callbacks call `getPostAuthUserState` which fans out ~7 parallel queries
  (`post-auth-redirect.ts:86-122`) — fine, parallelized, only on login.
- Middleware runs on most routes (broad matcher) and may do a Redis round-trip per
  request for rate limiting; shadow user-keyed counter is flag-gated off. No
  obvious regression.
- No client over-fetch found; `/api/auth/me?optional` is rate-limited to 200/min.

## 15. Reliability Audit

- DB lookup failures in `getUserSession` are swallowed → null but logged
  (`user-auth.ts:524-534`) so a DB blip logs the user out rather than 500-ing;
  trade-off is documented.
- Email sends are fire-and-forget with `.catch` logging — never block auth.
- Schema-drift tolerance for `impersonatedByAdminId` via `db-schema-compat`
  fallbacks (impersonate routes).
- Lockout/rate-limit degrade to in-memory in dev, fail-closed in prod.
- No error boundary concerns in server routes; client forms show error/toast.
- Monitoring: security events emitted for lockout, MFA bursts, secret misuse,
  rate-limit hits.

## 16. Dead Code / Cleanup

- **auth-session-08 (Dead Code, Low)**: `decodeJwtPayload` (`oauth.ts:352`) is
  defined but unreferenced in `apps/web/src` (grep-confirmed). Remove or guard.
- `generateLegacyMobileVersionFingerprint` / `generateLegacyWebIpFingerprint`
  are transitional fallbacks intended to become dead after 30 days
  (`user-auth.ts:120-137`) — keep until rollout window passes, then remove
  `[needs verification]` on deploy date.
- `readSingleTokenFromRequestForLegacyPath` (`user-auth.ts:447-467`) appears
  unused by the current `getUserSession` path (which uses
  `readTokenCandidatesFromRequest`). `[needs verification]` whether any caller
  remains.
- `UserSession` prisma model (line 1148) may be legacy vs `UserLoginSession`
  (line 137) `[needs verification]`.

## 17. Tests

Existing (`apps/web/src/app/api/auth/**/route.test.ts`): login, logout, me,
register, mfa setup/confirm/disable, oauth apple route+callback, oauth google
**init only**, password change, password reset request/confirm, verify-email,
resend-verification, security; plus `lib/__tests__/user-auth-fingerprint.test.ts`,
`user-step-up.test.ts`, `workspace-step-up.test.ts`,
`mobile/auth/{exchange,apple/native}/route.test.ts`.

Missing / critical scenarios to add:
- **Google OAuth callback** (`oauth/google/callback`) has **no** test — cover
  state mismatch, replay, id_token verify failure, email_unverified, link/create,
  mobile handoff (relates to auth-session-01).
- Step-up brute-force lockout (auth-session-02).
- `impersonate-handoff` rate-limit / admin-liveness (auth-session-04).
- `getUserSession` legacy fingerprint acceptance windows (web IP + mobile version).
- Backup-code-via-web-sign-in path (once UI exists).
- Suggested: e2e for full OAuth round-trip and MFA challenge.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| auth-session-01 | Medium | Security | Google OAuth callback uses cookie-only state, no DB single-use record (Apple has one) | Replay/CSRF residual on Google sign-in | Add DB-backed single-use state to Google callback | api/auth/oauth/google/callback/route.ts; oauth/google/route.ts |
| auth-session-02 | Medium | Security | `verifyUserStepUp` TOTP/backup has no MFA-specific brute-force limit | Weakened 2FA gate on export/account-delete | Wire step-up codes through `mfa_verify`+lockout | lib/user-step-up.ts; api/account/delete; api/export |
| auth-session-03 | Low | Security | Apple state/nonce cookies `SameSite=None`; callback CSRF-exempt, trust rests on DB-state consume | Concentrated risk on consume correctness | Keep DB-state authoritative; verify unique index + tests | api/auth/oauth/apple/route.ts; apple/callback/route.ts |
| auth-session-04 | Low | Security | `impersonate-handoff` public POST, no rate limit, no admin-liveness re-check | High-value token redemption not throttled | Add rate limit + optional admin re-check | api/auth/impersonate-handoff/route.ts |
| auth-session-05 | Info | Security | Unverified `decodeJwtPayload` helper exists (unused) | Latent trust foot-gun | Remove/guard | lib/oauth.ts |
| auth-session-06 | Info | Security | Login response returns account flags (post-auth only) | Negligible | None | lib/password-login.ts |
| auth-session-07 | Low | API | `PATCH /api/auth/password/change` has no dedicated rate-limit policy (only generic write limiter) | Limited throttling on password-change attempts | Add per-user `mfa_verify`-class policy | api/auth/password/change/route.ts |
| auth-session-08 | Low | Dead Code | `decodeJwtPayload` and possibly `readSingleTokenFromRequestForLegacyPath` unused | Maintenance/foot-gun | Remove after confirmation | lib/oauth.ts; lib/user-auth.ts |
| auth-session-09 | Low | UI/UX | Web sign-in MFA step has no backup-code field though API supports it | Lockout-recovery friction | Expose backup-code input | sign-in/page.tsx; lib/password-login.ts |
| auth-session-10 | Low | Test | No test for Google OAuth callback; none for step-up brute-force | Regression risk on critical path | Add tests | api/auth/oauth/google/callback |

## 19. Module TODO

- [ ] **auth-session-01** (Medium) Add DB-backed single-use state to Google OAuth callback. Reason: parity with Apple, replay hardening. Files: `oauth/google/route.ts`, `oauth/google/callback/route.ts`, `OAuthState` model. Dependencies: `OAuthState` schema (exists). Complexity: med. Risk: med (touches live login).
- [ ] **auth-session-02** (Medium) Route step-up TOTP/backup verification through `mfa_verify` policy + lockout and emit `MFA_FAILURE_BURST`. Files: `lib/user-step-up.ts` (+ callers). Dependencies: rate-limit-policy. Complexity: med. Risk: med.
- [ ] **auth-session-07** (Low) Add a dedicated rate-limit policy to `password/change`. Files: `api/auth/password/change/route.ts`, `rate-limit-policy.ts`. Complexity: low. Risk: low.
- [ ] **auth-session-04** (Low) Rate-limit `impersonate-handoff`; optionally re-check admin liveness at exchange. Files: `api/auth/impersonate-handoff/route.ts`. Complexity: low/med. Risk: low.
- [ ] **auth-session-09** (Low) Add backup-code field to web sign-in MFA step. Files: `sign-in/page.tsx`. Complexity: low. Risk: low.
- [ ] **auth-session-08** (Low) Remove unused `decodeJwtPayload` (and confirm `readSingleTokenFromRequestForLegacyPath`). Files: `lib/oauth.ts`, `lib/user-auth.ts`. Complexity: low. Risk: low.
- [ ] **auth-session-10** (Low) Add Google callback tests + step-up brute-force tests. Files: `api/auth/oauth/google/callback`, `lib/user-step-up`. Complexity: low/med. Risk: low.
- [ ] **auth-session-03** (Low) Verify `OAuthState.stateHash` unique index; document Apple consume invariants. `[needs verification]`. Complexity: low. Risk: low.
