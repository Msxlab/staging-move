# OAuth (Sign in with Google / Apple) + Mobile IAP — Operator Setup

This guide covers exactly what you need to do outside the codebase to turn on:

1. **Sign in with Google** (web + mobile)
2. **Sign in with Apple** (web + mobile)
3. **Apple App Store in-app purchases** (iOS subscriptions)
4. **Google Play in-app purchases** (Android subscriptions)

All of it is server-side verified. Once you paste the credentials into
`Admin → Runtime Config`, the system picks them up — no redeploy.

---

## Summary of what the backend already does

- Verifies Google OAuth ID tokens using Google's JWKS (`code` → token exchange).
- Verifies Apple OAuth ID tokens with a signed ES256 client_secret JWT.
- Verifies Apple App Store transactions locally from the JWS x5c chain
  (Apple Root CA-G3), then re-checks against the App Store Server API.
- Verifies Google Play purchases via the Android Publisher v3 API
  (service-account-authenticated OAuth2).
- Handles App Store Server Notifications v2 and Google Play RTDN (Pub/Sub push).
- Binds receipts to a user account via the `Subscription.originalTransactionId`
  unique index (no account sharing).
- Idempotent webhooks via `ProcessedWebhookEvent`.

Everything below is what **you** do in third-party dashboards.

---

## 1. Sign in with Google (OAuth)

**Cost**: free, unlimited.

1. Go to <https://console.cloud.google.com>.
2. Create a new project (or reuse an existing one).
3. **APIs & Services → OAuth consent screen**
   - User type: `External`
   - App name: LocateFlow (or your name)
   - Support email: your email
   - Authorized domains: `yourdomain.com`
   - Scopes: `openid`, `email`, `profile` — no extra scopes.
4. **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**
   - Application type: `Web application`
   - Name: `LocateFlow Web`
   - Authorized redirect URIs:
     ```
     https://app.yourdomain.com/api/auth/oauth/google/callback
     http://localhost:3000/api/auth/oauth/google/callback   (optional, for local dev)
     ```
5. Copy `Client ID` + `Client secret`.
6. In the admin panel → **Runtime Config**:
   - `GOOGLE_OAUTH_CLIENT_ID` = the client ID
   - `GOOGLE_OAUTH_CLIENT_SECRET` = the client secret

Mobile can use the **same OAuth client**; no separate Android/iOS OAuth client
is needed for our flow because the mobile app opens the browser to the web
callback (expo-auth-session).

---

## 2. Sign in with Apple (OAuth)

**Cost**: requires Apple Developer Program ($99 USD/year — same membership is
used for IAP, so you pay once).

1. Enroll at <https://developer.apple.com/programs/enroll>.
2. Once approved, open **Certificates, Identifiers & Profiles**.
3. **Identifiers → + → App IDs → App**
   - Bundle ID (explicit): `com.locateflow.mobile`
   - Enable capability: **Sign in with Apple**
4. **Identifiers → + → Services IDs**
   - Description: `LocateFlow Sign in`
   - Identifier: `com.locateflow.auth` (this is the OAuth **client_id**)
   - Tick **Sign in with Apple**, click **Configure**:
     - Primary App ID: the one you made in step 3
     - Domains and subdomains: `app.yourdomain.com`
     - Return URLs:
       ```
       https://app.yourdomain.com/api/auth/oauth/apple/callback
       ```
5. **Keys → + → new key**
   - Name: `LocateFlow Sign in Key`
   - Enable **Sign in with Apple** and configure with the App ID from step 3.
   - Download the `.p8` file. **You can only download it once.** Save it.
   - Note the **Key ID** (10-character string).
