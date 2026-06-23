# Module Audit: Payments & Billing (Stripe / Web)

> READ-ONLY audit. Evidence is source code only. Paths are relative to repo root
> `staging-move/`. Line numbers were accurate at audit time (2026-06-22).

## 1. Module Summary

The web billing module mirrors Stripe subscription state into the local
`Subscription` row (one per user, `userId @unique`) and derives every access
decision from that row through a single canonical resolver
(`packages/shared/src/entitlement.ts → getEffectiveEntitlement`). It owns:

- **Checkout** — `apps/web/src/app/api/stripe/checkout/route.ts` (Individual +
  campaign flow, and an isolated Family/Pro paid flow), with hosted and embedded
  Stripe Checkout, server-side price verification, and a non-entitling pending
  shell row.
- **Customer portal** — `apps/web/src/app/api/stripe/portal/route.ts`.
- **Subscription lifecycle actions** — cancel trial / cancel renewal / resume
  (`api/subscription/actions`), tier change with proration + deferred downgrade
  via Stripe subscription schedules (`api/subscription/change-plan`), and
  monthly↔yearly cycle switch (`api/subscription/switch-cycle`).
- **Webhook ingestion** — `apps/web/src/app/api/webhooks/stripe/route.ts`
  (signature verification, livemode guard, replay window, DB-backed
  reserve-before-act idempotency, out-of-order protection, duplicate-sub sweep,
  refund/dispute handling).
- **Reconciliation cron** — `api/cron/stripe-reconcile` (nightly drift repair)
  and `api/cron/checkout-cleanup` (stale `PENDING_CHECKOUT` sweep).
- **Plan/price config and mapping** — `lib/billing.ts`, `lib/billing-config.ts`,
  `lib/stripe-subscription-mapping.ts`, `lib/stripe-subscription-period.ts`,
  `lib/stripe-api-version.ts`, `packages/shared/src/billing.ts`.
- **Metrics** — `packages/shared/src/billing-metrics.ts` (pure MRR/churn/LTV).

Overall the module is unusually mature for a custom-JWT (no next-auth) stack:
webhook signature verification, idempotency, replay window, out-of-order guards,
multi-subscription scoping, ADMIN-grant protection, and currency/amount
verification at checkout are all present and tested. The findings below are
mostly edge-cases and a small number of integrity gaps, not foundational
failures.

## 2. Related Files

- `apps/web/src/lib/billing.ts` — price-id ↔ plan/interval mapping, entitlement
  snapshot builder, schema-compat subscription reads, `ensureSubscriptionDefaults`.
- `apps/web/src/lib/billing-config.ts` — Stripe key validation (live/test by env),
  idempotency-key builder, Apple env guard.
- `apps/web/src/lib/billing-email-utils.ts` — plan label, date format, fire-and-log email.
- `apps/web/src/lib/shared-billing.ts` — re-export barrel of `@locateflow/shared` billing.
- `apps/web/src/lib/stripe-api-version.ts` — pinned API version + flexible-billing preview version.
- `apps/web/src/lib/stripe-subscription-mapping.ts` — shared status/accessType derivation (webhook + reconcile).
- `apps/web/src/lib/stripe-subscription-period.ts` — period-end/start extraction (handles new item-level period fields).
- `apps/web/src/lib/plan-limits.ts` — per-tier address/service/custom-provider caps + `getUserPlan`.
- `apps/web/src/lib/global-spend-guard.ts` — app-wide daily AI/dossier spend fuse (not Stripe; tangential).
- `apps/web/src/lib/webhook-idempotency.ts` — reserve/release `ProcessedWebhookEvent`.
- `apps/web/src/lib/mobile-external-billing-guard.ts` — blocks web billing endpoints for mobile clients.
- `apps/web/src/app/api/stripe/checkout/route.ts`, `.../checkout/cancel/route.ts`, `.../portal/route.ts`.
- `apps/web/src/app/api/subscription/{actions,change-plan,switch-cycle}/route.ts`.
- `apps/web/src/app/api/webhooks/stripe/route.ts` (+ `route.test.ts`).
- `apps/web/src/app/api/cron/{stripe-reconcile,checkout-cleanup}/route.ts`.
- `packages/shared/src/{billing.ts,billing-metrics.ts,entitlement.ts,monetization-flags.ts,consumer-free.ts,acquisition.ts}`.
- `scripts/stripe-sync-individual-prices.ts`, `scripts/backfill-missing-subscriptions.ts`.
- `packages/db/prisma/schema.prisma` — `Subscription` (line 232), `ProcessedWebhookEvent` (line 1693).

