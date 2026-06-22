# Billing And IAP Route Matrix

Date: 2026-06-22
Scope: Stripe checkout/portal/subscription routes, mobile IAP routes, billing webhooks, and admin subscription actions.

This is a source-backed matrix pass, not a live billing test. No live Stripe, Apple, Google, or store credentials were used.

## Method

Inspected route files, billing/IAP helpers, webhook idempotency helpers, admin subscription routes, and related tests with targeted source searches.

## Web Billing Routes

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/stripe/checkout/route.ts` | POST | `requireDbUserId` at line 3 and user lookup at line 333 | rate limit at lines 339-340; price validation at lines 56-81; terms guard at lines 167-169 and 447-451; existing active-subscription guards at lines 180-195 and 458-488; Stripe idempotency at lines 304-309 and 730-735 | No bypass verified |
| `apps/web/src/app/api/stripe/portal/route.ts` | POST | `requireDbUserId` at line 3 and user auth at line 38 | rate limit at lines 43-44; requires subscription/customer lookup at line 49; creates billing portal session at lines 59-60 | No bypass verified |
| `apps/web/src/app/api/stripe/checkout/cancel/route.ts` | GET, POST | user auth import at line 2; auth in GET/POST at lines 73 and 89 | restores free access from pending checkout at lines 15-42 | No bypass verified |
| `apps/web/src/app/api/subscription/actions/route.ts` | POST | `requireDbUserId` at line 3 and user auth at line 57 | rate limit at lines 61-62; subscription lookup at line 73; Stripe resume/cancel idempotency at lines 94-104 and 142-153; local updates at lines 107, 182, and 194 | No bypass verified |
| `apps/web/src/app/api/subscription/change-plan/route.ts` | POST | `requireDbUserId` at line 3 and user auth at line 199 | rate limit at lines 204-205; terms guard at lines 211-213; provider/status guard at lines 227-235; server-side price mapping at lines 240-246; scheduled downgrade idempotency at lines 299-333; local scheduled update at line 347 | No bypass verified |
| `apps/web/src/app/api/subscription/switch-cycle/route.ts` | POST | `requireDbUserId` at line 3 and user auth at line 196 | rate limit at lines 201-202; terms guard at lines 208-210; provider/plan/status guard at lines 225-238; price mapping at lines 243-250; schedule idempotency around line 369; local update around line 387 | No bypass verified |

## Mobile IAP Routes

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/mobile/iap/products/route.ts` | GET | public product metadata route at line 18 | no purchase mutation | Expected public route |
| `apps/web/src/app/api/mobile/iap/verify/route.ts` | POST | user auth import at line 17 and auth at line 55 | IP/user rate limits at lines 57-62; Apple signed transaction verification at lines 88-100; Apple server refresh with locally verified fallback at lines 111-122; Google refresh at line 128; entitlement write at lines 137-139 | No bypass verified; full store transition matrix still open |

Supporting IAP helper evidence:

- `apps/web/src/lib/iap-apple.ts:174` verifies Apple JWS payloads; the file comments at lines 6-15 describe x5c chain validation and bundle/environment return values.
- `apps/web/src/lib/iap-common.ts:410-448` normalizes locally verified Apple transaction payloads, including bundle validation at lines 413-417 and environment capture at line 448.
- `apps/web/src/lib/iap-common.ts:547-548` gates Apple sandbox purchases in production-like billing environments.
- `apps/web/src/lib/iap-common.ts:574-646` applies IAP state, including original transaction ownership checks and encrypted/hashed purchase token storage.

## Billing Webhooks

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | POST | Stripe signature header at lines 581-584; runtime webhook secret at lines 587-589 | body cap at lines 562-578; signature construction at line 612; stale event guard at lines 644-654; webhook idempotency reserve at line 658; release on error at line 1320 | No bypass verified |
| `apps/web/src/app/api/webhooks/appstore/route.ts` | POST | App Store signed notification processing; notification UUID at lines 96-97 | prod-like missing bundle rejects at lines 105-107; bundle mismatch at lines 109-111 and 145-147; stale notification at line 118; idempotency at lines 150-160; sandbox-in-prod rejection at line 244 | No bypass verified |
| `apps/web/src/app/api/webhooks/playstore/route.ts` | POST | OIDC verification path at line 159 | prod-like missing identity rejects at lines 147-150; service-account/subject checks at lines 160-168; package validation at lines 225-250; idempotency at lines 213-219 | No bypass verified |

Supporting webhook helper evidence:

- `apps/web/src/lib/webhook-idempotency.ts:58` reserves webhook events.
- `apps/web/src/lib/webhook-idempotency.ts:68-69` releases reservations on retryable error paths.

## Admin Billing Routes

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/admin/src/app/api/billing/route.ts` | GET | `requirePermission("subscriptions", "canRead", { minimumRole: "ADMIN" })` at line 86 | purchase token fields are removed in the sanitizer at lines 69-71; audit write at line 229 | No bypass verified |
| `apps/admin/src/app/api/subscriptions/route.ts` | GET | `requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" })` at line 68 | raw billing IDs are role-gated at line 69; purchase token presence is booleanized at lines 40-41; result rows are redacted at line 201 | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/invoices/route.ts` | GET | `requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" })` at line 77 | raw Stripe identifiers are masked at line 128 and audit is written at lines 145-154 | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/cancel/route.ts` | POST | `requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" })` at line 66 | password/MFA step-up at lines 77-78; provider/status guard at lines 122-126; audit writes before and after provider action | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/refund/route.ts` | GET, POST | read preview permission at line 155; POST update permission at line 206 | password/MFA step-up at lines 217-218; preview amount mismatch guard at lines 296-317; refund amount guard at lines 326-371; Stripe idempotency at lines 373-407 | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/change-plan/route.ts` | GET, POST | read preview permission at line 189; POST update permission at line 296 | password/MFA step-up at lines 307-308; server-side Stripe price resolution; Stripe idempotency at lines 540-547 | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/resync/route.ts` | POST | `requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" })` at line 118 | password/MFA step-up at line 128; provider data is retrieved from Stripe; masked provider IDs in audit/log paths | No bypass verified |
| `apps/admin/src/app/api/subscriptions/[id]/revalidate/route.ts` | POST | `requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" })` at line 68 | password/MFA step-up at line 78; audit rows and masked credential IDs | No bypass verified |

## Findings

No new billing or IAP bypass was verified in this pass.

The Apple verify route can fall back to a locally verified signed transaction when the Apple server lookup fails or returns no subscription. That is not promoted as a finding in this pass because the inspected code verifies Apple JWS data, validates bundle ID, captures environment, and applies a production-like sandbox gate. The remaining gap is transition-test coverage and operational policy, not a confirmed source bug.

## Not Verified In Code

- Complete entitlement transition matrix across purchase, renewal, cancel, refund, revocation, expiration, duplicate, sandbox/test, and out-of-order events.
- Mobile UI server-authoritativeness across all screens.
- Live Stripe/App Store/Google Play dashboard configuration.
- Latest trusted dependency audit result.

## Recommended Next Tests

- Unit/integration tests for every `Subscription.status` transition by provider.
- Replay tests for Stripe, App Store, and Play Store webhooks.
- Duplicate ownership tests for App Store `originalTransactionId` and Play Store purchase token hashes.
- Admin billing action tests for missing/invalid/valid step-up, provider failure, and local DB failure after provider success.