6. Note your **Team ID** (top right of the developer portal, 10 chars).
7. In the admin panel → **Runtime Config**:
   - `APPLE_OAUTH_CLIENT_ID` = `com.locateflow.auth`
   - `APPLE_OAUTH_TEAM_ID`   = your 10-char team ID
   - `APPLE_OAUTH_KEY_ID`    = the key ID from step 5
   - `APPLE_OAUTH_PRIVATE_KEY` = the full contents of the `.p8` file,
     including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`
     lines. The runtime-config UI encrypts it at rest (AES-256-GCM).

---

## 3. Apple App Store In-App Purchases (iOS subscriptions)

**Cost**: $99/year Apple Developer Program (already paid in step 2).
Apple takes 15–30% of each subscription.

1. **App Store Connect → My Apps → +**
   - Create an app shell for LocateFlow (bundle ID `com.locateflow.mobile`).
2. **My Apps → LocateFlow → In-App Purchases → +**
   - Type: **Auto-Renewable Subscription**
   - Reference name: `LocateFlow Individual Monthly`
   - Product ID: `com.locateflow.individual.monthly`
   - Subscription group: create one called `LocateFlow Premium`
   - Subscription duration: 1 month
   - Pricing: $4.99/mo (or whatever you choose)
   - Localizations, screenshots, review info: follow the prompts. Apple
     requires screenshots of the subscribe screen for review.
3. **Users and Access → Integrations → App Store Server API**
   - Generate a new key. Download the `.p8`. Note the **Key ID**.
   - Note the **Issuer ID** at the top of the page.
4. **App Information → App Store Server Notifications V2**
   - Production URL:
     `https://app.yourdomain.com/api/webhooks/appstore`
   - Sandbox URL (for TestFlight):
     `https://app.yourdomain.com/api/webhooks/appstore`
   - Version: **V2 JWS**
5. In the admin panel → **Runtime Config**:
   - `APPLE_BUNDLE_ID`                = `com.locateflow.mobile`
   - `APPLE_APP_STORE_ISSUER_ID`      = issuer ID from step 3
   - `APPLE_APP_STORE_KEY_ID`         = key ID from step 3
   - `APPLE_APP_STORE_PRIVATE_KEY`    = full `.p8` contents
   - `APPLE_APP_STORE_ENVIRONMENT`    = `Production` once live, `Sandbox` for TestFlight
   - `MOBILE_IOS_PRODUCT_INDIVIDUAL`  = `com.locateflow.individual.monthly`

> The same App Store Connect private key is **different** from the Sign in
> with Apple key. Generate separately; don't reuse.

---

## 4. Google Play In-App Purchases (Android subscriptions)

**Cost**: $25 USD one-time (Play Console registration).
Google takes 15–30% of each subscription.

1. Register at <https://play.google.com/console/signup>.
2. **Create app** — package name `com.locateflow.mobile`.
3. **Monetize → Products → Subscriptions → Create subscription**
   - Product ID: `locateflow_individual_monthly`
   - Base plan: `monthly-auto` (auto-renewing, 1-month period)
   - Price: $4.99/mo
4. **Setup → API access** (inside Play Console)
   - Link a Google Cloud project (or create one).
   - Click **Create new service account** — opens Google Cloud Console.
     - Name: `locateflow-play-api`
     - Role: none in the Google Cloud side
     - Done → open the account → **Keys → Add key → JSON** → download
   - Back in Play Console: click **Grant access** on the newly created account.
     - Permissions: **View financial data, orders, and cancellation survey
       responses** + **Manage orders and subscriptions**.
5. **Monetize → Monetization setup → Real-time developer notifications**
   - Create a Pub/Sub topic in Google Cloud (e.g. `play-rtdn`).
   - In Play Console, paste the full topic name:
     `projects/<gcp-project>/topics/play-rtdn`.
6. In Google Cloud Console:
   - **Pub/Sub → Topics → play-rtdn → Subscriptions → Create**
     - Delivery type: **Push**
     - Endpoint URL: `https://app.yourdomain.com/api/webhooks/playstore`
     - **Enable authentication** (very important): pick a service account.
       Click **Grant** when prompted — this gives Pub/Sub permission to sign
       OIDC tokens on behalf of that account.
     - **Audience** field: leave as the endpoint URL (this is what our
       backend expects).
