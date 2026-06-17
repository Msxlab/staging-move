# Mobile Store Submission Copy

Use this file to paste consistent reviewer-facing text into App Store Connect and
Play Console. Do not store real reviewer passwords or secrets in git.

Last updated: 2026-06-14

## Current public blockers before submission

These are not code bugs, but they still need operator/store-console action:

- Refreshed premium store screenshots are generated and committed at
  `store-assets/mobile-screenshots/2026-06-13-premium/`, with 8 images each
  for iOS 6.7", iOS 6.5", iOS 5.5", and Google Play phone screenshots. A ZIP
  copy for manual upload is on the desktop:
  `C:\Users\Kutay\Desktop\locateflow-store-screenshots-2026-06-13-premium.zip`.
- EAS finished iOS build `1.0.2 (28)` from commit `52826555` and scheduled
  App Store submission automatically. Verify the submission in App Store
  Connect before release; version release should stay manual unless the operator
  intentionally changes it.
- Google Play Console currently shows `LocateFlow: Moving Checklist` in
  production with no unpublished changes and 8 existing phone screenshots.
  Replacing those assets requires removing the existing 8 screenshots, uploading
  the new 8 `android-phone` images, saving the listing draft, and sending the
  change for review.
- Android OTA is live on production for runtime `sdk55-1.0.0` with update group
  `bbdf4022-87ee-4b6a-b36a-f2d71ecceede`, but a new native Play AAB for the
  current commit is blocked by EAS Android cloud build quota until reset or plan
  upgrade. Windows local EAS Android builds are unsupported, and local
  release-signing env vars are not present.
- Android build `15 (1.0.0)` is published to Play internal testing and marked
  `Available to internal testers`; the tester list is `LOCATEFLOW` with 4 users.
- Android internal paid IAP now installs from Google Play and purchase/restore/cancel
  has passed on build `15` using Google Play License testing with the no-charge
  test card flow. Keep License testing selected for `LOCATEFLOW` before any
  future paid Billing QA; if the sheet shows a real card, stop before `Subscribe`.
- The latest completed Android store build visible in EAS is still build `24`
  from commit `bf580772`; it shares runtime `sdk55-1.0.0`, so the production OTA
  can update its JS/UI, but it is not a fresh native AAB for the latest commit.

Resolved store declaration confirmation:

- On 2026-06-04, Play Console `App content` was checked in the live console:
  `Need attention` was empty and `Actioned` listed 10 declarations, including
  Data safety and Privacy policy, all ready to send for review.
- On 2026-06-04, App Store Connect `App Privacy` was checked in the live
  console: the privacy URL is `https://locateflow.com/privacy`, and 12 published
  data types match `apps/mobile/MOBILE_DATA_INVENTORY.md` at category level.
- Codex did not accept legal declarations, accept Terms, perform a production
  rollout, or manually release the app.

Resolved public URL blocker:

- Live `https://locateflow.com/terms`, `https://locateflow.com/privacy`, and
  `https://locateflow.com/contact` now render `AXTRA SOLUTIONS LLC` plus the
  Woodland Park mailing address. The support URL in App Store Connect was moved
  to public `https://locateflow.com/help`.

Superseded App Review pricing question:

- Operator previously confirmed on 2026-06-04 that App Store Connect
  `Pro Annual` matched the then-current product catalog.
- The current annual-first pricing target is Individual $24/year or
  $4.99/month, Family $39/year or $7.99/month, and Pro $59/year or
  $11.99/month.
- iOS production/TestFlight purchase UI reads StoreKit localized pricing, so
  the App Store billed amount is shown from Apple's product catalog. Update
  App Store Connect products manually; code cannot change store prices.
- Mobile price parity is a human business decision because store tiers and
  Apple fees may differ from web pricing.

Resolved App Review resubmission step:

- On 2026-06-04, the App Review reply was sent in App Store Connect.
- The rejected build `1.0.0 (12)` was removed from the submitted version, build
  `1.0.0 (13)` was attached, and the submission was resubmitted.
- App Store Connect now shows `Waiting for Review` for build `1.0.0 (13)`.
- App Store version release is set to `Manually release this version`, so App
  Review approval will not automatically release the app to the App Store.

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

## App Review Response draft

