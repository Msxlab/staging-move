# Play Console Answer Guidance

Use these answers for Google Play Internal Testing after a new AAB is built from the updated config.

## App Type

Recommended description:

- Free app download.
- Login required.
- Optional subscription purchase through Google Play Billing on Android.
- No mobile Stripe checkout or Stripe portal.

## Privacy Policy

Privacy policy URL:

`https://locateflow.com/privacy`

The URL must be public and accessible without login.

## App Access

Answer:

- App access is restricted by login.
- Provide reusable reviewer credentials.

Reviewer credential instructions placeholder:

```text
Use the following LocateFlow reviewer account:

Email: [REVIEWER_EMAIL]
Password: [REVIEWER_PASSWORD]

MFA/2-step verification is disabled for this reviewer account. After signing in, reviewers can access the main move planning, budget, provider, checklist, subscription, and account screens.
```

If Android subscription UI is enabled for the submitted AAB, add:

```text
Android subscription purchases are available through Google Play Billing. Use a Play license tester account for purchase testing.
```

## Ads

Recommended answer:

- No, the app does not contain ads.

## Content Rating

Recommended posture:

- Moving/planning productivity app.
- No mature content.
- No gambling.
- No public user-generated feed.
- No regulated substances.

## Target Audience

Recommended answer:

- Target age: 18+
- Not designed for children.

## Government Apps

Recommended answer:

- No, this is not a government app.

## Financial Features

Recommended answer:

- No regulated financial features.

Explanation:

- LocateFlow includes moving budget/expense planning and subscription billing. It is not banking, lending, investing, insurance, crypto, or money transfer.

## Health

Recommended answer:

- No health features.

## Data Safety High-Level Answers

Recommended disclosures:

- Account info: collected for login/account.
- User content: collected for move planning, addresses, tasks, provider/service records, budgets, and notes.
- App activity: collected if analytics/session tracking is enabled and consented.
- Diagnostics: collected if error reporting is configured.
- Device or other IDs: push tokens and device metadata are used for notifications/session support.
- Financial info: subscription purchase history/status is collected for entitlement/support. Google Play handles Android payment method data.

Recommended non-disclosures for this build unless a visible feature says otherwise:

- Device location: no runtime location API found.
- Camera capture: no active camera feature and `CAMERA` is blocked.
- Files/photos: no active mobile picker UI was found; disclose if a visible picker/upload feature is enabled.

Security answers:

- Data is encrypted in transit.
- Users can request account/data deletion.
- Data is not sold.
- Sharing is limited to service providers/payment processors/legal requirements as applicable.

## Subscription Product Setup

Before enabling Android purchase UI:

- Create/activate Play subscription product for `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`.
- Create/activate yearly product or base plan for `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` if yearly is supported.
- Ensure each subscription/base plan has at least one active offer/base-plan token available to Billing Client.
- Add license testers.
- Confirm subscription disclosures in the mobile paywall match Play Console terms.

## Internal Testing Release Note

```text
<en-US>
Initial internal testing release for LocateFlow.

LocateFlow is free to download and requires login. Android subscription purchases are handled through Google Play Billing when enabled for the test build.
</en-US>
```

## Reviewer Note

```text
LocateFlow is submitted as a free download/login app. Android subscriptions are handled through Google Play Billing. Mobile Stripe checkout and Stripe customer portal are not available inside the app. Existing paid web users can sign in and continue using their account; Stripe subscription management is handled on the web.
```

