# Next Agent Tasks

Updated: 2026-06-15

Use this note as the Obsidian task queue for the next Codex, Claude Product Explorer, or Claude Product Judge pass.

## Current Strategic Context

Dashboard: [[00_PRODUCT_BRAIN_DASHBOARD]]
Experience layer: [[experience/USER_JOURNEY_MAP]], [[experience/FRICTION_LOG]], [[experience/AHA_MOMENT_MAP]], [[experience/EXPERIENCE_BACKLOG]]
Vision layer: [[vision/VISION_MASTER_PLAN]], [[vision/VISION_DECISION_SUMMARY]], [[vision/90_180_365_DAY_PLAN]]

## Active Ops Task

- Dokploy migration preparation is in progress. Current handoff:
  [[handoffs/2026-06-16-1719-dokploy-build-fixes]]
- Dokploy UI-only DB copy succeeded: the one-shot `locateflow-dbcopy` container
  streamed the DigitalOcean MySQL data into Dokploy MySQL, exited `0`, and
  source/target counts matched for `_prisma_migrations`, `RuntimeConfigEntry`,
  `RuntimeConfigEntry_active`, users, subscriptions, addresses, providers,
  saved/custom providers, tasks, email logs, connector dispatches, and address
  change events. `locateflow-mysql` remains running healthy.
- Temporary DigitalOcean restore access was removed after the copy: the
  temporary restore user was deleted and the temporary Dokploy-server DB
  firewall rule was removed. DigitalOcean remains live and DNS was not changed.
- GitHub provider is configured in Dokploy for `Msxlab/move-main` on branch
  `codex/dokploy-migration`. Local web/admin production Docker builds now pass
  after build-blocker fixes. Next step: push the fixes and trigger full app
  deploy in Dokploy. The Dokploy compose keeps `cron` behind the `cron` profile,
  so the first full app rehearsal should deploy web/admin without scheduled
  jobs. Do not enable the `cron` profile until final cutover.
- Cleanup reminder: remove the temporary `SOURCE_MYSQL_PASSWORD` key from
  Dokploy env if it is still present. Do not reveal or record its value.
- Do not deploy/cut over until writes can be frozen, GitHub scheduled cron can
  be paused, final dump can be taken, final restore can be counted, health
  checks pass, and DNS/cron can be moved in that order.

Accepted direction: LocateFlow is moving toward Address Life OS / Move Command Center.

Current strategy:

- Do not build AI from scratch.
- Surface, harden, and monetize existing [[product/AI_MOVE_BRIEFING_SPEC]].
- Surface [[product/PROVIDER_TRANSITION_WORKSPACE]] over existing MoveTask data.
- Package post-move monitoring into a user-facing retention surface.
- Use consented transition-outcome graph as the data moat.
- Defer partner-facing workspace and SEO-first strategy until validated.
- New vision candidates emphasize monetizing/surfacing existing intelligence, trust positioning, free tools that save into accounts, proof/export upsells, and compliant referral click-outs only after validation.

## Ready For Human Approval

These tasks may require source-code work in a separate session. Do not start them without explicit approval.

1. AI Briefing experience hardening implementation.
   - Linked spec: [[product/AI_MOVE_BRIEFING_SPEC]]
   - Experience note: [[experience/AI_MOVE_BRIEFING_EXPERIENCE]]
   - Experiment: [[experiments/EXPERIMENT_BACKLOG]]
   - Scope: visibility, source/limitation explainer, gates, fallback, privacy tests, telemetry, upgrade teaser, reversible AI cohort gate.
   - Approval needed: source changes, AI runtime key/cohort handling, telemetry persistence, billing or upgrade copy.

2. Provider Transition board v1.
   - Linked spec: [[product/PROVIDER_TRANSITION_WORKSPACE]]
   - Experience note: [[experience/PROVIDER_TRANSITION_EXPERIENCE]]
   - Scope: read-only board over existing MoveTask lanes/statuses/assignees/progress.
   - Approval needed: source changes, UI copy, any status mutation, any telemetry persistence.

3. Post-move monitoring surface.
   - Linked backlog: [[product/FEATURE_BACKLOG]]
   - Experience note: [[experience/POST_MOVE_MONITORING_EXPERIENCE]]
   - Scope: user-facing view over upcoming billing, contract-end, auto-renewal, and service obligations.
   - Approval needed: source changes, notification changes, telemetry persistence.

4. Proof packet preview.
   - Experience note: [[experience/EXPORT_PROOF_PACKET_EXPERIENCE]]
   - Scope: preview existing export/dossier capabilities as a move proof packet before generating sensitive output.
   - Approval needed: source changes, export copy, Pro-gated billing copy, telemetry persistence.

## Docs-Only Prep Tasks

