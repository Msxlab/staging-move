# Product Intelligence Dependency Removal Handoff

Date: 2026-06-15

## Completed

- Removed the previous external research dependency from the Product Intelligence Layer.
- Renamed the previous model-specific research queue to `docs/ai/research/PRODUCT_RESEARCH_QUEUE.md`.
- Replaced dual-model open-question wording with `Open questions for Claude Product Review` in product, growth, research, and experiment files.
- Replaced product workflow references with Claude Product Explorer, Claude Product Judge, Product Research Queue, and External Research Queue wording where appropriate.
- Added `docs/ai/product/PRODUCT_INTELLIGENCE_WORKFLOW.md`.
- Updated the previous product intelligence handoff so it no longer points to the previous external research workflow.
- Preserved the useful product strategy content while changing the operating model to Claude + Codex + Obsidian.

## Changed Files

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
- `docs/ai/product/PRODUCT_INTELLIGENCE_WORKFLOW.md`
- `docs/ai/growth/GROWTH_ENGINE.md`
- `docs/ai/growth/SEO_CONTENT_CLUSTERS.md`
- `docs/ai/growth/FREE_TOOLS_STRATEGY.md`
- `docs/ai/research/PRODUCT_RESEARCH_QUEUE.md`
- `docs/ai/experiments/EXPERIMENT_BACKLOG.md`
- `docs/ai/handoffs/20260615-135650-product-intelligence-bootstrap.md`
- `docs/ai/handoffs/20260615-140330-kimi-removed-product-intelligence.md`

## Final Workflow

- Codex extracts verified current capabilities from technical memory.
- Codex maintains product docs and handoffs.
- Codex converts accepted product decisions into implementation-ready tasks.
- Claude Product Explorer thinks broadly and generates hypotheses.
- Claude Product Explorer proposes customer jobs, growth ideas, data moat ideas, and strategy options.
- Claude Product Judge filters ideas for revenue, defensibility, feasibility, and user value.
- Claude Product Judge produces 30-day and 90-day roadmap recommendations.
- Obsidian acts as the memory graph and decision system.
- Obsidian links product strategy, research, experiments, risks, decisions, and implementation tasks.
- Accepted decisions are written back into canonical docs plus handoffs before any code implementation begins.

## Verification

- No application source code was modified.
- No `.env`, `.env.*`, private keys, tokens, credentials, certificates, or secret files were read.
- No delete, reset, clean, stash, push, deploy, publish, install, test, build, or migration command was run.
- No customer data, partnerships, integrations, revenue, or traffic claims were invented.

## Exact Next Prompt For Claude Product Explorer

```text
Use the LocateFlow Product Intelligence Layer under docs/ai/product, docs/ai/growth, docs/ai/research, and docs/ai/experiments as the internal strategy baseline. Follow docs/ai/product/PRODUCT_INTELLIGENCE_WORKFLOW.md. Think broadly about the Address Life OS / Move Command Center opportunity and generate product hypotheses, customer jobs, growth ideas, data moat ideas, and experiment ideas. Do not treat hypotheses as facts. Do not invent customer data, partnerships, integrations, revenue, traffic, or market share. Separate verified current capability, sourced facts, interpretations, hypotheses, and recommended validation steps. Return ideas in a format Claude Product Judge can score for revenue, defensibility, feasibility, and user value.
```

## Recommended Next Action

- Run the Claude Product Explorer prompt, then run Claude Product Judge to turn the strongest ideas into a 30-day and 90-day roadmap.
