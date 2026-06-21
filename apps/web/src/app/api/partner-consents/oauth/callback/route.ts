import { NextRequest, NextResponse } from "next/server";
import { getOAuthRedirectUri, getOAuthResponseUrl } from "@/lib/oauth";
import { getUserSession, shouldUseSecureSessionCookies } from "@/lib/user-auth";
import {
  exchangeConnectorCode,
  getConnectorOAuthConfig,
  isApiConnectorsEnabled,
  isConnectorEnabled,
  isValidConnectorKey,
  upsertGrantedConsent,
  userHasApiConnectorEntitlement,
} from "@/lib/connector-oauth";
import { ApiGateError } from "@/lib/api-gates";
import { assertWorkspaceAction, resolveWorkspaceDataScope } from "@/lib/workspace-data-scope";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/partner-consents/oauth/callback";

function expireOAuthCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: shouldUseSecureSessionCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function clearCookies(res: NextResponse): NextResponse {
  expireOAuthCookie(res, "pc_oauth_state");
  expireOAuthCookie(res, "pc_oauth_pkce");
  expireOAuthCookie(res, "pc_oauth_connector");
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

  let entitlementUserId = session.userId;
  try {
    const scope = await resolveWorkspaceDataScope(request, session.userId);
    assertWorkspaceAction(scope, "addressChange.initiate", { resourceUserId: session.userId });
    entitlementUserId = scope.workspaceId ? scope.ownerUserId : session.userId;
  } catch (error) {
    if (error instanceof ApiGateError) {
      const code = error.code === "STALE_WORKSPACE_SELECTION" ? "stale-workspace" : "workspace-forbidden";
      return fail(`/dashboard?connector_error=${code}`);
    }
    throw error;
  }

  if (!(await userHasApiConnectorEntitlement(entitlementUserId))) {
    return fail("/dashboard?connector_error=plan-not-entitled");
  }
  if (!(await isConnectorEnabled(connectorKey))) {
    return fail("/dashboard?connector_error=connector-disabled");
  }

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