7. In the admin panel → **Runtime Config**:
   - `GOOGLE_PLAY_PACKAGE_NAME`                  = `com.locateflow.mobile`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`         = from the JSON (`client_email`)
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`   = from the JSON (`private_key`),
     full PEM including BEGIN/END lines. Paste exactly — the UI escapes newlines.
   - `GOOGLE_PLAY_RTDN_AUDIENCE`                 = `https://app.yourdomain.com/api/webhooks/playstore`
     (same as the Pub/Sub subscription's audience)
   - `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`         = `locateflow_individual_monthly`

---

## 5. Mobile dev client build

`expo-iap` is a native module. It will **not** run inside Expo Go. Once the
credentials are in place, rebuild the mobile app:

```bash
# From repo root
cd apps/mobile
pnpm install                   # picks up expo-iap from package.json
pnpm build:dev:ios             # or :android
```

For TestFlight / Play Console internal testing:

```bash
pnpm build:ios                 # release build
pnpm build:android
```

You must be logged in to EAS (`eas login`) and have an `eas.json` configured.

---

## 6. Testing the end-to-end flow

### Sign in with Google / Apple
1. Deploy with the credentials populated.
2. Visit `https://app.yourdomain.com/auth/sign-in`.
3. Click "Sign in with Google" / "Sign in with Apple".
4. You should land back on the dashboard with a new user created.

### iOS IAP (sandbox)
1. In App Store Connect → **Users and Access → Sandbox Testers → +**, create a
   sandbox tester (any fake email).
2. Install the dev client build on a real iPhone (IAP does not work in the
   simulator). Sign out of the store on-device, then sign in with the sandbox
   tester from Settings → App Store.
3. In the app → Settings → Subscription → **Upgrade**. Native sheet appears;
   tap Subscribe. You won't be charged.
4. Backend should log `[IAP]` messages and update the subscription row to
   `ACTIVE`.

### Android IAP (internal testing)
1. In Play Console → **Testing → Internal testing**, upload your AAB.
2. Add your Google account as a tester.
3. Install from the internal testing link. License purchases are free for
   testers (but the full flow runs).
4. Trigger upgrade → subscribe → verify backend updates.

### Webhook smoke tests
- Apple: App Store Connect → your app → **Request a test notification**.
  Should see `received: true, test: true` in the server logs.
- Google: Play Console → **Monetization setup → Developer notifications →
  Send test notification**. Should see `received: true, test: true`.

---

## 7. What goes wrong most often

| Symptom | Cause |
|---|---|
| `IAP_NOT_CONFIGURED` from `/api/mobile/iap/verify` | One of the runtime-config keys for the active platform is blank |
| Apple: `APPLE_JWS_UNTRUSTED_ROOT` | You pasted a sandbox receipt against a production-only flow, or the JWS is malformed |
| Apple: `APPLE_JWS_BUNDLE_MISMATCH` | `APPLE_BUNDLE_ID` in runtime-config doesn't match the bundle of the app that made the purchase |
| Google: `GOOGLE_OAUTH_401` | Service account doesn't have the `Financial data` permission in Play Console |
| Google webhook: `Invalid OIDC token` | Pub/Sub subscription doesn't use an authenticated service account, or `GOOGLE_PLAY_RTDN_AUDIENCE` doesn't match the audience you set on the Pub/Sub subscription |
| Webhook delivers but subscription row not updated | The `originalTransactionId` / `purchaseToken` isn't yet in the DB. Apple/Google retry for 3 days — the next `/verify` call from the client will claim ownership, and the following webhook will be processed normally |
| `RECEIPT_OWNED_BY_ANOTHER_ACCOUNT` | The user is trying to restore a receipt already bound to a different account. This is intentional (prevents account sharing). Have them log into the original account, or contact support to transfer. |
