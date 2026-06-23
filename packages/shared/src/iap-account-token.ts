/**
 * Deterministic per-user IAP "account token" derivation (audit fix 1.1 —
 * mobile-iap-billing-01 / mobile-iap-purchase-01).
 *
 * PROBLEM: store receipts are claimed first-come with no buyer↔account proof,
 * so a receipt can be redeemed on a DIFFERENT account (entitlement theft /
 * buyer lockout).
 *
 * FIX: at purchase time the mobile client attaches an account token derived
 * DETERMINISTICALLY from the authed userId:
 *   - iOS:     StoreKit2 `appAccountToken` (must be a UUID).
 *   - Android: Play Billing `obfuscatedAccountIdAndroid`.
 * The store echoes that value back inside the *verified* receipt:
 *   - Apple:   `appAccountToken` on the verified JWS transaction.
 *   - Google:  `externalAccountIdentifiers.obfuscatedExternalAccountId`
 *              on the v2 subscription purchase.
 * The server recomputes the expected token from the authed userId and, when a
 * receipt CARRIES a token that does NOT match, can reject the grant. Because
 * the derivation is deterministic the server needs NO new storage — it just
 * recomputes and compares.
 *
 * The derivation MUST be byte-identical on mobile (React Native / Hermes,
 * no `node:crypto`) and server (Node). To guarantee that without depending on
 * any platform crypto, this module ships a tiny self-contained, dependency-free
 * SHA-1 and produces an RFC 4122 v5 UUID:
 *
 *   appAccountToken(userId) = UUIDv5(name = userId, namespace = NAMESPACE)
 *
 * where UUIDv5 = format( sha1(namespaceBytes ++ utf8(name))[0..16],
 *                        version=5, variant=RFC4122 ).
 *
 * The Android obfuscated account id reuses the same UUID string so both stores
 * carry the same per-user value.
 *
 * This file has NO imports and NO platform dependencies on purpose — it is the
 * single source of truth both apps compile.
 */

/**
 * Fixed namespace UUID for LocateFlow IAP account tokens. Any random-but-stable
 * v4 UUID works as an RFC 4122 namespace; it only needs to be constant forever.
 * Do NOT change this value — doing so would change every user's token and break
 * matching for clients already in the field.
 */
export const IAP_ACCOUNT_TOKEN_NAMESPACE = "6f9b4d2e-1c7a-4a9f-8b3d-2e5c1a0f7d64";

// ── Pure SHA-1 (RFC 3174). Self-contained so mobile + server hash identically.
// SHA-1 is used here ONLY as the RFC 4122 v5 UUID construction primitive; it is
// not protecting a secret. The token's security comes from it being echoed back
// inside a store-signed receipt the server already cryptographically verifies.

function rotl(n: number, s: number): number {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
}

function sha1(bytes: Uint8Array): Uint8Array {
  // Pre-processing: append 0x80, pad with zeros to 56 mod 64, then 64-bit length.
  const ml = bytes.length * 8;
  const withOne = bytes.length + 1;
  const totalLen = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(totalLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  // 64-bit big-endian message length in bits. Lengths here are tiny (a userId),
  // so the high 32 bits are always 0; write the low 32 bits big-endian.
  const lenLo = ml >>> 0;
  msg[totalLen - 4] = (lenLo >>> 24) & 0xff;
  msg[totalLen - 3] = (lenLo >>> 16) & 0xff;
  msg[totalLen - 2] = (lenLo >>> 8) & 0xff;
  msg[totalLen - 1] = lenLo & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);
  for (let chunk = 0; chunk < totalLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      w[i] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const hs = [h0, h1, h2, h3, h4];
  for (let i = 0; i < 5; i++) {
    out[i * 4] = (hs[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hs[i] & 0xff;
  }
  return out;
}

function utf8Bytes(str: string): Uint8Array {
  // TextEncoder is available in Hermes (RN) and Node 24. Fall back to a manual
  // UTF-8 encode for any environment that lacks it so the helper stays portable.
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      i++;
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}

function uuidStringToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuidString(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/**
 * RFC 4122 v5 UUID from a namespace UUID + name string (pure, deterministic).
 */
function uuidV5(name: string, namespace: string): string {
  const nsBytes = uuidStringToBytes(namespace);
  const nameBytes = utf8Bytes(name);
  const input = new Uint8Array(nsBytes.length + nameBytes.length);
  input.set(nsBytes, 0);
  input.set(nameBytes, nsBytes.length);

  const hash = sha1(input);
  const out = hash.slice(0, 16);
  out[6] = (out[6] & 0x0f) | 0x50; // version 5
  out[8] = (out[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuidString(out);
}

/**
 * Deterministic per-user IAP account token (a lowercase RFC 4122 v5 UUID).
 *
 * Stable for a given userId across processes and platforms. Returns null for an
 * empty / missing userId so callers never attach a meaningless token (which
 * would then mismatch on the server).
 */
export function deriveIapAccountToken(userId: string | null | undefined): string | null {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) return null;
  return uuidV5(normalized, IAP_ACCOUNT_TOKEN_NAMESPACE);
}

/**
 * Android `obfuscatedAccountIdAndroid`. Reuses the same per-user UUID so both
 * stores carry the same value (Play accepts up to 64 url-safe chars; a UUID
 * fits). Kept as a named export so the binding semantics are explicit at the
 * call site even though it currently equals the iOS token.
 */
export function deriveObfuscatedAccountId(userId: string | null | undefined): string | null {
  return deriveIapAccountToken(userId);
}

/**
 * Server-side comparison helper. Decides whether a verified receipt's carried
 * token is consistent with the authed user.
 *
 * Returns:
 *   - "match"     — receipt carries a token AND it equals the expected token.
 *   - "mismatch"  — receipt carries a token AND it does NOT equal expected
 *                   (the only case enforcement may reject on).
 *   - "absent"    — receipt carries NO token (legacy receipts / older clients);
 *                   behavior must be UNCHANGED — NEVER reject these.
 *
 * Comparison is case-insensitive on the UUID hex (stores may echo a different
 * case than we sent) and ignores surrounding whitespace.
 */
export type IapAccountTokenMatch = "match" | "mismatch" | "absent";

export function classifyIapAccountToken(opts: {
  userId: string;
  receiptToken: string | null | undefined;
}): IapAccountTokenMatch {
  const carried = typeof opts.receiptToken === "string" ? opts.receiptToken.trim() : "";
  if (!carried) return "absent";
  const expected = deriveIapAccountToken(opts.userId);
  if (!expected) return "absent";
  return carried.toLowerCase() === expected.toLowerCase() ? "match" : "mismatch";
}
