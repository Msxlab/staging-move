# LocateFlow PostHog Measurement Plan

Updated: 2026-06-15

## Scope And Evidence

This plan is for the first approved UX experiments:

1. AI Move Briefing experience hardening.
2. Provider Transition Workspace read-only v1.
3. Post-move monitoring surface.

Baseline docs read: [[experience/USER_JOURNEY_MAP]], [[experience/AHA_MOMENT_MAP]], [[experience/ANALYTICS_EVENT_PLAN]], [[experience/EXPERIENCE_BACKLOG]], [[product/PRODUCT_NORTH_STAR]], [[product/AI_MOVE_BRIEFING_SPEC]], [[product/PROVIDER_TRANSITION_WORKSPACE]], [[product/DATA_MOAT_MAP]], [[product/PRICING_AND_PACKAGING]], [[experiments/EXPERIMENT_BACKLOG]], and [[handoffs/20260615-144907-user-experience-intelligence-scan]].

No separate completed Claude UX Judge handoff was found in `docs/ai/handoffs`; the latest UX Judge-related file is the User Experience Intelligence Scan handoff, which contains the next Claude UX Judge prompt.

## Current Verified Instrumentation

- The web app has consent-gated analytics helpers that can send Google/GTM events when configured and accepted.
- The web app has consent-gated internal signed-in usage tracking through `/api/tracking/session` and `/api/tracking/event`.
- The mobile app has consent-gated batched analytics helpers that call `/api/tracking/event`.
- The database has `UserSession`, `UserEvent`, and `FeatureFlag` models.
- UserEvent volume is now governed by [[analytics/DATA_RETENTION_POLICY]]: retention defaults to dry-run, deletion requires `USER_EVENT_RETENTION_ENABLED=true`, and optional sampling is off by default.
- Existing source references verified events such as `sign_up_started`, `sign_up_completed`, `checkout_started`, `trial_started`, `subscription_started`, `onboarding_completed`, `moving_plan_started`, recommendation events, provider search/compare events, `PAGE_VIEW`, and MoveTask lifecycle events.
- Admin feature flags exist with `ALL`, `PERCENTAGE`, `USER_LIST`, and `PLAN` targeting plus admin step-up and audit logging.

## Proposed Instrumentation

- PostHog is proposed, not verified as installed or live.
- V1 should use the smallest possible PostHog event set: the 15 events in [[analytics/EVENT_TAXONOMY]].
- V1 should not use PostHog autocapture, session replay, heatmaps, raw form capture, or person profile enrichment.
- V1 should reuse existing consent behavior and metadata sanitization patterns.
- V1 should not duplicate every existing internal event; PostHog should receive only experiment and funnel events needed for activation, retention, revenue, and task-completion decisions.

## 1. North-Star Metric

Accepted north-star metric: **verified address transitions completed per active household**.

V1 measurement definition:

- Numerator: count of `transition_task_completed` events where `transition_action_type` is present and `task_status_after = completed`.
- Stronger numerator when available: count only completions with `proof_present = true`.
- Denominator: active households with at least one of `signup_completed`, `first_address_added`, `first_service_added`, or `moving_plan_created` in the measurement window.
- First reporting view: weekly active households and completed transition tasks per active household.

This is a measurement proxy until the product has a verified "confirmed-with-proof" artifact across transition tasks.

## 2. Activation Metrics

Primary activation metric:

- Percentage of new signups that reach `ai_briefing_viewed` within 24 hours of `signup_completed`.

Supporting activation metrics:

- `signup_completed` -> `onboarding_started`.
- `onboarding_started` -> `first_address_added`.
- `first_address_added` -> `first_service_added`.
- `first_service_added` -> `moving_plan_created`.
- `moving_plan_created` -> `ai_briefing_viewed`.
- `ai_briefing_viewed` -> `ai_briefing_action_clicked`.
- `moving_plan_created` -> first `transition_task_completed`.

Guardrail:

- Do not optimize for event volume if the user has not completed a meaningful address, service, plan, briefing, or task step.

## 3. Retention Metrics

Primary retention metric:

- Percentage of households with `moving_plan_created` that return and trigger any meaningful move event in D7 and D30 windows.

Meaningful move events:

- `ai_briefing_viewed`
- `ai_briefing_action_clicked`
- `transition_workspace_viewed`
- `transition_task_completed`
- `household_invite_sent`
- `export_started`
- `post_move_alert_clicked`

Post-move retention metric:

- Percentage of households that click at least one `post_move_alert_clicked` after move day or after transition setup, where move day is available.

Guardrail:

- Do not count generic page views as retention success for these experiments.

## 4. Revenue/Upgrade Metrics

Primary upgrade-intent metric:

- `upgrade_clicked` rate after exposure to AI Briefing, Provider Transition, post-move monitoring, household invite, or export/proof packet surfaces.

Revenue funnel:

- `upgrade_clicked` -> `checkout_started` -> `subscription_activated`.

Attribution windows:

- Same session.
- 24 hours.
- 7 days.

Plan guardrails:

- Track only coarse `plan_tier`, `billing_cycle`, and `upgrade_surface`.
- Do not send Stripe IDs, customer IDs, receipt IDs, checkout session IDs, prices, payment details, emails, names, or raw account identifiers.

## 5. AI Move Briefing Event Plan

Events:

- `ai_briefing_viewed`
- `ai_briefing_action_clicked`
- `upgrade_clicked`
- `checkout_started`
- `subscription_activated`

Allowed properties:

- `surface`: `dashboard`, `mobile_home`, `onboarding_complete`, `pricing_teaser`
- `briefing_mode`: `generated`, `rule_based`, `cached`, `gated`, `upgrade_required`, `error_fallback`, `unknown`
- `action_type`: `add_service`, `view_services`, `view_moving_plan`, `view_state_rules`, `upgrade`, `other`
- `plan_tier`: `free`, `individual`, `family`, `pro`, `unknown`
- `experiment_flag`: `ux_ai_briefing_experience_v1`
- `variant`: `control`, `source_explainer`, `upgrade_teaser`, `persistent_mobile`

Success metrics:

- Lift in `ai_briefing_viewed` within 24 hours of signup.
- Lift in `ai_briefing_action_clicked` per briefing view.
- Lift in `upgrade_clicked` after briefing view for gated users.

Guardrails:

- No raw AI prompt or response text.
- No raw address, provider account, email, name, phone, or free-text user input.
- No claim that AI performed provider changes.

## 6. Provider Transition Workspace Event Plan

Events:

- `transition_workspace_viewed`
- `transition_task_completed`
- `household_invite_sent`
- `upgrade_clicked`

Allowed properties:

- `surface`: `moving_plan`, `transition_workspace`, `dashboard`
- `transition_action_type`: `stop_service`, `start_service`, `transfer_service`, `update_address`, `cancel_or_close`, `shop_provider`, `find_replacement`, `keep`, `needs_decision`, `other`
- `task_status_before`: `new`, `accepted`, `in_progress`, `completed`, `dismissed`, `reopened`, `unknown`
- `task_status_after`: `completed`, `dismissed`, `reopened`, `unknown`
- `provider_category`: approved service category enum only; no provider account details.
- `state`: two-letter state only when already available and consented.
- `assignee_role`: `owner`, `admin`, `member`, `child`, `view_only`, `unassigned`, `unknown`
- `proof_present`: boolean.
- `experiment_flag`: `ux_transition_workspace_v1`
- `variant`: `control`, `read_only_board`

Success metrics:

- Lift in transition-task completion after workspace view.
- Lift in household invite sending after transition workspace exposure.
- Reduction in time from moving plan created to first transition task completed.

Guardrails:

- No provider credentials, account numbers, confirmation numbers, raw notes, or document contents.
- Copy and events must not imply auto-sync, verified sync, or live provider account changes.

## 7. Post-Move Monitoring Event Plan

Events:

- `post_move_alert_clicked`
- `first_service_added`
- `export_started`
- `upgrade_clicked`

Allowed properties:

- `surface`: `dashboard`, `notifications`, `daily_digest`, `service_detail`, `mobile_home`
- `alert_type`: `bill`, `contract`, `renewal`, `task`, `lifecycle`, `service_review`, `unknown`
- `service_category`: approved service category enum only.
- `days_bucket`: `overdue`, `0_7`, `8_14`, `15_30`, `31_60`, `60_plus`, `unknown`
- `plan_tier`: `free`, `individual`, `family`, `pro`, `unknown`
- `experiment_flag`: `ux_post_move_monitoring_v1`
- `variant`: `control`, `monitoring_card`, `digest_link`