## 3. Related Routes / Screens

- Server API routes listed above. The user-facing screen is
  `/settings/subscription` (success/cancel landing) and `/pricing` (checkout
  entry). The success path is built server-side in checkout
  (`/settings/subscription?success=true&plan=…&trial=…`). UI components were not
  in scope for deep read; cross-references only.

## 4. Related APIs

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | /api/stripe/checkout | Create Checkout session | `requireDbUserId` + rate-limit 5/min |
| GET/POST | /api/stripe/checkout/cancel | Restore stale PENDING_CHECKOUT | `requireDbUserId` |
| POST | /api/stripe/portal | Customer portal session | `requireDbUserId` + rate-limit 5/min |
| POST | /api/subscription/actions | cancel/resume trial+renewal | `requireDbUserId` + rate-limit 8/min |
| POST | /api/subscription/change-plan | tier change (proration/deferred) | `requireDbUserId` + rate-limit 5/min |
| POST | /api/subscription/switch-cycle | month↔year | `requireDbUserId` + rate-limit 5/min |
| POST | /api/webhooks/stripe | Stripe events | Stripe signature |
| GET/POST | /api/cron/stripe-reconcile | nightly drift repair | `guardCronRequest` |
| GET/POST | /api/cron/checkout-cleanup | stale pending sweep | `guardCronRequest` |

## 5. Related Components

Client UI components (subscription-management reveal modal, pricing express
checkout, cancel-survey modal) are referenced by the server contract
(`success_url` query params, `cancelReason`/`cancelReasonComment` body fields)
but were not in the deep-read scope. [needs verification] for client-side render
states.

## 6. Related State / Hooks / Stores

Server-authoritative; the `Subscription` row is the state store. Entitlement is
recomputed on every read via `getEffectiveEntitlement`. The `version` integer
column is incremented on every mutation (optimistic-concurrency signal + Stripe
idempotency-key salt). `lastStripeEventAt` is the out-of-order watermark.

## 7. Related Database / Models

- `Subscription` (schema line 232–314): single row per user (`userId @unique`),
  `stripeCustomerId @unique`, `stripeSubscriptionId @unique`,
  `originalTransactionId @unique`, `purchaseTokenHash @unique`. Holds plan,
  status, provider, accessType, billingInterval, pending* (deferred change),
  campaign*, consent snapshots, premium* (admin grant), `lastStripeEventAt`,
  `version`.
- `ProcessedWebhookEvent` (line 1693): PK = Stripe event id (VarChar 255),
  `source` column. Idempotency marker.
- `AcquisitionCampaign` / `AcquisitionRedemption`: campaign redemption tracking
  tied to checkout.

## 8. Impact Map

- **UI**: `/settings/subscription`, `/pricing`. Status drives upgrade banners,
  cancel/resume CTAs, plan reveal modal.
- **API**: all routes in §4.
- **DB**: `Subscription`, `ProcessedWebhookEvent`, `AcquisitionCampaign/Redemption`.
- **Auth**: `requireDbUserId` (custom JWT). Webhook uses Stripe signature only.
- **Admin**: admin manual grants (`provider=ADMIN`, `premiumGrantedBy`) are
  explicitly protected from Stripe overwrites in every handler.
- **Mobile**: web billing endpoints hard-block `x-client-type: mobile`
  (`mobileExternalBillingNotAllowedResponse`, 403) for store-billing compliance.
- **Notifications**: activation/cancel/resume/updated/payment-failed emails;
  admin purchase alert.
- **Integrations**: Stripe (Checkout, Subscriptions, Schedules, Portal, Invoices,
  Charges, Disputes, webhooks).
- **Analytics**: `billing-metrics.ts` MRR/churn/LTV/ARPU/trial-conversion.
- **SEO**: N/A (authenticated billing).
- **Tests**: `webhooks/stripe/route.test.ts`, `plan-limits.test.ts`,
  `entitlement.test.ts`, `qa-account.test.ts`, others.

## 9. Buttons / Actions / Functions

For each server action: expected vs actual, with state handling.

