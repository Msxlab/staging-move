/**
 * Lightweight OAuth helpers — state param, PKCE (Google), Apple client_secret.
 * No external OAuth library — just `fetch` + `crypto`.
 */

import { randomBytes, createHash, createPrivateKey } from "crypto";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

// ── State + PKCE ──────────────────────────────────────────────

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export function generatePkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
}

export async function getRuntimeBaseUrl(): Promise<string> {
  const value = await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL");
  return (value || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function isInternalHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("0.0.0.0:") ||
    normalized === "[::1]" ||
    normalized.startsWith("[::1]:")
  );
}

function originFromHost(host: string | null, proto: string | null): string | null {
  if (!host || isInternalHost(host)) return null;
  const scheme = proto === "http" ? "http" : "https";
  return `${scheme}://${host}`.replace(/\/+$/, "");
}

function hostnameFromHost(host: string | null): string | null {
  if (!host) return null;
  try {
    return new URL(`https://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedOAuthHost(host: string | null, configuredOrigin: string): boolean {
  const hostname = hostnameFromHost(host);
  if (!hostname) return false;

  const configuredHostname = hostnameFromOrigin(configuredOrigin);
  if (configuredHostname && hostname === configuredHostname) return true;

  return (
    hostname === "locateflow.app" ||
    hostname.endsWith(".locateflow.app") ||
    hostname === "locateflow.com" ||
    hostname.endsWith(".locateflow.com") ||
    (hostname.startsWith("locateflow-") && hostname.endsWith(".ondigitalocean.app"))
  );
}

export async function getOAuthRequestOrigin(request: NextRequest): Promise<string> {
  const runtimeBaseUrl = await getRuntimeBaseUrl();
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const originFromTrustedHost = (host: string | null, proto: string | null): string | null => {
    if (!isTrustedOAuthHost(host, runtimeBaseUrl)) return null;
    return originFromHost(host, proto);
  };

  const directHost = firstHeaderValue(request.headers.get("host"));
  const hostOrigin = originFromTrustedHost(
    directHost,
    forwardedProto || request.nextUrl.protocol.replace(":", ""),
  );
  if (hostOrigin) return hostOrigin;

  const forwardedHost =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
    firstHeaderValue(request.headers.get("x-original-host"));
  const forwardedOrigin = originFromTrustedHost(forwardedHost, forwardedProto);
  if (forwardedOrigin) return forwardedOrigin;

  return runtimeBaseUrl;
}

export async function getOAuthRedirectUri(request: NextRequest, callbackPath: string): Promise<string> {
  const origin = await getOAuthRequestOrigin(request);
  return `${origin}${callbackPath}`;
}

export async function getOAuthResponseUrl(request: NextRequest, path: string): Promise<URL> {
  const origin = await getOAuthRequestOrigin(request);
  return new URL(path, origin);
}

export function normalizeOAuthRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  return normalizeAppRedirectPath(value, fallback);
}

export async function getGoogleOAuthCredentials() {
  const [clientId, clientSecret] = await Promise.all([
    getRuntimeConfigValue("GOOGLE_OAUTH_CLIENT_ID"),
    getRuntimeConfigValue("GOOGLE_OAUTH_CLIENT_SECRET"),
  ]);
  return { clientId, clientSecret };
}

export async function getAppleOAuthCredentials() {
  const [clientId, teamId, keyId, privateKeyPem] = await Promise.all([
    getRuntimeConfigValue("APPLE_OAUTH_CLIENT_ID"),
    getRuntimeConfigValue("APPLE_OAUTH_TEAM_ID"),
    getRuntimeConfigValue("APPLE_OAUTH_KEY_ID"),
    getRuntimeConfigValue("APPLE_OAUTH_PRIVATE_KEY"),
  ]);
  return { clientId, teamId, keyId, privateKeyPem };
}

// ── Google ─────────────────────────────────────────────────────

export interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud: string;
  iss: string;
}

export function googleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  pkceChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    code_challenge: opts.pkceChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  pkceVerifier: string;
}): Promise<{ idToken: string; accessToken: string } | null> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
    code_verifier: opts.pkceVerifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("[OAUTH] google token exchange failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json();
  return { idToken: json.id_token, accessToken: json.access_token };
}

// ── Apple ──────────────────────────────────────────────────────

export function appleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "name email",
    state: opts.state,
    response_mode: "form_post", // Apple requires form_post when scope is requested
  });
  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

export function isAppleEmailVerifiedClaim(value: boolean | string | null | undefined): boolean {
  return value === true || value === "true";
}

/**
 * Apple requires a short-lived client_secret JWT signed with the developer's
 * private key (ES256). Generated per token exchange.
 */
async function buildAppleClientSecret(opts: {
  teamId: string;
  clientId: string;
  keyId: string;
  privateKeyPem: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = createPrivateKey({ key: opts.privateKeyPem, format: "pem" });

  return new SignJWT({ })
    .setProtectedHeader({ alg: "ES256", kid: opts.keyId })
    .setIssuer(opts.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .setAudience("https://appleid.apple.com")
    .setSubject(opts.clientId)
    .sign(privateKey);
}

export async function exchangeAppleCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  teamId: string;
  keyId: string;
  privateKeyPem: string;
}): Promise<{ idToken: string } | null> {
  const clientSecret = await buildAppleClientSecret({
    teamId: opts.teamId,
    clientId: opts.clientId,
    keyId: opts.keyId,
    privateKeyPem: opts.privateKeyPem,
  });

  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("[OAUTH] apple token exchange failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json();
  return { idToken: json.id_token };
}

// ── Generic JWT payload parser (NO signature verification here — do that
//    via jose.createRemoteJWKSet in the callback). Callbacks re-verify.
// ────────────────────────────────────────────────────────────────

export function decodeJwtPayload<T = any>(jwt: string): T | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
