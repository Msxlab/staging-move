# Security Blockers Phase 1 Report

Date: 2026-05-07

## Confirmed Risks Fixed

- Audit payload redaction: confirmed user and admin audit write paths could receive raw structured payloads. Added a shared non-mutating redaction helper for nested objects and arrays, with depth, array, object, and string caps. Wired it into user audit, admin audit, security-event context redaction, and impersonation audit writes.
- Sensitive export flow: confirmed the export endpoint was server-callable without step-up. Export now requires POST plus password/MFA/backup-code step-up, applies the existing export rate-limit policy, emits safe security/audit events for start, failed step-up, rate limit, and success, and does not log export content or raw step-up inputs.
- Mobile OAuth PKCE enforcement: confirmed server-side exchange could preserve unsafe legacy behavior when a stored challenge was absent. New mobile OAuth initiation requires a code challenge, exchange requires a verifier, rows with null stored challenges fail, TTL/single-use behavior remains intact, and successful mobile PKCE still works.
- Play Store webhook identity binding: confirmed OIDC verification needed an explicit trusted identity check. The webhook now binds verified tokens to an expected service-account email or subject, fails closed in production-like runtimes if audience/identity is missing, validates package name, and keeps replay/idempotency behavior.
- Public web health diagnostics: confirmed the public web health endpoint exposed richer diagnostics than necessary. It now returns only status, timestamp, uptime seconds, and readiness.
- Session fingerprint bypass: confirmed null stored user-agent and UA-match behavior could bypass fingerprint mismatch. New sessions store a normalized user-agent where available, and fingerprint mismatches invalidate the session instead of accepting same-UA IP drift.
- User-side security audit events: added safe user audit events for login success/failure, logout, password reset request/complete, password change, MFA enable/disable/failure, export attempts, and account-delete attempt failure/rate-limit cases.
- Webhook failure events: added or hardened safe failure security events for Stripe, Play Store, App Store, and Resend verification failures without logging raw signatures, JWS/OIDC tokens, or full payloads.

## False Positives / Verified Existing Behavior

- Provider batches and provider seed data were not part of these findings and were not touched.
- Admin health remains an authenticated/admin surface; no separate public admin detailed-health split was needed for this phase.
- Mobile client PKCE generation already existed; the hardening needed was server-side mandatory enforcement.
- Existing rate-limit policy work was present on several auth/MFA/mobile routes. This PR reused that policy surface and updated tests rather than reimplementing lower-level rate limits.
- Existing export UI paths already use POST-style step-up flows; the security blocker was closed at the server endpoint.

## Files Changed By This Phase

- `.env.example`
- `.env.production.example`
- `apps/admin/src/lib/audit.ts`
- `apps/admin/src/lib/audit.test.ts`
- `apps/web/src/app/api/account/delete/route.ts`
- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/auth/login/route.test.ts`
- `apps/web/src/app/api/auth/logout/route.ts`
- `apps/web/src/app/api/auth/logout/route.test.ts`
- `apps/web/src/app/api/auth/mfa/confirm/route.ts`
- `apps/web/src/app/api/auth/mfa/confirm/route.test.ts`
- `apps/web/src/app/api/auth/mfa/disable/route.ts`
- `apps/web/src/app/api/auth/mfa/disable/route.test.ts`
- `apps/web/src/app/api/auth/oauth/apple/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/route.test.ts`
- `apps/web/src/app/api/auth/oauth/apple/callback/route.ts`
- `apps/web/src/app/api/auth/oauth/google/route.ts`
- `apps/web/src/app/api/auth/oauth/google/route.test.ts`
- `apps/web/src/app/api/auth/oauth/google/callback/route.ts`
- `apps/web/src/app/api/auth/password/change/route.ts`
- `apps/web/src/app/api/auth/password/reset/confirm/route.ts`
- `apps/web/src/app/api/auth/password/reset/request/route.ts`
- `apps/web/src/app/api/export/route.ts`
- `apps/web/src/app/api/export/route.test.ts`
- `apps/web/src/app/api/health/route.ts`
- `apps/web/src/app/api/health/route.test.ts`
- `apps/web/src/app/api/mobile/auth/exchange/route.test.ts`
- `apps/web/src/app/api/webhooks/appstore/route.ts`
- `apps/web/src/app/api/webhooks/appstore/route.test.ts`
- `apps/web/src/app/api/webhooks/playstore/route.ts`
- `apps/web/src/app/api/webhooks/playstore/route.test.ts`
- `apps/web/src/app/api/webhooks/resend/route.ts`
- `apps/web/src/app/api/webhooks/resend/route.test.ts`
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/app/api/webhooks/stripe/route.test.ts`
- `apps/web/src/lib/__tests__/audit.test.ts`
- `apps/web/src/lib/audit.ts`
- `apps/web/src/lib/iap-google.ts`
- `apps/web/src/lib/impersonation-audit.ts`
- `apps/web/src/lib/impersonation-audit.test.ts`
- `apps/web/src/lib/mobile-oauth.ts`
- `apps/web/src/lib/mobile-oauth.test.ts`
- `apps/web/src/lib/security-events.ts`
- `apps/web/src/lib/user-auth.ts`
- `apps/web/src/lib/user-auth-session.test.ts`
- `apps/web/src/lib/user-security-audit.ts`
- `docs/deploy/billing-and-iap-setup-checklist.md`
- `docs/setup/oauth-and-iap.md`
- `packages/shared/src/audit-redaction.ts`
- `packages/shared/src/audit-redaction.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.mobile.ts`

