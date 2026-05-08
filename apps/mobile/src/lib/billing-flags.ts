import { Platform } from "react-native";

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
