/**
 * Lightweight OAuth helpers — state param, PKCE (Google), Apple client_secret.
 * No external OAuth library — just `fetch` + `crypto`.
 */

import { randomBytes, createHash, createPrivateKey } from "crypto";
import { SignJWT } from "jose";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

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
