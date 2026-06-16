# Event Taxonomy

Updated: 2026-06-16

## Current Verified Instrumentation

- Web: consent-gated `trackEvent`, `trackPageView`, `trackSearch`, `trackClick`, `trackFormSubmit`, `trackFeatureUse`, and `trackExport` helpers.
- Web: signed-in internal event batching to `/api/tracking/event`.
- Mobile: consent-gated batched `trackEvent` and `trackScreenView` helpers.
- API: `/api/tracking/event` sanitizes metadata and writes `UserEvent`.
- API: `/api/tracking/session` creates/updates `UserSession`.
- Database: `UserEvent.event` is limited to 50 chars; `UserEvent.page` to 200 chars; metadata is stored as JSON text.
- Existing source-observed events include `sign_up_started`, `sign_up_completed`, `checkout_started`, `trial_started`, `subscription_started`, `onboarding_completed`, `moving_plan_started`, `ai_briefing_viewed`, `ai_briefing_action_clicked`, `trust_copy_shown`, `onboarding_teaser_viewed`, `upgrade_clicked`, recommendation events, provider search/compare events, `PAGE_VIEW`, `SEARCH`, `BUTTON_CLICK`, `FORM_SUBMIT`, `FEATURE_USE`, `EXPORT`, and MoveTask lifecycle events.

PostHog is not verified as installed or live. Live events below mean persisted through the existing consent-gated `trackEvent` -> `/api/tracking/event` -> `UserEvent` pipeline, not PostHog.

Volume guardrail: [[analytics/DATA_RETENTION_POLICY]] defines the `UserEvent` retention dry-run, enable switch, and optional non-experiment sampling policy. Phase-1 experiment events stay at 100%.

## First Product Events

| Event | Status | Product Question | Trigger | Primary Metric |
|---|---|---|---|---|
| `signup_completed` | Proposed canonical. Existing web equivalent: `sign_up_completed`. | Did the user enter the funnel? | Account signup succeeds. | Signup count. |
| `onboarding_started` | Proposed. Internal onboarding progress events exist. | Does setup begin after signup? | Onboarding first meaningful screen starts. | Signup -> onboarding start. |
| `first_address_added` | Proposed. | Did the user create Move Memory? | First address record is saved. | Signup -> first address. |
| `first_service_added` | Proposed. | Did the user add a provider/service obligation? | First service record is saved. | First address -> first service. |
| `moving_plan_created` | Proposed canonical. Existing web event: `moving_plan_started`. | Did the user create move intent? | Moving plan creation succeeds. | First service -> moving plan. |
| `ai_briefing_viewed` | Live for Phase 1. | Did the user reach the first intelligence aha, fallback, teaser, or hidden diagnostic state? | Briefing card/surface resolves on web/mobile. | Briefing state mix and activation. |
| `ai_briefing_action_clicked` | Live for Phase 1. | Did the briefing drive action? | User clicks a briefing next action. | Briefing view -> action click. |
| `transition_workspace_viewed` | Proposed. | Did the user reach Move Operations? | Transition board/workspace is viewed. | Plan -> workspace view. |
| `transition_task_completed` | Proposed canonical. Existing API records MoveTask complete events. | Did transition work get done? | User completes a transition task. | North-star proxy. |
| `household_invite_sent` | Proposed. | Did collaboration/growth loop start? | User sends a household invite. | Invite rate. |
| `export_started` | Proposed canonical. Existing internal `EXPORT` helper exists. | Did proof/record value appear? | User starts an export/proof packet flow. | Proof intent. |
| `trust_copy_shown` | Live for Phase 1. | Did point-of-action trust copy appear for guided provider tasks? | Moving-plan task trust legal line renders for supported transition action types. | Trust-copy display coverage. |
| `upgrade_clicked` | Live for Phase 1 AI briefing/onboarding teaser surfaces; broader canonical use proposed. | Did a paid moment create intent? | User clicks upgrade from a feature surface. | Upgrade intent rate. |
| `checkout_started` | Current source-observed web event; include in PostHog plan. | Did upgrade intent reach checkout? | Checkout start request begins. | Upgrade -> checkout. |
| `subscription_activated` | Proposed canonical. Existing web equivalents: `trial_started`, `subscription_started`. | Did revenue activate? | Paid/trial subscription becomes active. | Checkout -> activation. |
| `post_move_alert_clicked` | Proposed. | Does monitoring bring users back? | User clicks a post-move alert/digest/reminder. | Retention. |

## Common Property Allowlist

