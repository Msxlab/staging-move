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
          if (envHost === expoHost) {
            return envApiUrl;
          }
        } catch {}
      }

      return `http://${expoHost}:3000/api`;
    }
  }

  return envApiUrl || "https://app.locateflow.com/api";
}

const API_URL = resolveApiUrl();

import { getToken as getStoreToken, clearToken as clearStoreToken } from "@/lib/auth-store";

// Keep setTokenGetter as a no-op for any legacy callers (pre-migration).
export function setTokenGetter(_fn: () => Promise<string | null>) {
  /* no-op — token is now persisted in auth-store / SecureStore */
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
  onUnauthorized: async () => {
    // Token invalid — wipe it so the user is routed back to sign-in.
    await clearStoreToken().catch(() => {});
  },
  onError: (error) => {
    if (__DEV__) {
      console.warn("[API Error]", error.message, API_URL);
    }
  },
});

export { API_URL };
