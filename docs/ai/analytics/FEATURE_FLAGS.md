# Feature Flags

Updated: 2026-06-15

## Current Verified Flag Substrate

- The database has a `FeatureFlag` model with `name`, `enabled`, `targetType`, and `targetValue`.
- Admin feature-flag APIs support `ALL`, `PERCENTAGE`, `USER_LIST`, and `PLAN` targeting.
- Feature-flag mutations require admin permissions, password confirmation, MFA/backup code support, and audit logging.
- Existing product docs reference runtime config and feature flags as reversible kill-switch patterns.
- This plan does not verify a shared client/server feature-flag evaluator for the proposed UX flags; that must be checked before source implementation.

## Proposed First 3 Experiment Flags

| Flag | Default | Targeting | Experiment | Variants | Rollback |
|---|---:|---|---|---|---|
| `ux_ai_briefing_experience_v1` | Off | `PERCENTAGE`, `USER_LIST`, `PLAN` | AI Move Briefing visibility/source/upgrade teaser | `control`, `source_explainer`, `upgrade_teaser`, `persistent_mobile` | Disable flag; preserve existing briefing behavior. |
| `ux_transition_workspace_v1` | Off | `PERCENTAGE`, `USER_LIST`, `PLAN` | Read-only Provider Transition board over MoveTask data | `control`, `read_only_board` | Disable flag; route users to existing moving plan task list. |
| `ux_post_move_monitoring_v1` | Off | `PERCENTAGE`, `USER_LIST`, `PLAN` | Post-move monitoring card/digest surface | `control`, `monitoring_card`, `digest_link` | Disable flag; preserve existing reminders/notifications. |

## Exposure Event Rule

Record feature-flag exposure only when all are true:

- The user has analytics consent.
- The user is eligible for the surface.
- The flagged UI path is actually evaluated.
- The exposure property set contains no raw PII.

Recommended exposure event shape:

- Use the product event being measured, not a separate high-volume exposure stream, where possible.
- Attach `experiment_flag` and `variant` to the first meaningful event on that surface.
- If a separate exposure event becomes necessary later, propose it in a new docs-only review first.

## Targeting Guidance

- Start with `USER_LIST` for internal QA only.
- Move to small `PERCENTAGE` rollout only after QA and privacy tests pass.
- Use `PLAN` targeting only when measuring entitlement or upgrade experiences.
- Do not target by raw address, city, ZIP, provider name, email, name, phone, account data, or payment data.

## Flag-Specific Metrics

### `ux_ai_briefing_experience_v1`

- Primary: `ai_briefing_viewed` within 24 hours of signup.
- Secondary: `ai_briefing_action_clicked` per briefing view.
- Revenue: `upgrade_clicked` after briefing teaser.
- Guardrail: privacy complaints, AI confusion, support issues, AI cost/cap ratio.

### `ux_transition_workspace_v1`

- Primary: `transition_task_completed` after workspace view.
- Secondary: `household_invite_sent`.
- Revenue: `upgrade_clicked` from transition workspace.
- Guardrail: provider-automation confusion and failed-provider expectations.

### `ux_post_move_monitoring_v1`

- Primary: D7/D30 meaningful return after move plan creation.
- Secondary: `post_move_alert_clicked`.
- Revenue: `upgrade_clicked` from monitoring surface.
- Guardrail: notification fatigue, unsubscribe/opt-out behavior, automation confusion.

## Privacy And Safety Rules

- Feature flags must not override analytics consent.
- Feature flags must not override billing entitlements.
- Feature flags must not make provider connector calls in these v1 experiments.
- Feature flags must not reveal hidden data across household/workspace permissions.
- Feature flags must not enable AI generation unless existing AI gates, caps, fallbacks, and human approvals are satisfied.
