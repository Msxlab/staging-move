/**
 * Native Sign in with Apple (iOS) bridge.
 *
 * On iOS this presents the native Sign in with Apple sheet via
 * `expo-apple-authentication` and hands the resulting identity token to the
 * backend at `/api/mobile/auth/apple/native` for server-side verification.
 * The backend mints a mobile JWT exactly like the existing web-mediated flow.
 *
 * On Android / web / iOS simulators where the native flow is unavailable, the
 * caller should fall back to the existing `startMobileOAuthSession("apple")`
 * web flow.
 *
 * Apple private relay email is handled by the backend (the identity token's
 * `email` claim contains the relay address; we store it as-is).
 */
import { Platform } from "react-native";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-store";
import type { LegalConsentState } from "@/lib/legal";
import { captureException } from "@/lib/sentry";

type AppleModule = typeof import("expo-apple-authentication");
declare const require: (moduleName: string) => unknown;

let cached: AppleModule | null | undefined;

function getAppleModule(): AppleModule | null {
  if (Platform.OS !== "ios") return null;
  if (cached !== undefined) return cached;
  try {
    cached = require("expo-apple-authentication") as AppleModule;
  } catch (err) {
    captureException(err, { area: "apple-auth", step: "require" });
    cached = null;
  }
  return cached;
}

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  const mod = getAppleModule();
  if (!mod) return false;
  try {
    return await mod.isAvailableAsync();
  } catch {
    return false;
  }
}

export interface NativeAppleSignInResult {
  status: "ok" | "cancelled" | "unavailable" | "error";
  token?: string;
  user?: AuthUser;
  error?: string;
}

interface AppleNativeExchangeResponse {
  token?: string;
  user?: AuthUser;
  error?: string;
}

interface NativeAppleSignInOptions {
  legalConsents?: LegalConsentState | null;
}

/**
 * Trigger the native Apple sheet and exchange the identity token with the
 * backend for a mobile session JWT. The caller should hydrate the auth store
 * with the returned `token` + `user` on `status === "ok"`.
 */
export async function signInWithAppleNative(
  options: NativeAppleSignInOptions = {},
): Promise<NativeAppleSignInResult> {
  const mod = getAppleModule();
  if (!mod) return { status: "unavailable" };

  try {
    const available = await mod.isAvailableAsync();
    if (!available) return { status: "unavailable" };

    const credential = await mod.signInAsync({
      requestedScopes: [
        mod.AppleAuthenticationScope.FULL_NAME,
        mod.AppleAuthenticationScope.EMAIL,
      ],
    });

    const identityToken = credential.identityToken;
    if (!identityToken) {
      return { status: "error", error: "Apple did not return an identity token." };
    }

    const res = await api.post<AppleNativeExchangeResponse>("/api/mobile/auth/apple/native", {
      identityToken,
      authorizationCode: credential.authorizationCode || null,
      nonce: (credential as { nonce?: string | null }).nonce || null,
      user: credential.user,
      legalConsents: options.legalConsents ?? null,
      fullName: credential.fullName
        ? {
            givenName: credential.fullName.givenName || null,
            familyName: credential.fullName.familyName || null,
          }
        : null,
      email: credential.email || null,
    });

    if (res.error || !res.data?.token || !res.data?.user) {
      return {
        status: "error",
        error: res.error || res.data?.error || "Apple sign-in could not be completed.",
      };
    }

    return { status: "ok", token: res.data.token, user: res.data.user };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
      return { status: "cancelled" };
    }
    captureException(err, { area: "apple-auth", step: "signInAsync" });
    return {
      status: "error",
      error: (err as { message?: string } | null)?.message || "Apple sign-in failed.",
    };
  }
}
