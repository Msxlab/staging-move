# Flow Audit: Subscription Payment (Stripe / Web)

Area slug: `subscription-payment-web`
Scope: Pricing -> Stripe Checkout/session -> webhook -> subscription record -> entitlement -> plan-limit enforcement.
Method: READ-ONLY source-code trace. Evidence is source code; doc/report claims are not cited as proof.

---

## 1. Flow Summary & actors

**Actors**
- **Visitor / authenticated user** — starts checkout from the pricing page (`/pricing`) or the subscription settings page (`/settings/subscription`).
- **Web app (Next.js API routes)** — creates Stripe Checkout sessions, customer-portal sessions, and applies plan/cycle changes.
- **Stripe** — hosts Checkout (hosted redirect or embedded iframe), charges the card, and emits webhook events.
- **Webhook handler** (`/api/webhooks/stripe`) — the authoritative writer of subscription state into the local DB mirror.
- **Crons** — `stripe-reconcile` (nightly drift correction) and `checkout-cleanup` (stale PENDING_CHECKOUT sweep).
- **Entitlement resolver** (`packages/shared/src/entitlement.ts`) + **plan-limits** (`apps/web/src/lib/plan-limits.ts`) — read the mirror to gate features and enforce caps.

**Single local source of truth**: one `Subscription` row per user (`@@unique` on `userId`). Stripe is the billing source of truth; the local row is a mirror reconciled by webhook + nightly cron.

---

## 2. Step-by-step trace

### Step 1 — Pricing page render
- **Trigger**: GET `/pricing`.
- **File**: `apps/web/src/app/pricing/page.tsx` (force-dynamic). Renders `PricingSection`; embedded checkout is `apps/web/src/components/marketing/embedded-checkout-card.tsx`.
- **State**: reads `CONSUMER_FREE_FLAG` (when on, the whole paid flow is positioned as free), resolves the CTA target and public campaign view-model.
- **No DB write.**

### Step 2 — Launch checkout (client)
- **Trigger**: user clicks Subscribe.
- **File**: `embedded-checkout-card.tsx:119-175` POSTs `/api/stripe/checkout` with `{ plan, billingInterval, campaignCode?, acceptedSubscriptionTerms: true, uiMode: "embedded" }`. Hosted path (subscription-management) omits `uiMode` and gets a redirect `url`.
- **Client gate**: refuses to launch if `!termsAccepted` or no publishable key (`:121-136`).

### Step 3 — Create Checkout session (server)
- **File**: `apps/web/src/app/api/stripe/checkout/route.ts` `POST` (`:323`).
- **Guards (in order)**:
  - Mobile client blocked (`isMobileAppClient` -> `mobileExternalBillingNotAllowedResponse`, `:325`).
  - `requireStripeSecretKeyForMutation` (live key in prod) (`:329`).
  - `requireDbUserId()` auth (`:333`).
  - Rate limit 5/min keyed by user (`:339-343`, `failClosed: "if-redis-configured"`).
  - Plan routing: FAMILY/PRO -> `createWorkspacePlanCheckout`; INDIVIDUAL -> campaign path; else 400 (`:363-376`).
  - Campaign resolution + availability/type/interval validation (`:381-446`).
  - `acceptedSubscriptionTerms` required (`:447`).
  - Existing-subscription guards: `ALREADY_TRIALING` / `ALREADY_ACTIVE` / `BILLING_NEEDS_ATTENTION` / `SUBSCRIPTION_MANAGED_ELSEWHERE` (`:462-509`).
  - Trial-reuse guard via `acquisitionRedemption` (`:511-527`).
  - **Price integrity guard** `verifyStripeCheckoutPrice` (`:60-85`): retrieves the Stripe price and rejects (503) unless `active && currency==usd && interval matches && unit_amount == expectedStripeUnitAmount(plan, interval)`. Expected amount comes from `billingAmountUsdForInterval` over `BILLING_PLAN_DEFINITIONS`.
- **DB op**: get/create `Subscription` shell (`status=PENDING_CHECKOUT`, `provider=STRIPE`), get/create Stripe customer, then `subscription.update` writing `PENDING_CHECKOUT`, campaign snapshot, consent snapshot, policy versions, `stripePriceId`, `firstChargeAt/Amount` (`:552-649`). Also writes a `acquisitionRedemption` PENDING_CHECKOUT row (best-effort, `:651-673`).
- **Side effect**: `stripe.checkout.sessions.create` with an idempotency key bucketed to the minute (`:730-741`). Metadata carries `userId, plan, cycle, billingInterval, provider, platform, campaignCode, accessType, checkoutDisclosureTextHash` on both session and `subscription_data`.
- **Response**: `{ clientSecret }` (embedded) or `{ url }` (hosted).

