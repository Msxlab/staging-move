# User Experience Intelligence Scan Handoff

## Current verified experience

- The scan used existing `docs/ai` memory/product/growth/experiment notes as the strategic baseline.
- Source inspection verified current surfaces for onboarding, dashboard, AI Move Briefing, addresses, services, moving plans, MoveTask generation and assignment, provider recommendations, exports, dossiers, billing/subscription gates, household invitations, notifications, bill reminders, contract reminders, lifecycle nudges, and trust/limitation copy.
- No application source code was modified.
- No `.env`, secrets, credentials, tokens, private keys, customer data, production data, `SYSTEM_AUDIT_REPORT/**`, `docs/ai-ops/**`, README, CHANGELOG, old docs, or previous summaries outside the allowed `docs/ai` baseline were used as product evidence.
- No tests, migrations, deployments, package installs, destructive commands, pushes, or infrastructure changes were run.

## UX strategy summary

LocateFlow should make the verified primitives feel like one Address Life OS / Move Command Center:

1. AI Move Briefing should become the first visible intelligence moment.
2. MoveTask action types should become provider transition lanes, statuses, owners, and next actions.
3. Existing bill, contract, lifecycle, notification, and digest primitives should become post-move monitoring.
4. Export and Home Dossier primitives should become proof-packet moments.
5. Household invitations and task assignment should become household mission control.
6. Pricing should attach to urgent outcomes, not generic feature lists.
7. Trust copy should consistently explain records, recommendations, proof, and manual provider confirmation.
8. Analytics should stay consented, coarse, and no-raw-PII.
9. Partner-facing workspace and SEO-first strategy should remain deferred until activation is stronger.
10. Every hypothesis must stay labeled until backed by customer, product, or metric evidence.

## Changed docs

- [[experience/USER_JOURNEY_MAP]]
- [[experience/AHA_MOMENT_MAP]]
- [[experience/ONBOARDING_EXPERIENCE_AUDIT]]
- [[experience/AI_MOVE_BRIEFING_EXPERIENCE]]
- [[experience/PROVIDER_TRANSITION_EXPERIENCE]]
- [[experience/POST_MOVE_MONITORING_EXPERIENCE]]
- [[experience/HOUSEHOLD_EXPERIENCE]]
- [[experience/EXPORT_PROOF_PACKET_EXPERIENCE]]
- [[experience/PRICING_UPGRADE_EXPERIENCE]]
- [[experience/TRUST_AND_SAFETY_EXPERIENCE]]
- [[experience/ANALYTICS_EVENT_PLAN]]
- [[experience/FRICTION_LOG]]
- [[experience/EXPERIENCE_BACKLOG]]
- [[00_PRODUCT_BRAIN_DASHBOARD]]
- [[03_NEXT_AGENT_TASKS]]
- [[04_WEEKLY_REVIEW]]
- [[experiments/EXPERIMENT_BACKLOG]]

## Highest UX risks

1. Users may not reach the first AI Briefing aha quickly enough.
2. Provider Transition may feel like a checklist instead of a command workspace.
3. Post-move retention value is present in reminders/digests but not packaged as a surface.
4. Export/proof value is discoverable too late if it remains mostly in settings.
5. Pricing may convert poorly if framed as plan features before visible user outcomes.
6. Trust risk increases if AI or provider copy implies automation, official authority, or direct account changes.
7. Analytics could undermine the data moat strategy if raw PII or sensitive provider data is collected.

## First recommended experiments

1. AI Briefing visibility, source explainer, and upgrade teaser.
2. Provider Transition board read-only v1 over existing MoveTask data.
3. Post-move monitoring surface over existing reminder and digest primitives.

## Deferred or avoided ideas

- Do not build AI from scratch.
- Do not claim live provider account-change integrations.
- Do not claim official partnerships.
- Do not make partner-facing workspace the next bet until partner demand is verified.
- Do not make SEO-first strategy the next bet until the core activation loop is stronger.
- Do not turn hypotheses into decisions without evidence.

## Needs human approval before implementation

- Any application source-code work.
- Any AI runtime key, cohort, cost, or fallback behavior change.
- Any telemetry persistence or analytics pipeline change.
- Any billing, pricing, checkout, or upgrade-copy change.
- Any export/proof-packet behavior change.
- Any provider-transition UI that could be read as automatic provider execution.

## Exact next prompt for Claude UX Judge

```text
You are Claude UX Judge for LocateFlow.

Review the LocateFlow User Experience Intelligence Scan in docs/ai/experience plus the current dashboard, task queue, and experiment backlog.

Do not treat hypotheses as facts. Do not invent customer demand, conversion, revenue, partnerships, analytics, or integrations. Preserve the direction: Address Life OS / Move Command Center. Current strategy: do not build AI from scratch; surface/harden/monetize existing AI Move Briefing; surface Provider Transition Workspace over existing MoveTask/provider/service data; package post-move monitoring; use a consented transition-outcome graph; defer partner-facing workspace and SEO-first strategy until validated.

Please judge:
1. The top 10 UX friction points by activation, retention, revenue, and trust risk.
2. The top 10 aha opportunities by likely user value.
3. The top 5 natural upgrade moments.
4. The top 5 data moat opportunities that remain privacy-safe and no-raw-PII.
5. Whether the first implementation experiment should be AI Briefing experience hardening, Provider Transition board v1, or Post-Move Monitoring surface.
6. Which ideas should be rejected, deferred, or narrowed.
7. The exact 30-day UX experiment roadmap with metrics, guardrails, and rollback criteria.

Return decisions separately from hypotheses, and include the first Codex implementation brief that should be written next.
```
