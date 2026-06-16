# Experiment Metrics

Updated: 2026-06-16

## Current Verified Metrics State

- No live PostHog dashboards, A/B reports, conversion reports, retention reports, revenue lift, churn, LTV, or customer-demand evidence were verified.
- Existing source supports internal usage events, sessions, admin analytics views, billing analytics, and feature flags.
- The first UX experiment metrics below are proposed and should not be treated as measured results.

## North-Star Metric

**Verified address transitions completed per active household.**

V1 proxy:

- `transition_task_completed` per active household in a weekly window.
- Stronger count when `proof_present = true`.

Active household proxy:

- A household with at least one of `signup_completed`, `first_address_added`, `first_service_added`, `moving_plan_created`, `ai_briefing_viewed`, `transition_workspace_viewed`, or `post_move_alert_clicked` in the window.

## Activation Metrics

| Metric | Definition | Why It Matters |
|---|---|---|
| Signup-to-onboarding start | `onboarding_started` / `signup_completed` | Measures setup pull. |
| First address activation | `first_address_added` / `signup_completed` | Measures Move Memory creation. |
| First service activation | `first_service_added` / `first_address_added` | Measures obligation capture. |
| Move intent activation | `moving_plan_created` / `first_service_added` | Measures transition intent. |
| First intelligence activation | `ai_briefing_viewed` / `signup_completed` within 24h | Measures first aha. |
| Briefing action rate | `ai_briefing_action_clicked` / `ai_briefing_viewed` | Measures whether briefing drives action. |
| First task completion | first `transition_task_completed` / `moving_plan_created` | Measures Move Operations progress. |

## Retention Metrics

| Metric | Definition | Window |
|---|---|---|
| D7 meaningful return | Household returns and triggers a meaningful move event after day 1 | 7 days |
| D30 meaningful return | Household returns and triggers a meaningful move event after day 1 | 30 days |
| Post-move alert engagement | `post_move_alert_clicked` / households with eligible monitoring items | Weekly |
| Monitoring-to-action | `post_move_alert_clicked` followed by `transition_task_completed` or `export_started` | 7 days |

Meaningful move events: `ai_briefing_viewed`, `ai_briefing_action_clicked`, `transition_workspace_viewed`, `transition_task_completed`, `household_invite_sent`, `export_started`, `post_move_alert_clicked`.

## Revenue/Upgrade Metrics

| Metric | Definition | Notes |
|---|---|---|
| Upgrade intent | `upgrade_clicked` / eligible surface views | Segment by `upgrade_surface`. |
| Checkout start | `checkout_started` / `upgrade_clicked` | Segment by `target_plan_tier`. |
| Subscription activation | `subscription_activated` / `checkout_started` | No prices, payment IDs, or Stripe IDs. |
| Paid feature follow-through | Paid feature event after `subscription_activated` | Use 7-day attribution. |

## Running Phase-1 Experiment Reads

No results are claimed here. These are the approved read definitions for the live `UserEvent` pipeline.

