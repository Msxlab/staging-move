# Auth and Email Audit Fix Verification - 2026-04-26

Sources reviewed:

- `docs/audits/full-system-audit-2026-04-26/02-auth-security-session-logout.md`
- `docs/audits/full-system-audit-2026-04-26/03-email-notifications-resend.md`

The source audit was treated as read-only. Each item below was checked against current `move-main/main` after the logout and email pipeline merge.

## Summary

| Status | Count |
|---|---:|
| CONFIRMED | 28 |
| ALREADY_FIXED | 2 |
| STALE | 0 |
| FALSE_POSITIVE | 5 |
| DEFERRED | 19 |

## Auth Findings

| Finding ID | Audit title | Current status | Evidence in current code | Fix decision | Files touched | Tests added | Launch relevance |
|---|---|---|---|---|---|---|---|
| F-AUTH-001 | Deleted users can still log in by password | CONFIRMED | `login/route.ts` used email lookup without `deletedAt: null`. | Fixed active-user lookup and generic invalid credentials. | `apps/web/src/app/api/auth/login/route.ts` | `apps/web/src/app/api/auth/login/route.test.ts` | Launch blocker fixed |
| F-AUTH-002 | Deleted user can re-link via OAuth | CONFIRMED | `findOrLinkOAuthUserWithStatus` returned existing OAuth links and email matches without checking `deletedAt`. | Fixed by rejecting OAuth links and email matches tied to soft-deleted users. | `apps/web/src/lib/user-auth.ts` | `apps/web/src/lib/user-auth-oauth.test.ts` | Launch blocker fixed |
| F-AUTH-003 | Impersonation handoff token in URL query string | CONFIRMED | Internal route returned `/api/auth/impersonate-handoff?token=...`. | Fixed token-in-URL issue by requiring POST body handoff. DB-backed one-time code remains deferred. | `apps/web/src/app/api/internal/impersonate/route.ts`, `apps/web/src/app/api/auth/impersonate-handoff/route.ts`, `apps/admin/src/app/api/users/[id]/impersonate/route.ts` | `apps/web/src/app/api/internal/impersonate/route.test.ts` | Launch blocker partially fixed, stronger one-time code deferred |
| F-AUTH-004 | Admin cookie sameSite lax | CONFIRMED | `admin_session` used `sameSite: "lax"`. | Fixed admin session cookie and clear path to `sameSite: "strict"`. | `apps/admin/src/lib/auth.ts` | `apps/admin/src/lib/auth-cookie.test.ts` | Public beta fixed |
| F-AUTH-005 | Logout may leave stale `.locateflow.com` cookie | CONFIRMED | Previous clear candidates depended on host detection. | Fixed user session clear candidates to always include host-only and `.locateflow.com`. | `apps/web/src/lib/user-auth.ts` | `apps/web/src/lib/user-auth-cookie.test.ts` | Logout security fixed |
| F-AUTH-006 | Secure flag gated only on `NODE_ENV` | CONFIRMED | Web, admin, OAuth, and handoff cookies used `NODE_ENV === "production"`. | Fixed secure-cookie helpers for production, staging, preview, and HTTPS app URLs. | `apps/web/src/lib/user-auth.ts`, `apps/admin/src/lib/auth.ts`, OAuth start routes, handoff route | Cookie tests | Staging and production hardening fixed |
| F-AUTH-007 | Missing security headers | CONFIRMED | Web middleware lacked HSTS, nosniff, referrer, and permissions policy. Admin normal responses did not apply the full set. | Fixed middleware header helpers without changing existing CSP. | `apps/web/src/middleware.ts`, `apps/admin/src/middleware.ts` | `apps/web/src/middleware.test.ts` | Launch hardening fixed |
| F-AUTH-008 | Missing rate limits on MFA, verify-email, reset confirm | CONFIRMED | Route handlers lacked endpoint-specific limits. | Fixed route limits for MFA setup, confirm, disable, verify email, reset confirm, and OAuth callbacks. | MFA routes, verify-email route, reset confirm route, OAuth callbacks | MFA, verify-email, reset-confirm tests | Abuse hardening fixed |
| F-AUTH-009 | Password change raw IP parsing | CONFIRMED | Password change parsed `x-forwarded-for` directly. | Fixed by exporting and using `resolveClientIP`. | `apps/web/src/lib/rate-limit.ts`, `apps/web/src/app/api/auth/password/change/route.ts` | Covered by typecheck | Security consistency fixed |
| F-AUTH-010 | Session not invalidated on MFA enable or password change | DEFERRED | Password change now destroys active sessions and reissues the current one, but no `tokenVersion` exists for MFA enable. | Deferred schema-backed token-version design to dedicated branch. | None | None | Residual risk until tokenVersion work |
| F-AUTH-011 | OAuth state and PKCE cookies not cleared on error | CONFIRMED | Several Google and Apple callback error branches returned redirects directly. | Fixed error redirects through cookie-clearing helpers. | OAuth callbacks | Covered by callback focused tests and typecheck | OAuth replay cleanup fixed |
| F-AUTH-012 | OAuth-only unverified forgot-password path no-ops | DEFERRED | Verified OAuth-only users already receive set-password links; unverified OAuth-only users are safely skipped with generic response. | Deferred product-policy email for unverified OAuth-only accounts. | None | Existing password reset request tests | Not a security blocker |
| F-AUTH-013 | Mobile session fingerprint is UA-only | DEFERRED | Code intentionally uses UA-only mobile fingerprint for network churn. | Deferred to mobile device-id and SecureStore design. | None | None | Mobile hardening follow-up |
| F-AUTH-014 | Web fingerprint allows same-UA IP changes | DEFERRED | Current code allows same browser UA across proxy IP changes. | Deferred to session migration and stricter fingerprint rollout. | None | None | Hardening follow-up |
| F-AUTH-015 | Admin IP bucket too coarse | DEFERRED | Admin fingerprint still buckets IPv4 at `/24`. | Deferred because changing bucket size invalidates active admin sessions and needs operator rollout. | None | None | Admin hardening follow-up |
| F-AUTH-016 | No notification email on new login or new device | DEFERRED | No such transactional triggers exist. | Deferred as product/email-notification scope, not this security patch. | None | None | Not launch blocker |
| F-AUTH-017 | JWT algorithm not pinned | CONFIRMED | Local JWT verification omitted algorithms. | Fixed local user/admin JWT verification with `algorithms: ["HS256"]`. | `apps/web/src/lib/user-auth.ts`, web/admin middleware, `apps/admin/src/lib/auth.ts`, handoff route | Typecheck and middleware tests | Hardening fixed |
| F-AUTH-018 | Admin password change does not revoke admin sessions | CONFIRMED | Password route updated hash but left `AdminSession` rows active. | Fixed by invalidating active admin sessions and expiring cookie. | `apps/admin/src/app/api/auth/password/route.ts` | `apps/admin/src/app/api/auth/password/route.test.ts` | Admin security fixed |
| F-AUTH-019 | Logout CSRF origin proof weak | CONFIRMED | Logout had a special relaxed middleware path. | Fixed by requiring same-origin fetch metadata, same-origin origin/referer proof, or LocateFlow request header. Clients now send the header. | Web/admin middleware and logout callers | `apps/web/src/middleware.test.ts` | Forced logout hardening fixed |
| F-AUTH-020 | Apple OAuth user JSON parsed without validation | CONFIRMED | Apple `user` field used raw `JSON.parse` and optional chaining. | Fixed with Zod validation and safe rejection. | `apps/web/src/app/api/auth/oauth/apple/callback/route.ts` | Typecheck | OAuth input hardening fixed |
| F-AUTH-021 | No rate limit on OAuth callbacks | CONFIRMED | Google and Apple callbacks had no route-level limit. | Fixed 30 req/min per IP per provider callback. | OAuth callbacks | Typecheck | Abuse hardening fixed |
| F-AUTH-022 | Backup codes returned in response payload | DEFERRED | MFA setup still returns backup codes for one-time display. | Deferred UI and download/acknowledgement redesign. | None | None | UX security follow-up |
| F-AUTH-023 | Backup-code bcrypt cost mismatch | CONFIRMED | `totp.ts` hashed backup codes at cost 10. | Fixed to cost 12. | `apps/web/src/lib/totp.ts` | Typecheck | Hardening fixed |
| F-AUTH-024 | Logout response lacks Pragma and Expires | CONFIRMED | Logout routes only had `Cache-Control: no-store`. | Fixed by adding `Pragma: no-cache` and `Expires: 0`. | Web/admin logout routes | Logout tests | Cosmetic cache hardening fixed |
| F-AUTH-025 | `/api/auth/me` not rate-limited | FALSE_POSITIVE | Middleware applies general API rate limits before public API bypass. | No code change. | None | Existing middleware tests | Low risk |
| F-AUTH-026 | Hardcoded admin lockout policy | DEFERRED | Policy remains static. | Deferred to runtime-config tuning branch. | None | None | Operational follow-up |
| F-AUTH-027 | No audit log entry on session-cookie clear | DEFERRED | Logout invalidates DB session but does not add a new audit event. | Deferred as audit-event product scope. | None | None | Follow-up |
| F-AUTH-028 | Email-verification TTL fixed with no resend convenience | DEFERRED | No resend-verification endpoint exists. | Deferred to account recovery UX branch. | None | None | Product follow-up |
| F-AUTH-029 | Impersonation session logged with admin/internal IP | DEFERRED | Impersonation records internal/admin context, not target browser IP. | Deferred with DB-backed one-time code and audit model work. | None | None | Follow-up with F-AUTH-003 |

