# LocateFlow UI QA Final - 2026-06-03

## Scope

Verified the UI states that were at risk during release readiness: pricing, client subscription, admin connectors/sidebar, client connections, Android mobile subscription visibility, and backend-proven pending subscription states.

## Verified

- Public pricing page shows Individual, Family, and Pro in both Monthly and Annual tabs.
- Client subscription page shows plan cards, Pro annual sync copy, and terms gating.
- Admin connectors page shows the deployed expanded sidebar and connector metrics/catalog state.
- Client connections page matches admin connector state: no registered/enabled connector control-plane row means no partner connections are shown to the client.
- Android mobile subscription screen opens from `More -> Subscription`.
- Android local QA build shows Individual, Family, and Pro cards while purchases are disabled/read-only.
- No visible overlap or missing Family/Pro card was observed in the Android subscription screenshot.
- Play-installed Android internal build `15 (1.0.0)` opens the subscription screen and launches the Google Play Billing sheet for `Individual Annual` at `$39.99/year`.
- After License testing was saved for tester list `LOCATEFLOW`, the Google Play Billing sheet showed `Test card, always approves` and the no-charge test subscription notice.
- Android build `15` completed the Individual Annual purchase through Google Play test Billing and showed `Individual Annual` as current plan.
- Android build `15` restore purchases showed the expected `Restored` alert.
- Android build `15` cancellation through Google Play returned the app to `CANCEL_AT_PERIOD_END` while keeping Individual Annual access active until the period end.
- A web/Stripe-managed `Individual Monthly` account shows the expected mobile read-only/manage-on-web state instead of offering duplicate native purchase actions.
- Stripe QA/staging backend state now proves active, immediate-change, scheduled-downgrade, no-op, canceled-at-period-end, and inactive declined-payment subscription outcomes.
- Full Stripe plan-change matrix passed in QA/staging: 36 transitions / 36 passed.
- Production `/api/mobile/iap/products` returns six unique iOS and six unique Android SKU values.
- DigitalOcean deployment `22742904-4886-4c4b-822d-b32781786dc4` is ACTIVE and live smoke passed after the report push.

## Remaining UI Follow-Up

- Chrome-controlled visual verification is still blocked because the Codex Chrome Extension native pipe closes before responding even though Chrome, the extension, and the native host check as installed/enabled/correct. The pending downgrade web banner and admin pending-state screen need Chrome reconnection or manual inspection.
- Play-installed build `15` still shows older `Renews {{date}}` copy beside `CANCEL_AT_PERIOD_END`; local mobile code now switches that summary to `Ends {{date}}`, pending the next mobile build/update.
- Re-test active Stripe-managed Pro/Family state in the mobile UI if production admin grants are intentionally performed; the current live visual proof is web/Stripe-managed Individual Monthly.
