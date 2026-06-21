# R6 · Insurance offers — implementation plan

> Status: **PLAN ONLY — REGULATORY-GATED. NO CODE until legal/compliance sign-off.**
> Scope: monetize the high-intent move moment with **renters/home insurance**
> offers (docs/ai/free-pivot/19 §3, §6). This is the **most regulated** layer of
> the marketplace — gated harder than R5 (billing). Insurance is licensed
> state-by-state; getting the model wrong is a legal/regulatory liability, not just
> a bug. Behind `offers_renters_insurance_v1` (already defined, fail-closed,
> default-off). Renters insurance first (lowest-friction, renter-heavy mover base).

## The fork that decides everything: affiliate vs. licensed lead-gen

Two fundamentally different regulatory postures — **legal must choose before any code**:

- **(A) Affiliate / referral (RECOMMENDED for v1).** We are a marketing affiliate.
  We show a carrier/marketplace partner's offer and link out (with our affiliate
  id); the partner does all quoting, binding, and data capture on their own site.
  We never collect insurance PII, never quote, never advise, never get paid
  per-policy as a producer. Regulatory burden = lowest (marketing/advertising +
  FTC affiliate disclosure + carrier marketing agreements). This reuses the
  EXISTING affiliate spine (R1/R2) almost entirely.
- **(B) Licensed lead-gen / producer (HIGH GATE — defer past v1).** We capture the
  consumer's info and sell it as an insurance lead, or act as a producer. Triggers
  **state insurance producer licensing**, lead-aggregator regulations, NAIC rules,
  TCPA/telemarketing exposure, and per-state advertising rules. Do NOT build without
  a compliance/legal program in place.

**Recommendation:** v1 = **(A) affiliate-only**, state-eligibility gated, with
regulated-category disclosures. Treat (B) as a separate, later, legal-led program.

## What exists to reuse (so v1-A is small)

- **Affiliate spine** (R1/R2): `AffiliateClick → AffiliateConversion → HMAC postback`,
  `AffiliateCtaButton`, `affiliate-disclosure.tsx`, the sponsored slot, `trackEvent`
  offer funnel. An insurance offer is just another affiliate CTA at a new surface.
- **`Partner` model** (R4a): a carrier/marketplace partner is `category="insurance"`
  with `serviceStates` = the states where the offer is permitted/licensed. No new
  model needed for affiliate-only.
- **`offers_renters_insurance_v1`** flag (monetization-flags.ts) — fail-closed gate.
- **State context**: the move/address already carries destination state → drives
  state-eligibility gating (only surface where the carrier is licensed + permitted).
- **Recommendation engine + CATEGORY_META** taxonomy (add an `insurance` category
  like junk-removal was added in R1) — ONLY if surfacing insurance in recommendations;
  otherwise the offer lives at the address/lease moment.

## v1-A scope (when legal clears) — phases

- **R6a · Insurance affiliate offer surface.** At the high-intent moment (new
  destination address / "set up your new home" / renters context), render a single
  FTC + insurance-regulated disclosure'd affiliate CTA to the carrier partner,
  **state-eligibility gated** (only if the partner's `serviceStates` includes the
  destination state). Flag-gated, prop-drilled from a server flag read (web) exactly
  like the R2 move-task offer. Fires `offer_viewed`/`offer_clicked` (slug-safe).
- **R6b · State-eligibility helper.** `isInsuranceOfferEligible(state, partner)` —
  pure, tested: surface only where permitted; fail-closed (no state / not listed →
  no offer). Mirrors the sponsored-provider state scoping.
- **R6c · Regulated disclosure copy.** A dedicated insurance disclosure (NOT just the
  affiliate one): "LocateFlow is not an insurer / not licensed to give insurance
  advice; offers are from licensed third-party partners; we may earn a referral fee;
  availability varies by state." **Copy requires legal sign-off** (like the consent
  strings — flip-time/legal work).
- **(deferred, model B only) R6d · Licensed insurance lead-gen** via the existing
  `Lead` pipeline with `category="insurance"` + `matchPartnersForLead` — reuses
  create-lead/dispatch/leadsOptIn machinery, BUT only behind a full licensing +
  TCPA + state-aggregator-law program. Out of scope for v1.

## HARD gates before ANY R6 code (non-coding — legal/compliance)

1. **Affiliate-vs-producer decision** (the §1 fork) — legal.
2. **Carrier/marketplace partner agreements** + which states each is licensed in
   (feeds `serviceStates`).
3. **State-eligibility matrix** — where we may even advertise insurance + the
   per-state advertising rules.
4. **Disclosure copy** approved by legal (not-an-insurer / not-advice / compensation
   / state-availability).
5. **FTC + insurance advertising compliance** review of the surface + copy.
6. **(model B only)** producer licensing, lead-aggregator law, TCPA, data-sharing
   consent — a whole compliance program; do not start without it.

## Invariants (carry over from the marketplace)

- **Fail-closed + default-off** (`offers_renters_insurance_v1`); fully reversible.
- **Ranking integrity** — an insurance offer is a separate labeled slot; it NEVER
  reorders organic results (docs/ai/free-pivot/19 §7).
- **No consumer charge** — consumers are never billed; insurance revenue is
  affiliate/referral (model A) from the carrier.
- **State-eligibility fail-closed** — unknown/ineligible state ⇒ no offer.
- **PII** — model A captures NO insurance PII (link-out only). Model B would route
  PII and is therefore gated to the full compliance program.

## Status / next

PLAN ONLY. The next action is **non-coding**: legal picks model A vs B and approves
the disclosure + state matrix. Until then, no R6 code ships. (Consistent with R5c+
which is also held for legal/tax — see [R5-PARTNER-BILLING.md](R5-PARTNER-BILLING.md)
and [AUDIT-FIXES.md](AUDIT-FIXES.md).)
