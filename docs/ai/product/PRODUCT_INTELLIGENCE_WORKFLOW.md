# Current verified product capability

- LocateFlow has an existing `docs/ai/memory` technical baseline and a Product Intelligence Layer under `docs/ai/product`, `docs/ai/growth`, `docs/ai/research`, and `docs/ai/experiments`.
- Verified current product capability should continue to come from technical memory, source-backed audits, and approved product docs only.
- Current verified capability includes web/admin/mobile surfaces, move records, workspaces, provider flows, connectors, exports, billing/IAP, notifications, and admin governance as summarized in the existing AI memory files.
- No customer interviews, analytics dashboards, pricing validation, external market research, live partnership data, or traffic data were verified in this workflow.
- This workflow replaces external-model dependency language with a Claude + Codex + Obsidian operating model.

# Hypotheses

- Hypothesis: the strongest workflow is a deliberate separation of imagination, judgment, implementation, and memory.
- Hypothesis: Claude Product Explorer should generate broad product possibilities, but should not be the final authority on priority.
- Hypothesis: Claude Product Judge should convert raw product possibilities into ranked decisions based on revenue, defensibility, feasibility, and user value.
- Hypothesis: Codex should remain the source-aware operator that translates selected decisions into implementation-ready tasks and keeps the docs synchronized.
- Hypothesis: Obsidian can act as the product memory graph by linking strategy, customer jobs, feature specs, decisions, experiments, risks, and handoffs.

# Recommended next decisions

- Adopt the following workflow as the default Product Intelligence Layer loop:
  - Codex extracts verified current capabilities from technical memory and source-backed audit memory.
  - Claude Product Explorer generates product hypotheses, customer jobs, growth ideas, positioning options, and data moat ideas.
  - Claude Product Judge filters, ranks, and turns the strongest ideas into 30-day and 90-day product roadmap recommendations.
  - Obsidian stores the living graph of decisions, assumptions, dependencies, risks, research queues, experiments, and handoffs.
  - Codex converts accepted decisions into scoped implementation tasks only after user approval.
- Treat every product idea as a hypothesis until it is supported by customer evidence, market research, source capability, or user decision.
- Treat every partnership, integration, revenue, and customer-data claim as unverified unless explicitly supported by approved evidence.
- Use handoff files for each major strategy pass so future agents can continue without relying on hidden memory.

# Open questions for Claude Product Review

- Which product hypotheses should enter Claude Product Judge first?
- What scoring rubric should the judge use for revenue, defensibility, feasibility, and user value?
- What Obsidian note structure best links north star, customer jobs, feature specs, research, experiments, and implementation tasks?
- What minimum evidence should be required before an idea moves from hypothesis to accepted product decision?

# Possible Codex implementation tasks

- Maintain the product docs and handoffs as the canonical machine-readable strategy layer.
- Convert selected Product Judge decisions into PRD stubs, implementation task lists, acceptance criteria, and test plans.
- Add cross-links between product strategy files when the user wants Obsidian graph navigation improved.
- Create a product-decision template under the allowed docs path after approval.
- Keep future edits scoped to docs unless the user explicitly requests source implementation.

# Role Definitions

## Codex

Codex is the source-aware operator for the Product Intelligence Layer.

- Extracts current product capabilities from `docs/ai/memory/*.md` and source-backed audit memory.
- Maintains product, growth, research, experiment, and handoff docs.
- Preserves the distinction between verified capability, hypothesis, decision, and task.
- Converts selected product decisions into implementation-ready tasks, PRDs, acceptance criteria, and test plans.
- Writes handoffs after meaningful product or implementation planning work.
- Does not invent customer data, partnerships, integrations, revenue, traffic, or market proof.

## Claude Product Explorer

Claude Product Explorer is the broad-thinking product strategy role.

- Generates product hypotheses, customer jobs, growth ideas, data moat ideas, positioning options, and experiment ideas.
- Explores the Address Life OS / Move Command Center direction from multiple customer and market angles.
- Labels assumptions as hypotheses and separates sourced facts from interpretations.
- Feeds promising raw ideas into the Product Research Queue and Product Judge queue.
- Does not convert ideas directly into implementation without judgment and user approval.

## Claude Product Judge

Claude Product Judge is the prioritization and filtering role.

- Filters Claude Product Explorer ideas for revenue potential, defensibility, feasibility, user value, risk, and alignment with verified capability.
- Produces 30-day and 90-day roadmap recommendations.
- Identifies which ideas should be rejected, parked, researched, prototyped, or implemented.
- Flags unsupported claims, missing evidence, privacy concerns, partner-claim risk, and implementation risk.
- Hands accepted decisions back to Codex for task conversion.

## Obsidian

Obsidian is the memory graph and decision system.

- Links technical memory, product strategy, research queues, feature specs, experiments, risks, decisions, and handoffs.
- Makes assumptions and dependencies visible across notes.
- Stores accepted decisions and their rationale so future agents do not rely on hidden chat context.
- Provides graph navigation across Move Memory, Move Intelligence, Move Operations, growth, pricing, and data moat topics.
- Should distinguish evergreen product memory from time-bound handoffs and temporary research queues.

# Idea To Implementation Flow

1. Codex records verified current capability from technical memory and source-backed audit memory.
2. Claude Product Explorer proposes product hypotheses, customer jobs, growth ideas, data moat ideas, and research questions.
3. Claude Product Judge scores and filters those ideas by revenue, defensibility, feasibility, user value, risk, and evidence.
4. The user accepts, rejects, or requests more research on the judged recommendations.
5. Obsidian captures the accepted decision, rationale, assumptions, dependencies, and links to related notes.
6. Codex converts accepted decisions into PRD stubs, implementation tasks, acceptance criteria, and verification plans.
7. Source code changes happen only after a separate explicit implementation request.
8. Codex writes a handoff summarizing what changed, what remains uncertain, and the next recommended prompt.

# Decision Writeback Rules

- Accepted product decisions should be written back into the relevant product strategy file and a handoff.
- Research-backed findings should update `docs/ai/research/PRODUCT_RESEARCH_QUEUE.md` or a future approved research note before affecting product specs.
- Prioritized roadmap items should update `docs/ai/product/FEATURE_BACKLOG.md` or a future approved roadmap note.
- Growth decisions should update the relevant `docs/ai/growth` file.
- Experiment decisions should update `docs/ai/experiments/EXPERIMENT_BACKLOG.md`.
- Obsidian links should point to the canonical docs file and the handoff that recorded the decision.
- Unverified assumptions must remain labeled as hypotheses.
