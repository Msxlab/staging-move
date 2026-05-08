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

  it("redacts service PII and nested metadata before storing changes", async () => {
    const { prisma } = await import("@/lib/db");

    await createAuditLog({
      userId: "user-1",
      action: "UPDATE",
      entityType: "Service",
      entityId: "svc-1",
      changes: {
        accountNumber: "123456789",
        notes: "call me at home",
        metadata: {
          INTERNAL_WEBHOOK_SECRET: "super-secret",
          ok: "safe",
        },
      },
    });

    const call = (prisma.auditLog.create as Mock).mock.calls.at(-1)?.[0];
    const stored = call.data.changes as string;
    expect(stored).not.toContain("123456789");
    expect(stored).not.toContain("call me at home");
    expect(stored).not.toContain("super-secret");
    expect(JSON.parse(stored)).toMatchObject({
      accountNumber: "[REDACTED]",
      notes: "[REDACTED]",
      metadata: {
        INTERNAL_WEBHOOK_SECRET: "[REDACTED]",
        ok: "safe",
      },
    });
  });

  it("redacts address fields before storing changes", async () => {
    const { prisma } = await import("@/lib/db");

    await createAuditLog({
      userId: "user-1",
      action: "UPDATE",
      entityType: "Address",
      entityId: "addr-1",
      changes: {
        street: "123 Main St",
        city: "Austin",
        zip: "78701",
        isPrimary: true,
      },
    });

    const call = (prisma.auditLog.create as Mock).mock.calls.at(-1)?.[0];
    const stored = call.data.changes as string;
    expect(stored).not.toContain("123 Main St");
    expect(stored).not.toContain("Austin");
    expect(stored).not.toContain("78701");
    expect(JSON.parse(stored)).toMatchObject({
      street: "[REDACTED]",
      city: "[REDACTED]",
      zip: "[REDACTED]",
      isPrimary: true,
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
