# LocateFlow Mobile — Data Inventory & Store Form Mapping

This document is the canonical source for filling out the **App Store Connect App Privacy** form and the **Google Play Console Data Safety** form. Update it whenever a new data type starts being collected or a third-party SDK is added.

Definitions follow Apple App Privacy and Google Data Safety taxonomy. "Tracking" follows Apple's definition (linking data to third parties for advertising/measurement across apps and websites you do not own).

---

## 1. Data inventory

| Data type | Collected by app | Collected by backend | Stored locally | Stored on server | Shared with 3P | Used for tracking | Required for core feature | Purpose |
|---|---|---|---|---|---|---|---|---|
| Email address | Yes (sign-in, sign-up forms) | Yes | SecureStore (auth token only — email is in memory) | Yes | No | No | Yes | Account creation, login, security notifications |
| Name (first/last) | Yes (onboarding) | Yes | In-memory user object | Yes | No | No | No | Personalization in app and emails |
| Password | Yes (sign-in only) | Yes (verify-only; bcrypt hash stored) | No | Hash only | No | No | Yes (for email/password accounts) | Authentication |
| Auth token (JWT) | Yes | Yes | Yes — Keychain/Keystore via `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) | Yes | No | No | Yes | Maintaining the signed-in session |
| User-entered addresses (street, city, ZIP) | Yes (onboarding + addresses screen) | Yes | Yes (query cache) | Yes | Address autocomplete API (Google Places or equivalent) | No | Yes | Core moving/services workflow |
| Move/service plan content | Yes | Yes | Yes (query cache) | Yes | No | No | Yes | Core feature |
| Subscription / IAP receipt data | Yes | Yes (`/api/mobile/iap/verify`) | No | Yes | Apple/Google for verification | No | Yes (for paid features) | Subscription entitlement |
| Push notification token (Expo) | Yes | Yes (`/api/push/register`) | No | Yes | Expo Push Service (relays to APNs/FCM) | No | No | Push delivery |
| Analytics events (screen views, taps, search length) | Yes — opt-in only (`/api/tracking/event`) | Yes | In-memory queue | Yes | No | No | No | Product analytics; PII-scrubbed |
| Crash / error logs | Yes (custom Sentry-compatible reporter) | Yes | No | Yes | Self-hosted GlitchTip / Sentry-compatible endpoint | No | No | Diagnostics |
| Session metadata (browser/OS/IP) | No (server-derived) | Yes | No | Yes | No | No | Yes | Security / session list |
| Login session list (IP, last activity) | Read-only from server | Yes | No | Yes | No | No | No | Security awareness |
| Device biometric template | No (handled by OS only) | No | OS keystore | No | No | No | No | Optional App Lock |
| IDFA / advertising ID | No | No | No | No | No | No | No | Not used |
| Camera / photo / microphone / contacts / location | No | No | No | No | No | No | No | App does not call any of these device APIs |

The mobile app does **not** use IDFA, ad SDKs, cross-site analytics, or device GPS. `expo-location`, `expo-image-picker`, `expo-document-picker`, and `expo-camera` are not bundled.

---

## 2. Apple App Privacy (App Store Connect) — answers

For each data category, set "Linked to the user", "Not used for tracking", and select all applicable purposes.

| Category | Type | Linked | Tracking | Purposes |
|---|---|---|---|---|
| Contact Info | Email Address | Yes | No | App Functionality, Account Management |
| Contact Info | Name | Yes | No | App Functionality, Personalization |
| Identifiers | User ID | Yes | No | App Functionality, Analytics, Product Personalization |
| Identifiers | Device ID | Yes | No | App Functionality (push token) |
| Location | Coarse Location | Yes | No | App Functionality (user-entered ZIP / address — **not** device GPS) |
| User Content | Other User Content | Yes | No | App Functionality (move/service notes, custom providers) |
| Purchases | Purchase History | Yes | No | App Functionality (subscription entitlement) |
| Usage Data | Product Interaction | Yes | No | Analytics (consent-gated) |
| Diagnostics | Crash Data | Yes | No | App Functionality (debugging) |
| Diagnostics | Performance Data | Yes | No | App Functionality |

**Tracking:** No. The app does not use IDFA, ad SDKs, or third-party analytics that link data to other apps or sites.

---

## 3. Google Play Data Safety — answers

| Section | Data type | Collected | Shared | Optional/Required | Purposes |
|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Optional | Account management, App functionality |
| Personal info | Email address | Yes | No | Required | Account management |
| Personal info | User IDs | Yes | No | Required | App functionality |
| Personal info | Address | Yes | No | Optional | App functionality (user-entered) |
| Location | Approximate location | Yes | No | Optional | App functionality (user-entered ZIP / address) — not device GPS |
| Financial info | Purchase history | Yes | No | Required (for subscribers) | App functionality |
| App activity | App interactions | Yes (opt-in) | No | Optional | Analytics |
| App activity | In-app search history | Yes (length only) | No | Optional | Analytics |
| App info and performance | Crash logs | Yes | No | Required | App functionality |
| App info and performance | Diagnostics | Yes | No | Required | App functionality |
| Device or other IDs | Device or other IDs | Yes | No | Required | App functionality (push token) |

**Security practices**

- Data is encrypted in transit (HTTPS only).
- Users can request that their data be deleted (in-app and at `https://locateflow.com/account/delete`).
- Independent security review: not applicable for v1.
- Follows Play Families Policy: not applicable (18+ audience).

---

## 4. Third-party processors mentioned in store forms / Privacy Policy

| Processor | Purpose | Data type | Required for |
|---|---|---|---|
| Apple App Store / StoreKit 2 | IAP / subscription verification | Receipt JWS, transaction IDs | iOS subscriptions |
| Google Play Billing | IAP / subscription verification | Purchase tokens, product IDs | Android subscriptions |
| Stripe (web only) | Web subscriptions | Customer/subscription IDs | Web checkout (not used by mobile) |
| Expo Push Service | Push notification relay | Push tokens | Push delivery |
| Self-hosted GlitchTip / Sentry-compatible endpoint | Crash reporting | Crash event payloads (PII-scrubbed) | Diagnostics (when DSN configured) |
| Address autocomplete provider | Address suggestions | Partial address strings | Address entry |

---

## 5. Maintenance rules

- When a new third-party SDK is added to `apps/mobile/package.json`, update sections 1 and 4 in the same commit.
- When a new permission string is added to `app.json` `ios.infoPlist` or `android.permissions`, update section 1.
- When the App Store / Play store forms are saved, copy the exact submission text back here as evidence.
