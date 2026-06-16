# Product Intelligence Bootstrap Handoff

Date: 2026-06-15

## Completed

- Created the LocateFlow Product Intelligence Layer under `docs/ai/product`, `docs/ai/growth`, `docs/ai/research`, and `docs/ai/experiments`.
- Used existing `docs/ai/memory/*.md` files as the technical baseline.
- Kept verified current capabilities separate from hypotheses, product ideas, recommended decisions, research questions, and possible Codex implementation tasks.
- Did not modify application source code.
- Did not read `.env`, `.env.*`, private keys, tokens, credentials, certificates, README, CHANGELOG, old docs, `SYSTEM_AUDIT_REPORT/**`, or `docs/ai-ops/**` as product evidence.

## Created Files

- `docs/ai/product/PRODUCT_NORTH_STAR.md`
- `docs/ai/product/CUSTOMER_JOBS.md`
- `docs/ai/product/MOVE_INTELLIGENCE_ENGINE.md`
- `docs/ai/product/AI_MOVE_BRIEFING_SPEC.md`
- `docs/ai/product/PROVIDER_TRANSITION_WORKSPACE.md`
- `docs/ai/product/ADDRESS_TIMELINE_SPEC.md`
- `docs/ai/product/MOVE_RULES_REGISTRY.md`
- `docs/ai/product/DATA_MOAT_MAP.md`
- `docs/ai/product/FEATURE_BACKLOG.md`
- `docs/ai/product/PRICING_AND_PACKAGING.md`
- `docs/ai/growth/GROWTH_ENGINE.md`
- `docs/ai/growth/SEO_CONTENT_CLUSTERS.md`
- `docs/ai/growth/FREE_TOOLS_STRATEGY.md`
- `docs/ai/research/PRODUCT_RESEARCH_QUEUE.md`
- `docs/ai/experiments/EXPERIMENT_BACKLOG.md`

## Strategy Summary

- LocateFlow should evolve from moving checklist into Address Life OS / Move Command Center.
- The product memory is organized around Move Memory, Move Intelligence, and Move Operations.
- The strongest current wedge appears to be turning verified move state into confidence artifacts: briefings, risk radar, transition status, timelines, and proof packets.
- Product ideas are explicitly marked as hypotheses because no customer research, traffic, conversion, or partnership data was inspected.
- Current verified capabilities already include many enabling surfaces: addresses, services, tasks, budgets, workspaces, providers, connectors, exports, billing, mobile, and admin governance.

## Best Revenue Potential Hypotheses

- AI Move Briefing.
- Provider Transition Workspace.
- Move Risk Radar.
- Export/proof/landlord/insurance packet generation.
- Household Mission Control with shared workspace and roles.

## Strongest Data Moat Potential Hypotheses

- Provider transition outcomes.
- Address Timeline event history.
- Move Rules Registry coverage and freshness.
- Risk Radar dismissal/resolution feedback.
- Proof packet generation patterns and document requirements.

## Exact Next Prompt for Claude Product Explorer

```text
Use the newly created LocateFlow Product Intelligence Layer under docs/ai/product, docs/ai/growth, docs/ai/research, and docs/ai/experiments as the internal strategy baseline. Do not treat hypotheses as facts. Perform external research on the Address Life OS / Move Command Center opportunity: competitor categories, customer jobs, SEO keyword clusters, pricing/packaging patterns, and plausible partner/channel opportunities. Use citations for every external claim. Do not invent customer data, partnerships, integrations, revenue, traffic, or market share. Return findings separated into sourced facts, interpretations, hypotheses, and recommended validation steps.
```

## Exact Next Prompt for Claude Product Judge

```text
Review the newly created LocateFlow Product Intelligence Layer under docs/ai/product, docs/ai/growth, docs/ai/research, and docs/ai/experiments. Judge whether each file correctly separates verified current product capability from hypotheses, avoids unsupported customer/partner/data claims, and stays consistent with the technical baseline in docs/ai/memory/*.md. Do not use README, CHANGELOG, old docs, SYSTEM_AUDIT_REPORT/**, docs/ai-ops/**, previous summaries, .env files, secrets, credentials, or private keys as evidence. Write a review handoff under docs/ai/handoffs/ with corrections, missing questions, and recommended product decisions.
```

## Not Completed

- No customer research, keyword research, competitor research, pricing validation, analytics review, or partner validation was performed.
- No source code was modified.
- No tests, lint, typecheck, builds, migrations, deploys, package installs, pushes, or external calls were run.

## Recommended Next Action

- Run the Claude Product Explorer prompt first for external market evidence, then run the Claude Product Judge prompt to reconcile product strategy against verified technical capability.
