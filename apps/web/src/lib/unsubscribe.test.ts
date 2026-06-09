import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;
const ORIGINAL_JWT = process.env.USER_JWT_SECRET;

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "a".repeat(32);
    delete process.env.USER_JWT_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    } else {
      process.env.EMAIL_UNSUBSCRIBE_SECRET = ORIGINAL_SECRET;
    }
    if (ORIGINAL_JWT === undefined) {
      delete process.env.USER_JWT_SECRET;
    } else {
      process.env.USER_JWT_SECRET = ORIGINAL_JWT;
    }
  });

  it("round-trips a userId through sign + verify", async () => {
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("./unsubscribe");
    const token = signUnsubscribeToken("user_123");
    expect(token).toMatch(/^user_123\.[A-Za-z0-9_-]+$/);
    expect(verifyUnsubscribeToken(token)).toBe("user_123");
  });

  it("rejects a tampered signature", async () => {
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("./unsubscribe");
    const token = signUnsubscribeToken("user_123");
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects a token that swaps userId without re-signing", async () => {
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("./unsubscribe");
    const token = signUnsubscribeToken("user_123");
    const sig = token.split(".")[1];
    const swapped = `attacker_999.${sig}`;
    expect(verifyUnsubscribeToken(swapped)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    const { verifyUnsubscribeToken } = await import("./unsubscribe");
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken(undefined)).toBeNull();
    expect(verifyUnsubscribeToken("no-dot-here")).toBeNull();
    expect(verifyUnsubscribeToken(".no-userid")).toBeNull();
    expect(verifyUnsubscribeToken("no-sig.")).toBeNull();
  });

  it("falls back to USER_JWT_SECRET when EMAIL_UNSUBSCRIBE_SECRET is unset", async () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    process.env.USER_JWT_SECRET = "b".repeat(32);
    const mod = await import("./unsubscribe");
    const token = mod.signUnsubscribeToken("user_456");
    expect(mod.verifyUnsubscribeToken(token)).toBe("user_456");
  });

  it("throws when no secret is configured", async () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    delete process.env.USER_JWT_SECRET;
    const { signUnsubscribeToken } = await import("./unsubscribe");
    expect(() => signUnsubscribeToken("user_1")).toThrow();
  });

  it("rejects secrets shorter than 32 characters", async () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "short";
    delete process.env.USER_JWT_SECRET;
    const { signUnsubscribeToken } = await import("./unsubscribe");
    expect(() => signUnsubscribeToken("user_1")).toThrow();
  });
});

describe("unsubscribe URL builder", () => {
  it("includes token and kind, omitting kind when 'all'", async () => {
    const { buildUnsubscribeUrl } = await import("./unsubscribe");
    expect(buildUnsubscribeUrl("https://locateflow.com", "tok.abc")).toBe(
      "https://locateflow.com/unsubscribe?t=tok.abc",
    );
    expect(buildUnsubscribeUrl("https://locateflow.com/", "tok.abc", "all")).toBe(
      "https://locateflow.com/unsubscribe?t=tok.abc",
    );
    expect(buildUnsubscribeUrl("https://locateflow.com", "tok.abc", "marketing")).toBe(
      "https://locateflow.com/unsubscribe?t=tok.abc&k=marketing",
    );
  });
});

describe("notificationTypesForKind", () => {
  it("maps unsubscribe kinds to notification types", async () => {
    const { notificationTypesForKind } = await import("./unsubscribe");
    expect(notificationTypesForKind("marketing")).toEqual(["MARKETING"]);
    expect(notificationTypesForKind("reminder")).toEqual(["REMINDER", "LIFECYCLE"]);
    expect(notificationTypesForKind("all")).toEqual(["MARKETING", "REMINDER", "LIFECYCLE"]);
  });

  it("silences LIFECYCLE via reminder and all (CAN-SPAM: a lifecycle email's own opt-out must stop it)", async () => {
    const { notificationTypesForKind } = await import("./unsubscribe");
    // Lifecycle nudges carry a kind=reminder unsubscribe link, so opting out of
    // reminder — or 'all' (used by the bounce/complaint webhook) — must disable it.
    expect(notificationTypesForKind("reminder")).toContain("LIFECYCLE");
    expect(notificationTypesForKind("all")).toContain("LIFECYCLE");
    expect(notificationTypesForKind("marketing")).not.toContain("LIFECYCLE");
  });
});

describe("parseUnsubscribeKind", () => {
  it("falls back to 'all' for null, undefined, or unknown values", async () => {
    const { parseUnsubscribeKind } = await import("./unsubscribe");
    expect(parseUnsubscribeKind(null)).toBe("all");
    expect(parseUnsubscribeKind(undefined)).toBe("all");
    expect(parseUnsubscribeKind("")).toBe("all");
    expect(parseUnsubscribeKind("invalid")).toBe("all");
    expect(parseUnsubscribeKind("marketing")).toBe("marketing");
    expect(parseUnsubscribeKind("reminder")).toBe("reminder");
  });
});