1. **Start checkout (POST /api/stripe/checkout)** — Expected: validate plan,
   campaign, terms, existing-subscription guards; verify Stripe price
   active/usd/interval/amount; create pending shell + Stripe session.
   Actual: matches. Loading/disabled/error/success are client concerns
   (machine-readable `code` returned for each rejection: `TERMS_NOT_ACCEPTED`,
   `ALREADY_ACTIVE`, `ALREADY_TRIALING`, `BILLING_NEEDS_ATTENTION`,
   `SUBSCRIPTION_MANAGED_ELSEWHERE`, `OFFER_UNAVAILABLE`, `PRICE_UNAVAILABLE`,
   `CAMPAIGN_*`). Permission: `requireDbUserId`. Mobile blocked. Edge cases:
   deleted Stripe customer → recreated; double-click → idempotency key bucketed
   per minute. **Gap:** amount verification only at checkout, not at webhook
   ingest (see pbw-03).
2. **Cancel checkout (GET/POST /api/stripe/checkout/cancel)** — restores
   `PENDING_CHECKOUT` to `ACTIVE`/`FREE_ACCESS_EXPIRED`/`CANCELED` only when no
   `stripeSubscriptionId`. GET is the Stripe `cancel_url`; both swallow errors so
   the user still lands on the page. Permission: `requireDbUserId`. Edge: idempotent.
   **Note:** GET mutates state (see pbw-07).
3. **Open portal (POST /api/stripe/portal)** — 404 if no `stripeCustomerId`;
   self-heals stale customer id (clears + 404). Permission/mobile guards present.
4. **cancel_trial / cancel_renewal / resume_renewal (POST /api/subscription/actions)**
   — sets `cancel_at_period_end` on Stripe, mirrors locally, sends email.
   Idempotency key salted with `version`. Survey fields validated against an
   allowlist and length-capped. Schema-compat fallback for survey columns.
5. **change-plan (POST /api/subscription/change-plan)** — upgrade immediate w/
   proration + OVERFLOW restore; downgrade deferred via subscription schedule;
   rollback releases the schedule if the local persist fails. Requires
   `acceptedSubscriptionTerms === true`. Only `ACTIVE`/`CANCEL_AT_PERIOD_END`.
6. **switch-cycle (POST /api/subscription/switch-cycle)** — INDIVIDUAL only;
   month→year immediate, year→month deferred; same rollback discipline.
7. **Webhook handlers** — see §11/§12/§13.
8. **Reconcile cron / checkout-cleanup cron** — see §15.

## 10. UI/UX Audit

Mostly out of deep scope (server module). Observations affecting UX:

- **Good**: every rejection returns a machine-readable `code`, enabling targeted
  client CTAs (e.g. `BILLING_NEEDS_ATTENTION` → portal). Evidence: checkout
  route lines 87–119, 374–509.
- **Finding (pbw-08, Low)**: `formatCurrency` in the webhook (route.ts:76–86)
  hardcodes `Intl.NumberFormat("en-US", …)` for the locale while honoring the
  user's currency; a Spanish-locale recipient gets US-formatted amounts in the
  activation email. Impact: cosmetic. Recommendation: pass the resolved `lang`.
- **Finding (pbw-09, Low)**: `firstChargeAmount` is derived by stripping
  non-numeric characters from the campaign display label
  (`Number.parseFloat(displayPrice.replace(/[^0-9.]/g, ""))`, checkout
  route.ts:637). A label like "$1,234" parses to `1` after the comma is stripped
  only if a comma appears before the decimal — for "$1,234.00" the regex keeps
  `1234.00` (comma removed) so it is correct, but any label with a trailing
  range or "/mo" suffix containing digits would corrupt the stored amount.
  Recommendation: store the numeric campaign amount as a dedicated field rather
  than re-parsing a presentation string.

## 11. Logic Audit

Expected flow (happy path): checkout → `checkout.session.completed` →
`syncLocalSubscriptionFromStripe` writes ACTIVE/TRIALING → renewals via
`invoice.paid` → cancel via portal/actions → `customer.subscription.deleted`.
Reconcile cron repairs any dropped webhook nightly.

Strengths confirmed in code:

- **Out-of-order protection**: `applyStripeWebhookUpdate` writes only rows whose
  `lastStripeEventAt <= eventDate` and advances the watermark (route.ts:321–345);
  `syncLocalSubscriptionFromStripe` additionally short-circuits stale events
  (route.ts:451–460). Last-writer-wins on equal-second events is intentional.
- **Reserve-before-act idempotency**: `markWebhookEventProcessed` creates the
  unique marker BEFORE side-effects; failure path releases it
  (route.ts:664–667, 1316–1322).
