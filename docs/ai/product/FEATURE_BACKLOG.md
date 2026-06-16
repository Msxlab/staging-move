# Current verified product capability

- Current verified capabilities include move records, tasks, budgets, providers, recommendations, connectors, partner consents, exports, billing, mobile, workspaces, notifications, admin governance, and tests.
- The Claude Product Strategy Council reports source-verified capability for a shipped AI Move Briefing path, a production `MoveTask` transition classifier, a deterministic risk engine, a post-move reminder cron fleet, entitlement tiers, exports/dossiers, and household assignment foundations.
- The backlog below separates accepted build-now product bets, hypotheses, deferred ideas, and experiments.
- Source code should not be modified from this backlog without a later explicit implementation request.
- Not verified: customer demand, feature usage data, partner agreements, revenue performance, traffic, churn, or live provider integrations.

# Hypotheses

- Hypothesis: near-term revenue is highest where existing move state becomes confidence: AI briefing, provider transition, post-move monitoring, proof packets, and risk radar.
- Hypothesis: the board UI is copyable, but transition-outcome data becomes harder to replicate as it accumulates.
- Hypothesis: household collaboration can differentiate LocateFlow from single-user checklist tools and create a growth loop.
- Hypothesis: SEO tools can accelerate growth later, but are not the first wedge because search demand and rules content are not verified.

# Recommended next decisions

- Accepted ranked top product bets:
  - 1. AI Move Briefing: harden, deepen, and make the AI key path reversible. This is the paid daily surface and Family/Pro story.
  - 2. Provider Transition Workspace: surface the existing `MoveTask` transition classifier as the operational board.
  - 3. Post-move address obligation monitoring: package the cron/reminder fleet as the retention layer that outlives move day.
- Treat Move Risk Radar as the substrate across those three bets, not a standalone paid flagship.
- Treat proof packets as a high-margin Pro upsell and fast-follow.
- Defer SEO free tools until the account-save artifact and rules/content review path are ready.
- Defer partner-facing mover/provider workspace until at least one verified partner is actively distributing and asking for reporting or branding.

# Open questions for Claude Product Review

- What is the smallest source-code change set for each accepted build-now bet?
- Which product claims can be used publicly before customer demand is validated?
- What 30-day and 90-day roadmap gates should require human approval?
- Which fast-follow proof packet scope creates revenue without implying legal advice or verified partner status?

# Possible Codex implementation tasks

- Experiment 1: AI Briefing hardening, reversible AI cohort gate, privacy tests, telemetry, and upgrade teaser.
- Experiment 2: Post-move obligation monitoring surface using existing service/reminder primitives.
- Experiment 3: Provider Transition board v1 over existing `MoveTask` data.
- Fast-follow: Risk Radar tab, proof packet Pro upsell, budget-surprise signal, Address Timeline view, and state rules SEO tool after rules review.
