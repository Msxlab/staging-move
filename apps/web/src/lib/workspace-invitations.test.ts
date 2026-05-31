import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  seatLimitForPlan,
} from "./workspace-invitations";

describe("invitation tokens", () => {
  it("generates a wsi_ token with a matching hash and last4", () => {
    const { token, tokenHash, tokenLast4 } = generateInvitationToken();
    expect(token.startsWith("wsi_")).toBe(true);
    expect(tokenLast4).toBe(token.slice(-4));
    expect(tokenHash).toBe(hashInvitationToken(token));
    expect(tokenHash).toHaveLength(64); // sha256 hex
  });

  it("hashes deterministically and mints unique tokens", () => {
    expect(hashInvitationToken("wsi_abc")).toBe(hashInvitationToken("wsi_abc"));
    expect(generateInvitationToken().token).not.toBe(generateInvitationToken().token);
  });
});

describe("seatLimitForPlan", () => {
  it("matches the plan ceilings", () => {
    expect(seatLimitForPlan("PRO")).toBe(10);
    expect(seatLimitForPlan("FAMILY")).toBe(6);
    expect(seatLimitForPlan("INDIVIDUAL")).toBe(1);
    expect(seatLimitForPlan("FREE_TRIAL")).toBe(1);
  });
});

describe("invitationExpiry", () => {
  it("is seven days out", () => {
    const now = new Date("2026-05-29T00:00:00.000Z");
    expect(invitationExpiry(now).toISOString()).toBe("2026-06-05T00:00:00.000Z");
  });
});