These can be done before source implementation.

1. Draft a north-star event taxonomy.
   - Link: [[product/PRODUCT_NORTH_STAR]]
   - Output: event definitions for transition confirmed with proof, transition status changed, briefing generated, monitoring item resolved, and proof packet generated.

2. Draft privacy-safe telemetry rules.
   - Link: [[product/DATA_MOAT_MAP]]
   - Output: allowed fields, disallowed fields, consent rules, retention questions, and test requirements.

3. Draft experiment one-pagers for the top three experiments.
   - Links: [[experiments/EXPERIMENT_BACKLOG]], [[experience/EXPERIENCE_BACKLOG]]
   - Output: hypothesis, audience, metric, guardrail, rollout, rollback, and approval gates.

4. Draft product copy guardrails.
   - Links: [[product/AI_MOVE_BRIEFING_SPEC]], [[product/PROVIDER_TRANSITION_WORKSPACE]], [[product/PRICING_AND_PACKAGING]]
   - Output: allowed/blocked copy for AI, provider transition, proof packets, and subscription claims.

5. Draft UX Judge review packet.
   - Links: [[experience/FRICTION_LOG]], [[experience/AHA_MOMENT_MAP]], [[experience/PRICING_UPGRADE_EXPERIENCE]], [[experience/TRUST_AND_SAFETY_EXPERIENCE]]
   - Output: top friction, top aha moments, upgrade moments, first three experiments, and rejected/deferred ideas.

6. Claude Strategy Compression review.
   - Links: [[vision/VISION_MASTER_PLAN]], [[vision/VISION_DECISION_SUMMARY]], [[vision/90_180_365_DAY_PLAN]]
   - Output: one 30-day lane, one 90-day lane, parked/deferred ideas, and public-source claims requiring spot-check.

7. Choose one growth/vision lane to execute first.
   - Candidate lanes: USPS OAuth hygiene plus COA anti-scam guide; free-tool MVP; consented transition-outcome graph plus 5-state rules schema.
   - Output: human-selected lane and explicit approval boundary.

8. Codex implementation spec for the selected lane.
   - Output: docs-only PRD, source files to inspect later, acceptance criteria, tests, privacy/compliance guardrails, and rollback plan.
   - Stop before source-code changes.

## Claude Product Judge Queue

Ask Claude Product Judge to review:

- Whether AI Briefing hardening or Provider Transition board should be the first approved source-code task.
- Which claims are safe for public-facing product copy today.
- Whether post-move monitoring should ship before or after the Provider Transition board.
- What proof artifact should count toward the north-star metric.

## Claude UX Judge Queue

Ask Claude UX Judge to review:

- Whether the first-session experience should lead with AI Briefing, Provider Transition setup, or service import/add.
- Which friction points most threaten activation, retention, trust, and willingness to pay.
- Which paid moments feel natural versus premature.
- Which UX experiments can be implemented without increasing privacy, billing, AI, or provider-automation risk.

## Claude Strategy Compression Queue

Ask Claude Strategy Compression to review:

- Which one growth/vision lane should execute first.
- Whether the vision should prioritize Individual paywall, free tool to account-save, broadband referral, post-move monitoring, or transition-outcome graph.
- Which Claude-reported public-source facts need immediate independent spot-check.
- Which ideas should be rejected, narrowed, or parked for 180+ days.

## Blocked Until Verified

- Partner-facing workspace.
- SEO-first strategy.
- Live provider account-change integrations.
- Official partnership claims.
- Customer demand, revenue, traffic, conversion, churn, or LTV claims.
- Rules content publication without source review.
- Referral, affiliate, or partner click-outs without disclosure/compliance review.
- Public use of Claude-reported source facts without independent spot-check.

## First Vision Implementation-Spec Candidates

1. USPS OAuth hygiene audit plus USPS COA anti-scam guide page.
2. Free-tool MVP using already-wired data, such as flood-zone or internet-at-new-address.
3. Consented transition-outcome event taxonomy plus small move-rules dataset schema.

## Recommended Next Codex Task

Prepare a **Claude Strategy Compression review packet** from [[vision/VISION_DECISION_SUMMARY]], then ask the human to choose one growth/vision lane before any application source-code work.

## Deferred / Do Last

- **Experiment 1 UI QA (Codex runs it from the UI).** Per human decision (2026-06-15), this is parked to run **LAST**, after other Phase-1 work. Codex executes the manual-UI QA matrix and records real results. Plan + matrix + ready execution steps: [[experiments/QA_EXP1_COMMAND_CENTER_DEPENDABILITY]] ("Execution plan" section). Test-only; flag stays `control` in prod; no runtime-source/telemetry/billing change; record BLOCKED honestly; write a `…-exp1-qa-results` handoff.
