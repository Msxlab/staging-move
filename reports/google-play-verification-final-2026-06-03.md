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
- Pub/Sub push subscription `play-rtdn-locateflow-webhook` is active on topic `play-rtdn`.
- Push endpoint is `https://locateflow.com/api/webhooks/playstore`.
- Push OIDC audience is `https://locateflow.com/api/webhooks/playstore`.
- Push OIDC service account matches the expected DigitalOcean identity; values intentionally not recorded.
- DigitalOcean RTDN env values match the final endpoint/audience/service account, so no redeploy or restart was needed.
- Invalid RTDN delivery fails closed:
  - Missing bearer: HTTP 401 `Missing OIDC token`.
  - Fake bearer: HTTP 401 `Invalid OIDC token`.
- Valid RTDN-format delivery through Google Cloud Pub/Sub reached the live webhook; DigitalOcean run logs showed `[PLAYSTORE WEBHOOK] received TEST notification`.
- EAS Android `play-internal` build `9d3c92a9-5e58-4eac-ba12-79bd63065081` remains `FINISHED` for versionCode `15`.
- Android internal track submit was attempted safely for build `15` and stopped before upload:
  - EAS non-interactive submit requires Google service-account key setup.
  - Direct Android Publisher OAuth upload could not use DigitalOcean app spec `SECRET` placeholders as OAuth secrets.
  - `gcloud` is not installed locally, so no alternate signed-in user token path is available from the shell.
  - No Play edit, upload, track commit, internal release update, production rollout, or live payment occurred.

## Blocked

- Service-account JSON key creation remains blocked by Google organization policy `iam.disableServiceAccountKeyCreation`; this is now handled by the OAuth fallback rather than a launch blocker for Android Publisher auth.
- Fake-token Android verification reaches the Google Publisher dependency path and fails closed as provider unavailable. A real internal-test Play purchase token is still needed to prove successful paid entitlement activation end to end.
- Play Console's own "Send test notification" path redirected to a Play Console Terms of Service acceptance page. Codex did not accept legal terms on the user's behalf.
- Play internal track update for build `15` remains console/credential gated until a usable Play submit credential is available or the already-open Play Console can be controlled manually/through Chrome.

## Launch Impact

Android products, backend auth, and RTDN Pub/Sub push delivery are ready for internal paid-IAP testing, but Android paid IAP is not production-ready until build `15` is available to internal testers and a real internal-test purchase verifies entitlement activation.
