import { ApiClient } from "@locateflow/shared";
import Constants from "expo-constants";
import { Platform } from "react-native";

function extractHost(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, "");
  const hostPort = withoutScheme.split("/")[0];
  const host = hostPort.split(":")[0];
  return host || null;
}

function resolveExpoHost() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).__unsafeNoWarnManifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host) return host;
  }

  return null;
}

function resolveApiUrl() {
  const extraApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (extraApiUrl) return extraApiUrl;

  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (__DEV__) {
    const expoHost = resolveExpoHost();
    if (expoHost) {
      if (envApiUrl) {
        try {
          const envHost = new URL(envApiUrl).hostname;
          const envIsLocalhost = envHost === "localhost" || envHost === "127.0.0.1" || envHost === "0.0.0.0";
          if (envHost === expoHost || !envIsLocalhost) {
            return envApiUrl;
          }
        } catch {}
      }

      return `http://${expoHost}:3000/api`;
    }
  }

  return envApiUrl || "https://locateflow.com/api";
}

function enforceProductionApiUrl(url: string) {
  const allowLocalDebugProxy =
    process.env.EXPO_PUBLIC_ENV === "development" &&
    /^http:\/\/(?:10\.0\.2\.2|localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(url);

  if (!__DEV__ && !/^https:\/\//i.test(url) && !allowLocalDebugProxy) {
    return "https://locateflow.com/api";
  }
  return url;
}

const API_URL = enforceProductionApiUrl(resolveApiUrl());

/**
 * Public web origin (no trailing slash, no /api suffix). Used for opening
 * marketing/legal pages in the browser. Prefers EXPO_PUBLIC_APP_URL, then
 * derives from API_URL by stripping the trailing /api, then falls back to
 * production. Never returns a localhost origin in a release build.
 */
function resolveWebAppUrl() {
  const explicit = process.env.EXPO_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const derived = API_URL.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  if (!__DEV__ && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(derived)) {
    return "https://locateflow.com";
  }
  return derived || "https://locateflow.com";
}

const APP_WEB_URL = resolveWebAppUrl();

import { getToken as getStoreToken, useAuthStore } from "@/lib/auth-store";

if (__DEV__) {
  console.info("[API] mobile base URL", API_URL);
}

async function getToken(): Promise<string | null> {
  try {
    return await getStoreToken();
  } catch {
    return null;
  }
}

/**
 * Native platform sent to the server as `X-Client-Platform`. The server uses
 * this to label the session device ("LocateFlow iOS app") instead of
 * "Unknown browser" — the native fetch User-Agent has no parseable browser
 * token, so without this header the session showed up as an unknown browser.
 */
const CLIENT_PLATFORM = Platform.OS; // "ios" | "android" | (web fallback)

/**
 * App version reported via `X-Client-Version`. Prefers the native binary
 * version, then the Expo config version, then a dev fallback.
 */
const CLIENT_VERSION =
  Constants.expoConfig?.version ??
  (Constants as any).nativeAppVersion ??
  "0.0.0";

/**
 * Descriptive User-Agent for the native client, e.g.
 * "LocateFlow/1.2.3 (iOS; Expo)". The server recognizes the "LocateFlow"
 * marker as a secondary signal (after X-Client-Platform) when labeling the
 * session device.
 */
const CLIENT_USER_AGENT = `LocateFlow/${CLIENT_VERSION} (${
  Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Mobile"
}; Expo)`;

export const api = new ApiClient({
  baseUrl: API_URL,
  getToken,
  clientType: "mobile",
  clientPlatform: CLIENT_PLATFORM,
  clientVersion: CLIENT_VERSION,
  userAgent: CLIENT_USER_AGENT,
  timeoutMs: 20_000,
  onUnauthorized: async () => {
    // Token invalid — wipe it so the user is routed back to sign-in.
    await useAuthStore.getState().clearSession().catch(() => {});
  },
  onError: (error) => {
    if (__DEV__) {
      console.warn("[API Error]", error.message, API_URL);
    }
  },
});

export { API_URL, APP_WEB_URL };
