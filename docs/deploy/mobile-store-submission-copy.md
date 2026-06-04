# Mobile Store Submission Copy

Use this file to paste consistent reviewer-facing text into App Store Connect and
Play Console. Do not store real reviewer passwords or secrets in git.

Last updated: 2026-06-03

## Current public blockers before submission

These are not code bugs, but they still need operator/store-console action:

- Apple App Review asked whether `Pro Annual` at `$199.99` is intentional.
  Confirm the intended price before replying or changing App Store Connect.
- App Store Connect must select/process build `1.0.0 (13)` and resubmit after
  the price answer is ready.
- Play Console Data Safety and Apple App Privacy forms still need final console
  confirmation against `apps/mobile/MOBILE_DATA_INVENTORY.md`.
- Android internal paid IAP still needs a real internal-test purchase/restore/
  cancel pass to prove entitlement activation end to end.
- Play internal track upload for Android build `15` is credential/console gated:
  EAS non-interactive submit requires a Google service-account key, while the
  current Google organization policy blocks service-account key creation.

Resolved public URL blocker:

- Live `https://locateflow.com/terms`, `https://locateflow.com/privacy`, and
  `https://locateflow.com/contact` now render `AXTRA SOLUTIONS LLC` plus the
  Woodland Park mailing address. The support URL in App Store Connect was moved
  to public `https://locateflow.com/help`.

## Public URLs to use in store consoles

- Privacy Policy: `https://locateflow.com/privacy`
- Terms of Use / EULA reference: `https://locateflow.com/terms`
- Support URL: `https://locateflow.com/contact`
- Help URL: `https://locateflow.com/help`
- Account deletion URL: `https://locateflow.com/account/delete`
- Billing Policy: `https://locateflow.com/billing-policy`
- Refund Policy: `https://locateflow.com/refund`

## App Store Review Notes draft

Paste and adapt this in App Store Connect:

```text
LocateFlow is a moving and address-management app.

Reviewer login:
- Email: mobile.qa@locateflow.com
- Password: [SUPPLY SECURELY OUT-OF-BAND]

How to reach subscriptions:
1. Sign in.
2. Complete onboarding if prompted.
3. Open the More tab.
4. Tap Subscription.

What the reviewer should expect:
- The subscription screen shows Individual, Family, and Pro plans.
- In store-enabled production/TestFlight builds, native in-app purchases are shown through Apple.
- If the account already has a subscription managed elsewhere, the screen shows a read-only/manage state instead of offering a duplicate purchase.

Notes:
- Account deletion is available in-app and at https://locateflow.com/account/delete
- Privacy Policy: https://locateflow.com/privacy
- Terms: https://locateflow.com/terms
```

## Play Console App Access draft

Paste and adapt this in Play Console App access:

```text
LocateFlow requires sign-in to access account data and subscription management.

Reviewer login:
- Email: mobile.qa@locateflow.com
- Password: [SUPPLY SECURELY OUT-OF-BAND]

How to reach subscriptions:
1. Sign in.
2. Complete onboarding if prompted.
3. Open More.
4. Tap Subscription.

The account deletion flow is available in-app and at:
https://locateflow.com/account/delete
```

## Play Data Safety operator notes

Source of truth: `apps/mobile/MOBILE_DATA_INVENTORY.md`

Recommended console posture:

- No ads
- 18+ target audience unless product policy changes
- Data encrypted in transit: Yes
- Account deletion supported: Yes
- Independent security review: No / not claimed for v1

Data categories currently represented in the inventory:

- Personal info: name, email address, user IDs, address
- Location: approximate location only through user-entered address/ZIP, not GPS
- Financial info: purchase history
- App activity: app interactions and in-app search history, consent-gated
- App info and performance: crash logs and diagnostics
- Device or other IDs: push token / device-linked identifiers needed for app functionality

## Apple App Privacy operator notes

Source of truth: `apps/mobile/MOBILE_DATA_INVENTORY.md`

Recommended posture:

- Data linked to user: Yes where the inventory marks server/account association
- Used for tracking: No
- IDFA: not used
- Cross-app / cross-site advertising measurement: not used

Main categories currently represented:

- Contact Info: email, name
- Identifiers: user ID, device-linked push identifier
- Location: coarse/user-entered address context, not device GPS
- User Content: move/service/custom-provider content
- Purchases: purchase history
- Usage Data: product interaction, consent-gated
- Diagnostics: crash/performance data

## Operational reminder

Do not submit reviewer passwords, refresh tokens, API keys, private keys, or
backup codes to git, docs, or public issue threads.