- **Multi-subscription scoping**: invoice/refund/dispute/deleted handlers scope
  by `(stripeCustomerId, stripeSubscriptionId)` when known, falling back to
  customer scope only for non-subscription invoices.
- **Duplicate-sub sweep**: `cancelDuplicateActiveStripeSubscriptions` cancels
  orphaned live subs after checkout (route.ts:256–302).
- **ADMIN-grant protection**: every mutating handler filters
  `provider: { not: "ADMIN" }` or early-returns on ADMIN rows
  (route.ts:382–388, 930, 1064, 1115, 1234, 1292; reconcile route.ts:107).

Issues:

- **Finding (pbw-01, Medium)** — *Webhook trusts `lastStripeEventAt` watermark
  only when the column exists; during the schema-compat fallback both the
  out-of-order write-guard AND the early stale-event skip are silently bypassed.*
  `applyStripeWebhookUpdate` catches a missing-column error and re-runs the write
  WITHOUT the `lastStripeEventAt` filter (route.ts:336–344). In that mode a stale
  retry of a superseded event (e.g. an old `past_due` arriving after `active`
  within Stripe's 72h retry window) is applied unguarded, rolling the row back.
  This is a deliberate availability tradeoff during a rolling deploy, but the
  window is unbounded if the migration never lands. Impact: temporary incorrect
  entitlement (lockout or over-grant) during/after a partial deploy.
  Recommendation: alert (not just `warnSchemaCompatibilityFallback`) when the
  fallback fires in production so the migration gap is caught quickly.

- **Finding (pbw-02, Medium)** — *`checkout.session.completed` ignores
  `session.payment_status`.* The handler (route.ts:675–798) treats any
  subscription-mode completed session as activated and writes the entitlement
  from the retrieved subscription's status. For a session where the subscription
  is `incomplete` (e.g. a 3DS/SCA card that never confirmed), the mapped status
  comes from `mapStripeStatusWithRenewal` → `INCOMPLETE`, which
  `getEffectiveEntitlement` treats as no-access — so the end state is correct.
  But the activation email + admin purchase alert + campaign-redemption
  increment all fire (route.ts:731–797) before payment is confirmed. Impact:
  premature "your subscription is active" email and inflated redemption counts
  for never-paid checkouts. Recommendation: gate the email/alert/redemption flip
  on `session.payment_status === "paid"` or on the resolved status being an
  access-granting one.

- **Finding (pbw-03, Medium)** — *No amount/currency re-verification at webhook
  ingest.* `verifyStripeCheckoutPrice` (checkout route.ts:60–85) enforces that
  the configured Stripe price matches the hardcoded plan amount/currency/interval
  at checkout-creation time, but the webhook maps `priceId → plan` purely by
  identity (`mapStripePriceIdToPlanAndInterval`) and never checks the unit
  amount. If a Stripe price is later edited in the dashboard (or the
  `STRIPE_PRICE_*` runtime-config value is repointed at a cheaper price while
  `STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED=true`), a subscription billed at the
  wrong amount still maps to the full-featured plan. Impact: revenue/entitlement
  mismatch (under-charged user gets full tier). Recommendation: periodically (or
  in reconcile) assert the live price `unit_amount` still equals
  `billingAmountUsdForInterval(plan, interval)*100` and alert on drift.

- **Finding (pbw-04, Low)** — *`resolveWebhookPlan` candidate precedence differs
  between handlers.* `checkout.session.completed` prefers
  `session.metadata.plan` over the mapped price (route.ts:709), while
  `customer.subscription.*` prefers the mapped price over metadata
  (route.ts:812–815). Both are server-set today, so this is consistent in
  practice, but if metadata.plan ever drifts from the actual price the two paths
  disagree. Recommendation: standardize on price-derived plan first everywhere
  (the price is the billing source of truth), metadata as fallback only.

- **Finding (pbw-05, Low)** — *`invoice.paid` zero-amount guard only skips
  `subscription_create`.* route.ts:997 skips `amount_paid===0 &&
  billing_reason==="subscription_create"`. A `$0` proration credit invoice with
  a different `billing_reason` would still flip the row to ACTIVE/PAID — benign
  for entitlement (it should be active anyway) but could mislabel `accessType`.
  Low impact; note for completeness.

## 12. Reverse Logic Audit

- **Unauthorized user**: all mutation routes call `requireDbUserId` (throws
  `UNAUTHORIZED` → 401). Webhook requires a valid Stripe signature.
- **Empty data**: missing subscription row → checkout creates a pending shell;
  portal 404s cleanly; actions/change/switch 400 with `NO_STRIPE_SUBSCRIPTION`.
- **API error (Stripe down)**: checkout/portal wrap config errors → 503; webhook
  throws on transient lookup failures so Stripe retries (`retryableWebhookError`).
- **Slow network / double-click**: Stripe idempotency keys on every
  create/update; webhook DB idempotency. Checkout idempotency key is bucketed per
  minute so a legitimate retry after >60s creates a fresh session (intended).
- **Stale data**: `version` column + `lastStripeEventAt` watermark; reconcile
  cron is the backstop.
- **Direct route access**: server routes are not navigable; mobile blocked by
  header guard.
- **Role change / token expiry**: `requireDbUserId` re-reads session each call.
- **Dark theme / mobile viewport**: UI not in scope.
- **Risk surfaced**: the `customer.subscription.updated` ADMIN guard
  (route.ts:382–388) is the only thing preventing a stale Stripe retry from
  clobbering a manual admin grant; it relies on the row already being
  `provider=ADMIN` at read time. If a grant is written between the webhook's
  `findLocalSubscriptionForWebhook` read and its `updateMany`, the guard could be
  bypassed (TOCTOU). Narrow window; noted as part of pbw-01 reliability.

## 13. Security Audit

### pbw-S1 — Webhook signature verification & replay (Info / strong)
- **Severity**: Info (control present and correct).
- **Affected area**: `POST /api/webhooks/stripe`.
- **Evidence**: `stripe.webhooks.constructEvent` (route.ts:612); signature
  failure emits `WEBHOOK_SIG_FAILURE` security event + deduped operator alert +
  400 (route.ts:613–637); livemode mismatch rejected (route.ts:516–559); 72h
  replay window (route.ts:651–656); 256KB body ceiling re-imposed
  (route.ts:561–580); secret + secret-key fetched from runtime config and
  validated for env (`requireStripeSecretKeyForMutation`).
- **Risk**: forged/replayed events.
- **Defensive scenario (high level)**: an attacker POSTs crafted event bodies;
  without signature verification they could mint subscriptions. All such requests
  are rejected at `constructEvent`.
- **Prevention**: keep `STRIPE_WEBHOOK_SECRET` out of DB unless
  `STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED`; rotate carefully (72h window covers
  retries during rotation).
- **Detection**: `WEBHOOK_SIG_FAILURE` + `alertWebhookSignatureFailure`.
- **Analysis**: well-architected. No action required.
- **Tests to add**: a test asserting livemode-mismatch is rejected in
  production-like env (the matrix exists; confirm both directions covered).

### pbw-S2 — Customer/workspace binding (IDOR) (Low)
- **Severity**: Low.
- **Affected area**: webhook subscription resolution; all user routes.
- **Evidence**: user routes scope strictly by `requireDbUserId()` →
  `where: { userId }`. The webhook resolves the local row by
  `OR(userId, stripeCustomerId, stripeSubscriptionId)` then writes
  `where: { userId: local.userId }` (route.ts:188–192, 462–467). `userId` in
  `checkout.session.completed` comes from `session.metadata.userId ||
  client_reference_id`, both set **server-side** at checkout creation
  (checkout route.ts:681–711). `stripeCustomerId`/`stripeSubscriptionId` are
  unique columns.
- **Risk**: cross-user entitlement write if an attacker could inject
  metadata.userId. They cannot — metadata is set by our server and the event is
  signature-verified.
- **Prevention/Detection**: signature verification + server-set metadata.
- **Analysis**: no IDOR found. Recorded as Info-grade assurance.
- **Tests to add**: a webhook test asserting that a `metadata.userId` pointing at
  a *different* customer's row is reconciled to the row matched by
  `stripeCustomerId`, not blindly trusted.

### pbw-S3 — Idempotency key namespace vs ProcessedWebhookEvent PK (Low)
- **Severity**: Low.
- **Affected area**: `lib/webhook-idempotency.ts`, `ProcessedWebhookEvent`.
- **Evidence**: PK is `id` (Stripe event id) only; `source` is a non-key column
  (schema line 1693–1700). `markWebhookEventProcessed` inserts `{ id, source }`
  and treats a P2002 as duplicate. `releaseProcessedWebhookEvent` deletes by
  `{ id, source }`.
- **Risk**: if a second provider ever reused a Stripe-style event id, the create
  would collide on PK and be (mis)treated as a duplicate. Stripe event ids are
  globally unique, so not exploitable today.
- **Recommendation**: make the PK composite `(id, source)` if a second webhook
  source is ever added; otherwise document the single-namespace assumption.

### pbw-S4 — Secret/PII logging (Info)
- **Evidence**: logs use `safeUserHint` (8-char prefix), never log full email or
  secret-key material; signature failure logs only lengths and a correlation id
  (route.ts:88–91, 614–626). Stripe keys validated but never logged.
- **Analysis**: good hygiene; no leak found.

### pbw-S5 — Missing server-side validation (Info)
- **Evidence**: checkout validates plan enum, campaign type/interval, terms
  acceptance, existing-subscription state; actions validate action enum + cancel
  reason allowlist; change-plan/switch-cycle validate interval enum + paid-plan
  guard. No unvalidated passthrough to Stripe found.

### pbw-S6 — Rate limiting / spend (Info)
- **Evidence**: every user-facing billing mutation is rate-limited
  (5–8/min/user) with `failClosed: "if-redis-configured"` (fails OPEN when Redis
  unconfigured, CLOSED during a configured-Redis outage). Webhook is unlimited by
  design (Stripe-signed). Reconcile cron capped at 2/min. The "spend guard"
  (`global-spend-guard.ts`) is an AI/dossier fuse, NOT a Stripe charge cap — there
  is no app-level cap on Stripe charges (charges are user-initiated and
  amount-verified, so this is acceptable).

### pbw-S7 — Unsafe redirect (Low)
- **Affected area**: `checkout/cancel/route.ts`.
- **Evidence**: redirect base is `getRuntimeConfigValue("NEXT_PUBLIC_APP_URL") ||
  request.nextUrl.origin`, path is a constant `/settings/subscription?...`
  (cancel route.ts:8–12). No user-controlled redirect target.
- **Analysis**: safe (fixed path).

## 14. Performance Audit

- **Per-webhook Stripe round-trips**: `invoice.paid`/`invoice.payment_succeeded`
  re-retrieves the subscription (route.ts:1002) and calls
  `mapStripePriceIdToPlanAndInterval` (which fans out to 7 `getRuntimeConfigValue`
  reads) twice. `getRuntimeConfigValue` hits the DB unless env-preferred. For a
  high renewal volume this is N extra config reads per event.
  **Finding (pbw-06, Low/Perf)**: cache `STRIPE_PRICE_*` config lookups (they
  change rarely) or batch via `getRequiredRuntimeConfigValues` to cut per-event
  DB load. Today's volume is pre-launch so impact is minimal.
- **Reconcile cron**: paginates 200 rows/page with cursor; bounded memory; one
  Stripe retrieve per row (inherent). `maxDuration=300`. Acceptable.
- **No N+1 in user routes** (single `findUnique` per request).
- **`mapStripePriceIdToPlanAndInterval`** issues 7 parallel config reads even to
  map one price; fine but cacheable.

## 15. Reliability Audit

- **Error boundary / retry**: webhook returns 5xx on transient failures so Stripe
  retries; reservation released on failure. Schedule-persist failures roll back
  the Stripe schedule (change-plan route.ts:364–387; switch-cycle 403–427).
- **Transaction consistency**: checkout-cleanup and cancel use `$transaction`
  when available with a `Promise.all` fallback (cleanup route.ts:105–107; cancel
  route.ts:63–67). The Stripe-then-DB sequence in change-plan/switch-cycle is not
  atomic across systems, but the explicit schedule-release rollback handles the
  DB-failure case; a process crash between the Stripe call and the local write
  is repaired by reconcile/webhook. Reasonable for cross-system consistency.
- **Partial failure**: emails are fire-and-forget (`fireAndLogEmail`) and never
  break idempotency.
- **Empty/loading state**: machine-readable codes for client states.
- **Monitoring/logging**: Sentry `captureMessage/Exception`, structured
  `logger`, security events. Schema-compat fallbacks `warnSchemaCompatibilityFallback`
  (only a warn, see pbw-01).
- **Reconcile is the backstop** for dropped webhooks and uses the SAME derivation
  helper as the webhook (`deriveStripeEntitlementFields`) to avoid drift — a
  documented past bug class that is now closed.

## 16. Dead Code / Cleanup

- `lib/webhook-idempotency.ts` exports `hasProcessedWebhookEvent`,
  `reserveWebhookEvent`, `releaseWebhookEvent`, `isUniqueConstraintError`. The
  Stripe route uses `markWebhookEventProcessed`/`releaseProcessedWebhookEvent`
  directly. `reserveWebhookEvent`/`releaseWebhookEvent` are intention-revealing
  aliases; confirm other webhook routes (appstore/playstore/resend) use them
  before deleting — **[needs verification]**, do not remove.
- `stripe-reconcile/route.ts:309` `void prisma;` is a deliberate tree-shake
  warm-reference comment, not dead code.
- `mapStripeStatus`/`mapStripeStatusWithRenewal` are duplicated between the
  webhook route (route.ts:1332–1356) and `lib/stripe-subscription-mapping.ts`.
  The webhook uses its local copy; reconcile uses the shared lib. **Finding
  (pbw-10, Low/Dead-Code)**: consolidate to the shared lib to prevent the two
  copies from drifting (a documented past failure mode).
- No abandoned routes found in scope.

## 17. Tests

- **Existing**: `apps/web/src/app/api/webhooks/stripe/route.test.ts` (mocks
  Stripe, prisma, email, security); `lib/plan-limits.test.ts`;
  `packages/shared/src/__tests__/entitlement.test.ts`; admin
  `subscriptions/route.test.ts`, `users/[id]/route.test.ts`.
- **Missing / suggested**:
  - Webhook: stale-event-during-schema-compat-fallback (pbw-01) — assert
    out-of-order guard is bypassed and document it.
  - Webhook: `checkout.session.completed` with `payment_status !== "paid"`
    should NOT send activation email or increment redemption (pbw-02).
  - Webhook: amount-drift detection (pbw-03) once implemented.
  - Webhook: `metadata.userId` pointing at another customer's row is reconciled
    by `stripeCustomerId` (pbw-S2 assurance test).
  - change-plan/switch-cycle: schedule-create-then-DB-fail releases the schedule
    (rollback path) — assert no orphan schedule and 503.
  - reconcile: 404-from-Stripe marks CANCELED; ADMIN rows skipped.
  - e2e: full upgrade (immediate proration) and deferred downgrade phase
    transition clears pending fields.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| pbw-01 | Medium | Reliability | Schema-compat fallback silently drops the `lastStripeEventAt` out-of-order write-guard | Stale Stripe retry can roll back entitlement during/after a partial deploy | Alert (not warn) when fallback fires in prod; bound the window | `webhooks/stripe/route.ts:321-345,451-460` |
| pbw-02 | Medium | Logic | `checkout.session.completed` fires activation email + admin alert + redemption increment without checking `payment_status` | Premature "active" email & inflated redemption counts for unpaid/SCA-failed checkouts | Gate side-effects on `payment_status==="paid"` / access-granting status | `webhooks/stripe/route.ts:675-797` |
| pbw-03 | Medium | Data | Webhook maps price→plan by identity only; no unit-amount/currency re-verification | A repriced Stripe price (or repointed config) grants full tier at wrong amount | Assert live `unit_amount` == expected in reconcile; alert on drift | `webhooks/stripe/route.ts:707-719,995-1006`; `lib/billing.ts:79-108`; `stripe/checkout/route.ts:60-85` |
| pbw-04 | Low | Logic | Plan-resolution precedence differs (metadata-first vs price-first) between handlers | Disagreement if metadata.plan ever drifts from price | Standardize on price-derived plan first everywhere | `webhooks/stripe/route.ts:709,812-815` |
| pbw-05 | Low | Logic | `invoice.paid` $0 guard only skips `subscription_create` | $0 proration invoice with other reason may mislabel accessType | Broaden the zero-amount short-circuit | `webhooks/stripe/route.ts:997` |
| pbw-06 | Low | Performance | `STRIPE_PRICE_*` config read (7 fan-out) repeated per webhook, twice on invoice events | Extra DB load at renewal volume | Cache/batch price-config lookups | `lib/billing.ts:79-108`; `webhooks/stripe/route.ts:995-1006` |
| pbw-07 | Low | Security | GET `/api/stripe/checkout/cancel` mutates DB state | Auth-gated state reset reachable via GET (Stripe cancel_url) | Restrict mutation to POST; keep GET redirect-only | `stripe/checkout/cancel/route.ts:71-81` |
| pbw-08 | Low | UI/UX | Webhook `formatCurrency` hardcodes en-US locale for amounts | Spanish recipients get US-formatted amounts in emails | Use resolved `lang` | `webhooks/stripe/route.ts:76-86` |
| pbw-09 | Low | Data | `firstChargeAmount` re-parsed from a presentation label by regex | Mis-stored amount if label format changes | Persist numeric campaign amount as a field | `stripe/checkout/route.ts:637` |
| pbw-10 | Low | Dead Code | `mapStripeStatus*` duplicated in webhook route vs shared lib | Two copies can drift (a known past bug class) | Consolidate to `lib/stripe-subscription-mapping.ts` | `webhooks/stripe/route.ts:1332-1356`; `lib/stripe-subscription-mapping.ts:15-38` |
| pbw-S2 | Info | Security | Customer/workspace binding — no IDOR found (server-set metadata + unique customer id + signature) | — | Add a regression test (see §17) | `webhooks/stripe/route.ts:183-226`; `stripe/checkout/route.ts:681-711` |
| pbw-S3 | Low | Architecture | `ProcessedWebhookEvent` PK is event-id only; `source` not in key | Cross-source id collision (not exploitable today) | Composite PK if a 2nd source is added | `schema.prisma:1693`; `lib/webhook-idempotency.ts` |

## 19. Module TODO

- [ ] **pbw-01 — Alert on schema-compat out-of-order bypass** (Severity: Medium).
  Reason: the unguarded fallback can roll back billing state. Files:
  `webhooks/stripe/route.ts`, `lib/db-schema-compat.ts`. Suggested fix: emit a
  Sentry `error` (and dedupe) when `applyStripeWebhookUpdate`/find fallbacks fire
  in production-like env so the missing migration is fixed fast. Dependencies:
  none. Complexity: low. Risk: low.
- [ ] **pbw-02 — Gate activation side-effects on payment confirmation**
  (Severity: Medium). Reason: avoid "active" emails/redemptions for unpaid
  checkouts. Files: `webhooks/stripe/route.ts` (checkout.session.completed).
  Suggested fix: check `session.payment_status === "paid"` (or the synced status
  is access-granting) before sending email/alert and flipping redemption.
  Dependencies: none. Complexity: low. Risk: low.
- [ ] **pbw-03 — Amount-drift verification in reconcile** (Severity: Medium).
  Reason: defend entitlement↔amount integrity against repriced/ repointed Stripe
  prices. Files: `cron/stripe-reconcile/route.ts`, `lib/billing.ts`,
  `packages/shared/src/billing.ts`. Suggested fix: when a row's price maps to a
  paid plan, fetch the live price and assert `unit_amount` equals
  `billingAmountUsdForInterval(plan, interval)*100`; emit drift warning.
  Dependencies: extra Stripe `prices.retrieve` in reconcile. Complexity: medium.
  Risk: low.
- [ ] **pbw-04 — Standardize plan resolution to price-first** (Severity: Low).
  Files: `webhooks/stripe/route.ts`. Complexity: low. Risk: low.
- [ ] **pbw-06 — Cache STRIPE_PRICE_* config reads** (Severity: Low). Files:
  `lib/billing.ts`, `lib/runtime-config.ts`. Complexity: low. Risk: low.
- [ ] **pbw-07 — Make checkout-cancel mutation POST-only** (Severity: Low).
  Files: `stripe/checkout/cancel/route.ts`. Suggested fix: keep GET as a pure
  redirect (it already runs the reset best-effort); move the authoritative reset
  to the POST the management page already calls. Complexity: low. Risk: low
  (the page already POSTs the reset, so GET-side reset is redundant).
- [ ] **pbw-08 — Locale-correct currency formatting in webhook emails**
  (Severity: Low). Files: `webhooks/stripe/route.ts`. Complexity: low. Risk: low.
- [ ] **pbw-09 — Store numeric campaign amount instead of re-parsing label**
  (Severity: Low). Files: `stripe/checkout/route.ts`,
  `lib/acquisition-campaigns.ts`. Complexity: low. Risk: medium (touches campaign
  snapshot shape).
- [ ] **pbw-10 — Consolidate duplicated status mappers** (Severity: Low). Files:
  `webhooks/stripe/route.ts`, `lib/stripe-subscription-mapping.ts`. Complexity:
  low. Risk: low.
- [ ] **pbw-S3 — Composite PK for ProcessedWebhookEvent if a 2nd source is added**
  (Severity: Low). Files: `schema.prisma`, `lib/webhook-idempotency.ts`.
  Complexity: low. Risk: medium (migration).
