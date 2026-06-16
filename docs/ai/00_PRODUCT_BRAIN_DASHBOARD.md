# LocateFlow Product Brain Dashboard

Updated: 2026-06-15

This is the Obsidian entry point for the LocateFlow Product Brain. The canonical current dashboard is this top section. The older snapshot below is retained only as historical context.

## Active Strategy

- Canonical one-page roadmap: [[01_ACTIVE_STRATEGY]]
- Phase 1 experiment slice: [[02_ACTIVE_EXPERIMENTS]]
- Analytics taxonomy and retention: [[analytics/EVENT_TAXONOMY]], [[analytics/DATA_RETENTION_POLICY]]

## Canonical Current Dashboard

### North Star

Canonical note: [[product/PRODUCT_NORTH_STAR]]

Accepted direction: LocateFlow is moving toward **Address Life OS / Move Command Center**.

Accepted north-star metric: **verified address transitions completed per active household**.

Definition to refine before implementation: a verified transition is a provider or obligation moved from needs-action to confirmed-with-proof.

### Verified Capability Baseline

Technical baseline: [[memory/PROJECT_MAP]], [[memory/API_INVENTORY]], [[memory/AUTH_AND_PERMISSIONS]], [[memory/BILLING_AND_SUBSCRIPTIONS]], [[memory/MOBILE_RELEASE_READINESS]], [[memory/RISK_REGISTER]]

Current verified capability includes web/admin/mobile surfaces, accounts, workspaces, addresses, services, move tasks, budgets, provider flows, recommendations, exports, billing/IAP, notifications, admin governance, and source-backed product capabilities recorded in [[memory/DECISION_LOG]].

Not verified: customer demand, traffic, conversion, churn, LTV, live partnerships, live provider account-change integrations, keyword demand, live prices, and production AI-key state.

### Current Strategy

Decision source: [[handoffs/20260615-142939-product-strategy-ingested]]

- Do not build AI from scratch.
- Surface, harden, and monetize the existing [[product/AI_MOVE_BRIEFING_SPEC]].
- Surface [[product/PROVIDER_TRANSITION_WORKSPACE]] over existing MoveTask data.
- Package post-move monitoring into a user-facing retention surface.
- Use the consented transition-outcome graph in [[product/DATA_MOAT_MAP]] as the data moat.
- Treat Move Risk Radar as an intelligence substrate, not the first standalone product.
- Defer partner-facing workspace until partner demand is verified.
- Defer SEO-first strategy until the core save/use loop, account artifact, and rules review path are stronger.

### Experience Intelligence

Experience scan: [[experience/USER_JOURNEY_MAP]], [[experience/AHA_MOMENT_MAP]], [[experience/FRICTION_LOG]], [[experience/EXPERIENCE_BACKLOG]]

Core experience read: verified primitives exist for AI Briefing, MoveTask-based provider transitions, post-move reminders, proof/export flows, household invitations, billing gates, and trust copy. The main UX opportunity is packaging these into one obvious Move Command Center journey.

Top experience bets:

1. Make [[experience/AI_MOVE_BRIEFING_EXPERIENCE]] the visible first intelligence moment.
2. Turn MoveTask data into [[experience/PROVIDER_TRANSITION_EXPERIENCE]] lanes, owners, statuses, and next actions.
3. Package existing reminder and digest primitives as [[experience/POST_MOVE_MONITORING_EXPERIENCE]].
4. Reframe export and dossier primitives as [[experience/EXPORT_PROOF_PACKET_EXPERIENCE]].
5. Tie Family/Pro upgrades to [[experience/HOUSEHOLD_EXPERIENCE]], proof, monitoring, and briefing moments.

## Vision Layer

Vision master plan: [[vision/VISION_MASTER_PLAN]]

Links:

- [[vision/VISION_MASTER_PLAN]]
- [[vision/API_OPPORTUNITY_MATRIX]]
- [[vision/PARTNERSHIP_TARGET_MAP]]
- [[vision/MONETIZATION_MAP]]
- [[vision/SEO_GEO_SITE_STRATEGY]]
- [[vision/OUTREACH_PLAYBOOK]]
- [[vision/API_INTEGRATION_ROADMAP]]
- [[vision/DATA_MOAT_STRATEGY]]
- [[vision/RISK_AND_COMPLIANCE_GUARDRAILS]]
- [[vision/90_180_365_DAY_PLAN]]
- [[vision/VISION_DECISION_SUMMARY]]

Vision ingestion source: [[handoffs/2026-06-15-155106-claude-vision-api-partnership-growth]]

Vision status: decision candidates, interpretations, public-source facts, and experiment candidates. Public-source claims and reported verified integration claims need spot-check before public use or implementation.

Top preserved conclusion: the next year should focus less on generic API integration and more on monetizing, packaging, trust-positioning, and surfacing the already-identified dossier, briefing, transition, monitoring, free-tool, and proof/export capabilities.

