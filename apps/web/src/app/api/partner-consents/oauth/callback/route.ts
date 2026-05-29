import { NextRequest, NextResponse } from "next/server";
import { getOAuthRedirectUri, getOAuthResponseUrl } from "@/lib/oauth";
import { getUserSession } from "@/lib/user-auth";
import {
  exchangeConnectorCode,
  getConnectorOAuthConfig,
  isApiConnectorsEnabled,
  isValidConnectorKey,
  upsertGrantedConsent,
} from "@/lib/connector-oauth";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/partner-consents/oauth/callback";

function clearCookies(res: NextResponse): NextResponse {
  res.cookies.delete("pc_oauth_state");
  res.cookies.delete("pc_oauth_pkce");
  res.cookies.delete("pc_oauth_connector");
  return res;
}

/**
 * GET /api/partner-consents/oauth/callback
 *
 * Finishes the flow: validates the CSRF state cookie, exchanges the code for
 * tokens server-side, and stores an encrypted PartnerConsent attached to the
 * logged-in user. Always redirects back into the app (errors land on the
 * dashboard with a connector_error query param) and clears the flow cookies.
 */
export async function GET(request: NextRequest) {
  const fail = async (path: string) =>
    clearCookies(NextResponse.redirect(await getOAuthResponseUrl(request, path)));

  const session = await getUserSession();
  if (!session) return fail("/sign-in?error=connector-auth-required");
  if (!(await isApiConnectorsEnabled())) return fail("/dashboard?connector_error=disabled");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) return fail(`/dashboard?connector_error=${encodeURIComponent(errorParam)}`);
  if (!code || !state) return fail("/dashboard?connector_error=missing-code");

  const cookieState = request.cookies.get("pc_oauth_state")?.value;
  const verifier = request.cookies.get("pc_oauth_pkce")?.value;
  const connectorKey = request.cookies.get("pc_oauth_connector")?.value ?? "";
  if (!cookieState || !verifier || cookieState !== state) {
    return fail("/dashboard?connector_error=state-mismatch");
  }
  if (!isValidConnectorKey(connectorKey)) return fail("/dashboard?connector_error=invalid-connector");

  const redirectUri = await getOAuthRedirectUri(request, CALLBACK_PATH);
  const config = await getConnectorOAuthConfig(connectorKey, redirectUri);
  if (!config) return fail("/dashboard?connector_error=not-configured");

  const tokens = await exchangeConnectorCode(config, code, verifier);
  if (!tokens) return fail("/dashboard?connector_error=token-exchange-failed");

  try {
    await upsertGrantedConsent({
      userId: session.userId,
      connectorKey,
      tokens,
      consentSnapshot: {
        connectorKey,
        scopes: config.scopes,
        grantedAt: new Date().toISOString(),
      },
      now: new Date(),
    });
  } catch {
    return fail("/dashboard?connector_error=persist-failed");
  }

  return clearCookies(
    NextResponse.redirect(
      await getOAuthResponseUrl(request, `/dashboard?connector_connected=${encodeURIComponent(connectorKey)}`),
    ),
  );
}
