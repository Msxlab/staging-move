import { describe, it, expect } from "vitest";
import {
  validatePasswordPolicy,
  generateOpaqueToken,
  hashOpaqueToken,
  hashSessionToken,
  generateFingerprint,
  hashPassword,
  verifyPassword,
} from "./user-auth";

describe("validatePasswordPolicy", () => {
  it("rejects too-short passwords", () => {
    expect(validatePasswordPolicy("Sh0rt!")).toMatch(/at least 12/);
  });

  it("requires uppercase", () => {
    expect(validatePasswordPolicy("abcdefgh1234!")).toMatch(/uppercase/);
  });

  it("requires lowercase", () => {
    expect(validatePasswordPolicy("ABCDEFGH1234!")).toMatch(/lowercase/);
  });

  it("requires a digit", () => {
    expect(validatePasswordPolicy("AbcdefghIJKL!")).toMatch(/digit/);
  });

  it("requires a special character", () => {
    expect(validatePasswordPolicy("Abcdefgh1234Z")).toMatch(/special/);
  });

  it("accepts valid password", () => {
    expect(validatePasswordPolicy("Valid-Password-2025!")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validatePasswordPolicy("")).toMatch(/at least 12/);
  });
});

describe("generateOpaqueToken", () => {
  it("produces a URL-safe base64 token of sufficient length", () => {
    const { token } = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("produces a stable sha256 hex hash that matches hashOpaqueToken", () => {
    const { token, hash } = generateOpaqueToken();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hash);
  });

  it("generates unique tokens across invocations", () => {
    const a = generateOpaqueToken().token;
    const b = generateOpaqueToken().token;
    expect(a).not.toBe(b);
  });
});

describe("hashSessionToken", () => {
  it("returns a deterministic 64-char hex sha256", async () => {
    const h1 = await hashSessionToken("abc.def.ghi");
    const h2 = await hashSessionToken("abc.def.ghi");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", async () => {
    const h1 = await hashSessionToken("token-a");
    const h2 = await hashSessionToken("token-b");
    expect(h1).not.toBe(h2);
  });
});

describe("generateFingerprint", () => {
  it("is deterministic for the same userAgent", async () => {
    const a = await generateFingerprint("1.2.3.4", "UA/1.0");
    const b = await generateFingerprint("1.2.3.4", "UA/1.0");
    expect(a).toBe(b);
  });

  it("does not change when ip changes", async () => {
    const a = await generateFingerprint("1.2.3.4", "UA/1.0");
    const b = await generateFingerprint("5.6.7.8", "UA/1.0");
    expect(a).toBe(b);
  });

  it("changes when userAgent changes", async () => {
    const a = await generateFingerprint("1.2.3.4", "UA/1.0");
    const b = await generateFingerprint("1.2.3.4", "UA/2.0");
    expect(a).not.toBe(b);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("Valid-Password-2025!");
    expect(await verifyPassword("Valid-Password-2025!", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Valid-Password-2025!");
    expect(await verifyPassword("Wrong-Password-2025!", hash)).toBe(false);
  });
});