### Step 4 — User pays at Stripe
- Stripe collects payment / wallet. On success it returns the user to `return_url`/`success_url` = `/settings/subscription?success=true&plan=...&trial=...`.

### Step 5 — Return path (client)
- **File**: `apps/web/src/components/settings/subscription-management.tsx`.
- On `success=true` it **polls** the real subscription via `load()` up to 12×2s and only celebrates when `isStripeCheckoutActivated(sub)` is true (`:260-282`) — it does NOT trust the query param as proof of payment. Good.
- If it lands on `PENDING_CHECKOUT` without `success` and no `stripeSubscriptionId` (browser back from Checkout), it POSTs `/api/stripe/checkout/cancel` to reset the stuck row (`:289-312`).

### Step 6 — Webhook (authoritative write)
- **File**: `apps/web/src/app/api/webhooks/stripe/route.ts` `POST` (`:571`).
- **Order of checks**: content-length/byte ceiling 256KB (`:573-580`) -> require `stripe-signature` (`:581`) -> load webhook secret (`:587`) -> require live secret key (`:593-606`) -> `constructEvent` signature verify (`:611-637`, emits `WEBHOOK_SIG_FAILURE` + operator alert on failure) -> livemode/env match (`:639-640`) -> 72h staleness reject (`:651-656`) -> **reserve-before-act idempotency** via `markWebhookEventProcessed` (`:664-667`).
- **Handlers**: `checkout.session.completed`, `customer.subscription.created/updated/trial_will_end`, `customer.subscription.deleted`, `invoice.paid/payment_succeeded`, `invoice.payment_action_required/payment_failed`, `subscription_schedule.*`, `charge.refunded`, `charge.dispute.created/funds_withdrawn`.
- **Core sync**: `syncLocalSubscriptionFromStripe` (`:347-506`) derives status via `mapStripeStatusWithRenewal`, sets `accessType`, `billingInterval` (prefers live Stripe price interval), period ends, `autoRenew`, `cancelAtPeriodEnd`, `plan`, increments `version`. Out-of-order protection via `lastStripeEventAt` (`:321-345`, `:451-460`). ADMIN manual-grant rows are skipped (`:382-388`).
- **Duplicate-sub cleanup**: `cancelDuplicateActiveStripeSubscriptions` cancels other live subs for the customer on `checkout.session.completed` (`:256-302`, `:722-729`).
- **Failure handling**: on any throw inside the switch, the reservation is released so Stripe retries (`:1316-1322`).
- **Side effects**: activation/cancel/resume/updated/payment-failed emails (deduped, fire-and-forget) and `sendAdminPurchaseAlert`; `reconcileSeatsForOwner` on plan change/cancel/refund/dispute.

### Step 7 — Entitlement read + plan-limit enforcement
- **File**: `packages/shared/src/entitlement.ts` `getEffectiveEntitlement` — single resolver for "has access now".
- **File**: `apps/web/src/lib/plan-limits.ts` `getUserPlan` -> `canCreateAddress/Service/CustomProvider/MovingPlan/...` enforce per-owner caps on write; `apps/web/src/lib/api-gates.ts` `requireAppMutationUser({requirePremium})` gates premium mutations.

---

## 3. Happy-path correctness

The happy path is sound and notably well-defended:
- Server-side **price integrity** (`verifyStripeCheckoutPrice`) blocks checkout if the configured Stripe price drifts from the canonical plan definition (active/usd/interval/amount), so a misconfigured/edited price can't silently charge the wrong amount.
- The checkout always resolves the **canonical** `priceId` from env (`getStripePriceIdForPlanAndInterval`) — the campaign's `displayPriceLabel` is disclosure copy only and never determines the charge.
- Webhook is the **only** entitlement-granting writer; the return page never grants access from `success=true`, it polls real state.
- Idempotency is reserve-before-act (`markWebhookEventProcessed`) plus per-row `lastStripeEventAt` out-of-order guard plus `version` increments.
- Trial vs paid is derived from live Stripe status (`accessType = trialing ? FREE_TRIAL : PAID`), and the nightly reconcile uses the **same** derivation helper (`deriveStripeEntitlementFields`) so the cron can't drift from the webhook.
- Duplicate live subscriptions from successive checkouts are actively canceled.

