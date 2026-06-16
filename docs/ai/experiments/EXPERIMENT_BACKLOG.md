# Current verified product capability

- Verified current capabilities include user accounts, subscriptions, mobile, workspaces, exports, notifications, provider flows, recommendations, analytics/events schema presence, admin reporting/log surfaces, and public content/provider/mover surfaces.
- The Claude Product Strategy Council ranked 30-day experiments by impact, ease, and confidence, grounded in verified capability where possible.
- No experiment platform, live metrics, A/B testing, cohort reports, or conversion results were inspected in this workflow.
- Any experiment below is a proposal and should not be treated as completed or validated.
- Experiments must avoid production-risk actions, unverified partner claims, and collection of unnecessary PII.

# Hypotheses

- Hypothesis: AI Move Briefing will lift signup-to-activation and paid conversion by making the value of stored move data obvious.
- Hypothesis: Provider Transition Workspace will increase retention during the move window and create partner revenue paths later.
- Hypothesis: Proof packet generation will create urgent willingness to pay for renters, families, and insurance/landlord use cases.
- Hypothesis: Household invitations will improve completion rates and retention for complex moves.
- Hypothesis: post-move obligation monitoring can create retention beyond move day and reduce forgotten billing/contract obligations.

# Recommended next decisions

- Accepted 30-day ranked experiments:
  - 1. Flip AI briefing key for a controlled cohort and measure activation/retention lift against rule-based briefing.
  - 2. Post-move monitoring digest/surface for renewal and contract-end nudges.
  - 3. Provider Transition board over existing `MoveTask` data.
  - 4. Briefing paywall teaser for Individual/Free users.
  - 5. Household invite prompt at task creation or assignment moments.
  - 6. Risk Radar tab with deterministic signals and one-tap fix deep-links.
  - 7. Proof packet Pro upsell.
  - 8. Budget-surprise signal in radar/briefing.
  - 9. Address Timeline view.
  - 10. State move-rules finder free SEO tool after rules review.
- Define guardrail metrics: support tickets, refund requests, privacy complaints, automation confusion, failed provider expectations, and AI cost/cap ratio.
- Establish experiment status labels: idea, research needed, design ready, implementation ready, running, analyzed, killed, scaled.
- Require every experiment to identify verified current capability, hypothesis, metric, audience, risk, and rollback plan.

# Open questions for Claude Product Review

- What human approval is required before flipping any AI runtime key or cohort gate?
- Which experiment can ship first without new database schema?
- What minimum telemetry is needed to evaluate each experiment without collecting raw PII?
- What rollback plan is required for AI Briefing, Provider Transition board, and monitoring surfaces?

# Possible Codex implementation tasks

- Draft implementation experiment specs for the top three:
  - AI Briefing hardening, reversible cohort gate, privacy tests, telemetry, and upgrade teaser.
  - Post-move obligation monitoring surface using service/reminder primitives.
  - Provider Transition board v1 over existing `MoveTask` data.
- Draft event taxonomy proposals for transition completion, monitoring resolution, AI generation mode, upgrade teaser click, and household assignment.
- Create pre-launch QA checklists for paid, AI, monitoring, and provider-transition experiments.

# User experience intelligence scan addendum

## Current verified experience

- Experience notes now live under [[experience/USER_JOURNEY_MAP]], [[experience/AHA_MOMENT_MAP]], [[experience/FRICTION_LOG]], and [[experience/EXPERIENCE_BACKLOG]].
- Source inspection verified primitives for AI Briefing, MoveTask provider transitions, post-move reminders, exports/dossiers, household invitations, subscription gates, and trust/limitation copy.
- No live experiment metrics, customer demand, conversion, revenue, churn, support tickets, or analytics dashboards were verified.

## Hypotheses

- Hypothesis: the fastest activation lift comes from making AI Move Briefing the visible first intelligence moment.
- Hypothesis: the strongest operational aha comes from a read-only Provider Transition board over existing MoveTask data.
- Hypothesis: the strongest retention lift comes from packaging reminders and digests as post-move monitoring.
- Hypothesis: the strongest Pro upgrade moment is a proof-packet preview tied to completed transitions.

## Recommended next decisions

1. Keep AI Briefing experience hardening as the first docs-only implementation spec.
2. Ask Claude UX Judge to rank AI Briefing, Provider Transition, and Post-Move Monitoring for first source-code approval.
3. Define privacy-safe event fields before any telemetry work.
4. Keep partner-facing workspace and SEO-first strategy deferred until activation and save/use loops are stronger.

## Open questions for Claude Product Review

- Which first-session path creates the strongest aha without adding feature sprawl?
- Which upgrade moment is most natural: briefing, proof packet, monitoring, household invite, or provider transition?
- Which friction point creates the greatest trust risk?
- What UX evidence is required before turning any hypothesis into a product decision?

## Possible Codex implementation tasks

- Draft the AI Briefing experience hardening PRD.
- Draft a Provider Transition board v1 PRD using existing MoveTask fields only.
- Draft a Post-Move Monitoring surface PRD using existing reminder/digest primitives only.
- Draft a proof-packet preview PRD that preserves step-up verification and export privacy.

# Vision validation addendum

## Current verified product capability

- Vision layer now lives at [[vision/VISION_MASTER_PLAN]], [[vision/90_180_365_DAY_PLAN]], and [[vision/VISION_DECISION_SUMMARY]].
- Current Product Brain verifies foundations for subscription, proof/export, post-move monitoring, free-tool candidates, and coarse event planning.
- No live experiment metrics, customer demand, revenue, conversion, referral approval, partner agreement, SEO traffic, or analytics result is verified.

## Hypotheses

- Hypothesis: Individual paywall conversion is the highest-leverage first revenue test.
- Hypothesis: a free tool that saves to account can validate growth before SEO scale.
- Hypothesis: broadband/referral click-out can validate additive revenue if disclosure is clear and no PII is handed off without consent.
- Hypothesis: post-move monitoring can improve D30 return.
- Hypothesis: transition-outcome graph v1 can validate the data moat without collecting raw PII.

## Recommended next decisions

Top vision validation experiments:

1. Individual paywall conversion funnel.
2. Free tool to account-save rate.
3. Broadband/referral click-out CTR with disclosure.
4. Post-move "what's coming" monitoring to D30 return.
5. Transition-outcome graph v1.

## Open questions for Claude Product Review

- Which experiment should execute first if the team can only choose one?
- Which experiment has the lowest compliance and implementation risk?
- What guardrail blocks referral or public-source experiments?

## Possible Codex implementation tasks

- Draft the selected experiment spec after Claude Strategy Compression and human lane selection.
- Add privacy, disclosure, trust-copy, and rollback criteria to the selected experiment.
- Keep all source-code implementation behind explicit approval.
