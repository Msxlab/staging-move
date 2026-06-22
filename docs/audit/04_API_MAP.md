# API Map

## Shared Boundary Controls

Web middleware:

- Public API prefix list: `apps/web/src/middleware.ts:76`.
- Body size limits: `apps/web/src/middleware.ts:156-157`.
- CSRF check: `apps/web/src/middleware.ts:192`.
- Rate limit check: `apps/web/src/middleware.ts:302`.
- Session validation gate: `apps/web/src/middleware.ts:575`, `apps/web/src/middleware.ts:819`.
- CSP/HSTS: `apps/web/src/middleware.ts:752`, `apps/web/src/middleware.ts:768`.

Admin middleware:

- Public exact path list: `apps/admin/src/middleware.ts:24`.
- HSTS: `apps/admin/src/middleware.ts:253`.
- Backup body limit: `apps/admin/src/middleware.ts:327`.
- CSRF: `apps/admin/src/middleware.ts:355`.
- Admin rate limiting: `apps/admin/src/middleware.ts:554`.
- Main rate-limit and CSRF pipeline: `apps/admin/src/middleware.ts:657`, `apps/admin/src/middleware.ts:671`.

## Web API Categories

| Category | Representative locations | Auth/safety model observed | Gaps |
| --- | --- | --- | --- |
| Auth/session | `apps/web/src/lib/user-auth.ts`, `apps/web/src/app/api/auth` | Cookie/JWT plus DB session model. | Mobile OAuth and OAuth edge cases need flow review. |
| User workspace | `apps/web/src/lib/workspace-context.ts` and workspace routes | Membership context and status checks. | Need route-level matrix to prove every scoped API uses helper. |
| Privacy/export/deletion | `apps/web/src/app/api/account/delete`, `apps/web/src/app/api/export`, `apps/web/src/app/api/consent` | Focused matrix found user auth, rate limits, step-up, masking, soft-delete/grace/purge, restore token, consent history, and CCPA cookie/DB behavior. | Full model-by-model export/delete policy table needed. |
| Tracking | `apps/web/src/app/api/tracking/event/route.ts` | Consent/session/auth and metadata sanitization. | Finding: sanitizer can miss sensitive data under benign keys. |
| Cron | `apps/web/src/lib/cron-guard.ts`, `apps/web/src/app/api/cron` | `verifyInternalAuth` with cron bucket. | Complete route list still needed. |
| Internal | `apps/web/src/app/api/internal` | `verifyInternalAuth` with internal/impersonation bucket. | Sampled only. |
| Webhooks | `apps/web/src/app/api/webhooks/appstore`, `apps/web/src/app/api/webhooks/playstore` | Signature/audience/package checks and idempotency paths observed. | Full entitlement-state transition audit needed. |
| Billing/IAP | `apps/web/src/app/api/stripe`, `apps/web/src/app/api/subscription`, `apps/web/src/app/api/mobile/iap` | Focused route matrix found user auth, rate limits, server-side price/status checks, store verification, and centralized entitlement writes. | Full transition test matrix needed. |
| Connectors/address-change | `apps/web/src/app/api/connectors`, `apps/web/src/app/api/connector-dispatch`, `apps/web/src/app/api/partner-consents` | Focused route matrix found user auth, workspace scope/action, feature gates, entitlement checks, HMAC webhooks, consent token storage, and dispatch idempotency. | Retention/export/delete and user notification behavior need proof. |
| Affiliate postback | `apps/web/src/app/api/affiliate/postback/[network]/route.ts` | HMAC signature over raw body and idempotent upsert observed. | Network-secret lifecycle and runtime config need review. |

## Admin API Categories

| Category | Representative locations | Auth/safety model observed | Gaps |
| --- | --- | --- | --- |
| Admin session/auth | `apps/admin/src/lib/auth.ts`, auth routes | DB-backed admin sessions, roles, MFA, password confirmation. | Full role transition/session invalidation review needed. |
| Users/subscriptions/billing | `apps/admin/src/app/api/users`, `apps/admin/src/app/api/billing` | `requirePermission` observed across sampled routes. | Need destructive-route step-up matrix. |
| Admin subscription actions | `apps/admin/src/app/api/subscriptions` | Focused matrix found read redaction, audit logging, and password/MFA step-up on sampled billing mutations. | Full status transition tests needed. |
| Admin connectors | `apps/admin/src/app/api/connectors`, `apps/admin/src/app/api/connector-fallbacks` | Connector config writes use step-up; fallback writes are permission-gated, validated, and audited. | Finding: fallback POST/DELETE lack step-up parity. |
| Admin backup/import/hard-delete | `apps/admin/src/app/api/backup`, `apps/admin/src/app/api/cron/backup`, `apps/admin/src/app/api/users/[id]/hard-delete` | Focused matrix found SUPER_ADMIN/admin permission gates, password/MFA step-up, OTP for hard delete, signed/encrypted backup policy, restore target guard, restore lock, and safety backup behavior. | Disposable restore drill and full admin route matrix still needed. |
| Analytics/audit logs | `apps/admin/src/app/api/analytics`, audit models | Permission-gated sampled routes. | Need PII minimization and export scope review. |
| Backup/import | `apps/admin/src/app/api/backup` | Permission plus password confirmation observed in sampled files. | High-risk area; needs dedicated test review. |
| Cron/internal | `apps/admin/src/app/api/cron`, `apps/admin/src/app/api/internal` | `verifyInternalAuth` observed. | Complete coverage still needed. |

## API Review Rules For Next Pass

- Treat billing, auth, account deletion, address-change connectors, webhooks, backups, and admin mutations as high risk.
- Every endpoint should have one explicit classification and one explicit owner.
- Any missing classification should be marked `not verified in code`, not inferred from naming.
