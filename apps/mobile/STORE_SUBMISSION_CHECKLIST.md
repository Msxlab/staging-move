# LocateFlow Mobile — Store Submission Checklist

Last updated: 2026-05-12. Maintain alongside every release.

Status legend: `DONE` · `TODO` · `HUMAN VERIFICATION REQUIRED` · `NOT APPLICABLE`.

---

## 1. Code & config readiness

| Item | Status | Notes |
|---|---|---|
| Expo SDK 54, React Native 0.81, New Architecture | DONE | `apps/mobile/package.json`, `app.json` `newArchEnabled: true` |
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
| AASA file served at `/.well-known/apple-app-site-association` | DONE (placeholder) | Route handler reads `APPLE_TEAM_ID` env var. **Set env var before publishing.** |
| assetlinks.json served at `/.well-known/assetlinks.json` | DONE (placeholder) | Route handler reads `ANDROID_APP_FINGERPRINTS` env var. **Set env var before publishing.** |
| Privacy Policy URL reachable + parity with mobile data inventory | HUMAN VERIFICATION REQUIRED | `https://locateflow.com/privacy` — verify content matches `MOBILE_DATA_INVENTORY.md` before submission |
| Crash reporter (Sentry/GlitchTip) DSN configured for production | TODO | Add `EXPO_PUBLIC_SENTRY_DSN` to `eas.json` production env, OR explicitly document v1 with no native crash reporting |

---

## 2. Apple — App Store Connect submission

| Item | Status | Notes |
|---|---|---|
| App record created with bundle ID `com.locateflow.mobile` | HUMAN VERIFICATION REQUIRED | App Store Connect console |
| Sign in with Apple capability enabled on the App ID | HUMAN VERIFICATION REQUIRED | Apple Developer → Certificates, Identifiers & Profiles |
| Push Notifications capability enabled (APNs key uploaded) | HUMAN VERIFICATION REQUIRED | required for `expo-notifications` |
| Universal Links / Associated Domains entitlement matches AASA hosts | HUMAN VERIFICATION REQUIRED | `locateflow.com`, `locateflow.app`, `app.locateflow.com` |
| In-App Purchase subscription group + products created | HUMAN VERIFICATION REQUIRED | Product IDs must match `/api/mobile/iap/products` response |
| Subscription products attached to first submission | HUMAN VERIFICATION REQUIRED | App Store Connect → My Apps → In-App Purchases |
| Privacy Policy URL: `https://locateflow.com/privacy` | TODO | Set in App Information |
| Support URL | TODO | Set (typically `https://locateflow.com/support` or `mailto:support@locateflow.com`) |
| Marketing URL (optional) | NOT APPLICABLE | |
| App category: Lifestyle / Productivity | TODO | Pick category |
| Age rating questionnaire | TODO | No objectionable / gambling / UGC moderation needed |
| iPhone screenshots: 6.7" (mandatory) + 6.5" + 5.5" | TODO | |
| iPad screenshots | NOT APPLICABLE | `supportsTablet: false` |
| App Review notes + demo credentials | TODO | Provide a sandbox account that has completed onboarding so reviewer can reach tabs |
| Encryption export compliance: `ITSAppUsesNonExemptEncryption=false` | DONE | `app.json` |
| App Tracking Transparency declaration: "No tracking" | DONE | App does not use IDFA, ad SDKs, or cross-site tracking |
| App Privacy form filled from `MOBILE_DATA_INVENTORY.md` | TODO | |
| No external CTAs for digital subscription purchases | DONE | All paid features go through StoreKit |

### Apple App Privacy answers (paste into App Store Connect)

Source of truth: `apps/mobile/MOBILE_DATA_INVENTORY.md`. Default to “Linked to the user”; default to **No** for “Used to track you” (no IDFA, no ad SDKs, no cross-site analytics).

---

## 3. Google — Play Console submission

| Item | Status | Notes |
|---|---|---|
| App record created with package `com.locateflow.mobile` | HUMAN VERIFICATION REQUIRED | Play Console |
| App signing by Google Play enabled | HUMAN VERIFICATION REQUIRED | |
| Release keystore SHA-256 (App Signing key + upload key) added to `ANDROID_APP_FINGERPRINTS` env | HUMAN VERIFICATION REQUIRED | Required before `/.well-known/assetlinks.json` will verify Android App Links |
| Closed testing track set up | HUMAN VERIFICATION REQUIRED | Mandatory for new personal developer accounts (14-day, 12-tester test) |
| Subscription products + Base Plans + Offers configured | HUMAN VERIFICATION REQUIRED | Product IDs must match `/api/mobile/iap/products` response |
| Data Safety form filled | TODO | See `MOBILE_DATA_INVENTORY.md` |
| Privacy Policy URL: `https://locateflow.com/privacy` | TODO | |
| Account deletion URL: `https://locateflow.com/account/delete` | DONE | Page exists, OAuth-only users supported |
| App access instructions / demo credentials | TODO | Provide reviewer sandbox account |
| Content rating questionnaire (IARC) | TODO | |
| Target audience: 18+ (recommended) | TODO | |
| Ads declaration: "No ads" | TODO | |
| Billing permission justification | DONE | Reason: in-app subscription via Play Billing |
| Target SDK ≥ 35 (Aug 2025 requirement) | DONE | Inherited from Expo SDK 54 (compileSdk 36 / targetSdk 36) |
| Release notes (initial release) | TODO | |
| Production rollout strategy | TODO | Plan staged rollout (10% → 50% → 100%) |

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
