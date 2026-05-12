# Mobile And Places Release Runbook

Use this when preparing mobile QA/release and Google Places address autocomplete.

## Google Places

The mobile app does not call Google directly. Web and mobile both call the web API:

- `GET /api/address-autocomplete`
- `GET /api/address-autocomplete/details`

The web API then calls Google Places from the server. This keeps the Maps key out of mobile bundles and applies auth, per-minute, per-user/day, and per-IP/day limits before Google is charged.

Required web/API environment:

```bash
GOOGLE_MAPS_API_KEY=<server-side Google Maps key>
PLACES_AUTOCOMPLETE_ENABLED=true
PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT=250
PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT=1000
PLACES_DETAILS_DAILY_USER_LIMIT=250
PLACES_DETAILS_DAILY_IP_LIMIT=1000
UPSTASH_REDIS_REST_URL=<required for shared production-grade rate limits>
UPSTASH_REDIS_REST_TOKEN=<required for shared production-grade rate limits>
```

Google Cloud setup:

- Enable billing on the Google Cloud project.
- Enable Places API for the key used by `GOOGLE_MAPS_API_KEY`.
- Restrict the key to the Places API.
- Prefer server/IP restrictions if the hosting provider has stable egress IPs. Do not use HTTP referrer restrictions for the server-side key.
- Keep `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` blank unless a future client-side map needs it.

Operational behavior:

- If `GOOGLE_MAPS_API_KEY` is missing, the API returns `enabled:false` and users can continue manually.
- If `PLACES_AUTOCOMPLETE_ENABLED=false`, autocomplete and details are disabled without redeploying.
- If Redis is missing in production, non-fail-closed routes can degrade to in-memory counters. For Places spend control, configure Upstash before launch.

QA:

```bash
curl -H "Authorization: Bearer <mobile-or-web-user-token>" \
  "https://locateflow.com/api/address-autocomplete?input=123%20Main&sessionToken=qa_session"
```

Expected: `enabled:true` with predictions when the key is valid, or `enabled:false` when disabled/missing.

## Mobile Environment

Build-time public mobile env:

```bash
EXPO_PUBLIC_API_URL=https://locateflow.com/api
EXPO_PUBLIC_APP_URL=https://locateflow.com
EXPO_PUBLIC_SENTRY_DSN=<optional public DSN>
```

Legacy `app.locateflow.com` note: native associated-domain, Android intent
filter, and mobile OAuth allowlists may still include `app.locateflow.com` for
compatibility with existing or app-review-bound builds. New production builds
should use `https://locateflow.com` and `https://locateflow.com/api`. Before
removing the legacy host, confirm no released build, OAuth dashboard allowlist,
universal-link association, password-reset link, or mobile review flow still
depends on it. If compatibility is required, handle DNS/redirect support as an
operator action; do not use `app.locateflow.com` as a canonical public URL.

Local physical-device testing:

```bash
EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3000/api
EXPO_PUBLIC_APP_URL=http://<YOUR_LAN_IP>:3000
```

Core web/API env needed before mobile QA:

```bash
DATABASE_URL=<mysql url>
USER_JWT_SECRET=<32+ chars>
ADMIN_JWT_SECRET=<32+ chars if admin/shared flows are tested>
FIELD_ENCRYPTION_KEY=<64 hex chars>
NEXT_PUBLIC_APP_URL=https://locateflow.com
UPSTASH_REDIS_REST_URL=<recommended/launch-grade>
UPSTASH_REDIS_REST_TOKEN=<recommended/launch-grade>
GOOGLE_MAPS_API_KEY=<for address autocomplete>
```

Optional but required for full release QA:

```bash
GOOGLE_OAUTH_CLIENT_ID=<web OAuth client id>
GOOGLE_OAUTH_CLIENT_SECRET=<web OAuth client secret>
APPLE_OAUTH_CLIENT_ID=<services id>
APPLE_OAUTH_TEAM_ID=<team id>
APPLE_OAUTH_KEY_ID=<key id>
APPLE_OAUTH_PRIVATE_KEY=<p8 contents>
STRIPE_SECRET_KEY=<for web checkout/portal>
STRIPE_WEBHOOK_SECRET=<for Stripe webhook>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<publishable key>
STRIPE_PRICE_INDIVIDUAL_MONTHLY=<monthly price id>
STRIPE_PRICE_INDIVIDUAL_YEARLY=<yearly price id>
STRIPE_ANNUAL_TRIAL_DAYS=90
RESEND_API_KEY=<email>
EMAIL_FROM=<email sender>
APPLE_APP_STORE_ISSUER_ID=<IAP>
APPLE_APP_STORE_KEY_ID=<IAP>
APPLE_APP_STORE_PRIVATE_KEY=<IAP>
APPLE_APP_STORE_ENVIRONMENT=Sandbox
MOBILE_IOS_PRODUCT_INDIVIDUAL=com.locateflow.individual.monthly
GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=<Play API service account>
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY=<Play API private key>
GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore
MOBILE_ANDROID_PRODUCT_INDIVIDUAL=locateflow_individual_monthly
```

## Local Mobile QA

1. Start the web/API with a reachable URL:

```bash
pnpm --filter @locateflow/web dev -H 0.0.0.0
```

2. In `apps/mobile/.env.local`, set:

```bash
EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3000/api
EXPO_PUBLIC_APP_URL=http://<YOUR_LAN_IP>:3000
```

3. Start Expo:

```bash
pnpm mobile:dev
```

Expo Go can cover simple JS smoke tests, but native IAP requires a dev client or EAS build.

## Pre-Build Checks

```bash
pnpm verify:typecheck
pnpm --filter @locateflow/web test
pnpm --filter @locateflow/mobile exec expo install --check
pnpm --filter @locateflow/mobile exec expo export --platform android --output-dir dist-export-android
pnpm --filter @locateflow/mobile exec expo export --platform ios --output-dir dist-export-ios
npx expo-doctor@latest
```

Remove export folders after verification:

```powershell
Remove-Item -Recurse -Force apps/mobile/dist-export-android, apps/mobile/dist-export-ios
```

Known Expo Doctor caveats in this monorepo:

- Duplicate React versions can appear because web/Next and mobile/Expo use different supported React versions.
- Native `android/` is present, so some `app.json` native config fields do not auto-sync. Keep native manifests in sync when changing native config.

## Native Builds

Prerequisites:

- `EAS_TOKEN` or interactive `eas login`.
- Android: Java, Android SDK, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, signing credentials or EAS-managed credentials.
- iOS: Apple Developer account, bundle identifier access, certificates/profiles, or EAS-managed signing.

Android internal APK:

```bash
cd apps/mobile
eas build --platform android --profile staging-preview --non-interactive
```

Android Play release AAB:

```bash
cd apps/mobile
eas build --platform android --profile production --non-interactive
```

iOS TestFlight/App Store build:

```bash
cd apps/mobile
eas build --platform ios --profile production --non-interactive
```

## Device Smoke Checklist

- Email/password sign-up, sign-in, logout.
- Google/Apple sign-in handoff if OAuth credentials are configured.
- Onboarding profile.
- Primary address autocomplete suggestions and selection.
- Moving destination autocomplete suggestions and selection.
- Address create/edit with autocomplete and manual fallback.
- Moving plan create/view.
- Provider list/detail and recommendations.
- Service create/edit/delete.
- Custom provider create/edit/delete.
- Settings/profile/privacy/export.
- Subscription screen. Native purchase only when App Store/Play credentials and products are configured.
- Push notification permission/register if enabled.
- Offline/error states and app restart session restore.
