# R5 · Partner billing / CPL — implementation plan

> Status: PLAN (awaiting approval — no code yet). Scope: charge partners for the
> leads we deliver (cost-per-lead), the revenue capture for the lead-gen
> marketplace (docs/ai/free-pivot/19 §3 Layer 4, §5, §10.5). The most
> money-/legal-sensitive layer — strong gates below.

## Framing — this LAYER COLLECTS money, it doesn't pay it out
Lead-gen is **partner-pays-us**: we deliver a qualified lead, the partner pays a
per-lead fee (CPL). So R5 is partner **billing** (we invoice the partner), NOT a
Connect payout. Stripe Connect / rev-share would only be needed for the reverse
(paying partners) — out of scope for v1. v1 uses simple **Stripe Invoicing**
against `Partner.stripeCustomerId` (already a dormant field). Consumers are never
charged — only partners.

## What exists to reuse
- `Partner.stripeCustomerId` (dormant, R4a) — the Stripe Customer to invoice.
- `LeadDispatch.cplCents` (dormant, R3a) — the per-lead charge, set at accrual.
- Stripe rails: the Stripe client, the `/api/webhooks/stripe` handler, and
  `ProcessedWebhookEvent` + `lib/webhook-idempotency.ts` (idempotent webhooks).
- `AffiliateConversion` (Layer-1 inbound commission ledger) as a pattern.
- Admin RBAC + audit; the partner portal (R4d) for the partner-facing view.

## Data model (NEW — additive; remember the R3e governance step)
1. **`PartnerLedgerEntry`** — the accrual line: `partnerId`, `kind`
   (`CPL` | `PLACEMENT` | `ADJUSTMENT` | `CREDIT`), `amountCents`, `currency`,
   `leadDispatchId?` (the billed delivery), `periodKey` (e.g. `2026-07`), `status`
   (`PENDING` | `INVOICED` | `PAID` | `VOID`), `invoiceId?`, timestamps. One
   PENDING entry per billable delivery; dedupe on `leadDispatchId` (@unique-ish per
   kind) so a delivery is never double-charged.
2. **`PartnerInvoice`** — the period rollup: `partnerId`, `periodKey`, `totalCents`,
   `currency`, `status` (`DRAFT` | `OPEN` | `PAID` | `VOID` | `UNCOLLECTIBLE`),
   `stripeInvoiceId?`, `issuedAt?` / `paidAt?`, timestamps. @@unique([partnerId, periodKey]).
> GOVERNANCE: both → BACKUP_TABLES (+ order/deps/replace/import-map); run the admin
> vitest coverage guardrails. No encrypted columns expected.

## Build phases (each its own verified commit)
- **R5a — ledger + accrual.** Models + migration + governance. `lib/leads/billing.ts`
  accruePartnerLeadCharge(dispatch): on a SENT dispatch, look up the CPL rate for the
  lead's category and write a PENDING PartnerLedgerEntry (idempotent on
  leadDispatchId) + stamp LeadDispatch.cplCents. Wire it into the delivery worker
  (R3d) right after a successful send. Pure rate-resolution + accrual unit-tested.
- **R5b — CPL rates.** Per-category rate via RuntimeConfig (CPL_CENTS_<CATEGORY>,
  unset = no charge → fail-safe to free). A rate change never retro-bills accrued
  entries. Admin can read current rates.
- **R5c — Stripe customer + invoicing.** Ensure a Stripe Customer for an APPROVED
  partner (store on Partner.stripeCustomerId). A monthly cron rolls each partner's
  PENDING entries into a PartnerInvoice + a Stripe Invoice (line items per category),
  marks entries INVOICED. Idempotent per (partner, period).
- **R5d — webhook reconciliation.** Extend the Stripe webhook: invoice.paid →
  PartnerInvoice/entries PAID; invoice.payment_failed/voided → OPEN/UNCOLLECTIBLE.
  Reuse ProcessedWebhookEvent idempotency. Audit each transition.
- **R5e — billing surfaces.** Admin: per-partner ledger + invoices + totals.
  Partner portal (R4d): "what you owe / paid" + invoice links. Read-only first;
  self-serve payment via the Stripe-hosted invoice.

## Hard gates (MUST resolve before turning billing on)
- **Legal/financial sign-off:** charging real money. Partner terms must state the
  CPL model, billing cadence, disputes/credits, and tax handling BEFORE any charge.
- **Sales tax / VAT:** lead fees may be taxable per jurisdiction — Stripe Tax or an
  explicit decision. Do not invoice until resolved.
- **CPL rates + who sets them** (per category; product/finance decision).
- **Charge trigger:** v1 charges on DELIVERED (SENT). A partner accept/reject loop
  (charge only accepted leads) needs the R3 accept flow first — deferred; until
  then, a credit/adjustment path handles bad leads (CREDIT ledger kind).
- **Bad-lead credits / disputes:** an admin adjustment path (CREDIT/ADJUSTMENT) is
  required at launch so a partner isn't charged for junk leads.
- **Connect vs Invoicing:** v1 = Stripe Invoicing (collect from partners). Connect
  (paying partners) is a separate, larger build — only if a rev-share model appears.

## Verification
Per phase: prisma migrate + generate; admin vitest (governance); verify:typecheck;
targeted vitest for accrual/rates/invoicing/webhook; full web + admin suites. All
behind flags; no charge can occur until rates are set AND the partner is APPROVED
with a Stripe customer AND legal/tax gates are cleared.