| Experiment | Exposure Event | Primary Read | Funnel/Revenue Context | Guardrail Read |
|---|---|---|---|---|
| Exp 1: Command Center dependability + de-noise | `ai_briefing_viewed` where `experiment_flag = ux_ai_briefing_experience_v1`, segmented by `variant`, `platform`, `surface`, `briefing_state`, and `briefing_mode`. | Variant should reduce `briefing_state = hidden` or `empty` and increase visible states: `content`, `fallback`, or `teaser`. | `ai_briefing_action_clicked / ai_briefing_viewed`; `upgrade_clicked` where `upgrade_surface = ai_briefing`; existing `checkout_started` and `subscription_started`/`trial_started` remain downstream context. | Privacy/support complaints, automation-confusion reports, and AI cost-cap ratio must not regress; no raw AI prompt/response is captured. |
| Exp 2: Point-of-action trust confirmation | `trust_copy_shown` where `experiment_flag = ux_trust_copy_v1`, segmented by `variant` and `transition_action_type`. | Coverage: trust copy should appear for `stop`, `start`, `transfer`, `cancel`, and `update` guided-action tasks in the variant. | Read alongside existing MoveTask completion lifecycle events by action type; do not infer external provider completion. | Task-completion reach-through for these action types must not materially drop; automation-confusion support reports should stay near zero. |
| Exp 3: Widen personalized onboarding teaser | `onboarding_teaser_viewed` where `experiment_flag = ux_onboarding_teaser_v1`, segmented by `variant`, `platform`, and `plan_tier`. | Variant should increase teaser exposure among destination+date users, including paid users where `plan_tier = unknown` if exact tier is unavailable. | Paid path: `onboarding_teaser_viewed -> moving_plan_started`; free path: `onboarding_teaser_viewed -> upgrade_clicked` where `upgrade_surface = onboarding_teaser`; existing `move_teaser_viewed` remains legacy free-only context. | Onboarding completion and 75th percentile time-to-complete must not regress; no free-user MovingPlan creation should occur from teaser exposure. |

## AI Move Briefing Experiment

Hypothesis: making AI Move Briefing more visible and trustworthy increases activation and upgrade intent.

Primary metric:

- `ai_briefing_viewed` within 24 hours of `signup_completed`.

Secondary metrics:

- `ai_briefing_action_clicked` per briefing view.
- `first_service_added` and `moving_plan_created` before/after briefing.
- `upgrade_clicked` from AI briefing surfaces.

Guardrails:

- AI confusion/support issues.
- Privacy complaints.
- AI cost/cap ratio.
- Increase in users believing LocateFlow made provider changes.

Decision rule:

- Continue if briefing action rate improves without privacy/trust guardrail failures.
- Roll back if trust, privacy, cost, or failure rates exceed the agreed threshold.

## Provider Transition Workspace Experiment

Hypothesis: a read-only board over existing MoveTask data will increase task completion and make Move Operations feel valuable.

Primary metric:

- `transition_task_completed` after `transition_workspace_viewed`.

Secondary metrics:

- `transition_workspace_viewed` after `moving_plan_created`.
- Time from `moving_plan_created` to first `transition_task_completed`.
- `household_invite_sent` from transition context.
- `upgrade_clicked` from transition context.

Guardrails:

- Provider-automation confusion.
- Support complaints that LocateFlow did not actually cancel/update a provider.
- Permission/household visibility issues.

Decision rule:

- Continue if transition completion improves and automation-confusion guardrail stays low.
- Roll back if users misunderstand the board as direct provider execution.

## Post-Move Monitoring Experiment

Hypothesis: packaging reminders and digests as a post-move monitoring surface improves D7/D30 retention and creates upgrade intent.

Primary metric:

- D7/D30 meaningful return among households with saved services or moving plans.

Secondary metrics:

- `post_move_alert_clicked`.
- `export_started` after alert click.
- `upgrade_clicked` from monitoring surface.

Guardrails:

- Notification opt-outs.
- Digest unsubscribe behavior.
- Users thinking LocateFlow monitors live external accounts.

Decision rule:

- Continue if meaningful return improves without notification fatigue or automation confusion.
- Roll back if alert clicks do not lead to meaningful action or create trust risk.

## Reporting Views

PostHog dashboards to create after implementation approval:

1. Activation funnel: signup -> onboarding -> address -> service -> plan -> briefing -> action.
2. Move Operations funnel: plan -> transition workspace -> task completed -> household invite -> export.
3. Revenue funnel: upgrade clicked -> checkout started -> subscription activated -> paid feature used.
4. Retention view: D7/D30 meaningful return and post-move alert click rate.
5. Guardrail view: event volume by flag, unknown/error fallback rates, privacy-safe property audit counts.

No dashboard should show raw user PII, raw addresses, raw provider account information, raw AI content, raw export content, or exact move/bill/contract dates.