---

## 4. Edge cases & reverse-logic

- **Auth/role**: every mutating route calls `requireDbUserId()`; checkout/portal/change-plan/switch-cycle additionally block mobile clients. Webhook is unauthenticated by design but signature-verified.
- **Empty/invalid input**: plan validated against `INDIVIDUAL|FAMILY|PRO`; `acceptedSubscriptionTerms` required; `targetInterval`/`targetPlan` validated; campaign type/interval validated.
- **Double-submit / idempotency**: checkout uses a minute-bucketed Stripe idempotency key; webhook reserves the event id before side effects; change-plan/switch-cycle/cancel use `version`-scoped idempotency keys.
- **Token/session expiry on return**: cancel-redirect swallows auth errors so the user still lands on the settings page (`cancel/route.ts:71-81`).
- **Partial failure**: schedule-based downgrades roll back the Stripe schedule if the local pending write fails (`change-plan:364-387`, `switch-cycle:403-427`).
- **Race / stale data**: `lastStripeEventAt` lte-guard, `updateMany` no-row detection, and reconcile cron all defend against dropped/out-of-order webhooks.
- **Direct deep-link entry**: `/settings/subscription` polling + the stuck-checkout reset handle back-button and tab-close cases; `checkout-cleanup` cron sweeps anything missed.

### Findings in this section

- **[subscription-payment-web-01] (Medium, Reverse Logic)** — `checkout.session.completed` never validates that the session belongs to the user it will entitle. See §5.
- **[subscription-payment-web-02] (Medium, Reliability)** — webhook side effects after the idempotency reservation are not transactional; a duplicate redelivery after a mid-handler crash will re-run already-applied side effects only if the release succeeded, but the reservation-release itself is best-effort. See §6.
- **[subscription-payment-web-04] (Low, Logic)** — initial-payment failure writes `status=UNPAID` with no email and no grace, but the entitlement resolver treats `UNPAID` as fully canceled even though the user may still be inside Stripe's incomplete-payment retry window. See below.

---

## 5. Security review

**Authz at each step** — strong. All user-facing billing mutations require `requireDbUserId()`; portal/change/switch/checkout block mobile; webhook is signature-verified with operator alerting on failure and a 256KB body ceiling.

**Secrets/PII** — `.env` not read. Stripe secret key required to be `sk_live_` in production (`billing-config.ts:11-26`). Rate-limit error reasons are scrubbed of URLs/tokens (`rate-limit.ts:111-120`). User hints are truncated in webhook logs (`safeUserHint`). Webhook signature-failure events record only lengths, not bodies.

**Validation** — price integrity guard, plan/interval/campaign validation, plan-value validation via `isBillingPlan` before persisting Stripe metadata (`webhooks/stripe:38-43`).

**IDOR / workspace scoping** — local row is keyed by `userId`; multi-subscription customers are scoped by `(stripeCustomerId, stripeSubscriptionId)` in invoice/refund/dispute handlers so one sub's event can't flip unrelated rows.

### Findings

- **[subscription-payment-web-01] (Medium, Security/Reverse-Logic)** — **`checkout.session.completed` trusts session metadata `userId` / `client_reference_id` without cross-checking the customer.**
  In `webhooks/stripe/route.ts:684-720`, the entitled `userId` is taken from `session.metadata.userId` or `session.client_reference_id`, and `syncLocalSubscriptionFromStripe` then resolves the local row by `OR [userId, stripeCustomerId, stripeSubscriptionId]` (`findLocalSubscriptionForWebhook:188-192`). The session's customer id is not required to match the customer already stored on the resolved `userId` row. Because the event is Stripe-signature-verified, the practical exposure is low (an attacker cannot forge a signed event), but the design relies on Stripe metadata that the checkout route itself populates rather than on a server-verified mapping from `stripeCustomerId -> userId`. If session metadata is ever populated from a less-trusted path (e.g. a future admin/test tool, or a copied session), the handler would entitle the metadata `userId` against a different customer's subscription. Recommendation: when both are present, assert that the resolved local row's `stripeCustomerId` equals the session customer (or that the metadata `userId` maps to the same customer) and reject/relog the mismatch.

