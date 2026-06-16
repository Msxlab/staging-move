\# AI Agent Rules for LocateFlow / move-main



\## Project



This repository powers LocateFlow / move-main.



The project may include:

\- Web app

\- Admin dashboard

\- Mobile app

\- Backend APIs

\- Database logic

\- Billing / IAP

\- Provider or address-change connector logic



\## Core Safety Rules



The AI agent must never:



\- Touch production data without explicit approval.

\- Commit secrets.

\- Print secrets.

\- Modify production environment files.

\- Run destructive database commands.

\- Run production migrations.

\- Access real customer PII unless explicitly approved.

\- Merge pull requests.

\- Deploy to production.

\- Use live Stripe, Apple, Google, USPS, carrier, or billing credentials.



\## Default Environment



Default to:

\- local

\- staging

\- QA accounts



Never assume production access is allowed.



\## High-Risk Areas



Extra caution is required for:



\- billing

\- Stripe

\- Apple IAP

\- Google Play IAP

\- authentication

\- account deletion

\- address-change connectors

\- user data

\- environment variables

\- database migrations

\- provider integrations

\- webhooks



\## Work Style



\- Read this AGENTS.md before doing work.

\- Inspect the repository before making assumptions.

\- Create a branch for code changes.

\- Make minimal focused changes.

\- Do not refactor unrelated code.

\- Do not change formatting across the whole repo unless requested.

\- Check package.json before assuming commands exist.

\- Run relevant lint, typecheck, tests, and build when available.

\- Do not install packages unless necessary and approved.

\- Do not run long-running commands unless approved.

\- Do not merge.

\- Do not deploy.



\## Expected Final Output



Every coding task must end with:



\- Summary

\- Changed files

\- Tests run

\- Risks

\- Manual QA steps

\- Recommended next action



<!-- AI_OPS_RULES_START -->
# AI Operating Rules

This file gives repo-level operating rules to Codex and other coding agents.
It is instruction, not audit evidence.

## Hard Safety Rules

- Work only inside this repository unless the user explicitly approves otherwise.
- Do not read, print, copy, summarize, or modify `.env`, `.env.*`, private keys, certificates, tokens, credential files, browser profiles, or OS credential stores.
- Do not run destructive commands such as deleting folders, resetting branches, force pushing, dropping databases, wiping caches globally, or changing production infrastructure.
- Do not install packages or change dependencies without explicit approval.
- Do not deploy, publish, release, submit to stores, push to production, or change cloud infrastructure without explicit approval.
- Do not modify application source code during audit tasks unless the user explicitly asks for fixes.
- Keep changes small and auditable.
- Write a handoff after every meaningful task.

## Audit Rules

- During code audit tasks, do not use existing `.md`, `.qmd`, README, CHANGELOG, docs, memory files, task files, notes, or previous summaries as evidence.
- AGENTS.md and CLAUDE.md may be used only as operating instructions, not as project facts.
- You may write new `.md` reports under `docs/ai/`.
- Base audit findings only on source code, config files, manifests, dependency files, migrations, test files, build files, and CI/CD config.
- Do not rely on memory or assumptions.
- If something cannot be verified from code, write `not verified in code`.
- Every finding should include file path, symbol or endpoint name, line range when practical, severity, impact, and fix.

## Development Workflow

1. Inspect git status first.
2. Create or verify a safe git checkpoint before edits.
3. Build an inventory before deep analysis.
4. Analyze module by module.
5. Run only safe local checks.
6. Prefer minimal changes.
7. Write/update a handoff file under `docs/ai/handoffs/`.
8. Stop and ask before risky actions.

## Output Style

- Be specific.
- Avoid unsupported claims.
- Prefer evidence over assumptions.
- Separate verified facts from recommendations.



<!-- AI_OPS_RULES_END -->


<!-- PRODUCT_BRAIN_STARTUP_START -->
## LocateFlow Product Brain Startup

Before product, UX, analytics, audit-memory, roadmap, or implementation-planning work, read `docs/ai/00_START_HERE.md` and follow its reading order.

Use `docs/ai` as the shared Product Brain:

- Codex extracts verified capability, maintains memory/docs, writes handoffs, and implements only explicitly approved source tasks.
- Claude judges, simplifies, prioritizes, and turns strategy into review decisions or Codex prompts.
- Obsidian is the memory graph over `docs/ai`; it is not a source of hidden facts.
- Keep verified capability, hypothesis, decision, experiment, task, and result separate.
- Do not turn hypotheses into facts or claim customer demand, partnerships, revenue, traffic, conversion, analytics results, or integrations unless verified.
- Do not store secrets, customer data, production data, credentials, tokens, or private keys in `docs/ai`.

Every meaningful Product Brain session must end with updated relevant `docs/ai` files when needed, a handoff under `docs/ai/handoffs/`, updated `docs/ai/03_NEXT_AGENT_TASKS.md` when next work is known, and confirmation whether application source code was modified.
<!-- PRODUCT_BRAIN_STARTUP_END -->