### Product Pillars

Move Memory: [[product/CUSTOMER_JOBS]], [[product/ADDRESS_TIMELINE_SPEC]]

- Addresses, services, providers, tasks, budgets, proof/exports, household members, timeline.

Move Intelligence: [[product/MOVE_INTELLIGENCE_ENGINE]], [[product/AI_MOVE_BRIEFING_SPEC]], [[product/MOVE_RULES_REGISTRY]]

- AI Move Briefing, Risk Radar, Rules Registry, recommendations, post-move alerts.

Move Operations: [[product/PROVIDER_TRANSITION_WORKSPACE]], [[experiments/EXPERIMENT_BACKLOG]]

- Transition board, assigned tasks, guided provider actions, proof packets, household collaboration, monitoring surface.

### Accepted Product Bets

Backlog: [[product/FEATURE_BACKLOG]]

1. [[product/AI_MOVE_BRIEFING_SPEC]]: harden, deepen, reversible AI cohort, upgrade teaser.
2. [[product/PROVIDER_TRANSITION_WORKSPACE]]: read-only board over existing MoveTask lanes and statuses.
3. Post-move obligation monitoring: user-facing retention surface over existing service/reminder primitives.

Fast-follow hypotheses: Risk Radar tab, proof packet Pro upsell, budget-surprise signal, Address Timeline, state move-rules finder after rules review.

### Active Experiments

Experiment queue: [[experiments/EXPERIMENT_BACKLOG]], [[experience/EXPERIENCE_BACKLOG]]

Top 30-day experiments:

1. AI Briefing visibility, source explainer, and controlled hardening.
2. Provider Transition board v1 over existing MoveTask data.
3. Post-move monitoring surface or digest.
4. Proof packet preview and Pro upgrade teaser.
5. Household invite prompt at assignment moments.

Every experiment must keep verified capability, hypothesis, metric, guardrail, audience, and rollback separate.

### Analytics And Retention

Measurement plan: [[analytics/POSTHOG_MEASUREMENT_PLAN]]

Event taxonomy: [[analytics/EVENT_TAXONOMY]]

Retention policy: [[analytics/DATA_RETENTION_POLICY]]

Current decision: use the existing consent-gated `UserEvent` pipeline; keep PostHog uninstalled/unconfigured until separately approved; bound analytics volume with dry-run retention by default and optional non-experiment sampling only when explicitly enabled.

### Revenue Path

Packaging note: [[product/PRICING_AND_PACKAGING]]

Accepted revenue path: Pro/Family subscription anchored by AI Briefing, Provider Transition, and post-move monitoring, with proof packets as a fast-follow Pro upsell.

Hypotheses:

- Stripe web remains the primary upgrade path.
- Mobile IAP supports in-app impulse upgrades.
- Secondary household members are not the revenue anchor.

### Data Moat

Moat note: [[product/DATA_MOAT_MAP]]

Accepted data moat strategy: consented, coarse transition-outcome graph.

Allowed direction: provider category, two-letter state, transition action type, status/outcome, blocker category, confidence, and proof generated yes/no.

Do not use raw addresses, confirmation numbers, account numbers, names, emails, phone numbers, secrets, or sensitive service fields as moat signals.

### Growth Loop

Growth notes: [[growth/GROWTH_ENGINE]], [[growth/SEO_CONTENT_CLUSTERS]], [[growth/FREE_TOOLS_STRATEGY]]

Accepted first loop:

Household invite -> transition assignment -> second-member activation -> next move-owner -> new household invite.

Deferred:

- Partner-facing workspace until verified partner pull exists.
- SEO-first strategy until search demand, rules content review, and account-save artifact are validated.

### Next Agent Tasks

Task queue: [[03_NEXT_AGENT_TASKS]]

Current recommendation: prepare a docs-only AI Briefing experience hardening spec, including source/limitation copy, upgrade moment, privacy-safe events, and manual QA. Ask for explicit human approval before any source-code work, AI-key handling, telemetry persistence, or billing-copy change.

### Weekly Review

Weekly operating note: [[04_WEEKLY_REVIEW]]

Use the weekly review to decide what moved from hypothesis to verified, what should be killed, what should be doubled down on, what Codex should prepare next, and what Claude Product Judge should review next.

### Decision And Handoff Trail

Decision log: [[memory/DECISION_LOG]]

Recent handoffs:

- [[handoffs/20260615-163949-vision-ingested-into-product-brain]]
- [[handoffs/2026-06-15-155106-claude-vision-api-partnership-growth]]
- [[handoffs/20260615-144907-user-experience-intelligence-scan]]
- [[handoffs/20260615-142939-product-strategy-ingested]]
- [[handoffs/20260615-140330-kimi-removed-product-intelligence]]
- [[handoffs/2026-06-15-142302-claude-product-strategy-council]]
- [[handoffs/20260615-132256-code-only-audit]]

