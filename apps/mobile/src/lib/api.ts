import { ApiClient } from "@locateflow/shared";
import Constants from "expo-constants";

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
  if (!__DEV__ && !/^https:\/\//i.test(url)) {
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

export const api = new ApiClient({
  baseUrl: API_URL,
  getToken,
  clientType: "mobile",
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
