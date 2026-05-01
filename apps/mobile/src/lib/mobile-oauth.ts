import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, API_URL } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-store";
import {
  getPendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

type SetSession = (token: string, user: AuthUser) => Promise<void>;

export interface MobileOAuthResult {
  handled: boolean;
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

interface ExchangeResponse {
  token?: string;
  user?: AuthUser;
}

const OAUTH_CALLBACK_PATH = "oauth";
const exchangeByCode = new Map<string, Promise<MobileOAuthResult>>();

export function getMobileOAuthRedirectUri() {
  const redirectUri = ExpoLinking.createURL(OAUTH_CALLBACK_PATH);
  return redirectUri.startsWith("locateflow:") ? "locateflow://oauth" : redirectUri;
}

export function buildMobileOAuthUrl(provider: OAuthProvider) {
  const webBase = API_URL.replace(/\/api\/?$/, "");
  const params = new URLSearchParams({
    client: "mobile",
    mobileRedirectUri: getMobileOAuthRedirectUri(),
    redirect: "/dashboard",
  });
  return `${webBase}/api/auth/oauth/${provider}?${params.toString()}`;
}

function parseOAuthUrl(url: string | null): { code?: string; error?: string } | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const isLocateFlowCallback =
    parsed.protocol === "locateflow:" &&
    (parsed.hostname === OAUTH_CALLBACK_PATH || pathParts.includes(OAUTH_CALLBACK_PATH));
  const isExpoCallback =
    (parsed.protocol === "exp:" || parsed.protocol === "exps:") &&
    pathParts.includes(OAUTH_CALLBACK_PATH);

  if (!isLocateFlowCallback && !isExpoCallback) return null;

  return {
    code: parsed.searchParams.get("code") || undefined,
    error: parsed.searchParams.get("error") || undefined,
  };
}

function mobileOAuthErrorMessage(error?: string) {
  switch (error) {
    case "INVALID_CODE":
    case "EXPIRED_CODE":
    case "REPLAYED_CODE":
      return "Google sign-in expired. Please try again.";
    case "ACCOUNT_UNAVAILABLE":
    case "oauth-account-unavailable":
      return "This account is unavailable. Contact support if this looks wrong.";
    case "access_denied":
      return "Sign-in was cancelled.";
    case "mobile-oauth-redirect-invalid":
      return "Mobile sign-in is not configured for this build.";
    case "mobile-oauth-handoff-failed":
      return "Mobile sign-in could not be completed. Please try again.";
    default:
      return "Google sign-in could not be completed. Please try again.";
  }
}

async function persistPendingLegalAcceptance() {
  const pendingLegalConsents = getPendingLegalConsents();
  if (!hasRequiredLegalConsents(pendingLegalConsents)) return;

  await api.post("/api/legal/acceptance", { legalConsents: pendingLegalConsents }).catch(() => null);
  setPendingLegalConsents(null);
}

async function exchangeOAuthCode(code: string, setSession: SetSession): Promise<MobileOAuthResult> {
  const res = await api.post<ExchangeResponse>("/api/mobile/auth/exchange", { code });
  if (res.error || !res.data?.token || !res.data.user) {
    return {
      handled: true,
      success: false,
      error: mobileOAuthErrorMessage(res.error),
    };
  }

  await setSession(res.data.token, res.data.user);
  await persistPendingLegalAcceptance();
  return { handled: true, success: true };
}

export async function completeMobileOAuthUrl(
  url: string | null,
  setSession: SetSession,
): Promise<MobileOAuthResult> {
  const parsed = parseOAuthUrl(url);
  if (!parsed) return { handled: false, success: false };

  if (parsed.error) {
    return {
      handled: true,
      success: false,
      cancelled: parsed.error === "access_denied",
      error: mobileOAuthErrorMessage(parsed.error),
    };
  }

  if (!parsed.code) {
    return {
      handled: true,
      success: false,
      error: "Google sign-in returned without a handoff code. Please try again.",
    };
  }

  let exchange = exchangeByCode.get(parsed.code);
  if (!exchange) {
    exchange = exchangeOAuthCode(parsed.code, setSession);
    exchangeByCode.set(parsed.code, exchange);
  }

  const result = await exchange;
  if (!result.success) exchangeByCode.delete(parsed.code);
  return result;
}

export async function startMobileOAuthSession(
  provider: OAuthProvider,
  setSession: SetSession,
): Promise<MobileOAuthResult> {
  const redirectUri = getMobileOAuthRedirectUri();
  const authUrl = buildMobileOAuthUrl(provider);

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === "cancel" || result.type === "dismiss") {
      return { handled: true, success: false, cancelled: true };
    }
    if (result.type === "success") {
      return completeMobileOAuthUrl(result.url, setSession);
    }
    return { handled: false, success: false };
  } catch {
    await ExpoLinking.openURL(authUrl);
    return { handled: false, success: false };
  }
}
