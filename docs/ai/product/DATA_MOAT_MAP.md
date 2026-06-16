# Current verified product capability

- Verified current data surfaces include users, sessions, workspaces, addresses, services, moving plans, tasks, budgets, providers, connectors, subscriptions, runtime config, notifications, tickets, analytics/events, and admin governance.
- The memory verifies technical capability for exports, provider interactions, mobile usage, billing/IAP, and connector execution patterns.
- The Claude Product Strategy Council selected the transition-outcome graph as the primary data moat strategy.
- No live production data, customer PII, analytics dashboards, partner outcomes, or conversion data were inspected.
- The current evidence supports potential data moat design, not proof that a moat already exists.

# Hypotheses

- Hypothesis: the strongest moat is not raw address data but structured transition outcomes: what changed, when, what was risky, what got blocked, what succeeded, and what proof customers needed.
- Hypothesis: aggregate provider transition patterns can improve recommendations, risk scoring, SEO tools, and partner prioritization.
- Hypothesis: household collaboration data can reveal coordination friction that generic moving checklists do not capture.
- Hypothesis: rule coverage, proof artifacts, and risk-resolution feedback can create compounding intelligence if collected with consent and privacy controls.

# Recommended next decisions

- Accepted data moat path: the transition-outcome graph.
- Collect only consented, coarse, no-raw-PII signals for product intelligence.
- Preferred v1 aggregate shape: provider category, two-letter state, transition action type, task status/outcome, blocker category, confidence, and whether proof was generated.
- Do not store or analyze raw addresses, confirmation numbers, account numbers, names, emails, phone numbers, or sensitive service fields as moat signals.
- Feed aggregate transition outcomes back into recommendations, Risk Radar, and AI Briefing only after consent, privacy, and retention rules are approved.
- Treat all data moat claims as hypotheses until actual aggregate volume and utility are measured.

# Open questions for Claude Product Review

- Which data signals are strategically valuable and ethically safe to collect?
- Which data claims are defensible without live customer evidence?
- What anonymization or aggregation thresholds are needed before reporting move intelligence trends?
- What retention/deletion rules should apply to transition outcomes, proof packets, and AI briefing context?

# Possible Codex implementation tasks

- Draft a transition-outcome event taxonomy with sensitivity, consent, retention, and product-use labels.
- Propose telemetry tests that prove only coarse fields are emitted.
- Create a privacy review checklist for every AI, growth, and data-moat feature.
- Add moat-feedback requirements to Provider Transition, Post-move Monitoring, Risk Radar, and AI Briefing specs.

# Vision data moat addendum

## Current verified product capability

- Vision data moat strategy lives at [[vision/DATA_MOAT_STRATEGY]].
- Current accepted moat remains consented, coarse transition-outcome graph.
- Move Rules Registry is a strategy candidate and substrate, but full 50-state sourced legal/rules content is not verified.

## Hypotheses

- Hypothesis: a maintained, cited move-rules dataset can become a second moat because rules are fragmented and source-review heavy.
- Hypothesis: transition outcomes plus rules coverage can improve briefing, recommendations, Risk Radar, and SEO/GEO.

## Recommended next decisions

- Treat move-rules dataset as a decision candidate tied to source-review workflow.
- Start with a 5-state sourced dataset schema only after human approval.
- Continue to prohibit raw address, account, confirmation, name, email, phone, document, AI text, and secret fields from moat signals.

## Open questions for Claude Product Review

- Which 5 states should be used for rules dataset MVP?
- What source-review and stale-rule guardrails are required?
- What aggregation threshold is needed before using cross-household insights?

## Possible Codex implementation tasks

- Draft a 5-state move-rules dataset schema.
- Draft transition-outcome graph v1 event extension from [[analytics/EVENT_TAXONOMY]].
- Draft data-moat privacy and retention checklist.
