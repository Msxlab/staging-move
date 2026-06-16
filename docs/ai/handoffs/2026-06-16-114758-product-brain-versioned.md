# Product Brain Versioned Handoff

## Scope

- Task: preserve the untracked `docs/ai/**` Product Brain content as a docs-only commit.
- Branch: `codex/phase1-integration`.
- Commit message requested: `docs: version the AI Product Brain`.
- No application source behavior change was made.
- No push, deploy, flag change, telemetry config change, or migration occurred.

## Product Brain commit contents

The commit versions the untracked Product Brain material under `docs/ai/**`, including:

- Startup and strategy dashboards: `00_START_HERE.md`, `01_ACTIVE_STRATEGY.md`, `03_NEXT_AGENT_TASKS.md`, `04_WEEKLY_REVIEW.md`.
- Product, growth, research, experiment, experience, vision, workflow, memory, audit, kanban, prompt, and Obsidian files under `docs/ai`.
- 2026-06-15 and 2026-06-16 Product Brain handoffs that were previously untracked.

Pre-commit docs count:

- Previously tracked `docs/ai` files: 17.
- Files visible under `docs/ai` before this commit: 98.

## Secret check

Only `docs/ai/**` was scanned. Findings:

- Broad scan found policy text and environment/config key names such as `ANTHROPIC_API_KEY`, `CRON_SECRET`, and `USER_JWT_SECRET`, but no secret values.
- High-confidence token/private-key scan found no matches for Stripe secret tokens, GitHub tokens, AWS access keys, Google API key patterns, or private key blocks.
- No `.env`, customer data, production data, private keys, credentials, tokens, or secret files were read.

## Dirty tracked file triage

These tracked files remain dirty and were not committed.

### `AGENTS.md`

Change:

- Adds an `AI_OPS_RULES` section with repo operating rules.
- Adds a `PRODUCT_BRAIN_STARTUP` section pointing agents to `docs/ai/00_START_HERE.md` and requiring Product Brain handoffs.

Assessment:

- Looks intentional from prior AI ops / Product Brain startup work.
- It is an agent-instruction change, not Product Brain content.

Recommendation:

- Keep only if the team wants these repo-level operating rules versioned now.
- Commit separately after human review because it changes agent behavior and should not be mixed into the Product Brain docs commit.

### `apps/admin/next-env.d.ts`

Change:

- Removes `import "./.next/dev/types/routes.d.ts";` from the generated Next type file.

Assessment:

- Looks like generated/local Next tooling drift.
- This file says it should not be edited manually.

Recommendation:

- Revert unless there is a deliberate typed-routes decision.
- Do not commit this as part of Phase-1 or Product Brain work.

### `apps/admin/tsconfig.json`

Change:

- Changes `"jsx": "react-jsx"` to `"jsx": "preserve"`.

Assessment:

- This is the change that made local admin tests misleadingly fail with `ReferenceError: React is not defined`.
- Clean main and the clean Phase-1 commit pass admin tests with `"react-jsx"`.
- Looks stale or experimental rather than an intentional approved source change.

Recommendation:

- Revert to `"react-jsx"` unless the team explicitly chooses a Next/JSX transform migration.
- If kept intentionally, the admin test/runtime setup will need a separate approved fix.

### `docs/ai-ops/04-commands.md`

Change:

- Expands a stub command doc into a full safe command matrix for pnpm/Turbo, web, admin, mobile, database, and high-caution commands.

Assessment:

- Looks intentional from the AI ops bootstrap flow.
- It is useful operational documentation, but it is outside `docs/ai/**`.

Recommendation:

- Keep and commit separately as an AI ops docs commit if the team wants to version `docs/ai-ops`.
- Do not mix it into the Product Brain docs commit.

## Generated mobile route file

Check:

```text
apps/mobile/.gitignore:2:.expo/ apps/mobile/.expo/types/router.d.ts
!! apps/mobile/.expo/
```

Conclusion:

- `apps/mobile/.expo/types/router.d.ts` is ignored via `apps/mobile/.gitignore`.
- It was not committed.
- If local typed-route errors reappear, delete or regenerate the ignored `.expo` output in the local checkout rather than committing generated route types.

## Phase-1 status

- Phase-1 code commit `4dcb1390 feat: integrate phase 1 experiments` is untouched.
- The Product Brain docs commit is separate from Phase-1 code.
- No application source code was staged for this Product Brain commit.
