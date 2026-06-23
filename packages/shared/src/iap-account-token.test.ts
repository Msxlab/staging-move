import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  IAP_ACCOUNT_TOKEN_NAMESPACE,
  classifyIapAccountToken,
  deriveIapAccountToken,
  deriveObfuscatedAccountId,
} from "./iap-account-token";

/**
 * Reference RFC 4122 v5 UUID computed with Node's battle-tested SHA-1. The
 * shared helper ships its own dependency-free SHA-1 so mobile (Hermes, no
 * node:crypto) and server hash IDENTICALLY — these known-answer tests prove
 * the in-house SHA-1 matches the canonical one byte-for-byte.
 */
function referenceUuidV5(name: string): string {
  const nsBytes = Buffer.from(IAP_ACCOUNT_TOKEN_NAMESPACE.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = createHash("sha1").update(Buffer.concat([nsBytes, nameBytes])).digest();
  const out = hash.subarray(0, 16);
  out[6] = (out[6] & 0x0f) | 0x50;
  out[8] = (out[8] & 0x3f) | 0x80;
  const h = out.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

describe("deriveIapAccountToken", () => {
  it("is deterministic for a given userId", () => {
    expect(deriveIapAccountToken("user-1")).toBe(deriveIapAccountToken("user-1"));
  });

  it("produces distinct tokens for distinct users", () => {
    expect(deriveIapAccountToken("user-1")).not.toBe(deriveIapAccountToken("user-2"));
  });

  it("matches a canonical RFC 4122 v5 UUID (in-house SHA-1 == node SHA-1)", () => {
    for (const id of ["user-1", "user-2", "clxabc123", "a-very-long-cuid-style-identifier-0000"]) {
      expect(deriveIapAccountToken(id)).toBe(referenceUuidV5(id));
    }
  });

  it("emits the v5 + RFC variant bits", () => {
    expect(deriveIapAccountToken("user-1")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("trims surrounding whitespace so the same id yields the same token", () => {
    expect(deriveIapAccountToken("  user-1  ")).toBe(deriveIapAccountToken("user-1"));
  });

  it("returns null for empty / missing userId (caller must not attach a token)", () => {
    expect(deriveIapAccountToken("")).toBeNull();
    expect(deriveIapAccountToken("   ")).toBeNull();
    expect(deriveIapAccountToken(null)).toBeNull();
    expect(deriveIapAccountToken(undefined)).toBeNull();
  });

  it("Android obfuscated id equals the iOS token (both stores carry one value)", () => {
    expect(deriveObfuscatedAccountId("user-1")).toBe(deriveIapAccountToken("user-1"));
  });
});

describe("classifyIapAccountToken", () => {
  it("returns 'absent' for a token-less receipt (never blocks)", () => {
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: null })).toBe("absent");
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: "" })).toBe("absent");
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: "   " })).toBe("absent");
  });

  it("returns 'match' when the receipt token was minted for this user", () => {
    const token = deriveIapAccountToken("user-1")!;
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: token })).toBe("match");
  });

  it("matches case-insensitively (stores may echo a different UUID case)", () => {
    const token = deriveIapAccountToken("user-1")!.toUpperCase();
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: token })).toBe("match");
  });

  it("returns 'mismatch' for a token minted for a different account", () => {
    const foreign = deriveIapAccountToken("user-2")!;
    expect(classifyIapAccountToken({ userId: "user-1", receiptToken: foreign })).toBe("mismatch");
  });
});