- **[subscription-payment-web-05] (Low, Security)** — **No verification that the completed session's price/plan matches what was reserved at checkout.** The checkout route writes `stripePriceId` and a `checkoutDisclosureTextHash` to the row and session metadata, but `checkout.session.completed` derives plan purely from the live subscription's price (`:707-709`) and never compares it to the pre-checkout reservation. With promotion codes enabled (`allow_promotion_codes: true`) this is intentional for discounts, but it means a price/plan substitution between session creation and completion would be accepted silently. Low severity because the price guard runs at creation and Stripe controls the line items; flagged for completeness. [needs verification of whether promo codes can change the recurring price/plan vs. only apply a discount].

---

## 6. Reliability

- **Retry**: non-2xx makes Stripe retry within 72h; the handler keeps events "retryable" by throwing (`retryableWebhookError`) when the local row isn't synced yet.
- **Transaction consistency**: the cancel-redirect and checkout-cleanup wrap their multi-write in `$transaction`. The webhook does NOT wrap subscription-update + redemption-flip + emails in a transaction — emails are intentionally fire-and-forget, and the redemption flip is gated on its own status so it is idempotent.
- **Partial-failure recovery**: schedule rollbacks on pending-write failure; `checkout-cleanup` and `stripe-reconcile` crons are the backstops.
- **Loading/empty/error UX**: the settings page shows an "Activating checkout…" state while polling and recovers stuck PENDING_CHECKOUT rows.

### Findings

- **[subscription-payment-web-02] (Medium, Reliability)** — **Reservation release on handler failure is best-effort and unmonitored.** `webhooks/stripe/route.ts:1320` calls `releaseProcessedWebhookEvent(event.id, "stripe").catch(() => {})`. If the release itself fails (DB blip during the same incident that failed the handler), the event id stays reserved and Stripe's retry will short-circuit as `duplicate` at `:665`, permanently dropping that event's side effects with no alert. The reconcile cron repairs subscription *state* nightly, but one-shot side effects (activation email, admin purchase alert, redemption count increment) are lost. Recommendation: log/capture when the release fails so an operator can re-drive, or make the marker carry a "processed=true" flag set only on success rather than reserve-then-delete.

- **[subscription-payment-web-03] (Medium, Reliability/Data)** — **`firstChargeAt` semantics diverge between checkout and webhook.** Checkout writes `firstChargeAt = now + trialDays` for the annual trial (`checkout/route.ts:606-607,637`). The webhook overwrites `firstChargeAt = trialEnd` only when `trialEnd` is set (`webhooks/stripe:431-433`) and explicitly never nulls it on a non-trial sync. For a **monthly paid** offer (no trial) the checkout sets `firstChargeAt = now` (trialDays null so `firstChargeAt` stays `now`), but the webhook never confirms/clears it; and a trial that is canceled-then-resumed can leave `firstChargeAt` pointing at the original trial end. The settings UI renders `firstChargeAt` as the "first charge" date (`subscription-management.tsx:363-368`), so the displayed first-charge date can be stale/wrong after a resume. User-facing billing-date accuracy issue; verify against the resume/cancel paths. [needs verification of exact UI copy impact].

- **[subscription-payment-web-04] (Low, Logic)** — **Initial subscription-create payment failure is terminal locally with no dunning.** `invoice.payment_failed` with `billing_reason === "subscription_create"` writes `status=UNPAID`, `gracePeriodEndsAt=null`, and **skips the payment-failed email is still sent** but no grace is granted (`webhooks/stripe:1082-1138`). The entitlement resolver maps `UNPAID` to `CANCELED`/no access (`entitlement.ts:462-480`). If Stripe later retries the initial invoice and it succeeds, `invoice.paid` restores `ACTIVE`. This is defensible, but a user who lands on `UNPAID` during Stripe's initial-payment retry window sees no access and (depending on Stripe settings) may not get a clear recovery path from this route. Low; mostly a UX/observability note.

---

## 7. Cross-module impact

- **Workspaces / seats**: every status transition that can change entitlement calls `reconcileSeatsForOwner` (best-effort) to demote/restore OVERFLOW members. Plan caps (`plan-limits.ts`) are read per plan-owner, so a downgrade narrows caps for the whole workspace.
- **Acquisition campaigns**: checkout creates a PENDING_CHECKOUT `acquisitionRedemption`; the webhook flips it to REDEEMED and increments `redemptionCount` once; checkout-cleanup expires stale ones. The increment is gated on `status=PENDING_CHECKOUT` so it runs at most once.
- **Email**: activation/cancel/resume/updated/payment-failed emails, all deduped on event id / period key, all fire-and-forget so they never block webhook 2xx.
- **Admin / analytics**: `sendAdminPurchaseAlert` on first activation; `trackEvent('trial_started'|'subscription_started')` fired client-side only after real activation is confirmed.
- **Mobile**: web billing routes hard-block mobile app clients to keep store-billing compliance; entitlement resolver shares one code path across web/mobile/admin.
- **Reconcile cron**: uses `rawPrisma` (sees soft-deleted users) and the shared derivation helper, writes BOTH `currentPeriodEndsAt` and `stripeCurrentPeriodEnd`.