## Email Findings

| Finding ID | Audit title | Current status | Evidence in current code | Fix decision | Files touched | Tests added | Launch relevance |
|---|---|---|---|---|---|---|---|
| F-MAIL-001 | Missing `RESEND_API_KEY` silently returns success | CONFIRMED | Web/admin email helpers returned success in all missing-key cases. | Fixed fail-closed behavior for production-like environments and health warning/fail. Dev mock remains allowed. | `apps/web/src/lib/email.ts`, `apps/admin/src/lib/email.ts`, health routes | `apps/web/src/lib/__tests__/email.test.ts` | Launch blocker fixed |
| F-MAIL-002 | No unsubscribe or preference center | DEFERRED | Notification preferences exist, but no safe one-click token URL exists. | Deferred to email-preferences branch. No fake unsubscribe links added. | None | None | Required before marketing scale |
| F-MAIL-003 | Bounce and complaint webhook not ingested | DEFERRED | No suppression schema or Resend webhook exists. | Deferred to resend-webhook-suppression branch. | None | None | Required before volume scale |
| F-MAIL-004 | Admin app default APP_URL localhost | CONFIRMED | Admin email helper defaulted to localhost. | Fixed production-like fallback to LocateFlow and fail-closed if app URL missing in production-like env. | `apps/admin/src/lib/email.ts` | Typecheck | Production link safety fixed |
| F-MAIL-005 | Sender domain not validated against Resend verification | DEFERRED | No startup Resend domain probe exists. | Deferred to operational health integration to avoid adding boot-time external API cost here. | None | None | Operational follow-up |
| F-MAIL-006 | DNS guidance missing | CONFIRMED | Existing deploy docs lacked concrete Zoho and Resend coexistence guidance. | Added DNS email checklist. | `docs/deploy/dns-email-checklist.md` | Docs only | Launch docs fixed |
| F-MAIL-007 | No alert on consecutive Resend failures | DEFERRED | Email failures log but do not aggregate alert counts. | Deferred to alerting branch to avoid retry/alert loops. | None | None | Operational follow-up |
| F-MAIL-008 | No per-email password reset cap | CONFIRMED | Reset request had per-IP limit only. | Fixed 1 reset email per 5 minutes per user via recent unused token lookup. | `password/reset/request/route.ts` | Reset request tests | Abuse hardening fixed |
| F-MAIL-009 | No account-security notifications | DEFERRED | No new login, password changed, or MFA changed templates/triggers exist. | Deferred as product notification scope. | None | None | Follow-up |
| F-MAIL-010 | Production URL hardcoded in template seed | FALSE_POSITIVE | Transactional runtime links are rendered from runtime app URL where needed; footer uses the required absolute `https://locateflow.com`. | No code change. | None | Existing email tests | No launch issue |
| F-MAIL-011 | Welcome email defined but never sent | ALREADY_FIXED | Current verify-email and first OAuth signup flows send deduped welcome emails. | No new code change. | None | Existing welcome tests | Fixed by prior merge |
| F-MAIL-012 | Set-password subject says reset | ALREADY_FIXED | `passwordResetContent` branches subject and CTA for set-password. | No new code change. | None | Existing email tests | Fixed by prior merge |
| F-MAIL-013 | EmailLog metadata can absorb sensitive context | CONFIRMED | `buildEmailMetadata` accepted caller metadata directly. | Fixed allowlist plus sensitive-key stripping. | `apps/web/src/lib/email-service.ts` | `apps/web/src/lib/email-service.test.ts` | Privacy hardening fixed |
| F-MAIL-014 | Plain text regenerated from HTML per send | DEFERRED | Schema has HTML body only, no text column. | Deferred to schema/template editor branch. | None | None | Quality follow-up |
| F-MAIL-015 | Hardcoded support fallback | CONFIRMED | Helpers fell back to support email in all envs. | Fixed production-like fail-closed config validation for support/reply-to and sender. | Web/admin email helpers and health routes | Email config test | Launch config hardening fixed |
| F-MAIL-016 | Per-template counters not on model | FALSE_POSITIVE | Admin route computes actual counts from `EmailLog.templateId`, and backfill migration exists. | No denormalized columns added. Actual log-backed counts remain preferred. | None | Existing admin email-template tests | No launch issue |
| F-MAIL-017 | No retry queue | DEFERRED | Schema has no retry fields or worker. | Deferred to dedicated retry queue branch. | None | None | Follow-up |
| F-MAIL-018 | Dedupe key truncates token hash | CONFIRMED | Register and reset request used `hash.slice(0, 12)`. | Fixed to use full SHA-256 hash in dedupe keys. | Register and reset request routes | Existing reset/register tests | Collision hardening fixed |
| F-MAIL-019 | RESEND_API_KEY format not validated | CONFIRMED | Helpers did not validate key format. | Fixed production-like `re_` prefix validation. | Web/admin email helpers | Email config test | Config hardening fixed |
| F-MAIL-020 | EMAIL_FROM and alert config not in health checks | CONFIRMED | Health checks mostly checked only Resend key. | Fixed web/admin health checks to include sender, support, and alert recipients. | Web/admin health routes | Typecheck | Operational visibility fixed |
| F-MAIL-021 | ALERT_EMAIL_TO comma-list not validated | CONFIRMED | Admin health did not validate recipient list. | Fixed simple comma-list email validation in admin health. | `apps/admin/src/app/api/health/route.ts` | Typecheck | Operational visibility fixed |
| F-MAIL-022 | Apple OAuth email_verified trusted | FALSE_POSITIVE | Apple and Google OIDC tokens are signature, issuer, and audience verified before trusting provider email verification. | No secondary email verification added. | Apple callback only validates `user` JSON shape | OAuth typecheck | No launch issue |
| F-MAIL-023 | No billing payment failed email | DEFERRED | No payment-failed transactional trigger exists. | Deferred as product/billing notification scope. | None | None | Follow-up |
| F-MAIL-024 | No support-form sender | FALSE_POSITIVE | No contact/support form sender exists in current product surface. | No code change. | None | None | No launch issue |
| F-MAIL-025 | Resend error redaction regex only strips `re_...` | CONFIRMED | Error redaction did not strip generic long secret-like tokens. | Fixed redaction of API-looking `re_` keys and long 32+ char token runs. | Web/admin email helpers | `apps/web/src/lib/__tests__/email.test.ts` | Privacy hardening fixed |

