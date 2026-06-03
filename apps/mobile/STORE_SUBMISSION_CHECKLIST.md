# LocateFlow Mobile — Store Submission Checklist

Last updated: 2026-06-03. Maintain alongside every release.

Status legend: `DONE` · `TODO` · `HUMAN VERIFICATION REQUIRED` · `NOT APPLICABLE`.

---

## 1. Code & config readiness

| Item | Status | Notes |
|---|---|---|
| Expo SDK 55, React Native 0.83, New Architecture | DONE | `apps/mobile/package.json`, `app.json` |
| iOS Privacy Manifest (`ios.privacyManifests`) declared | DONE | `apps/mobile/app.json`. Reasons: UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1. |
| `ios.usesAppleSignIn: true` + `expo-apple-authentication` plugin | DONE | `apps/mobile/app.json`, `apps/mobile/package.json` |
| Native Sign in with Apple implemented on iOS | DONE | `apps/mobile/src/lib/apple-auth.ts`, used in `(auth)/sign-in.tsx` and `(auth)/sign-up.tsx`. Falls back to web flow on simulator. |
| Unused permission-injecting dependencies removed | DONE | `expo-image-picker` and `expo-document-picker` removed from `package.json` |
| iPad / tablet support disabled until iPad QA + screenshots are ready | DONE | `ios.supportsTablet: false` |
| Android `blockedPermissions` (CAMERA, READ/WRITE_EXTERNAL_STORAGE) | DONE | `app.json` |
| Cleartext traffic disabled on Android | DONE | `app.json` `expo-build-properties.android.usesCleartextTraffic: false` |
| Production EAS profile uses production API URL only | DONE | `eas.json` `EXPO_PUBLIC_API_URL=https://locateflow.com/api` |
| No localhost/staging URLs in production env | DONE | Verified via grep |
| HTTPS-only API client | DONE | `src/lib/api.ts` `enforceProductionApiUrl` |
| Secure token storage (Keychain/Keystore) | DONE | `src/lib/auth.ts` SecureStore w/ `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` |
| OAuth uses PKCE + state + host allowlist | DONE | `src/lib/mobile-oauth.ts` |
| Push permission soft-prompt gating | DONE | `src/lib/push.ts` `registerForPushNotifications` requires accepted soft prompt |
| OAuth-only users can delete account in-app | DONE | `app/settings/delete-account.tsx` + `apps/web/src/lib/user-step-up.ts` `confirmAccountDeletion` |
| Public account-deletion web URL | DONE | `apps/web/src/app/account/delete/page.tsx` → `https://locateflow.com/account/delete` |
| AASA file served at `/.well-known/apple-app-site-association` | DONE | Live response uses `APPLE_TEAM_ID=LDWFU7FTBV` for `com.locateflow.mobile`. |
| assetlinks.json served at `/.well-known/assetlinks.json` | DONE | `ANDROID_APP_FINGERPRINTS` set in DigitalOcean. Route is runtime-dynamic so env changes are reflected after deploy. |
| Privacy Policy URL reachable + parity with mobile data inventory | HUMAN VERIFICATION REQUIRED | Live `https://locateflow.com/privacy` is reachable and broadly matches `MOBILE_DATA_INVENTORY.md`, but `privacy`, `terms`, and `contact` still show placeholder legal entity / mailing address until `NEXT_PUBLIC_LEGAL_ENTITY_NAME` and `NEXT_PUBLIC_COMPANY_ADDRESS` are set in DigitalOcean. |
| Crash reporter (Sentry/GlitchTip) DSN configured for production | DONE | `EXPO_PUBLIC_SENTRY_DSN` is present. Mobile currently uses the lightweight Sentry-compatible JS/error envelope path, not `@sentry/react-native` native crash capture. |

---

## 2. Apple — App Store Connect submission

| Item | Status | Notes |
|---|---|---|
| App record created with bundle ID `com.locateflow.mobile` | HUMAN VERIFICATION REQUIRED | App Store Connect console |
| Sign in with Apple capability enabled on the App ID | HUMAN VERIFICATION REQUIRED | Apple Developer → Certificates, Identifiers & Profiles |
| Push Notifications capability enabled (APNs key uploaded) | HUMAN VERIFICATION REQUIRED | required for `expo-notifications` |
| Universal Links / Associated Domains entitlement matches AASA hosts | DONE | Release config uses `locateflow.com` only. Re-add `locateflow.app` / `app.locateflow.com` only after DNS + well-known files exist. |
| In-App Purchase subscription group + products created | HUMAN VERIFICATION REQUIRED | Product IDs must match `/api/mobile/iap/products` response |
| Subscription products attached to first submission | HUMAN VERIFICATION REQUIRED | App Store Connect → My Apps → In-App Purchases |
| Privacy Policy URL: `https://locateflow.com/privacy` | TODO | Set in App Information after public legal entity / mailing address placeholders are finalized |
| Terms of Use / EULA URL: `https://locateflow.com/terms` | TODO | Set after public legal entity / mailing address placeholders are finalized |
| Support URL | TODO | Use `https://locateflow.com/contact` (live) |
| Marketing URL (optional) | NOT APPLICABLE | |
| App category: Lifestyle / Productivity | TODO | Pick category |
| Age rating questionnaire | TODO | No objectionable / gambling / UGC moderation needed |
| iPhone screenshots: 6.7" (mandatory) + 6.5" + 5.5" | TODO | |
| iPad screenshots | NOT APPLICABLE | `supportsTablet: false` |
| App Review notes + demo credentials | HUMAN VERIFICATION REQUIRED | Use `docs/deploy/mobile-store-submission-copy.md`. Demo password must be supplied out-of-band; do not commit it. Include IAP path: `More -> Subscription`. Apple previously rejected build 12 because IAP was not locatable. |
| Encryption export compliance: `ITSAppUsesNonExemptEncryption=false` | DONE | `app.json` |
| App Tracking Transparency declaration: "No tracking" | DONE | App does not use IDFA, ad SDKs, or cross-site tracking |
| App Privacy form filled from `MOBILE_DATA_INVENTORY.md` | HUMAN VERIFICATION REQUIRED | Use `apps/mobile/MOBILE_DATA_INVENTORY.md` plus `docs/deploy/mobile-store-submission-copy.md` for console copy. |
| No external CTAs for digital subscription purchases | DONE | Store-enabled native builds render native App Store / Play purchase actions for configured SKUs. Web billing links appear only for Stripe-managed accounts, management flows, or non-store/test builds where native commerce is unavailable. |

