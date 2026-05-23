import { Platform } from "react-native";

// App Store compliance note (read before flipping flags):
// Apple Guideline 3.1.1 forbids in-app purchasing of digital subscriptions
// via any mechanism other than IAP. Pre-launch checklist on iOS:
//   1. App Store Connect: create the Auto-Renewable Subscription group +
//      individual_monthly_399 and individual_yearly_3999 products.
//   2. Verify SKUs are returned by /api/mobile/iap/products.
//   3. Set EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED=true in EAS prod.
// If IAP is OFF in production, the paywall card must NOT display a price /
// purchase CTA on iOS — `mobileStoreCommerceAdvertisableForPlatform()` below
// returns false in that case so the subscription screen can hide commerce
// affordances and avoid an Apple Review rejection for "advertising a paid
// subscription without offering IAP."

function parseBooleanFlag(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export const MOBILE_STORE_PURCHASES_ENABLED = parseBooleanFlag(
  process.env.EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED,
);

export const MOBILE_IOS_STORE_PURCHASES_ENABLED = parseBooleanFlag(
  process.env.EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED,
  MOBILE_STORE_PURCHASES_ENABLED,
);

export const MOBILE_ANDROID_STORE_PURCHASES_ENABLED = parseBooleanFlag(
  process.env.EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED,
  MOBILE_STORE_PURCHASES_ENABLED,
);

export function isMobileStorePurchasesEnabledForPlatform(platform = Platform.OS) {
  if (platform === "ios") return MOBILE_IOS_STORE_PURCHASES_ENABLED;
  if (platform === "android") return MOBILE_ANDROID_STORE_PURCHASES_ENABLED;
  return false;
}

// Returns true when it is safe to show commercial paywall surfaces (price
// labels, "Subscribe" CTAs) on this platform. On iOS we require IAP to be
// enabled — otherwise we'd be advertising a paid plan with no in-app way
// to buy it, which Apple rejects. On Android the same rule applies for
// Play Store policy. On web the caller is expected not to use this guard.
export function mobileStoreCommerceAdvertisableForPlatform(platform = Platform.OS) {
  if (platform === "ios" || platform === "android") {
    return isMobileStorePurchasesEnabledForPlatform(platform);
  }
  return true;
}

if (__DEV__) {
  if (Platform.OS === "ios" && !MOBILE_IOS_STORE_PURCHASES_ENABLED) {
    console.warn(
      "[billing-flags] iOS IAP is DISABLED. Subscription screen will render in read-only mode. " +
        "Before App Store submission set EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED=true.",
    );
  }
  if (Platform.OS === "android" && !MOBILE_ANDROID_STORE_PURCHASES_ENABLED) {
    console.warn(
      "[billing-flags] Android IAP is DISABLED. Subscription screen will render in read-only mode. " +
        "Before Play submission set EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED=true.",
    );
  }
}