Paste this into the App Review reply for build `1.0.0 (13)`:

```text
Hello App Review Team,

Thank you for the review notes. We addressed the reported issues in build 1.0.0 (13).

1. Sign in with Apple / password setup
After Sign in with Apple, the app no longer requires the user to create a password before continuing. Users now continue into onboarding/the app normally. Password setup remains optional later from Settings > Privacy & Security for users who want email/password login or password management. Account deletion remains available in-app for OAuth-only users without requiring password creation.

2. Subscription billed amount
We updated the subscription screen so the annual billed amount is prominent in the primary action and disclosure text. Trial or savings text is now secondary to the actual annual billed price.

3. Subscription prices
The current pricing target is Individual $24/year or $4.99/month, Family $39/year or $7.99/month, and Pro $59/year or $11.99/month. StoreKit displays the localized App Store Connect price configured for each product.

The subscription path for review is:
Sign in -> More -> Subscription

Privacy Policy: https://locateflow.com/privacy
Terms: https://locateflow.com/terms
Support: https://locateflow.com/help

Thank you.
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

Console steps to verify before submitting:

- Data collection and security: answer that the app collects user data, encrypts
  data in transit, and provides account deletion.
- Data sharing: answer `No` unless the console treats Apple/Google purchase
  verification, Expo push relay, or crash processing as sharing under the
  latest form wording; if it does, mirror the processor/purpose rows from the
  inventory instead of inventing new categories.
- Financial info / purchase history: include subscription purchase state and
  receipt/token verification for paid users.
- Location: only approximate/user-entered address or ZIP context; do not claim
  device GPS collection unless location SDK usage is added later.
- Ads ID: answer that advertising ID is not used.
- Independent security review: do not claim one for v1 unless a real review
  certificate/report exists.

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

Console steps to verify before submitting:

- Tracking: answer `No`.
- IDFA: answer that the app does not use IDFA.
- Data linked to user: answer `Yes` for account/server-backed data categories
  shown in the inventory.
- Location: use coarse location only for user-entered address/ZIP context; do
  not select precise location or device GPS.
- Purchases: include purchase history for subscription entitlement.
- Diagnostics: include crash/performance diagnostics if the Sentry-compatible
  DSN is configured for the submitted build.

## Store declaration checklist

These entries require operator/legal confirmation in the consoles. Codex should
prepare text and evidence, but should not accept declarations on behalf of the
company.

Google Play Console:

- App access: use the Play Console App Access draft above and provide the demo
  password out-of-band.
- Data Safety: use the Play Data Safety operator notes above.
- Target audience/content: use an adult/general productivity posture; do not
  mark the app as primarily directed to children unless the product policy
  changes. The current inventory says Play Families Policy is not applicable
  and the intended audience is 18+.
- Content rating: answer as a productivity/account/subscription app with no
  user-generated public social feed, no gambling, no violence, no sexual
  content, no controlled-substance sales, and no location sharing feature. If
  any future content or marketplace features are added, rerun the questionnaire.
- Ads declaration: answer `No ads` unless an ad SDK or paid ad placement is
  added later.
- App category: productivity/tools-style app. Use the category already selected
  in the console unless the store listing owner intentionally changes it.
- Account deletion: use `https://locateflow.com/account/delete`.
- Internal testing: build `15 (1.0.0)` is available to internal testers, has
  been installed from Play on the emulator, and completed the purchase/restore/cancel
  Billing QA flow with a Google Play no-charge test card. Before any future paid
  Billing QA, verify the active Google account is covered by Play Console
  `Settings -> License testing`; if the sheet shows a real card, stop before
  `Subscribe` and update License testing first.

App Store Connect:

- App Privacy: use the Apple App Privacy operator notes above.
- App Review Information: use the App Store Review Notes draft above and supply
  the reviewer password out-of-band.
- Sign-in information: keep the demo account active and able to reach
  `More -> Subscription`.
- Version release: current release setting is manual; keep manual release if
  approval should not automatically publish the app.
- Content rights/age rating/trader/compliance declarations: answer from company
  policy and legal status. Do not let Codex accept legal status declarations or
  trader/contact attestations without an operator decision.

## Operational reminder

Do not submit reviewer passwords, refresh tokens, API keys, private keys, or
backup codes to git, docs, or public issue threads.
