# API Opportunity Matrix

## Status

decision candidate

## Executive summary

The Claude vision output reframes APIs as a deepening and monetization problem, not a blank integration roadmap. Many public-data and operational integrations are reported as already wired; spot-check recommended before treating that list as independently verified in this ingestion. New API work should focus on trust, proof, communication, referral hand-offs, and rules curation.

Dashboard backlink: [[00_PRODUCT_BRAIN_DASHBOARD]]
Nearest notes: [[memory/API_INVENTORY]], [[product/MOVE_INTELLIGENCE_ENGINE]], [[product/MOVE_RULES_REGISTRY]], [[growth/FREE_TOOLS_STRATEGY]]

## Verified current LocateFlow capability

- Verified Product Brain baseline includes provider flows, recommendations, connectors, exports, billing, notifications, runtime config, and analytics/event schema presence.
- Reported verified by Claude source-integration verifier; spot-check recommended: USPS OAuth address validation, Google Places, Census, FEMA, EPA, HUD, NCES, OpenEI, FCC BDC, NLR EV charging, NHTSA, FMCSA, Stripe, Resend, R2/imgproxy, and optional Anthropic briefing paths.
- Product memory verifies guarded connector patterns, runtime feature flags, and graceful degradation patterns.

## Public-source facts

- Reported public-source fact; spot-check recommended: USPS Web Tools retired on 2026-01-25.
- Reported public-source fact; spot-check recommended: USPS official change-of-address guidance should point to `moversguide.usps.com` and not imply LocateFlow files COA.
- Reported public-source fact; spot-check recommended: Twilio SMS requires consent and A2P 10DLC registration.
- Reported public-source fact; spot-check recommended: e-sign vendors can support proof-packet audit trails under ESIGN/UETA contexts, but legal scope needs review.

## Strategic interpretation

Top API opportunity order from the Claude handoff:

1. USPS OAuth hygiene and retired Web Tools audit.
2. Proof packet via e-sign/doc generation.
3. Broadband referral on existing FCC data.
4. Census/TIGERweb shapes for SEO/GEO enrichment.
5. Dossier deepening and monetization.
6. SMS reminders with explicit consent.
7. USPS COA anti-scam guide page.
8. EIA/OpenEI address-to-utility provider work.
9. Identity verification only if proof use cases demand it.
10. Address-validation upgrade only if an accuracy gap is proven.

## Hypotheses

- Hypothesis: the highest near-term API value is not another data source, but surfacing and monetizing existing intelligence.
- Hypothesis: broadband and storage referral APIs can become additive revenue only after explicit user intent and disclosure.
- Hypothesis: e-sign/proof APIs become valuable after proof packet demand is validated.

## Recommended decisions

- Treat existing public-data integrations as "deepen/monetize" until a source spot-check proves gaps.
- Avoid direct provider or government account-change automation in v1.
- Put every new API or partner handoff behind a feature flag, explicit consent, graceful fallback, and copy guardrails.
- Start with docs-only specs for USPS OAuth hygiene, one free tool, and transition-outcome/rules schema.

## Validation needed

- Spot-check source paths for each reported wired integration.
- Verify USPS OAuth-only path and absence of retired Web Tools use.
- Confirm FCC address-serviceability data quality before referral flow.
- Verify vendor terms and privacy implications before e-sign, SMS, identity, or geocode persistence.

## Possible Codex tasks

- Docs-only USPS OAuth hygiene audit plan and COA anti-scam guide spec.
- Docs-only free-tool MVP spec for flood-zone or internet-at-new-address using already-wired data.
- Docs-only API gating checklist: feature flag, consent, fallback, tests, copy, compliance, rollback.

## Claude review questions

- Which API opportunity is a revenue unlock versus a distraction?
- What must be independently verified before any public claim?
- Which integrations should be explicitly deferred despite being attractive?
