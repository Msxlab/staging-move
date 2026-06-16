# Monetization Map

## Status

decision candidate

## Executive summary

Near-term monetization should emphasize the subscription ladder, proof/export upsells, post-move monitoring, and AI Move Briefing. Referral revenue can become additive later, but should remain compliance-safe and clearly disclosed.

Dashboard backlink: [[00_PRODUCT_BRAIN_DASHBOARD]]
Nearest notes: [[product/PRICING_AND_PACKAGING]], [[experience/PRICING_UPGRADE_EXPERIENCE]], [[analytics/EXPERIMENT_METRICS]]

## Verified current LocateFlow capability

- Product Brain verifies Stripe checkout/portal/webhooks, mobile IAP verification, entitlement helpers, workspace seat limits, and feature gates.
- Product Brain verifies plan/entitlement concepts for AI Briefing, Home Dossier, dossier PDF, advanced export, seats, and other premium surfaces.
- No live prices, conversion, churn, LTV, or paid feature usage metrics are verified.

## Public-source facts

- Reported public-source fact; spot-check recommended: App Store and Play policies/fees affect mobile subscription strategy.
- Reported public-source fact; spot-check recommended: referral/affiliate monetization needs FTC disclosure and privacy-safe consent.
- Reported low-confidence in Claude handoff: some lead-price and affiliate payout ranges; do not use as fact.

## Strategic interpretation

Ranked monetization opportunities from the Claude handoff:

1. Subscription ladder on built intelligence.
2. Proof packet / export upsell.
3. Post-move monitoring premium.
4. AI Move Briefing premium.
5. Broadband referral.
6. Storage referral.
7. Mover lead or booking referral.
8. Utility concierge revenue share.
9. B2B2C white-label later.
10. Aggregated non-PII insights later, never raw personal data.

## Hypotheses

- Hypothesis: Individual paywall conversion is the highest-leverage first revenue test.
- Hypothesis: proof/export moments create stronger willingness to pay than plan feature lists.
- Hypothesis: post-move monitoring gives subscriptions a reason to continue after move day.
- Hypothesis: referral revenue can grow only after trust-safe disclosure and user intent are validated.

## Recommended decisions

- Keep subscription ladder first.
- Treat referral revenue as additive and experimental.
- Frame paid value around outcomes: briefing, transition confidence, proof, monitoring, and household coordination.
- Do not recommend selling personal data.
- Do not add partner or affiliate claims until agreements and approvals are verified.

## Validation needed

- Instrument `upgrade_clicked`, `checkout_started`, and `subscription_activated` around the Individual paywall.
- Validate proof-packet and post-move monitoring upgrade intent.
- Verify store product setup, Stripe config, and legal copy before public pricing changes.
- Verify affiliate/referral terms and disclosures before any external click-out.

## Possible Codex tasks

- Draft Individual paywall conversion experiment spec.
- Draft proof-packet upsell copy guardrails.
- Draft subscription-ladder packaging matrix using existing entitlements.

## Claude review questions

- Which paid moment should be tested first?
- Which monetization idea risks harming trust?
- What pricing language is safe before live prices and conversion data are verified?
