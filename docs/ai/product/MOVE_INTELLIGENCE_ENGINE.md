# Current verified product capability

- Verified current surfaces include provider recommendations, provider comparison/saved providers, moving plans, move tasks, budgets, notifications, state rules, partner consents, connector runtime, provider admin governance, exports, and mobile access.
- The connector framework includes guarded provider dispatch concepts such as consent, HTTPS allowlists, retries, idempotency, circuit breakers, and fallback behavior.
- The memory files do not verify a production AI reasoning engine, LLM workflow, user-facing risk radar, or automated move intelligence model.
- Existing data structures appear suitable for a deterministic intelligence layer before any AI-generated output is introduced.

# Hypotheses

- Hypothesis: the Move Intelligence Engine should begin as deterministic rule scoring over verified user move state, then add AI summaries with citations to the underlying move facts.
- Hypothesis: the first valuable intelligence outputs are missed-provider risk, deadline risk, duplicate/unclear task risk, budget surprise risk, and proof-gap risk.
- Hypothesis: household-level intelligence will create stronger retention than single-user checklists.
- Hypothesis: provider transition outcomes, rule performance, risk acknowledgements, and export usage can become a defensible data moat if aggregated with consent and privacy controls.

# Recommended next decisions

- Define v1 intelligence outputs as read-only recommendations, not automatic account changes or provider actions.
- Choose a scoring model for Move Risk Radar: rule severity, confidence, evidence, recommended action, and user dismissal reason.
- Decide which rules are product rules, legal/compliance-sensitive rules, provider rules, and household preference rules.
- Require every AI-generated move briefing to cite underlying move facts or clearly label unknowns.

# Open questions for Claude Product Review

- Which existing data models are sufficient for a deterministic risk score without schema changes?
- Which risk categories have the highest customer value and lowest liability exposure?
- What competitor products provide similar move recommendations, and how transparent are their explanations?
- What should the human review or user confirmation standard be before any provider connector action?

# Possible Codex implementation tasks

- Draft a Move Intelligence Engine technical spec with entities for signal, rule, risk, recommendation, evidence, and dismissal.
- Build a read-only risk computation prototype against existing mock/test data only after approval.
- Add docs for AI output constraints: no unsupported claims, no provider action without consent, no hidden assumptions.
- Create a test plan for deterministic risk scoring, rule precedence, confidence labeling, and explainability.
