# LocateFlow Play Internal Testing Final Report

Date: 2026-05-07

## Summary

LocateFlow is now positioned as a Google Play Internal Testing candidate for a free download/login app with Android subscriptions through Google Play Billing.

Important:

- Billing permission is intentionally kept.
- Stripe checkout and portal remain unavailable inside mobile.
- Apple IAP was not changed in this task.
- Android purchase UI remains build-flag disabled until manual Play/runtime setup is complete.

## Files Changed

- `apps/mobile/app.json`
- `apps/mobile/app/settings/privacy.tsx`
- `apps/mobile/app/settings/subscription.tsx`
- `apps/mobile/src/lib/iap-offers.ts`
- `apps/mobile/src/lib/iap-offers.test.ts`
- `apps/mobile/src/lib/iap.ts`
- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/app/privacy/page.tsx`
- `apps/web/src/lib/iap-common.ts`
- `apps/web/src/lib/iap-common.test.ts`
- `docs/audits/playstore/*`

## Permission Status

Kept:

- `INTERNET`
- `VIBRATE`
- `RECEIVE_BOOT_COMPLETED`
- `com.android.vending.BILLING`

Blocked:

- `android.permission.CAMERA`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.WRITE_EXTERNAL_STORAGE`

## CAMERA / Storage Source

`CAMERA` and legacy storage permissions are not explicitly declared by LocateFlow app config. They are introduced by native dependency metadata from packages such as `expo-image-picker` and `expo-file-system`.

No active camera capture, image picker, or document picker UI was found in inspected mobile source.

## Payment / IAP Status

Confirmed:

- App download remains free.
- Android subscriptions must use Google Play Billing.
- `expo-iap` remains installed.
- Android Billing permission remains present.
- Android purchase request now includes Play `subscriptionOffers` with `offerToken`.
- Missing Android `offerToken` fails safely.
- Backend verifies Google purchase tokens and product IDs.
- Backend does not return durable entitlement if Google acknowledgement fails.
- Mobile Stripe checkout and portal remain blocked.
- Web Stripe checkout and portal remain web-only.

Current blocker:

- `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=false` remains in EAS profiles.
- Enable it only after Play Console products/base plans/offers and runtime config are complete.

## Privacy Status

- Mobile app now has a visible Privacy Policy link to `https://locateflow.com/privacy`.
- Web privacy page falls back to `Legal entity: LocateFlow` instead of rendering the placeholder.
- Before production, legal entity must match the Play Console developer/legal identity.

## Expected Play Console Result

After uploading a new AAB built from the updated config:

- Play Console should no longer warn on `CAMERA`.
- Legacy external storage permissions should be removed/blocked.
- Billing permission should remain because subscriptions are intended.

## New AAB Required

Yes. Permission changes require a new Android App Bundle.

Build command with current repo flag state:

```powershell
pnpm --filter @locateflow/mobile exec eas build --platform android --profile production
```

For a billing-enabled internal test AAB, first complete the manual checklist and enable `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=true` for the Android store build.

## Manual Tasks Remaining

- Enter privacy policy URL in Play Console: `https://locateflow.com/privacy`.
- Complete App access with reviewer account.
- Create/activate Play subscription products/base plans/offers.
- Add license testers.
- Configure Google Play service account runtime values.
- Configure RTDN Pub/Sub push with OIDC.
- Complete Ads declaration.
- Complete Content rating.
- Complete Target audience.
- Complete Data Safety.
- Complete Government apps declaration.
- Complete Financial features declaration.
- Complete Health declaration.
- Upload new AAB.
- Use Internal testing first.

## Tests Run

Passed:

- `pnpm exec vitest run apps/mobile/src/lib/iap-offers.test.ts` - 1 file, 5 tests passed
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/shared exec tsc --noEmit`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/web test -- stripe checkout portal subscription mobile iap` - 10 files, 64 tests passed
- `pnpm --filter @locateflow/web test -- plan-limits api-gates budget billing` - 7 files, 59 tests passed
- `git diff --check`

Note: pnpm commands emitted the existing engine warning because this shell uses Node `v24.13.0` while the repo asks for Node `22.x`.

## Commit Recommendation

Do not commit until this report and final diff are reviewed.
