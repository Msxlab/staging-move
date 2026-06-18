# Weekly Product Brain Review

Updated: 2026-06-18

Use this note once per week to keep the Obsidian Product Brain honest. The review should update [[00_PRODUCT_BRAIN_DASHBOARD]], [[03_NEXT_AGENT_TASKS]], [[memory/DECISION_LOG]], and any affected product/growth/experiment notes.

## Review Inputs

- Dashboard: [[00_PRODUCT_BRAIN_DASHBOARD]]
- Decision log: [[memory/DECISION_LOG]]
- Feature backlog: [[product/FEATURE_BACKLOG]]
- Experiment backlog: [[experiments/EXPERIMENT_BACKLOG]]
- Experience backlog: [[experience/EXPERIENCE_BACKLOG]]
- Friction log: [[experience/FRICTION_LOG]]
- Aha moment map: [[experience/AHA_MOMENT_MAP]]
- Growth engine: [[growth/GROWTH_ENGINE]]
- Data moat map: [[product/DATA_MOAT_MAP]]
- Risk register: [[memory/RISK_REGISTER]]
- Latest handoff: [[handoffs/2026-06-17-225300-dokploy-cron-runbook-typecheck]]

## 1. Verified This Week

Record only evidence-backed changes.

- New verified capability:
  - Production web/admin deploy is live from `main` commit `df5307ef8bff1387bf775df76d690be4284a0f6a`.
  - Dokploy Ofelia cron jobs now run through `docker/locateflow-cron-runner.sh`; live tick verified `blog-publish`, `checkout-cleanup`, and `connector-dispatch` with `failed: false`.
  - Production acquisition campaign now returns a 14-day annual Individual trial and current annual-first pricing copy.
  - Mobile OTA was published to production runtime `sdk55-1.0.0`, update group `8303c581-4450-4ce0-9cc0-c78fdde17cf4`.
- New source-backed constraint:
  - Current `move-main/main` has billing canonical values in `packages/shared/src/billing.ts`: Individual `$24/year` and `$4.99/month`, Family `$39/year` and `$7.99/month`, Pro `$59/year` and `$11.99/month`.
  - Checkout contains a read-only Stripe Price guard before session creation.
  - Dokploy may keep the long-running `locateflow-cron` Ofelia daemon alive across compose config changes, so future cron config or runner changes require an explicit cron restart/recreate and log verification.
- New test/build/review evidence:
  - Live rendered home/pricing pages showed current annual-first pricing and no rendered `3 months`/`90 days`/`$3.99` pricing copy in the checked public surfaces.
  - Public campaign endpoint returned `trialDays: 14` and `$24/year` annual offer.
  - Dokploy deployments list showed PR #293 deployment `Done`; live cron log showed runner-form jobs and `failed: false` for the 10:40 PM ET tick.
  - `pnpm verify:typecheck` passed after clearing ignored stale generated cache `apps/web/.next`.
- New customer or market evidence:
  - None verified.

## 2. Hypotheses Still Open

Keep these labeled as hypotheses until evidence exists.

- Customer demand:
- Willingness to pay:
- Revenue path:
- Growth loop:
- Data moat:
- SEO demand:
- Partnership/channel pull:
- Current note: no conversion, retention, revenue lift, customer-demand, or partner-pull evidence was verified this week.

## 3. Product Decision Review

Accepted strategy to re-check:

- Address Life OS / Move Command Center remains the direction.
- Do not build AI from scratch.
- Surface/harden/monetize AI Move Briefing.
- Surface Provider Transition Workspace over existing MoveTask data.
- Package post-move monitoring as a retention surface.
- Use consented transition-outcome graph as the data moat.
- Defer partner-facing workspace and SEO-first strategy until validated.

Weekly decision:

- Keep:
  - Address Life OS / Move Command Center as the product direction.
  - Annual-first pricing and a single 14-day trial for new signups.
  - Default `control/off` posture for Phase-1 `ux_*` flags until QA and rollout approval.
- Change:
  - Treat Dokploy cron command execution as fixed but operationally watchlisted; future config changes must include explicit `locateflow-cron` restart/recreate.
  - Treat Product Brain docs as requiring live-state catch-up after each deploy/config/OTA action.