Use these properties where relevant. Avoid arbitrary metadata.

| Property | Allowed Values | Notes |
|---|---|---|
| `platform` | `web`, `pwa`, `ios`, `android`, `unknown` | Coarse platform only. |
| `surface` | `onboarding`, `dashboard`, `mobile_home`, `moving_plan`, `transition_workspace`, `services`, `settings_export`, `notifications`, `daily_digest`, `pricing`, `subscription`, `unknown` | No raw URL required. |
| `plan_tier` | `free`, `individual`, `family`, `pro`, `unknown` | No prices or subscription IDs. |
| `workspace_role` | `owner`, `admin`, `member`, `child`, `view_only`, `unknown` | No user IDs or emails. |
| `experiment_flag` | `ux_ai_briefing_experience_v1`, `ux_trust_copy_v1`, `ux_onboarding_teaser_v1`, `ux_transition_workspace_v1`, `ux_post_move_monitoring_v1`, `none` | First UX experiment flags. |
| `variant` | `control`, `variant`, `source_explainer`, `upgrade_teaser`, `persistent_mobile`, `read_only_board`, `monitoring_card`, `digest_link`, `unknown` | Keep values closed. |
| `state` | two-letter state or `unknown` | Allowed only when already present and consented. |
| `source` | `direct`, `dashboard`, `briefing`, `recommendation`, `notification`, `digest`, `pricing`, `export`, `unknown` | No raw referrer. |

## Event-Specific Property Allowlist

| Event | Allowed Additional Properties |
|---|---|
| `signup_completed` | `method`: `email`, `google`, `apple`, `unknown` |
| `onboarding_started` | `entrypoint`: `signup`, `returning_user`, `mobile`, `unknown` |
| `first_address_added` | `address_role`: `current`, `destination`, `other`, `unknown`; `housing_type`: coarse enum only |
| `first_service_added` | `service_category`; `source` |
| `moving_plan_created` | `move_type`: `local`, `state_to_state`, `unknown`; `move_timing_bucket`: `0_7`, `8_30`, `31_60`, `60_plus`, `unknown` |
| `ai_briefing_viewed` | `briefing_mode`: `ai_generated`, `rule_based`, `gated_teaser`, `unknown`; `briefing_state`: `content`, `fallback`, `gated`, `teaser`, `hidden`, `empty` |
| `ai_briefing_action_clicked` | `action_type`: `service_category`, `services`, `state_rule`, `plan`, `unknown`; `briefing_mode` |
| `transition_workspace_viewed` | `task_count_bucket`; `completed_count_bucket`; `lane_count_bucket` |
| `transition_task_completed` | `transition_action_type`; `task_status_before`; `task_status_after`; `provider_category`; `assignee_role`; `proof_present` |
| `trust_copy_shown` | `transition_action_type`: `stop`, `start`, `transfer`, `cancel`, `update`, `unknown` |
| `household_invite_sent` | `invite_surface`; `invite_count_bucket`; `target_role`: `admin`, `member`, `view_only`, `unknown` |
| `export_started` | `export_type`: `account`, `address_pdf`, `dossier_pdf`, `tax_property`, `proof_packet`, `unknown`; `step_up_required`: boolean |
| `upgrade_clicked` | `upgrade_surface`: `ai_briefing`, `onboarding_teaser`, `pro_showcase`, `subscription`, `unknown`; `target_plan_tier`; `feature_gate`: `ai_briefing`, `onboarding_teaser`, `move_plan`, `pro_showcase`, `unknown` |
| `checkout_started` | `target_plan_tier`; `billing_cycle`: `monthly`, `yearly`, `unknown`; `has_trial`: boolean |
| `subscription_activated` | `target_plan_tier`; `billing_cycle`; `activation_type`: `trial`, `paid`, `iap`, `unknown` |
| `post_move_alert_clicked` | `alert_type`; `service_category`; `days_bucket` |

## Events Avoided In V1

- `dashboard_widget_viewed`
- `page_view` in PostHog
- `form_field_changed`
- `ai_prompt_submitted`
- `ai_response_generated`
- `notification_sent`
- `email_opened`
- `provider_account_connected`
- `provider_account_changed`
- `partner_lead_sent`
- `export_completed_with_contents`
- `session_recording_started`

## Naming Rules

- Use lower snake_case.
- Keep names under 50 characters for compatibility with current `UserEvent.event`.
- Use one event per meaningful action, not one event per UI component.
- Prefer canonical event names above; if existing events differ, map them in the adapter rather than double-counting.
