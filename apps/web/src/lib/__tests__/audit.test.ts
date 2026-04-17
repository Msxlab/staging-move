import { describe, it, expect, vi, type Mock } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "test-audit-id" }),
    },
  },
}));

import { createAuditLog, extractRequestMeta } from "../audit";

describe("createAuditLog", () => {
  it("should not throw even if prisma fails", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.auditLog.create as Mock).mockRejectedValueOnce(new Error("DB error"));

    await expect(
      createAuditLog({
        userId: "user-1",
        action: "TEST",
        entityType: "Test",
        entityId: "entity-1",
      })
    ).resolves.toBeUndefined();
  });

  it("should call prisma.auditLog.create with correct params", async () => {
    const { prisma } = await import("@/lib/db");

    await createAuditLog({
      userId: "user-1",
      action: "CREATE",
      entityType: "Service",
      entityId: "svc-1",
      changes: { name: "Test" },
      ipAddress: "1.2.3.4",
      userAgent: "TestAgent",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "CREATE",
        entityType: "Service",
        entityId: "svc-1",
        changes: JSON.stringify({ name: "Test" }),
        ipAddress: "1.2.3.4",
        userAgent: "TestAgent",
      }),
    });
  });
});

describe("extractRequestMeta", () => {
  it("should extract IP and user-agent from headers", () => {
    const mockRequest = {
      headers: new Headers({
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        "user-agent": "Mozilla/5.0",
      }),
    } as Request;

    const meta = extractRequestMeta(mockRequest);
    expect(meta.ipAddress).toBe("10.0.0.1");
    expect(meta.userAgent).toBe("Mozilla/5.0");
  });

  it("should return 'unknown' when headers are missing", () => {
    const mockRequest = {
      headers: new Headers({}),
    } as Request;

    const meta = extractRequestMeta(mockRequest);
    expect(meta.ipAddress).toBe("unknown");
    expect(meta.userAgent).toBe("unknown");
  });
});