- Kill:
  - Public 90-day / 3-month Individual annual campaign promise for new signups.
- Needs Claude Product Judge:
  - Whether post-move monitoring remains the best next product build after cron, QA, and billing readiness close.
- Needs human approval:
  - Stripe/store dashboard verification, logged-in QA account use, feature-flag rollout, and any production config write.

## 4. Experiment Review

Top experiment queue: [[experiments/EXPERIMENT_BACKLOG]]
Experience queue: [[experience/EXPERIENCE_BACKLOG]]

For each active or proposed experiment:

- Hypothesis:
- Audience:
- Metric:
- Guardrail:
- Evidence collected:
- Result:
- Decision: keep / kill / iterate / ship / research more

Current active-experiment note:

- Phase-1 experiments are deployed but not yet measured.
- Logged-in dashboard QA, free-tier enforcement QA, on-device mobile OTA QA, and event-read verification remain pending.
- No experiment should be called successful until analytics and guardrails are read from the approved consent-gated pipeline.

## 5. Experience Review

Use [[experience/FRICTION_LOG]] and [[experience/AHA_MOMENT_MAP]] to keep UX decisions grounded.

- What was the clearest first value moment this week?
- Which friction point most threatened activation?
- Which friction point most threatened trust?
- Which friction point most threatened willingness to pay?
- Which aha moment should be made more visible?
- Which upgrade moment felt natural, and which felt premature?
- Did any UX copy risk implying automatic provider changes, official partnerships, or unverified AI authority?
- What should Claude UX Judge review next?

## 6. Revenue And Packaging Review

Packaging note: [[product/PRICING_AND_PACKAGING]]

- What did we learn about Pro/Family willingness to pay?
- Which UX moment created the strongest upgrade intent: briefing, provider transition, proof packet, monitoring, or household invite?
- Did any billing, upgrade, refund, or support risk appear?
- Are any pricing claims still unsupported?
- Does Stripe web remain the primary recommended upgrade path?
- Does mobile IAP need a separate review?

Current revenue note:

- Public web pricing and acquisition campaign were corrected to the annual-first 14-day trial policy.
- Stripe Dashboard price objects and mobile store price tiers were not fully verified in this pass and still require owner/dashboard review.
- Existing subscribers should not be assumed migrated; grandfathering remains the recommended default unless a separate billing migration is approved.

## 7. Growth Review

Growth note: [[growth/GROWTH_ENGINE]]

- Did household invites create useful activation?
- Did any second-member behavior suggest future move-owner potential?
- Are SEO tools still deferred?
- Is there verified partner pull yet?
- What acquisition claim is still unsupported?

## 8. Data Moat And Privacy Review

Moat note: [[product/DATA_MOAT_MAP]]
Event plan: [[experience/ANALYTICS_EVENT_PLAN]]

- Were any transition-outcome signals collected?
- Were they consented, coarse, and no-raw-PII?
- Did any signal violate the disallowed field list?
- What retention or deletion decision is still missing?
- What should not be collected?

## 9. Risk Review

Risk register: [[memory/RISK_REGISTER]]

- Did any existing risk change?
- Did any new product risk appear?
- Did AI, billing, provider, telemetry, or rules work introduce new review needs?
- What must be blocked until approval?

Current risk note:

- Production cron parsing risk is mitigated by the mounted runner and live tick verification, but cron reload remains an operations watch item.
- Still open from the technical risk register: app-start migrations, distributed rate-limit/step-up production readiness, and the mobile PKCE NOT NULL migration plan.
- Block growth/SEO push until billing readiness, logged-in QA, on-device mobile QA, and experiment-read verification are clean.

## 10. Next-Agent Routing

Update [[03_NEXT_AGENT_TASKS]] after answering:

- What should Codex prepare next?
- What should Claude Product Explorer explore next?
- What should Claude Product Judge decide next?
- What should Claude UX Judge decide next?
- What should be written back into Obsidian memory?

## 11. Handoff

Every meaningful weekly review should create a handoff under `docs/ai/handoffs/`.

Handoff should include:

- What changed.
- What stayed hypothesis.
- What was rejected.
- What needs approval.
- Recommended next prompt.
