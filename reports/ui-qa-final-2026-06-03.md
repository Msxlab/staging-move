# LocateFlow UI QA Final - 2026-06-03

## Scope

Verified the UI states that were at risk during release readiness: pricing, client subscription, admin connectors/sidebar, client connections, and Android mobile subscription visibility.

## Verified

- Public pricing page shows Individual, Family, and Pro in both Monthly and Annual tabs.
- Client subscription page shows plan cards, Pro annual sync copy, and terms gating.
- Admin connectors page shows the deployed expanded sidebar and connector metrics/catalog state.
- Client connections page matches admin connector state: no registered/enabled connector control-plane row means no partner connections are shown to the client.
- Android mobile subscription screen opens from `More -> Subscription`.
- Android local QA build shows Individual, Family, and Pro cards while purchases are disabled/read-only.
- No visible overlap or missing Family/Pro card was observed in the Android subscription screenshot.

## Remaining UI Follow-Up

- Re-test mobile subscription UI after the latest register response/mobile auto-login patch is deployed, so exact QA account signup reaches the authenticated path without manual API onboarding.
- Re-test an active paid Pro Annual/Family state on mobile after a safe staging/test entitlement path exists or admin step-up credentials are provided.
