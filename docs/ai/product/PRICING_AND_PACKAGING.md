# Current verified product capability

- Verified current capabilities include Stripe checkout, Stripe portal, Stripe webhooks, mobile IAP verification, subscription actions, entitlement helpers, workspace seat limits, and production mobile store-purchase flags.
- The Claude Product Strategy Council reports existing entitlement flags for AI Briefing, home dossier, dossier PDF, advanced export, partner hub, and mover suggestions.
- The memory confirms subscription and billing infrastructure, but it does not verify actual prices, live plan names, conversion, churn, LTV, App Store products, Play products, or live Stripe dashboard settings.
- Billing safety risks include runtime migration coupling, distributed rate-limit readiness, and mobile store configuration gates.
- Any pricing below is a hypothesis until market and billing configuration evidence exists.

# Hypotheses

- Hypothesis: Pro/Family subscription conversion is strongest when anchored by AI Briefing, Provider Transition, and post-move monitoring.
- Hypothesis: proof packets can become a high-margin episodic upsell.
- Hypothesis: mobile IAP can support consumer subscriptions, while Stripe can support web, household, mover, property, or partner packages.
- Hypothesis: partners may pay for qualified move intent only after consent, attribution, and partnership terms are verified; this is not a first-phase revenue anchor.

# Recommended next decisions

- Accepted revenue path: a single Pro/Family subscription anchored by AI Briefing, Provider Transition, and post-move monitoring.
- Use Stripe web checkout/portal as the primary paid conversion channel.
- Use mobile IAP only for in-app impulse upgrades where platform policy requires or where mobile context is strongest.
- Use existing entitlement flags; do not create new billing plumbing for the first experiments.
- Position proof packets as a Pro upsell or fast-follow premium artifact.
- Do not price on secondary-member conversion; household is the tier wrapper, not the buyer anchor.
- Avoid publishing plan claims until Stripe and store products are verified.
- Decide refund/support policy before selling operational promises.

# Open questions for Claude Product Review

- What pricing models do adjacent products use: moving apps, home services marketplaces, relocation tools, household admin apps, and AI personal assistant tools?
- What price points should be tested for Pro/Family once plan configuration is verified?
- What App Store/Play policy issues affect AI briefing, provider marketplace, or subscription packaging?
- What packaging minimizes customer-support burden for provider transition promises?

# Possible Codex implementation tasks

- Map accepted Pro/Family package claims to existing entitlement flags.
- Draft upgrade teaser requirements for AI Briefing and proof packet surfaces.
- Create billing-readiness and app-store-readiness checklists before any plan copy ships.
- Add product copy guardrails that avoid unverified automation, partner, or live-integration claims.

# Vision monetization addendum

## Current verified product capability

- Vision monetization strategy lives at [[vision/MONETIZATION_MAP]].
- Current Product Brain verifies billing/IAP foundations and entitlement concepts, but not live prices, conversion, churn, LTV, or paid usage.

## Hypotheses

- Hypothesis: Individual paywall conversion is the first revenue experiment to validate.
- Hypothesis: proof/export upsells and post-move monitoring create stronger willingness to pay than generic feature lists.
- Hypothesis: referral revenue can be additive only after explicit consent, disclosure, and partner approval.

## Recommended next decisions

- Keep subscription ladder first.
- Treat proof/export and monitoring as paid outcome moments.
- Treat broadband/storage/mover/utility referrals as later experiments, not current revenue facts.
- Do not recommend selling personal data.

## Open questions for Claude Product Review

- Which paid moment should be validated before referral experiments?
- What copy avoids implying provider automation or guaranteed savings?
- What refund/support guardrails are needed before paid operational promises?

## Possible Codex implementation tasks

- Draft Individual paywall experiment spec.
- Draft proof-packet upsell matrix using existing entitlements.
- Draft referral monetization compliance checklist.
