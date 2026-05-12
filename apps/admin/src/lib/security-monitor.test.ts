import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminFindFirst: vi.fn(),
  auditCreateMany: vi.fn(),
  ipRuleUpsert: vi.fn(),
  dispatchAlert: vi.fn(),
}));

vi.mock("./db", () => ({
  prisma: {
    adminUser: {
      findFirst: (...args: unknown[]) => mocks.adminFindFirst(...args),
    },
    adminAuditLog: {
      createMany: (...args: unknown[]) => mocks.auditCreateMany(...args),
    },
    iPRule: {
      upsert: (...args: unknown[]) => mocks.ipRuleUpsert(...args),
    },
  },
}));

vi.mock("./alert-dispatcher", () => ({
  dispatchAlert: (...args: unknown[]) => mocks.dispatchAlert(...args),
}));

import { trackFailedLogin, trackSuccessfulLogin } from "./security-monitor";

function auditPayload(entityType?: string) {
  const rows = mocks.auditCreateMany.mock.calls.at(-1)?.[0]?.data || [];
  if (entityType) return rows.find((row: any) => row.entityType === entityType) || {};
  return rows[0] || {};
}

describe("security monitor audit persistence", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.adminFindFirst.mockResolvedValue({ id: "system-admin" });
    mocks.auditCreateMany.mockResolvedValue({ count: 1 });
    mocks.ipRuleUpsert.mockResolvedValue({});
    mocks.dispatchAlert.mockResolvedValue(undefined);
  });

  it("redacts credential-stuffing emails, raw IPs, and raw detail text before audit persistence", async () => {
    const ip = "203.0.113.88";

    trackFailedLogin("first@example.com", ip);
    trackFailedLogin("second@example.com", ip);
    trackFailedLogin("third@example.org", ip);

    await vi.waitFor(() => expect(mocks.auditCreateMany).toHaveBeenCalled());
    const payload = auditPayload("CREDENTIAL_STUFFING");
    const serialized = JSON.stringify(payload);
    const changes = JSON.parse(payload.changes);

    expect(payload.action).toBe("SECURITY_ALERT");
    expect(payload.ipAddress).toBe("203.0.113.0");
    expect(changes.metadata).toMatchObject({
      alertType: "CREDENTIAL_STUFFING",
      severity: "CRITICAL",
      maskedIp: "203.0.113.0",
      emailDomainCount: 2,
      reasonCode: "credential_stuffing",
    });
    expect(serialized).not.toContain("first@example.com");
    expect(serialized).not.toContain("second@example.com");
    expect(serialized).not.toContain("third@example.org");
    expect(serialized).not.toContain(ip);
    expect(serialized).not.toContain("tried 3 different emails");
    expect(JSON.stringify(mocks.dispatchAlert.mock.calls)).not.toContain(ip);
  });

  it("redacts multi-IP login details before audit persistence", async () => {
    vi.useFakeTimers();

    trackSuccessfulLogin("multi-ip@example.com", "198.51.100.10", "admin-1");
    trackSuccessfulLogin("multi-ip@example.com", "198.51.100.11", "admin-1");
    trackSuccessfulLogin("multi-ip@example.com", "198.51.100.12", "admin-1");

    await vi.advanceTimersByTimeAsync(2500);
    await vi.waitFor(() => expect(mocks.auditCreateMany).toHaveBeenCalled());

    const payload = auditPayload("MULTI_IP_LOGIN");
    const serialized = JSON.stringify(payload);
    const changes = JSON.parse(payload.changes);

    expect(changes.metadata).toMatchObject({
      alertType: "MULTI_IP_LOGIN",
      severity: "MEDIUM",
      maskedIp: "198.51.100.0",
      ipCount: 3,
      detailLength: expect.any(Number),
    });
    expect(serialized).not.toContain("multi-ip@example.com");
    expect(serialized).not.toContain("198.51.100.10");
    expect(serialized).not.toContain("198.51.100.11");
    expect(serialized).not.toContain("198.51.100.12");
    expect(serialized).not.toContain("logged in from 3 different IPs");

    vi.useRealTimers();
  });
});
