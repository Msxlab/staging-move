# Current verified product capability

- The Claude Product Strategy Council reports that AI Move Briefing is already shipped end-to-end in source: API route, briefing library, web/mobile cards, tests, entitlement gating, rule-based fallback, Anthropic-keyed LLM path, and a hard 3 generations per UTC-day cap.
- Current verified move context includes profile/address/moving plan/service/provider/task/workspace signals, exports, billing, subscriptions, and mobile access.
- The LLM prose path depends on runtime configuration; whether the AI key is set in production is not verified.
- Customer demand, conversion lift, willingness to pay, and production usage are not verified.

# Hypotheses

- Hypothesis: AI Move Briefing is the clearest premium product bet because it converts scattered move state into a concise, confidence-building plan.
- Hypothesis: the briefing should answer "what matters now," "what is risky," "what is blocked," "what proof do I have," and "who owns what."
- Hypothesis: customers will trust AI output more when each recommendation links back to verified move facts, user-entered details, or explicitly labeled unknowns.
- Hypothesis: the AI Briefing is strongest as the daily surface that reports Provider Transition status, monitoring alerts, and Risk Radar signals.

# Recommended next decisions

- Accepted MVP: harden and deepen the shipped AI Move Briefing; do not rebuild it from zero.
- Keep v1 read-only, evidence-bound, display-only, and non-autonomous.
- Use rule-based fallback for key-unset, provider error, timeout, cap-spent, or no pending items; these paths should return useful HTTP 200 responses rather than invented facts.
- Keep structured next actions deterministic and server-derived, not model-generated.
- Gate paid AI value on the existing `aiBriefing` entitlement, with upgrade teaser for Individual/Free where the endpoint returns `upgradeRequired`.
- Enable the AI path only through a reversible runtime/config cohort gate after human approval; disabling should be as simple as unsetting the key or turning off the cohort.
- Do not add a durable `MoveBriefing` table in v1.

# First MVP spec

- Goal: a paid move-owner sees a short, honest briefing that says where the move stands and which three or fewer actions matter next.
- Inputs: coarse non-PII signals from the user's own move context, such as profile completeness, primary address, active moving plan, tracked services, saved providers, essential setup gaps, and workspace scope.
- Gates: auth, rate limit, key/config state, entitlement, workspace scope, daily cap, and deterministic fallback.
- Output: a short summary plus up to three deterministic deep-linked actions.
- Non-goals: no autonomous changes, no legal/tax advice, no provider claims without verification, no invented dates/providers/prices, no PII in the LLM request body, no persisted LLM prose.
- Acceptance criteria:
  - Key-unset/error/timeout/cap paths return rule-based briefing with deep-links.
  - Anthropic request body contains no name, street address, full address, email, phone, account id, or sensitive service fields.
  - Family/Pro receive the briefing experience; Individual/Free receive an upgrade teaser response.
  - Same-day unchanged input should use cache rather than generate repeatedly.
  - AI generations per entitled user per UTC day stay capped at 3.

# Open questions for Claude Product Review

- Which briefing claims are safe enough for public launch copy?
- What privacy assertion tests should be mandatory before enabling the AI cohort?
- What telemetry labels should distinguish generated, cached, rule-based, gated, and upgrade-required outcomes?
- What is the minimum human approval needed before setting the AI runtime key in any environment?

# Possible Codex implementation tasks

- Verify and extend briefing tests for auth, rate limit, key/config state, entitlement, workspace scope, fallback, cap, cache, and upgrade teaser.
- Add a privacy assertion test for the outbound LLM request body.
- Add a runtime-config or feature-flag cohort gate defaulting off.
- Confirm telemetry buckets for generated, cached, rule-based, gated, and upgrade-required outcomes.
