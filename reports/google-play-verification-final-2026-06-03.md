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
- Minimal Android Publisher OAuth refresh-token fallback was implemented and deployed because service-account key creation is blocked by organization policy.
- DigitalOcean now has the Google Play OAuth fallback env keys configured. Values are intentionally not recorded.
- Live deployment for the OAuth fallback reached ACTIVE.
- Live `/api/ready` returns HTTP 200 with `ready: true`.
- Live `/api/mobile/iap/products` returns all six iOS and Android product IDs.
- Live fake Android purchase verification fails closed with JSON HTTP 424 `IAP_PROVIDER_UNAVAILABLE`, not `IAP_NOT_CONFIGURED`, and no secret-like values in the response.
- Play Console RTDN topic value was saved as `projects/project-20494d44-c9e3-4fc2-9f4/topics/play-rtdn`; Save changes became disabled after saving.

## Blocked

- Service-account JSON key creation remains blocked by Google organization policy `iam.disableServiceAccountKeyCreation`; this is now handled by the OAuth fallback rather than a launch blocker for Android Publisher auth.
- Fake-token Android verification reaches the Google Publisher dependency path and fails closed as provider unavailable. A real internal-test Play purchase token is still needed to prove successful paid entitlement activation end to end.
- Pub/Sub push subscription was not created because the signed-in Google Cloud account is missing `pubsub.subscriptions.create` and `serviceusage.services.list`.
- Required next permission/action: grant the current Google Cloud account `roles/pubsub.editor` or `roles/pubsub.admin` on project `project-20494d44-c9e3-4fc2-9f4`, then create the push subscription.
- RTDN subscription target remains:
  - Topic: `projects/project-20494d44-c9e3-4fc2-9f4/topics/play-rtdn`
  - Push endpoint: `https://locateflow.com/api/webhooks/playstore`
  - OIDC audience: `https://locateflow.com/api/webhooks/playstore`
  - OIDC service account: the existing expected Play API service account in DigitalOcean.

## Launch Impact

Android products and backend auth are ready for internal paid-IAP testing, but Android paid IAP is not production-ready until RTDN push delivery is completed and a real internal-test purchase verifies entitlement activation.