Note: the working tree contained unrelated pre-existing dirty files outside this phase. They are excluded from this file list.

## Tests Added / Updated

- Shared audit redaction unit coverage for nested secrets, arrays/objects, size/depth caps, and non-mutation.
- Web audit tests for services, account numbers, notes, address PII, and nested metadata redaction.
- Admin audit test for before/after/metadata redaction.
- Export route tests for missing step-up, valid step-up, rate limiting, safe audit/security events, and no raw step-up/provider secrets in audit payloads.
- Mobile OAuth tests for missing init challenge, missing verifier, null stored challenge, valid PKCE exchange, reuse rejection, and expiry rejection.
- Play Store webhook tests for expected service account acceptance, wrong identity rejection, missing production identity fail-closed behavior, package mismatch rejection, and idempotency.
- Public health tests for minimal output and readiness failure without diagnostic leakage.
- Session fingerprint tests for null-UA legacy rejection, same-UA IP drift rejection, valid session behavior, and mobile intended IP-change behavior.
- Login tests for safe successful-login and invalid-password audit events without raw password storage.
- MFA tests for safe MFA enable/disable audit event creation and policy rate-limit behavior.
- Webhook failure tests for Stripe, App Store, Resend, and Play Store safe security-event emission.

## Test Results

- `pnpm --filter @locateflow/web test -- auth security-events webhooks export account/delete mobile/auth`: passed, 34 files and 183 tests.
- `pnpm --filter @locateflow/web test -- audit mobile-oauth mobile/auth health playstore webhooks export user-auth-session`: passed, 12 files and 84 tests.
- `pnpm --filter @locateflow/admin test -- audit`: passed, 1 file and 1 test.
- `pnpm --filter @locateflow/web exec tsc --noEmit`: passed.
- `pnpm --filter @locateflow/admin exec tsc --noEmit`: passed.
- `pnpm --filter @locateflow/shared exec tsc --noEmit`: passed.
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`: passed.
- `git diff --check`: passed with line-ending warnings for `.env.example` and `.env.production.example` only.

All pnpm commands reported the existing engine warning that the repo wants Node 22.x while this workstation is running Node v24.13.0.

## Remaining Risks

- Staging/production must set the expected Play Store RTDN identity before enabling production webhook traffic; the webhook intentionally fails closed without it.
- Legacy mobile OAuth exchange rows with null challenges now fail until they naturally expire. This is intentional and avoids preserving an unsafe fallback.
- The centralized redactor protects known helper write paths. Future direct Prisma writes to `AuditLog` or `AdminAuditLog` should be blocked by review or moved behind the same helper.
- Public web health output is now minimal; deployment monitors should be verified to depend only on HTTP status and the small safe response.
- Security events are intentionally coarse and safe; deeper incident forensics should correlate by request metadata/correlation IDs rather than raw payloads.

## Staging Smoke Test Checklist

- Configure `GOOGLE_PLAY_RTDN_AUDIENCE`, `GOOGLE_PLAY_PACKAGE_NAME`, and one of `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`.
- Confirm `/api/health` returns 200 when healthy and does not expose environment, build, dependency, database, or secret diagnostics.
- Attempt export without step-up and confirm it fails with a security/audit event and no exported content.
- Complete export with valid password and, where enabled, MFA or backup-code step-up; confirm content downloads and audit entries contain no raw credentials, notes, account numbers, or address fields.
- Start mobile Google/Apple OAuth from the current app and confirm PKCE exchange succeeds once, then fails on reuse.
- Send a Play Store RTDN fixture signed by the expected identity and package; confirm accepted/idempotent behavior.
- Send Play Store RTDN with valid audience but wrong service-account identity and confirm rejection plus safe security event.
- Send invalid Stripe/App Store/Resend webhook signatures and confirm safe failure events without raw signature/token/payload logging.
- Validate a normal web session stays valid from the same fingerprint and that an old/null-UA session is forced through re-authentication.

## Production Env Vars Required

- `GOOGLE_PLAY_RTDN_AUDIENCE` is required for production-like Play Store RTDN verification.
- `GOOGLE_PLAY_PACKAGE_NAME` must match the expected app package.
- At least one trusted identity binding is required in production-like runtimes:
  - `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL`
  - `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`

No secret values are recorded in this report.

## Commit Recommendation

Recommended commit after review: `security: harden audit logs and privacy-sensitive flows`

Do not commit until this report is reviewed.

## Safety Confirmation

- No provider seed data changes made by this phase.
- No providers added.
- No backup/DR files changed by this phase.
- No i18n/theme/logo/Aurora files changed by this phase.
- No unrelated mobile design files changed by this phase.
- No secrets or env values printed.
- No destructive DB commands run.
- No `git add .` run.
- No commit created.
