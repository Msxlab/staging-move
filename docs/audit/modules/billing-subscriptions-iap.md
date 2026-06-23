# Module Audit: Billing, Subscriptions, IAP

Status: source-backed route matrix added; full transition testing still required.

## Source Inspected

- Root/package scripts.
- Prisma subscription and webhook models.
- Stripe checkout, portal, cancel, subscription action, change-plan, and switch-cycle routes.
- Mobile IAP products and verify routes.
- Stripe, App Store, and Play Store webhook routes.
- Admin billing, subscriptions list, invoice, cancel, refund, change-plan, resync, and revalidate routes.
- IAP Apple/Google/common helper files and webhook idempotency helper.

## Verified Facts

- `Subscription` model exists at `packages/db/prisma/schema.prisma:232`.
- `ProcessedWebhookEvent` model exists at `packages/db/prisma/schema.prisma:1693`.
- Stripe checkout uses user auth, route-level rate limiting, server-side plan/price checks, terms guards, existing-active-subscription guards, and Stripe idempotency.
- User subscription mutation routes use user auth, route-level rate limiting, provider/status guards, server-side price mapping, and Stripe idempotency or schedules.
- Mobile IAP verify uses user auth, IP/user rate limits, Apple JWS verification, Google refresh, and centralized `applyIapStateToUser`.
- Billing webhooks include signature/audience/package checks and webhook idempotency.
- Admin billing writes sampled in this pass require subscription update permission plus password/MFA step-up and audit logging.

## Findings

No billing bypass was verified in this pass.

## Not Verified In Code

- Complete entitlement-state machine.
- Stripe lifecycle behavior across every status transition.
- Apple/Google sandbox vs production behavior across every store edge case.
- Refund, cancel, revoke, duplicate, and out-of-order event handling across all providers.
- Mobile entitlement UI server-authoritativeness.

## Next Steps

- Use `docs/audit/reports/billing-iap-route-matrix.md` as the starting evidence table.
- Run tests focused on every subscription status transition.
- Confirm no live billing credentials are used outside approved production contexts.