Success metrics:

- Lift in D7/D30 meaningful return after moving plan creation.
- Lift in `post_move_alert_clicked` per household with saved services.
- Lift in `upgrade_clicked` after monitoring exposure.

Guardrails:

- Monitoring means saved records and reminders, not live external account monitoring.
- Do not send bill amounts, account numbers, due dates as raw dates, provider account data, or contract details.

## 8. Feature Flags Needed

First experiment flags:

1. `ux_ai_briefing_experience_v1`
2. `ux_transition_workspace_v1`
3. `ux_post_move_monitoring_v1`

Flag principles:

- Default off.
- Support `PERCENTAGE`, `USER_LIST`, and `PLAN` targeting through the existing admin feature flag substrate if source implementation confirms runtime read support.
- Every flag must have an immediate rollback path.
- PostHog exposure should be recorded only after the user is actually eligible for the flagged surface.
- Do not use feature flags to bypass entitlement, permission, or consent checks.

## 9. Privacy Guardrails

- Respect analytics consent on web and mobile.
- Do not enable PostHog autocapture, session replay, heatmaps, raw form capture, or external enrichment in v1.
- Do not send raw addresses, street, ZIP/postal code, latitude/longitude, account numbers, confirmation numbers, emails, phone numbers, names, customer IDs, Stripe IDs, OAuth IDs, database IDs, secrets, tokens, raw search queries, free-text notes, support messages, export contents, documents, AI prompts, or AI responses.
- Use only coarse enums, booleans, buckets, and two-letter state where explicitly allowed.
- Prefer a pseudonymous analytics subject ID or session ID over raw app user IDs.
- Keep PostHog property allowlists in code and tests.
- Treat every event as user data that must respect deletion/export/retention policy.
- Keep the retention/sampling policy in [[analytics/DATA_RETENTION_POLICY]] current before adding new high-frequency events.

## 10. Events To Avoid For Now

- Generic dashboard widget impressions.
- Every page view in PostHog.
- Every form-field change.
- Raw provider search queries.
- AI prompt submitted.
- AI response generated.
- Export completed with file contents.
- Notification sent.
- Email opened.
- Session recording started.
- Provider account connected.
- Provider account changed.
- Partner lead sent.
- Revenue amount captured.
- Exact move date, exact bill date, exact contract date, exact address, or exact geolocation.

## 11. First Implementation Prompt For Codex After Approval

```text
Work only inside C:\Users\Windows\Documents\move-main\move-main.

Implement the approved PostHog measurement foundation for the first LocateFlow UX experiments.

Rules:
- Do not read .env, secrets, credentials, tokens, private keys, customer data, or production data.
- Do not deploy, push, run migrations, install packages, or change infrastructure without explicit approval.
- Before modifying source, inspect the existing analytics, consent, UserEvent, and FeatureFlag implementation.
- Keep analytics consent-gated.
- Do not enable PostHog autocapture, session replay, heatmaps, raw form capture, or person enrichment.
- Do not send raw addresses, names, emails, phone numbers, account numbers, confirmation numbers, Stripe IDs, OAuth IDs, database IDs, secrets, tokens, raw search queries, notes, documents, export contents, AI prompts, or AI responses.

Goal:
Create a minimal PostHog-compatible analytics adapter and feature-flag exposure plan for the first 15 events in docs/ai/analytics/EVENT_TAXONOMY.md and the three flags in docs/ai/analytics/FEATURE_FLAGS.md.

Implementation scope:
1. Add a typed event-name and property allowlist for the first 15 events only.
2. Add tests proving disallowed PII keys and values are dropped before any event leaves the app.
3. Add a disabled-by-default PostHog destination that only runs when configured and analytics consent is granted.
4. Preserve existing internal UserEvent tracking.
5. Add feature-flag exposure tracking only for ux_ai_briefing_experience_v1, ux_transition_workspace_v1, and ux_post_move_monitoring_v1.
6. Instrument only the smallest approved surface for the first experiment, starting with AI Move Briefing if no newer human decision changes priority.

Stop and report before enabling any production runtime config, changing billing copy, changing entitlement behavior, or adding more events.
```
