# Mobile Release Readiness

Updated: 2026-06-15

## App and Build Config

- App: Expo SDK 55, React Native 0.83.
- App version in app config: 1.0.2.
- Scheme: `locateflow`.
- Runtime version policy: app version.
- iOS associated domain includes `applinks:locateflow.com`.
- Android intent filters cover `locateflow.com` paths including blog, mobile OAuth, reset password, and invitations.
- Android cleartext traffic is disabled by build properties.
- EAS production channel uses production API/app URL and enables store purchases.

## API Safety

- Mobile API client resolves API URL from Expo extra/env, dev host, or production fallback.
- Release builds reject non-HTTPS API URLs unless explicitly in development debug proxy mode.
- Default release fallback is `https://locateflow.com/api`.
- Web origin fallback strips `/api` and avoids localhost in release builds.
- Client identity headers include platform/version/user-agent.
- `onUnauthorized` clears local session.

## Auth

- Password login uses `/api/mobile/auth/login`.
- OAuth login uses web OAuth init with mobile redirect, PKCE challenge, and state.
- PKCE verifier is generated with platform crypto, stored in SecureStore, single-use consumed, and expires after 10 minutes.
- OAuth callback parser accepts custom scheme, Expo dev scheme, and allowed HTTPS universal-link hosts.
- OAuth handoff exchange calls `/api/mobile/auth/exchange` with code and verifier.

## Token and Local Security

- Auth token storage uses mobile auth store and SecureStore integration.
- App lock uses platform local authentication with device fallback allowed.
- Local preference/cache values are separate from auth token storage.

## IAP

- `expo-iap` is dynamically loaded and unavailable in Expo Go.
- Store purchases are platform-flag gated.
- iOS/Android production purchase flags are enabled in EAS production profile.
- Transactions are only finished after backend verification succeeds.
- Pending transaction reconciler runs server verify before finishing.

## Release Risks and Gates

- Confirm App Store Connect products and Play products match backend product IDs before submission.
- Confirm server verifier config for Apple/Google store purchases before enabling production release.
- Confirm `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_APP_URL` production values point to the intended host.
- Confirm universal links/deep links resolve for OAuth, reset password, and invitations.
- Do not treat debug keystore inventory presence as release signing evidence; key files were not read by this audit.

## Not Verified

- No native builds were produced.
- No app-store submission, Play submission, or device smoke test was run.
- No store sandbox purchases were executed.