### Finding

- **[subscription-payment-web-06] (Low, Reliability)** — **`reconcileSeatsForOwner(...).catch(() => {})` swallows all errors silently across every billing transition.** A persistent failure to demote members after a downgrade/cancel/refund/dispute (e.g. `webhooks/stripe:493,965,1250,1307`; `change-plan:181`) leaves over-limit members with write access to an unpaid/over-cap plan, with no signal. Consider capturing the error to Sentry rather than discarding.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| subscription-payment-web-01 | Medium | Security | `checkout.session.completed` entitles the metadata/`client_reference_id` userId without asserting the session customer matches that user's stored Stripe customer | If session metadata ever comes from a less-trusted path, a user could be entitled against another customer's subscription | Cross-check resolved row's `stripeCustomerId` against the session customer; reject + alert on mismatch | `apps/web/src/app/api/webhooks/stripe/route.ts:684-720`, `:188-192` |
| subscription-payment-web-02 | Medium | Reliability | Idempotency reservation release on handler failure is best-effort (`.catch(()=>{})`) and unmonitored | A failed release permanently drops that event's one-shot side effects (activation email, admin alert, redemption increment) | Capture/alert on release failure, or use a success-flag marker instead of reserve-then-delete | `apps/web/src/app/api/webhooks/stripe/route.ts:1316-1322`, `apps/web/src/lib/webhook-idempotency.ts:35-37` |
| subscription-payment-web-03 | Medium | Data | `firstChargeAt` can become stale after trial resume/cancel and is not normalized for monthly offers | Settings UI shows a wrong "first charge" date to the user | Recompute/clear `firstChargeAt` on resume and non-trial syncs; verify UI copy | `apps/web/src/app/api/stripe/checkout/route.ts:606-637`, `webhooks/stripe/route.ts:431-433`, `subscription-management.tsx:363-368` |
| subscription-payment-web-04 | Low | Logic | Initial-payment failure -> `UNPAID` (resolver treats as canceled) with no grace during Stripe's initial retry window | User may briefly lose access while Stripe still retries the first charge | Confirm desired UX; consider an "incomplete" state distinct from canceled | `webhooks/stripe/route.ts:1082-1138`, `packages/shared/src/entitlement.ts:462-480` |
| subscription-payment-web-05 | Low | Security | Completed session's plan/price not compared against the pre-checkout reservation | Price/plan substitution between create and complete would be accepted silently | Compare completed price against reserved `stripePriceId` (allowing promo discounts) and alert on tier change | `webhooks/stripe/route.ts:707-720` |
| subscription-payment-web-06 | Low | Reliability | `reconcileSeatsForOwner(...).catch(()=>{})` swallows seat-reconcile errors on every transition | Over-limit members may retain write access after downgrade/cancel/refund with no signal | Capture the error to Sentry | `webhooks/stripe/route.ts:493,965,1250,1307`, `change-plan/route.ts:181` |
| subscription-payment-web-07 | Info | Architecture | Strong defenses observed: server price-integrity guard, reserve-before-act idempotency, shared webhook/reconcile derivation, real-state polling on return, duplicate-sub cancellation | n/a (positive) | Keep these invariants under test | `checkout/route.ts:60-85`, `webhooks/stripe/route.ts`, `stripe-subscription-mapping.ts` |

---

## 9. Flow TODO

1. Add a `stripeCustomerId == session.customer` assertion in `checkout.session.completed` before entitling (web-01).
2. Capture/alert on `releaseProcessedWebhookEvent` failures, or move to a success-flag idempotency marker (web-02).
3. Normalize `firstChargeAt` on resume/cancel/monthly paths and re-verify the settings "first charge" copy (web-03).
4. Decide on UX for initial-payment-failure `UNPAID` during Stripe's retry window (web-04).
5. Optionally compare the completed session price against the reserved `stripePriceId`, tolerating promo discounts (web-05).
6. Replace silent `reconcileSeatsForOwner` catches with Sentry capture (web-06).
