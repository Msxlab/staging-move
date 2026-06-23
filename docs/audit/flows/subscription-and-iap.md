# Flow Audit: Subscription And IAP

Status: source-backed route matrix added.

## Verified Flow Components

- Subscription model exists.
- Processed webhook event model exists.
- Stripe checkout/portal/subscription action routes contain user auth, rate limiting, server-side price/status checks, and idempotency controls.
- Mobile IAP verify contains user auth, rate limiting, Apple JWS verification, Google refresh, and centralized entitlement write logic.
- Stripe, Apple, and Google webhook route source contains verification and idempotency patterns.
- Admin subscription mutation routes sampled in this pass require admin permission, password/MFA step-up, and audit logging.

Evidence:

- `packages/db/prisma/schema.prisma:232`
- `packages/db/prisma/schema.prisma:1693`
- `docs/audit/reports/billing-iap-route-matrix.md`

## Not Verified In Code

- Full state transition test matrix.
- Stripe parity with Apple/Google across all edge cases.
- Mobile UI entitlement source of truth.
- Refund/revoke/out-of-order event behavior.

## Recommendation

- Treat this as a high-risk test matrix before billing-related source changes.
