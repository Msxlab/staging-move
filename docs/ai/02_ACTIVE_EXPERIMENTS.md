# Active Experiments

Backlinks: [[00_PRODUCT_BRAIN_DASHBOARD]], [[01_ACTIVE_STRATEGY]]

Source: [[handoffs/2026-06-15-150958-claude-ux-judge]]

## 2026-06-18 Live Status

- Phase-1 source work is merged to `main` and production deploy is at
  `df5307ef8bff1387bf775df76d690be4284a0f6a`.
- `main` also contains docs-only cron runbook merge `e6f3f9cdaeda568a186cfa7bf0795f3de22b74c6`; no experiment behavior changed in that docs-only follow-up.
- Mobile OTA for runtime `sdk55-1.0.0` was published to production in update
  group `8303c581-4450-4ce0-9cc0-c78fdde17cf4`.
- All `ux_*` experiment flags should still be treated as default
  `control/off` unless a separate feature-flag rollout is explicitly approved.
- No experiment results are claimed. Logged-in QA, on-device mobile QA,
  feature-flag rollout decisions, and analytics reads are still pending.

| status | hypothesis | audience | primary metric | guardrail metric | rollback | approval gate |
|---|---|---|---|---|---|---|
| Running behind `ux_ai_briefing_experience_v1` (`control` default, `variant` new behavior). | Command Center dependability + de-noise: if the briefing reliably renders fallback/teaser states and Command Center + Next Critical Actions + briefing are pinned above reference widgets, the first-session intelligence spine becomes clearer without depending on an AI key. | Dashboard users across web/mobile, especially free/Individual users and keyless/fetch-fail/no-critical states where the briefing can hide. | `briefing_state` hidden-rate where content exists, plus session-1 `first_meaningful_action` from the activation funnel. | Support tickets, refunds, privacy complaints, automation-confusion reports, and AI cost-cap ratio must not regress. | Feature flag off restores current briefing hide behavior and default widget order. | Explicit human approval for source-code changes, the feature flag, and any telemetry persistence; no AI-key change in this experiment. |
| Running behind `ux_trust_copy_v1` (`control` default, `variant` new behavior). | Point-of-action trust confirmation: if stop/start/transfer/cancel completion always shows "LocateFlow only" and provider-account-unchanged guided-action copy, automation confusion falls without materially reducing task completion. | Users completing MoveTask action types stop, start, transfer, or cancel; briefing viewers seeing provenance/disclaimer copy. | Trust-copy display coverage for the four action types plus completion flow reach-through for those tasks. | Task-completion rate on those action types must not drop materially; automation-confusion support tickets should stay near zero. | Reversible flag restores current conditional rendering and prior copy. | Explicit human approval for source-code/copy changes; legal/trust copy must avoid auto-sync, verified-sync, official-partner, or provider-offer claims. |
| Running behind `ux_onboarding_teaser_v1` (`control` default, `variant` new behavior). | Widen personalized onboarding teaser: if every user who enters destination + move date sees the engine-computed countdown and top-5 critical steps, first-session activation improves by showing value before the ask. | Everyone who enters destination + move date, not only the current `wantsToMove && !isPremium` cohort. | `teaser_viewed -> first_meaningful_action` within session 1. | Onboarding completion, upgrade complaints, refunds, privacy complaints, and support volume must not regress. | One-condition feature flag off restores the current cohort rule. | Explicit human approval for source-code changes and any measurement persistence; no billing-copy change. |
