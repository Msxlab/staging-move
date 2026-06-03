# Mobile Store Submission Copy

Use this file to paste consistent reviewer-facing text into App Store Connect and
Play Console. Do not store real reviewer passwords or secrets in git.

Last updated: 2026-06-03

## Current public blockers before submission

These are not code bugs, but they should be fixed before store review:

- `https://locateflow.com/privacy` is live, but the page still shows
  `[Legal entity name to be finalized]`.
- `https://locateflow.com/terms` is live, but the page still shows
  `[Legal entity name to be finalized]` and
  `[Mailing address to be finalized before production launch]`.
- `https://locateflow.com/contact` is live, but it also shows the same public
  legal-entity and mailing-address placeholders.
- DigitalOcean app spec currently does not contain:
  - `NEXT_PUBLIC_LEGAL_ENTITY_NAME`
  - `NEXT_PUBLIC_COMPANY_ADDRESS`
- Role-based public contact envs are also absent in DigitalOcean, so the site
  is currently falling back to:
  - `support@locateflow.com`
  - `billing@locateflow.com`
  - `privacy@locateflow.com`
  - `legal@locateflow.com`
  - `security@locateflow.com`

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
