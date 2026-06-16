# PostHog Measurement Plan Handoff

## Current Verified Instrumentation

- Web analytics helpers are consent-gated and support Google/GTM when configured.
- Web and mobile have internal signed-in event batching to `/api/tracking/event`.
- `/api/tracking/event` sanitizes metadata before writing `UserEvent`.
- `/api/tracking/session` writes consent-gated `UserSession` records.
- The database includes `UserSession`, `UserEvent`, and `FeatureFlag`.
- Admin feature flags support reversible targeting with step-up and audit logging.
- PostHog is not verified as installed, configured, or live; it is proposed only.

## Input Docs Used

- [[experience/USER_JOURNEY_MAP]]
- [[experience/AHA_MOMENT_MAP]]
- [[experience/ANALYTICS_EVENT_PLAN]]
- [[experience/EXPERIENCE_BACKLOG]]
- [[experience/AI_MOVE_BRIEFING_EXPERIENCE]]
- [[experience/PROVIDER_TRANSITION_EXPERIENCE]]
- [[experience/POST_MOVE_MONITORING_EXPERIENCE]]
- [[product/PRODUCT_NORTH_STAR]]
- [[product/AI_MOVE_BRIEFING_SPEC]]
- [[product/PROVIDER_TRANSITION_WORKSPACE]]
- [[product/DATA_MOAT_MAP]]
- [[product/PRICING_AND_PACKAGING]]
- [[experiments/EXPERIMENT_BACKLOG]]
- [[handoffs/20260615-144907-user-experience-intelligence-scan]]

No separate completed Claude UX Judge handoff was found; the latest UX Judge-related handoff is the User Experience Intelligence Scan handoff.

## Created Docs

- [[analytics/POSTHOG_MEASUREMENT_PLAN]]
- [[analytics/EVENT_TAXONOMY]]
- [[analytics/FEATURE_FLAGS]]
- [[analytics/EXPERIMENT_METRICS]]
- [[handoffs/20260615-150007-posthog-measurement-plan]]

## Proposed First 15 Events

1. `signup_completed`
2. `onboarding_started`
3. `first_address_added`
4. `first_service_added`
5. `moving_plan_created`
6. `ai_briefing_viewed`
7. `ai_briefing_action_clicked`
8. `transition_workspace_viewed`
9. `transition_task_completed`
10. `household_invite_sent`
11. `export_started`
12. `upgrade_clicked`
13. `checkout_started`
14. `subscription_activated`
15. `post_move_alert_clicked`

## Proposed First 3 Feature Flags

1. `ux_ai_briefing_experience_v1`
2. `ux_transition_workspace_v1`
3. `ux_post_move_monitoring_v1`

## Measurement Summary

- North-star metric: verified address transitions completed per active household.
- V1 north-star proxy: `transition_task_completed` per active household, stronger when `proof_present = true`.
- Activation focus: signup -> onboarding -> address -> service -> plan -> briefing -> action.
- Retention focus: D7/D30 meaningful return and post-move alert clicks.
- Revenue focus: upgrade clicked -> checkout started -> subscription activated.
- Task-completion focus: transition workspace view -> transition task completed.

## Privacy Risks

- Sending raw addresses, ZIPs, exact geolocation, exact dates, provider account data, confirmation numbers, names, emails, phone numbers, Stripe IDs, OAuth IDs, app database IDs, secrets, tokens, documents, export contents, raw AI prompts, or raw AI responses.
- Turning on PostHog autocapture, session replay, heatmaps, or raw form capture.
- Duplicating every existing internal event into PostHog and creating noisy or unnecessary user-data collection.
- Using feature flags to bypass analytics consent, permissions, entitlements, or AI/provider safety gates.
- Mislabeling post-move monitoring as live external account monitoring.

## Needs Human Approval

- Any source-code change.
- Installing or enabling PostHog packages/config.
- Persisting new telemetry destinations.
- Enabling feature flags in any environment.
- Changing billing, checkout, subscription, or entitlement behavior.
- Adding events outside the first 15 event taxonomy.

## Exact Codex Implementation Prompt

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
