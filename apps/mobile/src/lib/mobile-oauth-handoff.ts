import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { consumePkceVerifier } from "@/lib/pkce";

const HANDLED_OAUTH_CODES_STORAGE_KEY = "locateflow.handledOAuthCodes";

// Two callers race for the same handoff code: the WebBrowser success-result
// path (sign-in.tsx → startMobileOAuthSession) and the system deep-link path
// (AuthGuard's Linking.addEventListener in app/_layout.tsx). Both must
// converge on the SAME outcome — either the same success body or the same
// rejection — instead of one path consuming the code and the other seeing
// REPLAYED_CODE. We achieve that with:
//   • inflightExchanges: keyed Promise so the second caller awaits the
//     first caller's API request rather than firing a duplicate.
//   • completedExchanges: in-process success cache so callers that arrive
//     after the promise settled still get the original token/user.
//   • AsyncStorage-backed handled set: cross-restart dedup (a launch URL
//     that already produced a session in a previous app run is a silent
//     no-op rather than a confusing error).
type ExchangeResult = { token: string; user: any };

const inflightExchanges = new Map<string, Promise<ExchangeResult | null>>();
const completedExchanges = new Map<string, ExchangeResult>();

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
    if (protocol === "https:" && host === "locateflow.com") {
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

async function hasPersistedHandledCode(code: string) {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_OAUTH_CODES_STORAGE_KEY);
    const codes = raw ? JSON.parse(raw) : [];
    return Array.isArray(codes) && codes.includes(code);
  } catch {
    return false;
  }
}

async function persistHandledCode(code: string) {
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
  const code = callback.code;

  // 1. Same-process cache: a concurrent caller already finished. Return the
  //    same {token, user} so both callers can drive setSession idempotently.
  const cached = completedExchanges.get(code);
  if (cached) return cached;

  // 2. In-flight: a concurrent caller is mid-request. Coalesce onto its
  //    Promise instead of issuing a duplicate that would race for the same
  //    one-shot code and inevitably get REPLAYED_CODE from the server.
  //    The .get / .set pair below is intentionally synchronous (no await
  //    between them) so two near-simultaneous callers can't both pass the
  //    miss check.
  const existing = inflightExchanges.get(code);
  if (existing) return existing;

  const promise: Promise<ExchangeResult | null> = (async () => {
    // 3. Cross-restart: a prior app instance already consumed this code.
    //    The user is either signed in by another path or no longer needs
    //    this handoff. Return null (silent no-op) — callers must NOT treat
    //    this as an error.
    if (await hasPersistedHandledCode(code)) return null;

    const verifier = callback.state ? await consumePkceVerifier(callback.state) : null;
    const body: Record<string, string> = { code };
    if (verifier) body.code_verifier = verifier;

    const res = await api.post<{ token?: string; user?: any }>("/api/mobile/auth/exchange", body);
    if (res.error || !res.data?.token || !res.data.user) {
      throw new Error(res.error || "Could not complete mobile sign-in.");
    }

    const result: ExchangeResult = { token: res.data.token, user: res.data.user };
    completedExchanges.set(code, result);
    await persistHandledCode(code);
    return result;
  })();

  inflightExchanges.set(code, promise);
  try {
    return await promise;
  } finally {
    // The promise has either succeeded (result cached in completedExchanges)
    // or rejected (caller will surface the error). Either way the inflight
    // slot is no longer useful — drop it so a future fresh code can reuse
    // the map. We do NOT remove from completedExchanges or the persisted
    // set: a one-shot code stays "consumed" forever.
    inflightExchanges.delete(code);
  }
}
