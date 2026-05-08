# Rate-Limit / Auth-Limit Final Report

Status: post-implementation
Branch: fix/rate-limit-auth-protection
Date: 2026-05-07

## What Changed

This commit closes the policy, telemetry, and safe-security-event phase only.
It does not include the broader export UI step-up work, admin login rewrite,
password reset enforcement rewrite, MFA route enforcement rewrite, mobile OAuth
rewrite, provider recommendation rewrite, or mobile UI changes.

Implemented:

- Added `apps/web/src/lib/security-events.ts` for structured security events
  with field-level redaction for passwords, MFA codes, backup codes, tokens,
  secrets, DB URLs, Redis URLs, and Stripe secret values.
- Added `apps/web/src/lib/rate-limit-policy.ts` as the central route-group
  policy registry and helper layer.
- Added policy modes: `enforce`, `warn`, and `shadow`.
- Added standard 429 response metadata helpers and rate-limit hit telemetry.
- Added `LIMITER_DEGRADED` telemetry when Redis-backed limiting falls back to
  in-memory mode.
- Added cron/internal secret misuse telemetry without logging supplied secrets.
- Added middleware policy wiring for public/user read/write groups and an
  opt-in shadow `user_read` counter behind
  `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`.
- Exempted webhook, cron, and internal API paths from the global middleware
  IP limiter so their signature/secret checks remain the primary control.
- Added login lockout and MFA-failure telemetry without changing the login
  response shape or existing lockout threshold.
- Added account-delete and export-attempt telemetry without changing the
  existing export UI or export route signature.
- Added Stripe webhook signature-failure telemetry without logging the raw
  signature or body.

## Why It Is User-Friendly

- No global tightening was added.
- Normal read/write middleware limits are more generous than before.
- User-facing route signatures are unchanged in this narrow PR.
- Webhook, cron, and internal routes avoid shared-IP false positives.
- The new user-keyed read limiter is shadow-only and disabled by default.
- Admin sensitive-action policy is warn-only, not hard-blocking.

## Attack Paths Still Blocked

- Existing login and lockout behavior still blocks repeated bad login attempts.
- Existing account-delete step-up remains in place.
- Existing Stripe signature verification still blocks forged webhook payloads.
- Existing cron/internal bearer secret checks still fail closed.
- New telemetry makes lockout starts, MFA failures, webhook signature failures,
  secret misuse, and Redis limiter degradation visible without exposing secrets.

## Route Groups And Final Policies

See `rate_limit_policy_matrix.md` for the full matrix.

Enforced now:

- `public_read`
- `user_write`
- `auth_login`
- `auth_register`
- `password_reset`
- `password_reset_request`
- `password_reset_confirm`
- `mfa_verify`
- `mobile_oauth_exchange`
- `provider_recommendations`
- `export_data`
- `export_pdf`
- `account_delete`
- `admin_login`
- `cron`
- `internal`

Shadow/warn only:

- `user_read`: shadow only, gated by
  `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`.
- `admin_sensitive_action`: warn only.
- `webhook`: warn only.

## Tests Added

- `apps/web/src/lib/security-events.test.ts`
- `apps/web/src/lib/rate-limit-policy.test.ts`

The requested route and middleware tests were also run to verify compatibility
with the narrower telemetry-only route changes.

## Remaining Risks

- Production still needs Redis/Upstash configured for cluster-wide rate limits.
  In-memory fallback is per-instance and is only a degraded safety net.
- Proxy trust boundaries must be verified before relying on forwarded IP
  headers in production.
- Shadow `user_read` should run for at least 30 days before any enforcement
  promotion.
- CAPTCHA or step-up hooks remain future work for higher-risk bursts.
- Broader export step-up UI/backend changes were intentionally left out of this
  PR and should be handled in a separate scoped PR if desired.

## Rollout Recommendation

Ship this as a telemetry and policy-foundation PR first. Enable enforcement
only where existing behavior already enforced it. Turn on new shadow/warn
signals, watch false-positive rates, then promote narrowly where the data is
clean.

## Files In Scope

```
docs/audits/security/rate_limit_policy_matrix.md
docs/audits/security/rate_limit_auth_limit_audit.md
docs/audits/security/rate_limit_auth_limit_final_report.md
apps/web/src/lib/security-events.ts
apps/web/src/lib/security-events.test.ts
apps/web/src/lib/rate-limit-policy.ts
apps/web/src/lib/rate-limit-policy.test.ts
apps/web/src/lib/rate-limit.ts
apps/web/src/lib/internal-secrets.ts
apps/web/src/middleware.ts
apps/web/src/app/api/auth/login/route.ts
apps/web/src/app/api/account/delete/route.ts
apps/web/src/app/api/export/route.ts
apps/web/src/app/api/webhooks/stripe/route.ts
```

Export UI changes are intentionally not included.
