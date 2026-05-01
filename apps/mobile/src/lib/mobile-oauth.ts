import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, API_URL } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-store";
import {
  getPendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import { exchangeMobileOAuthCallbackUrl } from "@/lib/mobile-oauth-handoff";
import { generatePkcePair, persistPkceVerifier } from "@/lib/pkce";

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

type SetSession = (token: string, user: AuthUser) => Promise<void>;

export interface MobileOAuthResult {
  handled: boolean;
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

const OAUTH_CALLBACK_PATH = "oauth";
const exchangeByCode = new Map<string, Promise<MobileOAuthResult>>();

export function getMobileOAuthRedirectUri() {
  const configured = process.env.EXPO_PUBLIC_MOBILE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const redirectUri = ExpoLinking.createURL(OAUTH_CALLBACK_PATH);
  return redirectUri.startsWith("locateflow:") ? "locateflow://oauth" : redirectUri;
}

export function buildMobileOAuthUrl(
  provider: OAuthProvider,
  pkce?: { challenge: string; state: string },
) {
  const webBase = API_URL.replace(/\/api\/?$/, "");
  const params = new URLSearchParams({
    client: "mobile",
    mobileRedirectUri: getMobileOAuthRedirectUri(),
    redirect: "/dashboard",
  });
  if (pkce?.challenge) params.set("mobileCodeChallenge", pkce.challenge);
  if (pkce?.state) params.set("mobileState", pkce.state);
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
  const path = parsed.pathname.replace(/^\/+/, "").toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const isLocateFlowCallback =
    parsed.protocol === "locateflow:" &&
    (host === OAUTH_CALLBACK_PATH || pathParts.includes(OAUTH_CALLBACK_PATH));
  const isExpoCallback =
    (parsed.protocol === "exp:" || parsed.protocol === "exps:") &&
    pathParts.includes(OAUTH_CALLBACK_PATH);
  const isHttpsCallback =
    parsed.protocol === "https:" &&
    ["locateflow.com", "locateflow.app", "app.locateflow.com"].includes(host) &&
    (path === "mobile/oauth" || path === OAUTH_CALLBACK_PATH);

  if (!isLocateFlowCallback && !isExpoCallback && !isHttpsCallback) return null;

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
    case "PKCE_VERIFIER_REQUIRED":
    case "PKCE_VERIFIER_INVALID":
      return "Sign-in expired. Please try again.";
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

async function exchangeOAuthUrl(url: string, setSession: SetSession): Promise<MobileOAuthResult> {
  try {
    const exchanged = await exchangeMobileOAuthCallbackUrl(url);
    if (!exchanged?.token || !exchanged.user) {
      return {
        handled: true,
        success: false,
        error: "Sign-in is already being completed.",
      };
    }

    await setSession(exchanged.token, exchanged.user as AuthUser);
    await persistPendingLegalAcceptance();
    return { handled: true, success: true };
  } catch (err: any) {
    return {
      handled: true,
      success: false,
      error: mobileOAuthErrorMessage(err?.message),
    };
  }
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
    exchange = exchangeOAuthUrl(url!, setSession);
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
  const pkce = await generatePkcePair();
  await persistPkceVerifier(pkce.state, pkce.verifier);
  const authUrl = buildMobileOAuthUrl(provider, { challenge: pkce.challenge, state: pkce.state });

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
