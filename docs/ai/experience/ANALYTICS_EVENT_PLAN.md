# Analytics Event Plan

## Current verified experience

- Product memory records analytics/events schema presence, but this UX scan did not verify a running analytics pipeline, dashboard, or live event collection.
- Current source inspection verified user-facing surfaces that could emit privacy-safe UX events: onboarding, AI Briefing, services, move tasks, household invitations, exports, subscription, notifications, and monitoring.
- No live traffic, conversion, revenue, churn, retention, customer-demand, or experiment data was inspected.

## User goal

Measure whether LocateFlow helps a household complete verified address transitions and understand which product moments create activation, retention, and upgrade intent.

## Emotional job

Give the team confidence to decide from evidence without collecting sensitive move, address, provider, or billing details.

## Current friction

- The product strategy depends on activation, retention, upgrade, and transition-completion outcomes, but verified live metrics are not available in this workflow.
- The data moat direction requires a narrow, consented, coarse transition-outcome graph before any event collection should be treated as strategic data.
- Billing, AI, exports, provider transition, and household events need clear privacy guardrails before implementation.

## Aha opportunity

"We can see which move moments create value without storing raw PII or pretending hypotheses are facts."

The highest-value analytics aha is a small event set tied to the north-star metric: verified address transitions completed per active household.

## Revenue opportunity

- Identify upgrade surfaces that lead to paid feature use after checkout.
- Measure whether AI Briefing, proof packet, household invites, and monitoring create higher activation or retention.
- Avoid spending on SEO, partner workflows, or AI expansion before the core activation loop is proven.

## Data moat opportunity

- Allowed signal candidates: feature surface, plan tier bucket, provider category, two-letter state, transition action type, status/outcome, blocker category, confidence bucket, proof generated yes/no, monitoring item resolved yes/no.
- Disallowed signal candidates: raw address, account number, confirmation number, names, emails, phone numbers, provider credentials, private notes, document contents, payment details, secrets, tokens.

## Hypotheses

- Hypothesis: a privacy-safe event set can validate the Address Life OS strategy without collecting raw PII.
- Hypothesis: the highest-signal activation event is a generated briefing followed by at least one completed provider transition task.
- Hypothesis: proof-packet and post-move monitoring events are better revenue indicators than generic dashboard visits.

## Recommended experiments

1. Docs-only event taxonomy with allowed/disallowed fields and consent notes.
2. Instrumentation review before any source change to confirm no sensitive fields are logged.
3. North-star funnel definition: onboarding complete -> service added -> briefing viewed -> task completed -> proof/monitoring used -> upgrade.

## Possible Codex implementation tasks

- Draft a source-change-ready analytics taxonomy for Claude Product Judge review.
- Map each proposed event to an existing surface, allowed fields, guardrail, and rollback plan.
- Prepare analytics QA checklist for AI, billing, exports, provider transition, and household flows.
