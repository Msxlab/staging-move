import Constants from "expo-constants";
import { Platform } from "react-native";

export const CLIENT_PLATFORM = Platform.OS;

export const CLIENT_VERSION =
  Constants.expoConfig?.version ??
  (Constants as { nativeAppVersion?: string }).nativeAppVersion ??
  "0.0.0";

export const CLIENT_USER_AGENT = `LocateFlow/${CLIENT_VERSION} (${
  Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Mobile"
}; Expo)`;

/**
 * These headers are part of mobile session continuity. The web auth layer
 * fingerprints native sessions from the descriptive User-Agent, so every
 * authenticated mobile request must send the same identity shape.
 */
export const CLIENT_IDENTITY_HEADERS: Record<string, string> = {
  "x-client-type": "mobile",
  "x-client-platform": CLIENT_PLATFORM,
  "x-client-version": CLIENT_VERSION,
  "User-Agent": CLIENT_USER_AGENT,
};

export function buildMobileAuthHeaders(token: string): Record<string, string> {
  return {
    ...CLIENT_IDENTITY_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}
