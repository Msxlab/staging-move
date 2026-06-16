# Data Moat Strategy

## Status

decision candidate

## Executive summary

The strongest data moat remains privacy-safe: a consented transition-outcome graph plus a maintained, cited move-rules dataset. The moat is not raw address or personal data, and it should never become personal-data resale.

Dashboard backlink: [[00_PRODUCT_BRAIN_DASHBOARD]]
Nearest notes: [[product/DATA_MOAT_MAP]], [[product/MOVE_RULES_REGISTRY]], [[analytics/EVENT_TAXONOMY]]

## Verified current LocateFlow capability

- Product Brain verifies data surfaces for users, workspaces, addresses, services, moving plans, tasks, providers, subscriptions, notifications, events, and admin governance.
- Product Brain already selects transition-outcome graph as the primary data moat strategy.
- Product Brain verifies a Move Rules Registry concept and state-rule substrate, but not full legal/rules content accuracy.

## Public-source facts

- Reported public-source fact; spot-check recommended: there is no single national DMV/address-change API for all move rules, making curation valuable.
- Reported public-source fact; spot-check recommended: COPPA/privacy rules constrain use and monetization of child/minor data.
- Reported public-source fact; spot-check recommended: state privacy laws require consent, disclosure, deletion, and purpose limits.

## Strategic interpretation

Two-moat thesis from the Claude handoff:

1. Consented transition-outcome graph: provider category, two-letter state, action type, outcome, blocker, confidence bucket, proof generated yes/no.
2. Maintained 50-state Move Rules dataset: DMV, voter, utility, tax, and related obligations with source URL, effective date, and confidence.

## Hypotheses

- Hypothesis: aggregate transition outcomes improve recommendations, AI Briefing, Risk Radar, and partner prioritization.
- Hypothesis: a cited rules dataset improves trust and GEO visibility.
- Hypothesis: curation and outcome feedback become harder to copy than UI alone.

## Recommended decisions

- Collect only consented, coarse, no-raw-PII signals.
- Use rules dataset curation as both product trust layer and SEO/GEO moat.
- Aggregate before any cross-household use.
- Do not sell personal data.

## Validation needed

- Event taxonomy and privacy review before telemetry persistence.
- Rules source workflow before jurisdiction-specific publication.
- Retention/deletion rules for outcome and proof-related events.
- Minimum aggregation thresholds before publishing insights.

## Possible Codex tasks

- Extend [[analytics/EVENT_TAXONOMY]] with transition-outcome graph v1 if approved.
- Draft 5-state move-rules dataset schema and source-review workflow.
- Draft privacy tests for no raw address, account, confirmation, name, email, phone, document, or AI text fields.

## Claude review questions

- Which data signals are strategically valuable but too sensitive?
- What aggregation threshold is needed before insights can be shown?
- Which five states should be included in a rules dataset MVP?