### Apple App Privacy answers (paste into App Store Connect)

Source of truth: `apps/mobile/MOBILE_DATA_INVENTORY.md`. Default to “Linked to the user”; default to **No** for “Used to track you” (no IDFA, no ad SDKs, no cross-site analytics).

---

## 3. Google — Play Console submission

| Item | Status | Notes |
|---|---|---|
| App record created with package `com.locateflow.mobile` | HUMAN VERIFICATION REQUIRED | Play Console |
| App signing by Google Play enabled | HUMAN VERIFICATION REQUIRED | |
| Release keystore SHA-256 (App Signing key + upload key) added to `ANDROID_APP_FINGERPRINTS` env | DONE | Play signed universal APK fingerprint added to DigitalOcean: `A1:14:99:D3:29:69:50:CF:DC:40:74:4E:0C:94:79:9A:9D:B3:D7:AD:71:BC:BE:A6:04:8B:3C:3B:C2:31:01:74`. |
| Closed testing track set up | HUMAN VERIFICATION REQUIRED | Mandatory for new personal developer accounts (14-day, 12-tester test) |
| Subscription products + Base Plans + Offers configured | HUMAN VERIFICATION REQUIRED | Product IDs must match `/api/mobile/iap/products` response |
| Google Play Developer API auth env configured | DONE | OAuth fallback is configured in DigitalOcean with `GOOGLE_PLAY_OAUTH_CLIENT_ID`, optional secret, and `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`. Service-account private-key auth remains supported by code, but org policy blocks key creation. Live fake-token verify now fails closed as `IAP_PROVIDER_UNAVAILABLE`, not `IAP_NOT_CONFIGURED`. |
| Data Safety form filled | HUMAN VERIFICATION REQUIRED | Use `apps/mobile/MOBILE_DATA_INVENTORY.md` plus `docs/deploy/mobile-store-submission-copy.md`. |
| Privacy Policy URL: `https://locateflow.com/privacy` | TODO | Set after public legal entity / mailing address placeholders are finalized |
| Account deletion URL: `https://locateflow.com/account/delete` | DONE | Page exists, OAuth-only users supported |
| App access instructions / demo credentials | TODO | Provide reviewer sandbox account |
| Content rating questionnaire (IARC) | TODO | |
| Target audience: 18+ (recommended) | TODO | |
| Ads declaration: "No ads" | TODO | |
| Billing permission justification | DONE | Reason: in-app subscription via Play Billing |
| Target SDK >= 35 (Aug 2025 requirement) | DONE | Inherited from Expo SDK 55 (compileSdk/targetSdk 36) |
| Release notes (initial release) | TODO | |
| Production rollout strategy | TODO | Plan staged rollout (10% → 50% → 100%) |

---

## 3.1 Store submission copy

Use `docs/deploy/mobile-store-submission-copy.md` for:

- App Store review notes draft
- Play Console app-access instructions draft
- Suggested support / privacy / terms URLs
- Data Safety / App Privacy operator notes
- The current public-launch blockers that still need real operator values

---

## 4. Track-by-track gating

| Track | Code-side gate | Console-side gate |
|---|---|---|
| TestFlight (internal) | DONE | Apple Developer account + bundle ID required |
| App Store review | All P0 fixes DONE + AASA env var set | App Privacy form + screenshots + demo creds + IAP attached |
| Play internal testing | DONE | Play Console app + AAB signed |
| Play closed testing | DONE | 12 testers signed up, 14-day window started |
| Play production | DONE + AASA/assetlinks env vars set | Data Safety + account-deletion URL + closed-test completion (personal account) |

---

## 5. Pre-upload commands (run from repo root)

```sh
pnpm install                                # picks up package.json changes
pnpm --filter @locateflow/mobile run lint   # TypeScript check
pnpm --filter @locateflow/mobile run test   # Vitest unit tests

# iOS production build (EAS)
pnpm --filter @locateflow/mobile run build:ios

# Android production build (EAS)
pnpm --filter @locateflow/mobile run build:android
```

After EAS finishes, download the IPA / AAB and verify:

```sh
# Android: confirm permissions in the AAB
$ANDROID_HOME/build-tools/<ver>/aapt2 dump permissions LocateFlow.aab
# expect: INTERNET, VIBRATE, com.android.vending.BILLING, POST_NOTIFICATIONS only

# iOS: open the .ipa, inspect Info.plist
unzip -p LocateFlow.ipa Payload/LocateFlow.app/Info.plist | plutil -p -
# expect: no NSCameraUsageDescription, NSPhotoLibraryUsageDescription,
#         NSMicrophoneUsageDescription, or NSLocationWhenInUseUsageDescription
# expect: NSFaceIDUsageDescription present (App Lock)
```