### Guardrails

- Do not modify source code from this dashboard; it is a strategy and memory entry point.
- Do not turn hypotheses into verified facts.
- Do not claim customer demand, partnerships, live integrations, traffic, revenue, or production configuration unless verified.
- Do not promise automatic provider changes.
- Keep AI evidence-bound, display-oriented, reversible, and non-autonomous.
- Keep product-intelligence data consented, coarse, and no-raw-PII.

## Previous Snapshot

The following older dashboard snapshot is superseded by the canonical current dashboard above.

## North Star

LocateFlow is the Address Life OS / Move Command Center that helps households complete every address transition with nothing missed.

## Current Strategic Decision

We are not building AI from scratch.

The current strategy is:

- Surface and harden the existing AI Move Briefing
    
- Surface the Provider Transition Workspace over existing MoveTask data
    
- Package post-move monitoring into a user-facing retention surface
    
- Use consented transition-outcome data as the data moat
    
- Defer partner-facing workspace until partner demand is verified
    
- Defer SEO-first strategy until the core save/use loop is stronger
    

## Top 3 Product Bets

1. [[product/AI_MOVE_BRIEFING_SPEC]]
    
2. [[product/PROVIDER_TRANSITION_WORKSPACE]]
    
3. Post-move obligation monitoring
    

## Product Pillars

### Move Memory

- Addresses
    
- Services
    
- Providers
    
- Tasks
    
- Documents
    
- Household members
    
- Timeline
    

### Move Intelligence

- AI Move Briefing
    
- Risk Radar
    
- Rules Registry
    
- Recommendations
    
- Post-move alerts
    

### Move Operations

- Transition board
    
- Assigned tasks
    
- Proof/exports
    
- Household collaboration
    
- Provider action tracking
    

## Active Experiments

See: [[experiments/EXPERIMENT_BACKLOG]]

Current priority experiments:

1. AI Move Briefing visibility / activation
    
2. Provider Transition Workspace read-only board
    
3. Post-move monitoring surface
    
4. Briefing paywall / upgrade teaser
    
5. Household invite loop
    

## Revenue Path

See: [[product/PRICING_AND_PACKAGING]]

Current hypothesis:

- Family / Pro should be positioned around AI briefing, transition tracking, household collaboration, proof packets, and post-move monitoring.
    
- Stripe web should remain the primary upgrade path.
    
- Mobile IAP should support in-app impulse upgrades but not be the main revenue path.
    

## Data Moat Path

See: [[product/DATA_MOAT_MAP]]

Current hypothesis:

The strongest moat is the transition-outcome graph:

- what people stop
    
- what people start
    
- what people transfer
    
- what people cancel
    
- what people forget
    
- what actions resolve risk
    

## Growth Loop

See: [[growth/GROWTH_ENGINE]]

Primary loop:

Household invite → task assignment → second member activation → next move-owner → new household invite.

## Risk Guardrails

See: [[memory/RISK_REGISTER]]

Guardrails:

- Do not promise automatic provider changes unless verified/legal/API feasible.
    
- Do not claim official partnerships unless verified.
    
- Do not turn hypotheses into facts.
    
- Do not store secrets or customer data in docs/ai.
    
- Treat billing, mobile IAP, and provider integrations as verified only when proven.
    

## Next Codex Tasks

See: [[03_NEXT_AGENT_TASKS]]

Current candidate tasks:

1. Ingest Claude Product Strategy Council decisions into product docs.
    
2. Create AI Move Briefing experiment spec.
    
3. Create Provider Transition Workspace experiment spec.
    
4. Create Post-move Monitoring experiment spec.
    
5. Update experiment backlog with impact/effort/confidence scoring.
    

## Next Claude Review

See: [[04_WEEKLY_REVIEW]]

Questions for Claude:

1. Is AI Move Briefing still the best first product wedge?
    
2. What should be free vs paid?
    
3. Which experiment proves willingness to pay fastest?
    
4. Which product bet creates the strongest retention?
    
5. Which idea should be rejected this week?
    

## Decision Log

See: [[memory/DECISION_LOG]]

Latest decisions to record:

- LocateFlow direction: Address Life OS / Move Command Center
    
- Strategy: surface/harden/monetize existing intelligence
    
- Initial bets: AI Move Briefing, Provider Transition Workspace, Post-move Monitoring
    
- Avoid for now: partner-facing workspace, SEO-first strategy, standalone rules registry
    

## Handoffs

Recent handoffs:

- [[handoffs/20260615-140330-kimi-removed-product-intelligence]]
    
- [[handoffs/2026-06-15-142302-claude-product-strategy-council]]
    

## Weekly Review Checklist

Every week, answer:

- What did we learn?
    
- What changed from hypothesis to verified?
    
- What should be killed?
    
- What should be doubled down on?
    
- What should Codex build next?
    
- What should Claude judge next?
