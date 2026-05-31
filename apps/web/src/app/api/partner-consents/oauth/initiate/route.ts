import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@locateflow/connectors";
import { generatePkce, generateState, getOAuthRedirectUri } from "@/lib/oauth";
import { getUserSession, shouldUseSecureSessionCookies } from "@/lib/user-auth";
import {
  getConnectorOAuthConfig,
  isApiConnectorsEnabled,
  isConnectorEnabled,
  isValidConnectorKey,
  userHasApiConnectorEntitlement,
} from "@/lib/connector-oauth";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/partner-consents/oauth/callback";

/**
 * GET /api/partner-consents/oauth/initiate?connector=usps
 *
 * Starts the "connect a partner" OAuth flow. Requires a logged-in user, the
 * master feature flag, and an enabled + configured connector. State + PKCE
 * verifier are kept in short-lived httpOnly cookies; the user's browser is
 * redirected to the partner. With no partner credentials configured this
 * returns 503 — inert by default.
 */
export async function GET(request: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ error: "Connectors are not enabled." }, { status: 503 });
  }
  if (!(await userHasApiConnectorEntitlement(session.userId))) {
    return NextResponse.json({ error: "Your plan doesn't include automatic connectors." }, { status: 403 });
  }

  const connectorKey = request.nextUrl.searchParams.get("connector") ?? "";
  if (!isValidConnectorKey(connectorKey)) {
    return NextResponse.json({ error: "Invalid connector." }, { status: 400 });
  }
  if (!(await isConnectorEnabled(connectorKey))) {
    return NextResponse.json({ error: "Connector is not enabled." }, { status: 503 });
  }

  const redirectUri = await getOAuthRedirectUri(request, CALLBACK_PATH);
  const config = await getConnectorOAuthConfig(connectorKey, redirectUri);
  if (!config) {
    return NextResponse.json({ error: "Connector OAuth is not configured." }, { status: 503 });
  }

  const state = generateState();
  const pkce = generatePkce();
  const url = buildAuthorizeUrl({
    config,
    state,
    codeChallenge: pkce.challenge,
    extra: { access_type: "offline", prompt: "consent" },
  });

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    secure: shouldUseSecureSessionCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  res.cookies.set("pc_oauth_state", state, cookieOpts);
  res.cookies.set("pc_oauth_pkce", pkce.verifier, cookieOpts);
  res.cookies.set("pc_oauth_connector", connectorKey, cookieOpts);
  return res;
}
