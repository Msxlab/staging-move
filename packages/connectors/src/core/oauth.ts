/**
 * Connector core — OAuth 2.0 Authorization Code + PKCE helpers.
 *
 * Pure building blocks for the "connect a partner" flow, used by the web OAuth
 * endpoints (initiate / callback / refresh). LocateFlow is a confidential
 * server-side client: the `client_secret` and the token exchange stay on the
 * server, the user's password never touches us, and we only ever hold the
 * scoped tokens the partner issues.
 *
 * Everything here is pure — randomness and the clock are injectable — so the
 * security-critical bits (PKCE challenge derivation, state, URL assembly) are
 * unit-testable against known vectors.
 */

import { createHash, randomBytes } from "crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cryptographically-random PKCE code verifier (base64url). */
export function generateCodeVerifier(bytes: () => Buffer = () => randomBytes(32)): string {
  return base64url(bytes());
}

/** PKCE S256 challenge: base64url(SHA-256(verifier)). */
export function codeChallengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** Random CSRF `state` token (base64url). */
export function generateState(bytes: () => Buffer = () => randomBytes(16)): string {
  return base64url(bytes());
}

/** Static, per-connector OAuth client configuration (from secrets, never logged). */
export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface AuthorizeUrlParams {
  config: OAuthProviderConfig;
  /** CSRF state, persisted server-side and re-checked at callback. */
  state: string;
  /** PKCE challenge derived from the verifier kept server-side. */
  codeChallenge: string;
  /** Extra provider params, e.g. { access_type: "offline", prompt: "consent" }. */
  extra?: Record<string, string>;
}

/** Assemble the provider authorize URL the user's browser is redirected to. */
export function buildAuthorizeUrl(params: AuthorizeUrlParams): string {
  const { config, state, codeChallenge, extra } = params;
  const url = new URL(config.authorizeUrl);
  const q = url.searchParams;
  q.set("response_type", "code");
  q.set("client_id", config.clientId);
  q.set("redirect_uri", config.redirectUri);
  q.set("scope", config.scopes.join(" "));
  q.set("state", state);
  q.set("code_challenge", codeChallenge);
  q.set("code_challenge_method", "S256");
  for (const [key, value] of Object.entries(extra ?? {})) q.set(key, value);
  return url.toString();
}

/** Form body for the back-channel code→token exchange (server-to-server). */
export function buildTokenExchangeBody(params: {
  config: OAuthProviderConfig;
  code: string;
  codeVerifier: string;
}): Record<string, string> {
  return {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.config.redirectUri,
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    code_verifier: params.codeVerifier,
  };
}

/** Form body for refreshing an expired access token. */
export function buildRefreshBody(params: {
  config: OAuthProviderConfig;
  refreshToken: string;
}): Record<string, string> {
  return {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
  };
}

/**
 * client_credentials grant — for server-to-server APIs (e.g. USPS Addresses 3.0
 * validation) where there is no per-user grant, just an app-level token. Optional
 * `scope` for providers that require it (USPS: "addresses").
 */
export function buildClientCredentialsBody(params: {
  clientId: string;
  clientSecret: string;
  scope?: string;
}): Record<string, string> {
  return {
    grant_type: "client_credentials",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    ...(params.scope ? { scope: params.scope } : {}),
  };
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scope: string | null;
  tokenType: string | null;
}

/** Normalize a provider's token response (snake_case JSON) into our shape. */
export function parseTokenResponse(body: unknown): OAuthTokens {
  const b = (body ?? {}) as Record<string, unknown>;
  const accessToken = typeof b.access_token === "string" ? b.access_token : "";
  if (!accessToken) {
    throw new Error("OAuth token response missing access_token");
  }
  return {
    accessToken,
    refreshToken: typeof b.refresh_token === "string" ? b.refresh_token : null,
    expiresInSeconds: typeof b.expires_in === "number" ? b.expires_in : null,
    scope: typeof b.scope === "string" ? b.scope : null,
    tokenType: typeof b.token_type === "string" ? b.token_type : null,
  };
}

/** Absolute expiry instant for a token, given `expires_in` and the current ms. */
export function tokenExpiryFrom(expiresInSeconds: number | null, nowMs: number): Date | null {
  if (expiresInSeconds === null) return null;
  return new Date(nowMs + expiresInSeconds * 1_000);
}
