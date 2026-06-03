# LocateFlow Google Play Verification Final - 2026-06-03

## Scope

Verified Google Play subscription catalog, Google Cloud API readiness, service-account access, and RTDN setup status without performing a Play rollout, production release, payment, or secret rotation.

## Verified

- Play Console subscriptions match live `/api/mobile/iap/products`.
- All six Android products exist:
  - `locateflow_individual_monthly`
  - `locateflow_individual_annual`
  - `locateflow_family_monthly`
  - `locateflow_family_annual`
  - `locateflow_pro_monthly`
  - `locateflow_pro_annual`
- Each subscription shows one active base plan.
- Google Cloud project is connected to the Play Console app.
- Android Publisher API is enabled.
- Pub/Sub API is enabled.
- Topic `play-rtdn` exists.
- Google Play notification publisher principal has Publisher access on the `play-rtdn` topic.
- Google Play service account `locateflow-play-api` was created and has active app-scoped access in Play Console.

## Blocked

- Service-account JSON key creation is blocked by Google organization policy `iam.disableServiceAccountKeyCreation`.
- No private key was downloaded or added to DigitalOcean.
- DigitalOcean still needs the Google Play service account credential env values before Android purchase verification can pass.
- Play RTDN topic value was not saved in Play Console because the custom console input could not be filled reliably through Chrome automation.
- No Pub/Sub push subscription was created for the live webhook endpoint.
- Expected RTDN identity env values were not added to DigitalOcean because the Play RTDN push identity is not finalized.

## Launch Impact

Android products are catalog-ready, but Android paid IAP is not production-ready until Google credential provisioning and RTDN delivery are completed and verified.
