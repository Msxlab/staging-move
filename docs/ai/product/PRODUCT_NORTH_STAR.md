# Current verified product capability

- LocateFlow currently has web, admin, and mobile surfaces with authenticated user accounts, admin permissions, subscriptions, mobile IAP, workspaces, addresses, services, moving plans, move tasks, budgets, provider catalog flows, recommendations, exports, notifications, partner consents, connectors, and admin governance.
- The Claude Product Strategy Council output reports additional source-verified capability: a shipped AI Move Briefing path with rule-based fallback and entitlement gating, a `MoveTask` provider-transition classifier, an admin deterministic risk engine, a post-move reminder cron fleet, and tested entitlement tiers.
- The verified product direction is Address Life OS / Move Command Center, with three pillars:
  - Move Memory: addresses, services, tasks, budgets, workspaces, provider choices, exports, notifications.
  - Move Intelligence: AI briefing, recommendations, deterministic risk signals, provider matching, state rules, connector runtime, analytics/event schema presence.
  - Move Operations: checklists, provider transition tasks, post-move reminders, billing, exports, admin-managed providers, partner consents, connector dispatch, mobile.
- Not verified: customer demand, traffic, conversion, churn, LTV, actual prices, live partnerships, live provider account-change integrations, keyword data, and whether the AI key is set in production.

# Hypotheses

- Hypothesis: the strongest customer promise is not generic task completion; it is completing address transitions with nothing missed, tracked proof, and ongoing post-move monitoring.
- Hypothesis: "Move Command Center" is the best active-move framing, while "Address Life OS" is the durable post-move framing.
- Hypothesis: Move Memory creates retention, Move Intelligence creates willingness to pay, and Move Operations creates daily utility during a stressful transition.
- Hypothesis: customers will pay more for confidence artifacts such as AI briefing, provider transition status, post-move monitoring, proof packets, and risk radar than for checklist functionality alone.

# Recommended next decisions

- Accepted north star: LocateFlow is the Address Life OS that gets every household through a move with nothing missed, turning each address transition into a tracked, proven, intelligently guided outcome and staying useful long after move day.
- Accepted north-star metric: verified address transitions completed per active household.
- Define a verified transition as a provider or obligation moved from needs-action to confirmed-with-proof.
- Use AI Briefing as the daily surface, Provider Transition Workspace as the operational core, and post-move monitoring as the retention layer.
- Treat Move Risk Radar as the intelligence substrate across briefing, transition, and monitoring rather than a standalone flagship.
- Keep AI evidence-bound, display-oriented, reversible, and non-autonomous.

# Open questions for Claude Product Review

- What exact event definition should be used for "confirmed-with-proof" in the first implementation pass?
- Which user-visible proof artifacts should count toward the north-star metric in the first 30 days?
- What evidence is needed before marketing "Address Life OS" externally?
- Which claims are safe now based on verified capability, and which must stay internal until customer demand is validated?

# Possible Codex implementation tasks

- Draft an event taxonomy for `transition_confirmed_with_proof`, `transition_status_changed`, `briefing_generated`, `monitoring_item_resolved`, and `proof_packet_generated`.
- Create a north-star measurement spec that uses only consented, coarse, non-PII product events.
- Convert the accepted north star into dashboard requirements after human approval.
- Add Obsidian links from this note to feature, growth, pricing, moat, and experiment docs.
