/**
 * PKCE (RFC 7636) helpers for mobile OAuth.
 *
 * The verifier never leaves the device — it's generated locally,
 * stored in SecureStore alongside the state nonce, and presented to
 * `/api/mobile/auth/exchange` together with the OAuth code that came
 * back via the deep-link redirect. The server enforces
 * `sha256(verifier) == challenge` so a hostile Android app that
 * registers the `locateflow://` scheme and intercepts the redirect
 * cannot complete the exchange without ALSO stealing the verifier
 * from the legitimate app's SecureStore — a much harder attack.
 *
 * The `state` value is a separate random nonce that ties an in-flight
 * OAuth attempt to the SecureStore entry holding its verifier; on
 * callback we look up the verifier by state, ensuring an attacker
 * who somehow injects an unrelated `code` cannot get it exchanged
 * against a different attempt's verifier.
 */
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const VERIFIER_BYTES = 32; // 256 bits → 43-char base64url verifier
const STATE_BYTES = 16; // 128 bits is plenty for cross-flow uniqueness
const STORAGE_KEY_PREFIX = "locateflow.oauth.pkce.";
const STORAGE_TTL_MS = 10 * 60 * 1000;

function bytesToBase64Url(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    base64 += alphabet[(chunk >> 18) & 63];
    base64 += alphabet[(chunk >> 12) & 63];
    base64 += alphabet[(chunk >> 6) & 63];
    base64 += alphabet[chunk & 63];
  }
  if (i < bytes.length) {
    const remaining = bytes.length - i;
    const chunk = (bytes[i] << 16) | (remaining === 2 ? bytes[i + 1] << 8 : 0);
    base64 += alphabet[(chunk >> 18) & 63];
    base64 += alphabet[(chunk >> 12) & 63];
    base64 += remaining === 2 ? alphabet[(chunk >> 6) & 63] : "=";
    base64 += "=";
  }
  return base64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

/**
 * Generate a fresh PKCE verifier + S256 challenge + state nonce. Uses
 * `expo-crypto.getRandomBytesAsync` which is backed by the platform
 * CSPRNG (SecRandom on iOS, SecureRandom on Android).
 */
export async function generatePkcePair(): Promise<PkcePair> {
  const verifierBytes = await Crypto.getRandomBytesAsync(VERIFIER_BYTES);
  const stateBytes = await Crypto.getRandomBytesAsync(STATE_BYTES);
  const verifier = bytesToBase64Url(verifierBytes);
  const state = bytesToBase64Url(stateBytes);
  // Compute SHA-256(verifier) → base64url. expo-crypto's digest API
  // accepts string input and emits Uint8Array, which we re-encode.
  const challengeBytes = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    new TextEncoder().encode(verifier),
  );
  const challenge = bytesToBase64Url(new Uint8Array(challengeBytes));
  return { verifier, challenge, state };
}

interface StoredPkce {
  verifier: string;
  expiresAt: number;
}

function storageKeyFor(state: string): string {
  return `${STORAGE_KEY_PREFIX}${state}`;
}

/**
 * Persist the verifier in SecureStore under the state key so the
 * callback handler can recover it when the OAuth redirect lands.
 * Stored entries auto-expire after STORAGE_TTL_MS at read time.
 */
export async function persistPkceVerifier(state: string, verifier: string): Promise<void> {
  const payload: StoredPkce = {
    verifier,
    expiresAt: Date.now() + STORAGE_TTL_MS,
  };
  await SecureStore.setItemAsync(storageKeyFor(state), JSON.stringify(payload));
}

/**
 * Look up the verifier stored under the given state. Returns null when
 * the state is unknown, expired, or the SecureStore read fails. The
 * entry is deleted on read regardless of result — verifiers are
 * single-use.
 */
export async function consumePkceVerifier(state: string): Promise<string | null> {
  if (!state) return null;
  const key = storageKeyFor(state);
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(key);
  } catch {
    raw = null;
  }
  // Best-effort delete; failures here are non-fatal (next OAuth attempt
  // overwrites under a new state key anyway).
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* noop */
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPkce;
    if (typeof parsed?.verifier !== "string") return null;
    if (typeof parsed?.expiresAt === "number" && Date.now() > parsed.expiresAt) return null;
    return parsed.verifier;
  } catch {
    return null;
  }
}
