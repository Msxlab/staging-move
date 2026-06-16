# Current verified product capability

- Verified internal capability memory exists for web/admin/mobile, move records, provider flows, connectors, billing, exports, workspaces, notifications, and tests.
- No external market research, competitor review, customer interviews, pricing research, SEO data, or partner validation was performed in this workflow.
- Claude Product Explorer should treat product strategy claims as hypotheses unless verified with external research or source evidence.
- Claude Product Explorer should not use secrets, private customer data, production dashboards, or unapproved internal docs.

# Hypotheses

- Hypothesis: external research should first validate the Address Life OS / Move Command Center category, then test the individual product bets.
- Hypothesis: competitive gaps will be clearest across move checklist apps, USPS/address-change services, home services marketplaces, relocation tools, property-management workflows, and AI personal admin tools.
- Hypothesis: pricing research should focus on willingness to pay for risk reduction and proof generation, not generic task management.
- Hypothesis: SEO research can identify acquisition wedges before product engineering begins.

# Recommended next decisions

- Run research in this priority order:
  - competitor/category map;
  - customer pain and jobs;
  - SEO keyword clusters;
  - pricing and packaging;
  - partner/channel opportunities;
  - legal/compliance sensitivities for rules and provider claims.
- Require Claude Product Explorer to separate sourced findings, interpretations, and hypotheses.
- Require citations for all external claims and label outdated or low-confidence sources.
- Feed validated findings back into product memory only after review.

# Open questions for Claude Product Review

- What category language do customers and competitors use: moving checklist, address change, relocation, home services, household admin, or life OS?
- Which features are table stakes versus differentiated?
- What search problems have both high intent and natural conversion to LocateFlow?
- What price points and packaging models are common in adjacent categories?
- Which partner channels are plausible and which require verified agreements before discussion?

# Possible Codex implementation tasks

- Turn Product Research Queue outputs into structured product-memory updates after user approval.
- Create a competitor feature matrix under `docs/ai/research` after Claude Product Explorer provides sources.
- Create a keyword cluster spreadsheet or markdown table after research.
- Draft Claude Product Judge prompts to assess Claude Product Explorer findings against verified capability.

# Vision research addendum

## Current verified product capability

- Vision layer now lives at [[vision/VISION_MASTER_PLAN]] and [[vision/VISION_DECISION_SUMMARY]].
- Claude vision output reported public-source facts and reported verified integrations, but this ingestion did not independently re-check those sources.
- No partnerships, affiliate approvals, SEO traffic, customer demand, revenue, conversion, or live analytics were verified.

## Hypotheses

- Hypothesis: USPS COA anti-scam positioning, free tools, broadband referral, post-move monitoring, and transition-outcome graph are the highest-value validation lanes.
- Hypothesis: source-backed free tools can validate account-save intent before broad SEO scale.
- Hypothesis: referral click-outs can be tested without PII handoff if disclosure and user intent are explicit.

## Recommended next decisions

- Run independent source spot-checks before public claims for USPS, FTC disclosure, TCPA, insurance referral/licensing, Google SEO policy, COPPA/privacy, and affiliate/referral examples.
- Validate the first free-tool keyword and account-save path before building many pages.
- Validate partner interest before building partner-facing workspace.

## Open questions for Claude Product Review

- Which public-source facts need immediate source-verifier review?
- Which SEO/GEO cluster has enough intent to justify a free-tool MVP?
- Which partner category should be contacted first without making unverified claims?

## Possible Codex implementation tasks

- Create a source-verification checklist for the vision layer.
- Draft a research brief for USPS COA anti-scam guide, flood-zone tool, and internet-at-new-address tool.
- Draft a partner-outreach research plan that avoids claims about traffic, conversion, or signed partnerships.
