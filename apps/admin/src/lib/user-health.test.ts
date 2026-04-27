import { describe, expect, it } from "vitest";
import { computeUserHealth } from "./user-health";

const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
const longAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

describe("computeUserHealth", () => {
  it("returns rose/Blocked when the account is soft-deleted", () => {
    const h = computeUserHealth({ blocked: true });
    expect(h.tone).toBe("rose");
    expect(h.label).toBe("Blocked");
  });

  it("returns rose/Past due for failed payments", () => {
    const h = computeUserHealth({
      lastLoginAt: yesterday,
      subscriptionStatus: "PAST_DUE",
    });
    expect(h.tone).toBe("rose");
    expect(h.label).toBe("Past due");
  });

  it("returns rose/Canceled for ended subscriptions", () => {
    const h = computeUserHealth({
      lastLoginAt: yesterday,
      subscriptionStatus: "CANCELED",
    });
    expect(h.tone).toBe("rose");
  });

  it("returns rose/Ghost for inactive zero-activity accounts", () => {
    const h = computeUserHealth({
      lastLoginAt: longAgo,
      subscriptionStatus: "ACTIVE",
      addresses: 0,
      services: 0,
    });
    expect(h.tone).toBe("rose");
    expect(h.label).toBe("Ghost");
  });

  it("returns honey/Idle for accounts dormant > 14 days", () => {
    const h = computeUserHealth({
      lastLoginAt: monthAgo,
      subscriptionStatus: "ACTIVE",
      addresses: 2,
    });
    expect(h.tone).toBe("honey");
    expect(h.label).toMatch(/Idle/);
  });

  it("returns honey/New when no login is recorded yet", () => {
    const h = computeUserHealth({ lastLoginAt: null, addresses: 1 });
    expect(h.tone).toBe("honey");
    expect(h.label).toBe("New");
  });

  it("returns sage/Healthy for an active subscription with recent login", () => {
    const h = computeUserHealth({
      lastLoginAt: yesterday,
      subscriptionStatus: "ACTIVE",
      addresses: 3,
    });
    expect(h.tone).toBe("sage");
    expect(h.label).toBe("Healthy");
  });
});
