# LocateFlow Product Brain Startup

Updated: 2026-06-15

Use this file at the start of every meaningful LocateFlow Product Brain session.

## Required Reading Order

1. `AGENTS.md`
2. `CLAUDE.md` when working as Claude or preparing Claude prompts
3. `docs/ai/00_PRODUCT_BRAIN_DASHBOARD.md`
4. `docs/ai/03_NEXT_AGENT_TASKS.md`
5. `docs/ai/04_WEEKLY_REVIEW.md`
6. Latest relevant handoff under `docs/ai/handoffs/`
7. Relevant memory/product/experience/analytics/experiment docs for the task

Optional if present:

- `docs/ai/01_ACTIVE_STRATEGY.md`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`

Do not use old docs, README, CHANGELOG, previous summaries, or audit reports as evidence unless the current user explicitly allows it.

## Operating Model

- Codex is the source-aware operator: inspect verified capability, update `docs/ai`, draft implementation plans, write handoffs, and implement only after explicit approval.
- Claude Product Explorer broadens ideas but keeps assumptions labeled as hypotheses.
- Claude Product Judge, UX Judge, and Measurement Judge filter ideas for user value, revenue, retention, trust, feasibility, privacy, and defensibility.
- Obsidian is the memory graph over `docs/ai`; it links decisions, specs, risks, experiments, and handoffs.
- Human approval decides what moves from hypothesis to accepted decision and what source-code work may begin.

## Memory Categories

- `docs/ai/memory/`: technical baseline, project map, APIs, auth, billing, env/config, mobile readiness, tests, risks, and decisions.
- `docs/ai/product/`: north star, customer jobs, feature specs, pricing, data moat, rules, and workflow.
- `docs/ai/experience/`: user journey, aha moments, friction, onboarding, briefing, provider transition, monitoring, household, trust, pricing, and UX backlog.
- `docs/ai/analytics/`: PostHog measurement plan, event taxonomy, feature flags, and experiment metrics.
- `docs/ai/experiments/`: experiment backlog and status.
- `docs/ai/growth/`: growth engine, SEO/content hypotheses, and free-tool strategy.
- `docs/ai/research/`: research queues and unresolved questions.
- `docs/ai/handoffs/`: time-bound summaries of what changed, what remains uncertain, and what should happen next.

## Hard Rules

- Keep verified capability, hypothesis, decision, experiment, implementation task, and result separate.
- Do not turn hypotheses into facts.
- Do not invent customer demand, revenue, traffic, conversion, analytics results, partnerships, or integrations.
- Do not read or store `.env`, `.env.*`, secrets, credentials, tokens, private keys, certificates, customer data, or production data.
- Do not store raw PII, secrets, credentials, production data, or customer data in `docs/ai`.
- Do not deploy, push, install packages, run migrations, change infrastructure, reset, clean, stash, or delete unless the user explicitly approves.
- Do not modify application source code unless the user explicitly approves source implementation.
- Do not claim AI, provider, billing, analytics, or partner behavior is live unless verified from allowed evidence.

## Session Output Requirement

Every meaningful Product Brain session should end with:

- changed files
- what was completed
- what was not completed
- key decisions, hypotheses, or risks
- whether application source code was modified
- tests or checks run, if any
- handoff path under `docs/ai/handoffs/`
- recommended next action or exact next prompt when useful
