# Auth and Permissions

Updated: 2026-06-15

## User Auth

- User sessions use HS256 JWTs plus DB-backed `UserLoginSession` rows with token hashes, expiration, activity, and fingerprint checks.
- Web sessions use `user_session` httpOnly cookies.
- Mobile sessions use Bearer tokens stored by the mobile client.
- Middleware verifies JWTs only; API route handlers re-check DB session state through `getUserSession` / `requireDbUserId`.
- `USER_JWT_SECRET` is required and must be at least 32 characters.
- Password login has rate limits, login lockout, timing equalization for unknown/OAuth-only accounts, MFA support, and audit events.
- Password reset uses generic responses, hashed tokens, expiry, and session revocation after reset.
- Registration blocks soft-deleted account resurrection and applies password policy and optional COPPA gate.

## OAuth

- Google callbacks verify ID token issuer/audience/signature and require verified email.
- Apple callbacks verify ID token issuer/audience/signature, nonce, and email verification claim.
- OAuth linking blocks soft-deleted existing users.
- Security notices are sent when a provider is linked to an existing account.
- Mobile OAuth uses server handoff codes and PKCE:
  - mobile init rejects missing challenge;
  - exchange code creation rejects missing/invalid challenge;
  - exchange rejects stored rows without challenge or invalid verifier.
- Schema still allows nullable `MobileOAuthCode.codeChallenge`; this is schema debt after runtime enforcement.

## Admin Auth

- Admin middleware requires `ADMIN_JWT_SECRET` and verifies `admin_session` JWT.
- Route handlers use DB-backed admin session checks and `requirePermission`.
- Admin roles can require MFA; middleware gates privileged roles until MFA is enrolled.
- Forced password change gate restricts invited admins until password rotation is complete.
- Admin session fingerprint binds session to IP/user-agent/client hints.
- Admin hard delete requires:
  - SUPER_ADMIN minimum role and delete permission;
  - password step-up;
  - MFA;
  - target-bound email OTP to acting admin's own email;
  - OTP expiry, attempt limits, and single-use consumption;
  - audit and alerting.

## CSRF, Body Limits, and Headers

- Web/admin middleware requires JSON or multipart content types for mutations except explicit callback/logout exemptions.
- Origin/referer checks are applied when browser metadata is not same-origin/none.
- Web/admin middleware enforces body size limits before route handlers.
- CSP uses per-request nonce for scripts; styles allow inline for framework/UI compatibility.
- Security headers include HSTS in production-like contexts, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protections/noindex where appropriate.

## Authorization Model

- Workspace context resolves current user, requested workspace, membership, role, status, owner subscription/entitlement, and permission flags.
- Stale workspace cookies fall back to the user's oldest membership and self-heal cookie state.
- Workspace membership statuses fail closed unless `ACTIVE` or read-only `OVERFLOW`.
- Scoped record helpers check ownership/workspace membership before address/service operations.
- Child/read-only members get redacted or restricted sensitive/financial data.

## Service Secrets

- Internal auth separates `cron`, `internal`, and `impersonation` secret kinds.
- `CRON_SECRET` is not accepted for internal/impersonation routes, and internal/impersonation secrets are not accepted for cron routes.
- Secret comparisons use constant-time logic.

## Main Auth/Permission Risks

- Production safety depends on distributed Redis for coherent rate limits, step-up state, and admin locks.
- Admin middleware rate limits are process-local.
- Legacy partner-consent refresh route likely does not reach its route-level cron guard because middleware does not public-allow that path.
