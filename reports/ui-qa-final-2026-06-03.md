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
- Stripe QA/staging backend state now proves active, immediate-change, scheduled-downgrade, no-op, canceled-at-period-end, and inactive declined-payment subscription outcomes.
- Full Stripe plan-change matrix passed in QA/staging: 36 transitions / 36 passed.
- Production `/api/mobile/iap/products` returns six unique iOS and six unique Android SKU values.
- DigitalOcean deployment `22742904-4886-4c4b-822d-b32781786dc4` is ACTIVE and live smoke passed after the report push.

## Remaining UI Follow-Up

- Chrome-controlled visual verification is still blocked because the Codex Chrome Extension native pipe closes before responding even though Chrome, the extension, and the native host check as installed/enabled/correct. The pending downgrade web banner and admin pending-state screen need Chrome reconnection or manual inspection.
- The currently installed Android package on `emulator-5554` is not a Play-installed internal build (`installerPackageName=null`, `versionCode=1`), so real Play Billing UI cannot be proven from that device.
- Re-test active Stripe-managed Pro/Family state in the mobile UI from a store/internal build once Chrome/Play/App Store access or test credentials allow the flow.
