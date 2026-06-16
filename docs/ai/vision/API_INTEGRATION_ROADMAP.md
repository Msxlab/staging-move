# API Integration Roadmap

## Status

decision candidate

## Executive summary

API work should be sequenced around trust and monetization: hygiene first, then proof/free-tool/referral experiments, then optional deeper integrations if validation supports them.

Dashboard backlink: [[00_PRODUCT_BRAIN_DASHBOARD]]
Nearest notes: [[vision/API_OPPORTUNITY_MATRIX]], [[memory/API_INVENTORY]], [[analytics/EVENT_TAXONOMY]]

## Verified current LocateFlow capability

- Product Brain verifies broad API route inventory, connector framework, runtime config, feature flags, billing, exports, and tracking.
- Reported verified by Claude source-integration verifier; spot-check recommended: many public-data integrations are already wired and tested.
- No new API should be enabled from this doc without source review and explicit human approval.

## Public-source facts

- Reported public-source fact; spot-check recommended: USPS OAuth is the current route for address validation, while legacy Web Tools are retired.
- Reported public-source fact; spot-check recommended: SMS and lead/referral flows require explicit consent and compliance review.
- Reported public-source fact; spot-check recommended: e-sign and identity vendors introduce retention and privacy obligations.

## Strategic interpretation

Roadmap from the Claude handoff:

- 30 days: USPS OAuth hygiene, consented coarse event taxonomy, USPS COA anti-scam guide.
- 90 days: proof-packet e-sign prototype, broadband referral click-out, SMS reminders, TIGERweb SEO shapes.
- 12 months: address-to-utility provider work, identity verification only if needed, dossier monetization.
- Future: USPS Tracking only if eligible; aggregated non-PII insights product.

## Hypotheses

- Hypothesis: USPS hygiene and COA anti-scam content improve trust before new integrations.
- Hypothesis: one free tool can validate tool-to-account conversion before SEO scale.
- Hypothesis: transition-outcome and move-rules schema work is a better moat investment than broad API expansion.

## Recommended decisions

- Require docs-only specs before any API implementation.
- Keep all new integrations behind feature flags and graceful fallback.
- Do not add provider account-change automation in v1.
- Keep user-facing language guided, not automated.

## Validation needed

- Source spot-check of existing integration paths.
- Product/legal review of public-source and compliance claims.
- Experiment approval for any referral, e-sign, SMS, identity, or public guide implementation.

## Possible Codex tasks

- Draft USPS OAuth hygiene audit checklist.
- Draft free-tool MVP implementation spec.
- Draft consented transition-outcome event taxonomy extension and move-rules dataset schema.

## Claude review questions

- Which 30-day API item is actually product-critical?
- Which roadmap items should be removed until customer evidence exists?
- What approval gates should apply to every external API or referral handoff?