## Deferred Branches

- `auth-token-version-session-invalidation`: add `tokenVersion` to user/admin JWTs, bump on password/MFA changes, and reject stale JWTs in middleware and route handlers.
- `auth-impersonation-one-time-code`: replace POST body JWT handoff with a DB-backed one-time code, short TTL, consumed-once exchange, and expanded audit trail.
- `email-preferences-unsubscribe`: implement signed preference/unsubscribe links for digest and non-transactional email only.
- `resend-webhook-suppression`: add Resend bounce/complaint webhook validation, suppression storage, and tests.
- `email-retry-alerting`: add bounded retry queue and consecutive failure alerts without retry storms.
- `mobile-session-device-id`: bind mobile sessions to a server-issued device ID stored in mobile SecureStore.

## Tests Added

- Deleted password user login guard.
- Deleted OAuth user linking guard.
- Password reset per-recipient cap and reset confirmation rate limit.
- Verify-email rate limit.
- MFA confirm IP and per-user rate limits.
- Email config fail-closed behavior and metadata redaction.
- Impersonation handoff URL token removal.
- Admin password change session invalidation.
- Admin cookie SameSite Strict and Secure behavior.
- Middleware security headers and logout CSRF hardening.

## Remaining Risks

- The impersonation token is no longer in the URL, but a DB-backed one-time code is still the stronger target design.
- MFA enable still needs token-version invalidation to revoke already-issued JWTs immediately.
- Bounce/complaint suppression and unsubscribe/preferences require product and schema work before email volume scales.
- Mobile session fingerprinting should be upgraded with a device-bound identifier.
