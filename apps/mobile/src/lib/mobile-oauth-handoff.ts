import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { consumePkceVerifier } from "@/lib/pkce";

const HANDLED_OAUTH_CODES_STORAGE_KEY = "locateflow.handledOAuthCodes";
const handledInMemory = new Set<string>();

export interface MobileOAuthCallback {
  code: string;
  state: string | null;
  provider: string | null;
}

export function isMobileOAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, "").toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (protocol === "locateflow:" && (host || path) === "oauth") return true;
    if ((protocol === "exp:" || protocol === "exps:") && pathParts.includes("oauth")) return true;
    if (protocol === "https:" && ["locateflow.com", "locateflow.app", "app.locateflow.com"].includes(host)) {
      return path === "mobile/oauth" || path === "oauth";
    }
    return false;
  } catch {
    return url.startsWith("locateflow://oauth");
  }
}

export function readMobileOAuthCallback(url: string | null | undefined): MobileOAuthCallback | null {
  if (!url || !isMobileOAuthCallbackUrl(url)) return null;
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return null;
  const query = url.slice(queryStart + 1).split("#")[0];
  const params = new URLSearchParams(query);
  const code = params.get("code");
  if (!code) {
    const malformedCode = query.match(/^code\?([^&]+)/);
    if (!malformedCode?.[1]) return null;
    return {
      code: decodeURIComponent(malformedCode[1]),
      state: params.get("state"),
      provider: params.get("provider"),
    };
  }
  return {
    code,
    state: params.get("state"),
    provider: params.get("provider"),
  };
}

async function hasHandledOAuthCode(code: string) {
  if (handledInMemory.has(code)) return true;
  try {
    const raw = await AsyncStorage.getItem(HANDLED_OAUTH_CODES_STORAGE_KEY);
    const codes = raw ? JSON.parse(raw) : [];
    return Array.isArray(codes) && codes.includes(code);
  } catch {
    return false;
  }
}

async function rememberHandledOAuthCode(code: string) {
  handledInMemory.add(code);
  try {
    const raw = await AsyncStorage.getItem(HANDLED_OAUTH_CODES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const codes = Array.isArray(parsed) ? parsed : [];
    const next = [code, ...codes.filter((item: unknown) => typeof item === "string" && item !== code)].slice(0, 20);
    await AsyncStorage.setItem(HANDLED_OAUTH_CODES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* best effort */
  }
}

export async function exchangeMobileOAuthCallbackUrl(url: string | null | undefined) {
  const callback = readMobileOAuthCallback(url);
  if (!callback) return null;
  if (await hasHandledOAuthCode(callback.code)) return null;
  handledInMemory.add(callback.code);

  const verifier = callback.state ? await consumePkceVerifier(callback.state) : null;
  const body: Record<string, string> = { code: callback.code };
  if (verifier) body.code_verifier = verifier;

  const res = await api.post<{ token?: string; user?: any }>("/api/mobile/auth/exchange", body);
  if (res.error || !res.data?.token || !res.data.user) {
    handledInMemory.delete(callback.code);
    throw new Error(res.error || "Could not complete mobile sign-in.");
  }

  await rememberHandledOAuthCode(callback.code);
  return res.data;
}
